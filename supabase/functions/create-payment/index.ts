// create-payment — canonical payment order creation (Paymob card rail).
//
// The browser may send ONLY { product_code, form_id?, submission_id?,
// selected_language? }. Every value that decides what is bought, at what price,
// in which market, through which provider, in which environment, with which
// benefits, is resolved here from trusted server-side state and then frozen by
// the database triggers on public.payment_orders. Nothing in the request body
// can influence it.
//
// selected_language is the buyer's product preference (the output language of
// the generated CV and cover letter), not payment authority. It is required,
// exactly 'en' or 'ar', for products whose version grants generation, written
// in the order INSERT, and immutable afterwards (payment_orders trigger).
//
// This function NEVER performs fulfilment. It does not settle an order, grant
// entitlements, issue an invoice, award coins, create order_generations or
// generate a CV. Payment truth arrives later through the verified webhook,
// then settlement. A browser redirect is not a payment confirmation.
//
// Secrets discipline: the Paymob secret key, the public key, the client secret
// and the caller's JWT are never logged.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY       = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PAYMOB_SECRET_KEY          = Deno.env.get("PAYMOB_SECRET_KEY")          ?? "";
const PAYMOB_PUBLIC_KEY          = Deno.env.get("PAYMOB_PUBLIC_KEY")          ?? "";
const PAYMOB_CARD_INTEGRATION_ID = Deno.env.get("PAYMOB_CARD_INTEGRATION_ID") ?? "";
// Optional. When set to a valid integration id, Unified Checkout also offers
// Mobile Wallet; when unset, empty or invalid, checkout stays Card-only.
const PAYMOB_WALLET_INTEGRATION_ID = Deno.env.get("PAYMOB_WALLET_INTEGRATION_ID") ?? "";

const PAYMOB_INTENTION_URL = "https://accept.paymob.com/v1/intention/";
const PAYMOB_CHECKOUT_URL  = "https://accept.paymob.com/unifiedcheckout/";
const EF_BASE_URL          = `${SUPABASE_URL}/functions/v1`;
const SUCCESS_REDIRECT     = "https://www.resumation.co/success";

// Only the Paymob card rail is implemented here. A market whose active route
// points at any other provider is refused before an order exists, so the
// existing WishMoney path is left completely untouched.
const SUPPORTED_PROVIDER = "paymob";

const ORDER_TTL_MINUTES = 60;
// A pending order is only reused while it still has enough life left for the
// buyer to finish paying.
const REUSE_MARGIN_MS = 2 * 60 * 1000;
const PAYMOB_TIMEOUT_MS = 15_000;
// Provider-side expiry is clamped to a range Paymob accepts. The database
// expires_at remains the authoritative deadline either way.
const PAYMOB_MIN_EXPIRATION_S = 600;
const PAYMOB_MAX_EXPIRATION_S = 3600;

// Only an account with no stored name may carry a server-derived fallback;
// payment_orders_before_insert rejects a fallback whenever a real name exists.
const FALLBACK_FIRST_NAME = "Resumation";
const FALLBACK_LAST_NAME  = "Customer";

const PRODUCT_CODE_RE = /^[a-z][a-z0-9_]{0,63}$/;
const SELECTED_LANGUAGES = ["en", "ar"] as const;
type SelectedLanguage = typeof SELECTED_LANGUAGES[number];
// Benefits whose fulfilment produces language-specific documents. A product
// version granting any of them needs a frozen selected_language.
const GENERATION_BENEFITS = ["cv_generation", "cover_letter_generation"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/**
 * Conservative billing-phone normalisation.
 *
 * The phone is BILLING DATA ONLY — it is never an identity, ownership, region,
 * market, pricing or entitlement signal. No country code is ever guessed or
 * prepended, because that would invent data the user never supplied.
 * Returns null when the value cannot be used as a plausible phone number.
 */
function normalizeBillingPhone(raw: unknown): string | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  const keepPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return keepPlus ? `+${digits}` : digits;
}

/** Paymob's Unified Checkout page, opened with the public key + client secret. */
function checkoutUrl(clientSecret: string): string {
  return `${PAYMOB_CHECKOUT_URL}?publicKey=${encodeURIComponent(PAYMOB_PUBLIC_KEY)}` +
         `&clientSecret=${encodeURIComponent(clientSecret)}`;
}

/**
 * Non-sensitive summary of the payment methods Paymob attached to an intention:
 * integration ids and method/gateway type labels only. Built from whitelisted
 * scalar fields — payment_keys[].key (a payment token), the client secret and
 * any customer or card data are never read or returned.
 */
function summarizeReturnedMethods(data: Record<string, unknown>) {
  const scalar = (v: unknown): string | number | null =>
    typeof v === "number" ? v : typeof v === "string" ? v.slice(0, 64) : null;
  const objects = (v: unknown): Record<string, unknown>[] =>
    Array.isArray(v)
      ? v.filter((x): x is Record<string, unknown> => x !== null && typeof x === "object")
      : [];

  return {
    methods: objects(data["payment_methods"]).map((m) => ({
      integrationId: scalar(m["integration_id"]),
      methodType:    scalar(m["method_type"]),
      name:          scalar(m["name"]),
    })),
    keys: objects(data["payment_keys"]).map((k) => ({
      integrationId: scalar(k["integration"]),
      gatewayType:   scalar(k["gateway_type"]),
    })),
  };
}

/**
 * The Paymob order id, as it will later appear on the transaction callback as
 * obj.order.id. Paymob has returned it under more than one key across API
 * revisions, so every documented location is tried before giving up.
 */
function extractPaymobOrderId(data: Record<string, unknown>): string | null {
  const direct = data["intention_order_id"];
  if (typeof direct === "number" || (typeof direct === "string" && direct.trim())) {
    return String(direct).trim();
  }

  const keys = data["payment_keys"];
  if (Array.isArray(keys)) {
    for (const entry of keys) {
      if (entry && typeof entry === "object") {
        const orderId = (entry as Record<string, unknown>)["order_id"];
        if (typeof orderId === "number" || (typeof orderId === "string" && orderId.trim())) {
          return String(orderId).trim();
        }
      }
    }
  }

  const order = data["order"];
  if (typeof order === "number") return String(order);
  if (order !== null && typeof order === "object") {
    const orderId = (order as Record<string, unknown>)["id"];
    if (typeof orderId === "number" || (typeof orderId === "string" && orderId.trim())) {
      return String(orderId).trim();
    }
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  // ── 1. Authenticate — user_id comes from the verified JWT, never the body ──
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "unauthorized" }, 401);
  }
  const token = authHeader.slice(7);

  const authDb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { user }, error: authErr } = await authDb.auth.getUser(token);
  if (authErr || !user) {
    return json({ error: "unauthorized" }, 401);
  }
  const userId = user.id;

  // ── 2. Provider configuration must be complete — fail closed, never partial ──
  if (!PAYMOB_SECRET_KEY || !PAYMOB_PUBLIC_KEY || !PAYMOB_CARD_INTEGRATION_ID) {
    console.error("create-payment: Paymob configuration incomplete — rejecting");
    return json({ error: "payment_not_configured" }, 503);
  }
  const cardIntegrationId = Number(PAYMOB_CARD_INTEGRATION_ID);
  if (!Number.isInteger(cardIntegrationId) || cardIntegrationId <= 0) {
    console.error("create-payment: PAYMOB_CARD_INTEGRATION_ID is not a valid integer — rejecting");
    return json({ error: "payment_not_configured" }, 503);
  }

  // Wallet is OPTIONAL and never blocks Card. A missing value is a legitimate
  // Card-only configuration; a present-but-unusable value is logged and skipped.
  const walletRaw = PAYMOB_WALLET_INTEGRATION_ID.trim();
  const walletCandidate = Number(walletRaw);
  const walletIntegrationId =
    walletRaw.length > 0 &&
    Number.isInteger(walletCandidate) &&
    walletCandidate > 0 &&
    walletCandidate !== cardIntegrationId
      ? walletCandidate
      : null;
  if (walletRaw.length > 0 && walletIntegrationId === null) {
    console.error("create-payment: PAYMOB_WALLET_INTEGRATION_ID is not a usable integration id — continuing Card-only");
  }

  try {
    // ── 3. Request contract — exactly four accepted fields ────────────────────
    let body: Record<string, unknown>;
    try {
      const parsed = await req.json();
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("payload is not an object");
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return json({ error: "invalid_payload" }, 400);
    }

    const productCode = typeof body["product_code"] === "string"
      ? (body["product_code"] as string).trim()
      : "";
    if (!PRODUCT_CODE_RE.test(productCode)) {
      return json({ error: "invalid_product_code" }, 400);
    }

    const rawFormId = typeof body["form_id"] === "string" ? (body["form_id"] as string).trim() : "";
    const rawSubmissionId = typeof body["submission_id"] === "string"
      ? (body["submission_id"] as string).trim()
      : "";

    if (rawFormId && !UUID_RE.test(rawFormId)) {
      return json({ error: "invalid_form_id" }, 400);
    }
    if (!rawFormId && !rawSubmissionId) {
      return json({ error: "form_id_or_submission_id_required" }, 400);
    }

    // Exact match only: no trimming, case folding or default. Absent (or null)
    // is checked against the product below; any other value is refused here.
    const rawLanguage = body["selected_language"];
    let selectedLanguage: SelectedLanguage | null = null;
    if (rawLanguage !== undefined && rawLanguage !== null) {
      if (!SELECTED_LANGUAGES.includes(rawLanguage as SelectedLanguage)) {
        return json({ error: "invalid_selected_language" }, 400);
      }
      selectedLanguage = rawLanguage as SelectedLanguage;
    }

    // SECURITY: amount, currency, price, discount, market, provider, region,
    // product version, benefits, entitlements, provider references, callback
    // URLs and payment environment are deliberately NOT read from the body.
    // They are resolved below from server state only. Never reintroduce them.

    const db = createClient(SUPABASE_URL, SERVICE_KEY);

    // ── 4. Trusted buyer state ────────────────────────────────────────────────
    const { data: buyer, error: buyerErr } = await db
      .from("users")
      .select("region, region_status, first_name, last_name, username")
      .eq("id", userId)
      .maybeSingle();

    if (buyerErr) {
      console.error("create-payment: buyer lookup failed", { userId, code: buyerErr.code });
      return json({ error: "server_error" }, 500);
    }
    if (!buyer) {
      return json({ error: "account_not_found" }, 404);
    }

    const region = typeof buyer.region === "string" ? buyer.region : "";
    const regionStatus = typeof buyer.region_status === "string" ? buyer.region_status : "";

    // ── 5. Region must be server-verified. `unverified` may be legacy
    // client-authored data, so it can never buy. This mirrors the database
    // CHECK payment_orders_region_status_trusted.
    if (!/^[A-Z]{2}$/.test(region) || (regionStatus !== "verified" && regionStatus !== "flagged")) {
      console.error("create-payment: region not trusted", { userId, regionStatus, hasRegion: !!region });
      return json({ error: "region_not_verified" }, 403);
    }

    // ── 6. Market — resolved exactly as payment_orders_before_insert does ─────
    const { data: mapping, error: mappingErr } = await db
      .from("market_countries")
      .select("market")
      .eq("country_iso2", region)
      .maybeSingle();

    if (mappingErr) {
      console.error("create-payment: market mapping lookup failed", { code: mappingErr.code });
      return json({ error: "server_error" }, 500);
    }

    let market = mapping?.market as string | undefined;
    if (!market) {
      const { data: defaultMarket, error: defaultErr } = await db
        .from("payment_markets")
        .select("market")
        .eq("is_default", true)
        .maybeSingle();

      if (defaultErr) {
        console.error("create-payment: default market lookup failed", { code: defaultErr.code });
        return json({ error: "server_error" }, 500);
      }
      market = defaultMarket?.market as string | undefined;
    }

    if (!market) {
      console.error("create-payment: no market for region", { region });
      return json({ error: "market_unavailable" }, 409);
    }

    // ── 7. Route — the single authority for provider, price and currency ─────
    const { data: routes, error: routeErr } = await db
      .from("payment_routes")
      .select("id, market, product, provider, amount_cents, currency, coins_to_grant, creates_generation, product_version_id")
      .eq("market", market)
      .eq("product", productCode)
      .eq("active", true);

    if (routeErr) {
      console.error("create-payment: route lookup failed", { code: routeErr.code });
      return json({ error: "server_error" }, 500);
    }
    if (!routes || routes.length === 0) {
      return json({ error: "product_unavailable_in_market" }, 409);
    }
    if (routes.length > 1) {
      // Two active routes for one market+product is a configuration fault, not
      // a decision this function is allowed to make on the buyer's behalf.
      console.error("create-payment: ambiguous active routes", { market, productCode, count: routes.length });
      return json({ error: "route_ambiguous" }, 409);
    }
    const route = routes[0];

    // Only the Paymob card rail is implemented here. Anything else is refused
    // BEFORE an order row exists, so no unpayable order is ever created.
    if (route.provider !== SUPPORTED_PROVIDER) {
      console.error("create-payment: route provider not handled by this function", {
        market, productCode, provider: route.provider,
      });
      return json({ error: "provider_not_supported" }, 409);
    }

    // ── 7b. Output language — required exactly when the product generates ────
    // Whether a language is needed is decided by the route's product version
    // (server configuration), never by the caller.
    const { data: generationBenefits, error: benefitErr } = await db
      .from("product_version_benefits")
      .select("benefit_type")
      .eq("product_version_id", route.product_version_id)
      .in("benefit_type", GENERATION_BENEFITS);

    if (benefitErr) {
      console.error("create-payment: product benefit lookup failed", { code: benefitErr.code });
      return json({ error: "server_error" }, 500);
    }

    const requiresLanguage = (generationBenefits?.length ?? 0) > 0;
    if (requiresLanguage && selectedLanguage === null) {
      return json({ error: "selected_language_required" }, 400);
    }
    if (!requiresLanguage && selectedLanguage !== null) {
      return json({ error: "selected_language_not_applicable" }, 400);
    }

    // ── 8. Provider environment — server configuration, never caller choice ──
    const { data: provider, error: providerErr } = await db
      .from("payment_providers")
      .select("provider, environment, active")
      .eq("provider", route.provider)
      .eq("active", true)
      .maybeSingle();

    if (providerErr) {
      console.error("create-payment: provider lookup failed", { code: providerErr.code });
      return json({ error: "server_error" }, 500);
    }
    if (!provider) {
      return json({ error: "provider_unavailable" }, 409);
    }
    const paymentEnvironment = provider.environment as string;

    // ── 9. Customer snapshot — trusted identity at creation time ─────────────
    const { data: authEmail, error: emailErr } = await db
      .rpc("payment_customer_auth_email", { p_user_id: userId });

    if (emailErr) {
      console.error("create-payment: auth email lookup failed", { code: emailErr.code });
      return json({ error: "server_error" }, 500);
    }
    const customerEmail = typeof authEmail === "string" ? authEmail.trim() : "";
    if (!customerEmail) {
      return json({ error: "account_email_missing" }, 409);
    }

    const storedFirst = typeof buyer.first_name === "string" ? buyer.first_name.trim() : "";
    const storedLast  = typeof buyer.last_name === "string" ? buyer.last_name.trim() : "";
    const customerFirstName = storedFirst || FALLBACK_FIRST_NAME;
    const customerLastName  = storedLast || FALLBACK_LAST_NAME;
    const customerUsername  = typeof buyer.username === "string" ? buyer.username : null;

    // ── 10. The exact owned form, and its billing phone ──────────────────────
    // Ownership is established by user_id here and re-verified independently by
    // payment_orders_before_insert. The phone is read from this row for Paymob
    // billing only — it grants nothing and proves nothing.
    const archiveQuery = db
      .from("cv_archive")
      .select("form_id, submission_id, phone_number, cv_phone_number")
      .eq("user_id", userId);

    const { data: archiveRow, error: archiveErr } = rawFormId
      ? await archiveQuery.eq("form_id", rawFormId).maybeSingle()
      : await archiveQuery
          .eq("submission_id", rawSubmissionId)
          .order("created_at_utc", { ascending: false })
          .limit(1)
          .maybeSingle();

    if (archiveErr) {
      console.error("create-payment: form lookup failed", { code: archiveErr.code });
      return json({ error: "server_error" }, 500);
    }
    if (!archiveRow) {
      return json({ error: "form_not_found" }, 404);
    }

    // Both identifiers come from the same owned row, so the pair the insert
    // trigger re-checks is guaranteed to be self-consistent.
    const formId = archiveRow.form_id as string;
    const submissionId = (archiveRow.submission_id as string | null) ?? null;

    const billingPhone = normalizeBillingPhone(archiveRow.phone_number)
                      ?? normalizeBillingPhone(archiveRow.cv_phone_number);
    if (!billingPhone) {
      console.error("create-payment: no usable billing phone on form", { userId });
      return json({ error: "billing_phone_missing" }, 409);
    }

    // ── 11. Reuse a compatible pending order before creating another ─────────
    const reuseCutoff = new Date(Date.now() + REUSE_MARGIN_MS).toISOString();
    let existingFilter = db
      .from("payment_orders")
      .select("id, expires_at, provider_checkout_ref, provider_order_ref")
      .eq("user_id", userId)
      .eq("product", productCode)
      .eq("route_id", route.id)
      .eq("status", "pending")
      .eq("form_id", formId)
      .gt("expires_at", reuseCutoff);

    existingFilter = submissionId === null
      ? existingFilter.is("submission_id", null)
      : existingFilter.eq("submission_id", submissionId);

    // Language is part of compatibility: an 'en' order is never reused for an
    // 'ar' request or vice versa. Pre-Step-3A pending orders carry NULL, never
    // match a language request, and are left untouched (the column is
    // immutable); a new order is created instead.
    existingFilter = selectedLanguage === null
      ? existingFilter.is("selected_language", null)
      : existingFilter.eq("selected_language", selectedLanguage);

    const { data: existingOrder, error: existingErr } = await existingFilter
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingErr) {
      console.error("create-payment: pending order lookup failed", { code: existingErr.code });
      return json({ error: "server_error" }, 500);
    }

    if (existingOrder?.provider_checkout_ref) {
      // A duplicate click. The intention already exists at Paymob; re-opening
      // the same checkout is correct and creates nothing.
      console.log("create-payment: reusing existing checkout", { orderId: existingOrder.id });
      return json({
        order_id: existingOrder.id,
        checkout_url: checkoutUrl(existingOrder.provider_checkout_ref as string),
        expires_at: existingOrder.expires_at,
      }, 200);
    }

    if (existingOrder?.provider_order_ref) {
      // provider_order_ref is set-once. Asking Paymob for a new intention would
      // yield a different order id and the update would be rejected, so this
      // order cannot be advanced. Refuse rather than corrupt the reference.
      console.error("create-payment: pending order has an unusable provider state", {
        orderId: existingOrder.id,
      });
      return json({ error: "order_not_resumable" }, 409);
    }

    // ── 12. Create or resume the canonical order ─────────────────────────────
    let orderId: string;
    let orderExpiresAt: string;
    let isResumedOrder: boolean;

    if (existingOrder) {
      // A previous attempt inserted the order but never attached an intention.
      orderId = existingOrder.id as string;
      orderExpiresAt = existingOrder.expires_at as string;
      isResumedOrder = true;
    } else {
      const expiresAt = new Date(Date.now() + ORDER_TTL_MINUTES * 60_000).toISOString();

      // product_version_id and benefits_snapshot are deliberately NOT sent:
      // payment_orders_before_insert derives and freezes both from the route's
      // active product version. status and discount_applied use their defaults.
      const { data: inserted, error: insertErr } = await db
        .from("payment_orders")
        .insert({
          user_id: userId,
          product: route.product,
          form_id: formId,
          submission_id: submissionId,
          market: route.market,
          provider: route.provider,
          route_id: route.id,
          region_snapshot: region,
          region_status_snapshot: regionStatus,
          amount_cents: route.amount_cents,
          currency: route.currency,
          coins_to_grant: route.coins_to_grant,
          creates_generation: route.creates_generation,
          expires_at: expiresAt,
          payment_environment: paymentEnvironment,
          customer_email_snapshot: customerEmail,
          customer_first_name_snapshot: customerFirstName,
          customer_last_name_snapshot: customerLastName,
          customer_username_snapshot: customerUsername,
          selected_language: selectedLanguage,
        })
        .select("id, expires_at")
        .single();

      if (insertErr || !inserted) {
        // The insert trigger is the final authority; its refusals are
        // configuration or eligibility facts, not client errors to explain.
        console.error("create-payment: order insert rejected", {
          userId, market, productCode, code: insertErr?.code,
        });
        return json({ error: "order_rejected" }, 409);
      }

      orderId = inserted.id as string;
      orderExpiresAt = inserted.expires_at as string;
      isResumedOrder = false;
    }

    // ── 13. Paymob intention — built only from frozen/server values ──────────
    const expirationSeconds = Math.min(
      PAYMOB_MAX_EXPIRATION_S,
      Math.max(
        PAYMOB_MIN_EXPIRATION_S,
        Math.floor((new Date(orderExpiresAt).getTime() - Date.now()) / 1000),
      ),
    );

    // Paymob requires special_reference to be unique per merchant. A resumed
    // order may already have burned the plain reference on a failed attempt,
    // so it gets a suffixed one. extras.payment_order_id always carries the
    // unchanged canonical order id for correlation.
    const specialReference = isResumedOrder
      ? `${orderId}-r${Date.now().toString(36)}`
      : orderId;

    const intentionBody = {
      amount: route.amount_cents,
      currency: route.currency,
      payment_methods: walletIntegrationId !== null
        ? [cardIntegrationId, walletIntegrationId]
        : [cardIntegrationId],
      billing_data: {
        first_name: customerFirstName,
        last_name: customerLastName,
        email: customerEmail,
        phone_number: billingPhone,
        street: "NA",
        building: "NA",
        floor: "NA",
        apartment: "NA",
        city: "NA",
        state: "NA",
        country: "NA",
        postal_code: "NA",
      },
      special_reference: specialReference,
      notification_url: `${EF_BASE_URL}/webhook-paymob`,
      redirection_url: `${SUCCESS_REDIRECT}?order=${encodeURIComponent(orderId)}`,
      expiration: expirationSeconds,
      extras: { payment_order_id: orderId },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PAYMOB_TIMEOUT_MS);

    let paymobRes: Response;
    try {
      paymobRes = await fetch(PAYMOB_INTENTION_URL, {
        method: "POST",
        headers: {
          // Never logged, never echoed back to the caller.
          "Authorization": `Token ${PAYMOB_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(intentionBody),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchErr: unknown) {
      clearTimeout(timeoutId);
      const isTimeout = (fetchErr as { name?: string })?.name === "AbortError";
      console.error("create-payment: Paymob intention request failed", {
        orderId, timeout: isTimeout,
      });
      // The order stays pending with no provider reference — recoverable.
      return json({ error: "provider_unreachable" }, 502);
    }

    const paymobData = await paymobRes.json().catch(() => ({})) as Record<string, unknown>;

    if (!paymobRes.ok) {
      // Log the shape of the failure, never the payload: it echoes billing data.
      console.error("create-payment: Paymob rejected the intention", {
        orderId,
        status: paymobRes.status,
        fields: Object.keys(paymobData).slice(0, 10),
        detail: typeof paymobData["detail"] === "string" ? paymobData["detail"] : null,
      });
      return json({ error: "provider_rejected" }, 502);
    }

    // Diagnostic only: which methods were requested vs. which Paymob attached.
    // Makes a silently dropped Wallet visible. Integration ids and type labels
    // only — no client secret, payment key, customer or card data.
    const returned = summarizeReturnedMethods(paymobData);
    console.log("create-payment: intention payment methods", {
      orderId,
      requestedIntegrationIds: intentionBody.payment_methods,
      returnedMethods: returned.methods,
      returnedKeys: returned.keys,
    });

    const clientSecret = typeof paymobData["client_secret"] === "string"
      ? (paymobData["client_secret"] as string).trim()
      : "";
    const paymobOrderId = extractPaymobOrderId(paymobData);

    if (!clientSecret || !paymobOrderId) {
      // Without both, the checkout cannot be opened or later correlated to the
      // webhook callback. Nothing is written; the order remains pending.
      console.error("create-payment: Paymob response missing required references", {
        orderId,
        hasClientSecret: !!clientSecret,
        hasOrderRef: !!paymobOrderId,
      });
      return json({ error: "provider_reference_missing" }, 502);
    }

    // ── 14. Attach the provider references — one atomic, set-once write ──────
    // provider_checkout_ref  = the Unified Checkout session reference
    //                          (client_secret), the value that re-opens THIS
    //                          checkout. It is never a transaction id.
    // provider_order_ref     = the Paymob order id, i.e. exactly the value the
    //                          transaction callback carries as obj.order.id,
    //                          which is how the webhook and settlement will
    //                          find this order.
    // provider_transaction_ref is deliberately untouched: the database only
    //                          permits it on a paid order, at settlement.
    const { error: refErr } = await db
      .from("payment_orders")
      .update({
        provider_checkout_ref: clientSecret,
        provider_order_ref: paymobOrderId,
      })
      .eq("id", orderId)
      .eq("status", "pending")
      .is("provider_checkout_ref", null)
      .is("provider_order_ref", null);

    if (refErr) {
      console.error("create-payment: storing provider references failed", {
        orderId, code: refErr.code,
      });
      return json({ error: "server_error" }, 500);
    }

    console.log("create-payment: intention created", {
      orderId,
      market,
      product: productCode,
      provider: route.provider,
      environment: paymentEnvironment,
      providerOrderRef: paymobOrderId,
      resumed: isResumedOrder,
    });

    // ── 15. Minimal frontend contract — no price, benefits or entitlements ───
    return json({
      order_id: orderId,
      checkout_url: checkoutUrl(clientSecret),
      expires_at: orderExpiresAt,
    }, 200);

  } catch (err) {
    console.error("create-payment: unhandled error", { message: String(err) });
    return json({ error: "server_error" }, 500);
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY       = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WISHMONEY_CHANNEL = Deno.env.get("WISHMONEY_CHANNEL") ?? "";
const WISHMONEY_SECRET  = Deno.env.get("WISHMONEY_SECRET")  ?? "";
const _WM_BASE          = (Deno.env.get("WISHMONEY_API_URL") ?? "https://api.sandbox.whish.money/itel-service/api").replace(/\/+$/, "");
const WISHMONEY_API     = _WM_BASE.endsWith("/payment/whish") ? _WM_BASE : `${_WM_BASE}/payment/whish`;
const EF_BASE_URL       = `${SUPABASE_URL}/functions/v1`;

const PAYMOB_LINKS: Record<string, string> = {
  premium:   "https://accept.paymobsolutions.com/standalone?ref=p_LRR2cnBxcGFGYUdsY1NDVWtNN3RoWlpyUT09X0JLM1lxbFRXQWxVcG1zOWRHVWRYaGc9PQ",
  gold:      "https://accept.paymobsolutions.com/standalone?ref=p_LRR2cUU0S3F4cGhub3gwSllBL1hiZGpxZz09X2JWM3ZDVlE3Yys1RUdGUGpmUGkzM0E9PQ",
  ai_search: Deno.env.get("PAYMOB_AI_SEARCH_LINK") ?? "",
};

// ══════════════════════════════════════════════════════════════════════════════
// WISHMONEY SERVER-SIDE PRICING — SINGLE SOURCE OF TRUTH
//
// The client MUST NOT be able to choose what it pays. Everything below is
// computed here, from the authenticated user's own database state — never from
// the request body. `amount`, `currency`, `has_referral` and `coins` sent by the
// browser are ignored entirely.
//
// SCOPE: WishMoney is the Lebanon rail only (PlansPage sends payment_method
// "whish" when the user is NOT in Egypt). These are the Lebanon USD prices as
// currently displayed in src/components/PlansPage.tsx:123 — they are copied
// verbatim, not re-derived. Egypt/Paymob pricing is untouched by this block.
//
// ⚠ KEEP IN SYNC with the identical block in
//   supabase/functions/webhook-wishmoney/index.ts
// ══════════════════════════════════════════════════════════════════════════════
const WISHMONEY_PLANS = ["premium", "gold", "ai_search"] as const;
type WishMoneyPlan = (typeof WISHMONEY_PLANS)[number];

const WISHMONEY_CURRENCY = "USD";

// Lebanon list prices — mirrors PlansPage.tsx:123 (the non-Egypt BASE branch).
const WISHMONEY_PRICES: Record<WishMoneyPlan, number> = {
  premium:   25,
  gold:      40,
  ai_search: 10,
};

// Referral rule — mirrors PlansPage.tsx:126-127:
// a referred user gets 50% off, except on ai_search (which gets 2x coins instead).
const REFERRAL_DISCOUNT_EXEMPT: readonly WishMoneyPlan[] = ["ai_search"];

function isWishMoneyPlan(value: unknown): value is WishMoneyPlan {
  return typeof value === "string" &&
    (WISHMONEY_PLANS as readonly string[]).includes(value);
}

/** Canonical price for a plan. `hasReferral` comes from the DB, never from the client. */
function wishMoneyPrice(plan: WishMoneyPlan, hasReferral: boolean): number {
  const base = WISHMONEY_PRICES[plan];
  return hasReferral && !REFERRAL_DISCOUNT_EXEMPT.includes(plan) ? base / 2 : base;
}

/**
 * Canonical string form of an amount. Both the signature and the WishMoney API
 * call use this exact representation so the webhook can reproduce it byte-for-byte.
 */
function wishMoneyAmountString(amount: number): string {
  return String(amount);
}

/**
 * The message signed by the per-transaction webhook token.
 * Covering plan + amount + currency (not just tid:fid) means a tampered
 * callback URL can no longer produce a valid signature.
 *
 * ⚠ KEEP IN SYNC with webhook-wishmoney/index.ts
 */
function wishMoneySignaturePayload(parts: {
  tid: string;
  fid: string;
  plan: string;
  amount: string;
  currency: string;
}): string {
  return `${parts.tid}:${parts.fid}:${parts.plan}:${parts.amount}:${parts.currency}`;
}

// ── HMAC-SHA256 utility (Deno Web Crypto API) ─────────────────────────────────
// Produces a lowercase hex digest of HMAC-SHA256(secret, message).
// Used to mint per-transaction webhook tokens embedded in WishMoney callback URLs.
async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // ── JWT verification — user_id always from server-side auth, never from body ──
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing authorization header" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const token = authHeader.slice(7);

  const authDb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { user }, error: authErr } = await authDb.auth.getUser(token);
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const user_id = user.id;

  try {
    const body = await req.json();
    const {
      form_id:       bodyFormId,
      submission_id: rawSub,
      payment_method,
      plan      = "premium",
      email     = "",
    } = body;

    // SECURITY: `amount`, `currency`, `has_referral` and `coins` are deliberately
    // NOT destructured from the request body. They are still sent by PlansPage
    // but are ignored — the WishMoney branch below computes price and currency
    // server-side. Never reintroduce them here.

    const normalizedMethod = payment_method?.toLowerCase() ?? "";

    console.log("create-cv-order: received", {
      hasFormId:     !!bodyFormId,
      formIdLen:     String(bodyFormId ?? "").length,
      hasSubId:      !!rawSub,
      paymentMethod: normalizedMethod,
      plan,
      userId:        user_id,
    });

    if (!bodyFormId && !rawSub) {
      console.error("create-cv-order 400: missing ids", {
        bodyFormId: String(bodyFormId ?? ""),
        rawSub:     String(rawSub ?? ""),
      });
      return new Response(
        JSON.stringify({ error: "form_id or submission_id required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    if (normalizedMethod !== "whish" && normalizedMethod !== "wishmoney" && normalizedMethod !== "paymob") {
      console.error("create-cv-order 400: invalid payment_method", {
        normalizedMethod,
        raw: payment_method,
      });
      return new Response(
        JSON.stringify({ error: "payment_method must be 'whish', 'wishmoney', or 'paymob'" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ── Read-only snapshot from cv_archive — verify the form exists and belongs to this user ──
    // This is the ONLY database operation in this function. No writes occur anywhere below.
    const db = createClient(SUPABASE_URL, SERVICE_KEY);

    const q = db
      .from("cv_archive")
      .select("form_id, submission_id, user_id")
      .eq("user_id", user_id);

    const { data: archiveRow, error: archErr } = bodyFormId
      ? await q.eq("form_id", bodyFormId).maybeSingle()
      : await q
          .eq("submission_id", rawSub)
          .order("created_at_utc", { ascending: false })
          .limit(1)
          .maybeSingle();

    if (archErr || !archiveRow) {
      return new Response(
        JSON.stringify({ error: "cv_archive row not found or access denied" }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const form_id       = archiveRow.form_id as string;
    const submission_id = (archiveRow.submission_id as string) || rawSub || "";

    // ════════════════════════════════════════════════════════════════════════════
    // WISHMONEY PATH — Lebanon
    // Completely stateless: call WishMoney API, return collectUrl.
    // Connection tokens passed in callback URL so webhook can mint generation_id
    // after confirmed payment. No database row is created here.
    // ════════════════════════════════════════════════════════════════════════════
    if (normalizedMethod === "whish" || normalizedMethod === "wishmoney") {
      if (!WISHMONEY_SECRET) {
        console.error("create-cv-order: WISHMONEY_SECRET is not configured");
        return new Response(
          JSON.stringify({ error: "Payment gateway not configured" }),
          { status: 503, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }

      // ── Plan whitelist ────────────────────────────────────────────────────────
      // Only these three plans are purchasable over the WishMoney rail. Anything
      // else is rejected before a payment order can be created.
      if (!isWishMoneyPlan(plan)) {
        console.error("create-cv-order 400: plan not sellable via WishMoney", {
          plan: String(plan ?? ""),
          userId: user_id,
        });
        return new Response(
          JSON.stringify({ error: "Invalid plan" }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
      const wmPlan: WishMoneyPlan = plan;

      // ── Server-side price resolution ──────────────────────────────────────────
      // Referral eligibility is read from public.users for the JWT-verified user,
      // exactly as PlansPage derives it (`!!userData.referred_by`). The client's
      // own has_referral flag is never consulted.
      const { data: buyerRow, error: buyerErr } = await db
        .from("users")
        .select("referred_by")
        .eq("id", user_id)
        .maybeSingle();

      if (buyerErr) {
        console.error("create-cv-order: referral lookup failed", buyerErr);
        return new Response(
          JSON.stringify({ error: "Could not resolve pricing. Please try again." }),
          { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }

      const hasReferral = !!buyerRow?.referred_by;
      const wmAmount    = wishMoneyAmountString(wishMoneyPrice(wmPlan, hasReferral));
      const wmCurrency  = WISHMONEY_CURRENCY;

      console.log("create-cv-order: server-side price resolved", {
        plan: wmPlan, amount: wmAmount, currency: wmCurrency, hasReferral,
      });

      const wmExternalId = Date.now();

      // ── Per-transaction HMAC webhook token ────────────────────────────────────
      // token = HMAC-SHA256(WISHMONEY_SECRET, "tid:fid:plan:amount:currency")
      // Embedded as `wt` in every callback/redirect URL so webhook-wishmoney can
      // verify the request is genuine before touching any database row.
      // The signature now covers the entitlement-bearing fields (plan, amount,
      // currency) as well, so editing any of them in the callback URL invalidates
      // the token. WishMoney echoes the callback URL as-is for both POST callbacks
      // and GET browser redirects, so the same token covers both paths.
      const webhookToken = await hmacSha256Hex(
        WISHMONEY_SECRET,
        wishMoneySignaturePayload({
          tid:      String(wmExternalId),
          fid:      form_id,
          plan:     wmPlan,
          amount:   wmAmount,
          currency: wmCurrency,
        }),
      );

      // Callback URL carries the reference context only — no generation_id yet.
      // webhook-wishmoney uses these params to:
      //   1. verify HMAC token (wt) over tid:fid:plan:amount:currency
      //   2. re-validate plan/amount/currency against its own price table
      //   3. require status === "success"
      //   4. verify idempotency via wishmoney_order_id (= tid)
      //   5. extract cv_archive snapshot via fid
      //   6. INSERT into order_generations and mint generation_id
      //   7. redirect browser to /success?gid=<minted_gid>
      const baseCallback =
        `${EF_BASE_URL}/webhook-wishmoney` +
        `?sid=${encodeURIComponent(submission_id)}` +
        `&fid=${encodeURIComponent(form_id)}` +
        `&tid=${wmExternalId}` +
        `&plan=${encodeURIComponent(wmPlan)}` +
        `&amount=${encodeURIComponent(wmAmount)}` +
        `&currency=${encodeURIComponent(wmCurrency)}` +
        `&wt=${webhookToken}`;

      // 15-second hard timeout — WishMoney sandbox was hanging 60+ seconds causing 502
      const wmController = new AbortController();
      const wmTimeoutId  = setTimeout(() => wmController.abort(), 15_000);

      let wmRes: Response;
      try {
        wmRes = await fetch(WISHMONEY_API, {
          method: "POST",
          headers: {
            "channel":      WISHMONEY_CHANNEL,
            "secret":       WISHMONEY_SECRET,
            "websiteUrl":   "resumation.co",
            "Content-Type": "application/json",
            "User-Agent":   "Whish/1.0 (https://whish.money; support@whish.money)",
          },
          body: JSON.stringify({
            amount:             wmAmount,
            currency:           wmCurrency,
            invoice:            `Resumation ${wmPlan} plan`,
            externalId:         wmExternalId,
            successCallbackUrl: `${baseCallback}&status=success`,
            failureCallbackUrl: `${baseCallback}&status=failed`,
            successRedirectUrl: `${baseCallback}&status=success`,
            failureRedirectUrl: "https://resumation.co/plans",
          }),
          signal: wmController.signal,
        });
        clearTimeout(wmTimeoutId);
      } catch (wmErr: unknown) {
        clearTimeout(wmTimeoutId);
        const isTimeout = (wmErr as { name?: string })?.name === "AbortError";
        const msg = isTimeout
          ? "WishMoney API timed out (15s) — Supabase IP may not be whitelisted on WishMoney sandbox"
          : `WishMoney fetch error: ${String(wmErr)}`;
        console.error("create-cv-order WishMoney error:", msg, "| api_url:", WISHMONEY_API);
        return new Response(
          JSON.stringify({ error: msg }),
          { status: 502, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      const wmData    = await wmRes.json().catch(() => ({}));

      // Temporary diagnostic log: shows the full successful WishMoney API response
      // so we can identify whether WishMoney returns its own invoice/reference number
      // such as the "Payment To Guest XXXXXXXX" value shown on the hosted page.
      console.log("WishMoney success response:", JSON.stringify(wmData, null, 2));

      const collectUrl: string =
        wmData?.data?.collectUrl ||
        wmData?.collectUrl       ||
        wmData?.url              ||
        wmData?.paymentUrl       || "";

      if (collectUrl) {
        return new Response(
          JSON.stringify({ url: collectUrl }),
          { headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      console.error("WishMoney bad response (status", wmRes.status, "):", JSON.stringify(wmData));
      return new Response(
        JSON.stringify({ error: "Failed to create WishMoney order", details: wmData }),
        { status: 502, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ════════════════════════════════════════════════════════════════════════════
    // PAYMOB PATH — Egypt
    // Stateless: verify form exists, return the standalone link + reference context.
    // confirm-payment is the INSERT engine for Paymob (receives generation data
    // after the user's browser returns from the gateway).
    // ════════════════════════════════════════════════════════════════════════════
    if (normalizedMethod === "paymob") {
      const paymobLink = PAYMOB_LINKS[plan] ?? "";
      if (!paymobLink) {
        return new Response(
          JSON.stringify({ error: `No Paymob link configured for plan: ${plan}` }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          url:          paymobLink,
          form_id,
          submission_id,
          plan,
        }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unhandled payment_method" }),
      { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("create-cv-order error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});

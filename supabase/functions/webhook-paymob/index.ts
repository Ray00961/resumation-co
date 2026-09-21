// Paymob transaction callback — verify, then settle.
//
// Two boundaries, in this order and never the other way round:
//
//   1. AUTHENTICITY — the HMAC below. Nothing downstream runs until the
//      digest matches. The implementation and field ordering are preserved
//      byte-for-byte from the verify-only version; they are not weakened.
//   2. BUSINESS TRUTH — public.settle_payment_order, called exactly once with
//      the provider's SIGNED facts. That function owns the entire atomic
//      settlement: payment evidence, entitlements, invoice and fulfilment
//      commit together or not at all.
//
// This file therefore grants no entitlement, issues no invoice, awards no
// coins, creates no generation and updates no user or profile. It transports
// verified facts and maps outcomes to HTTP status codes.
//
// Correlation uses the signed obj.order.id only. merchant_order_id, extras,
// body.type, query parameters other than the digest, and anything from a
// browser are never treated as settlement authority.
//
// Deployment note: Paymob posts server-to-server and cannot present a user JWT,
// so this function must stay deployed with verify_jwt = false (now pinned in
// supabase/config.toml). Authenticity comes from the HMAC below, never a JWT.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PAYMOB_HMAC        = Deno.env.get("PAYMOB_HMAC") ?? "";
const PAYMOB_ENVIRONMENT = (Deno.env.get("PAYMOB_ENVIRONMENT") ?? "").trim();
const SUPABASE_URL       = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY        = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// The integrations this deployment is allowed to settle for. Built once at
// module load from trusted server configuration — never from the payload.
const ALLOWED_INTEGRATION_IDS = new Set(
  [
    Deno.env.get("PAYMOB_CARD_INTEGRATION_ID"),
    Deno.env.get("PAYMOB_WALLET_INTEGRATION_ID"),
  ]
    .map((value) => (value ?? "").trim())
    .filter((value) => value.length > 0),
);

// Environment is a deployment fact. Only these two exact values are accepted.
const VALID_ENVIRONMENTS = new Set(["test", "live"]);

// Deterministic RPC outcomes. Every one of them is acknowledged with 200,
// because a Paymob retry cannot change any of them. The second set is the
// subset that additionally demands human attention.
const HANDLED_OUTCOMES = new Set([
  "settled",
  "already_settled",
  "ignored_unsuccessful",
  "ignored_pending",
  "ignored_reversal",
]);

const ALERT_OUTCOMES = new Set([
  "inconsistent_settlement",
  "conflict_other_transaction",
  "conflict_transaction_reused",
  "conflict_terminal_status",
  "rejected_amount_mismatch",
  "rejected_currency_mismatch",
  "rejected_environment_mismatch",
  "rejected_integration_mismatch",
  "rejected_provider_mismatch",
  "order_not_found",
]);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function hmacSha512Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Length-independent, value-constant-time comparison of two hex digests.
// Compares lowercased strings; a length mismatch is reported without leaking
// where the difference is.
function timingSafeEqualHex(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) {
    diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  }
  return diff === 0;
}

// Paymob computes the transaction HMAC over these fields, in this exact order,
// concatenated with no separator. Field list and ordering are preserved
// verbatim from the previously deployed webhook-paymob v9 implementation —
// nothing added, removed or reordered.
const HMAC_FIELDS = [
  "amount_cents", "created_at", "currency", "error_occured",
  "has_parent_transaction", "id", "integration_id", "is_3d_secure",
  "is_auth", "is_capture", "is_refunded", "is_standalone_payment",
  "is_voided", "order", "owner", "pending",
  "source_data.pan", "source_data.sub_type", "source_data.type", "success",
] as const;

function buildHmacMessage(obj: Record<string, unknown>): string {
  return HMAC_FIELDS.map((field) => {
    if (field.startsWith("source_data.")) {
      const key = field.split(".")[1];
      const sd = obj["source_data"] as Record<string, unknown> | undefined;
      return String(sd?.[key] ?? "");
    }
    if (field === "order") {
      const order = obj["order"];
      if (order !== null && typeof order === "object") {
        return String((order as Record<string, unknown>)["id"] ?? "");
      }
      return String(order ?? "");
    }
    return String(obj[field] ?? "");
  }).join("");
}

// ── Strict extraction of signed facts ────────────────────────────────────────
// No coercion. A value of an unexpected type becomes null, and the settlement
// RPC treats null as the unsafe value in every direction, so a type surprise
// can only fail closed — never settle by accident.

function signedString(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

function signedBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function signedInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

/** The signed Paymob order id — the ONLY correlation authority. */
function signedOrderId(transaction: Record<string, unknown>): string | null {
  const order = transaction["order"];
  if (order !== null && typeof order === "object") {
    return signedString((order as Record<string, unknown>)["id"]);
  }
  return signedString(order);
}

/** source_data.type / sub_type only. source_data.pan is never read here. */
function signedSourceField(transaction: Record<string, unknown>, key: "type" | "sub_type"): string | null {
  const sd = transaction["source_data"];
  if (sd === null || typeof sd !== "object" || Array.isArray(sd)) return null;
  return signedString((sd as Record<string, unknown>)[key]);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  // FAIL CLOSED: without the secret, authenticity cannot be established.
  // Verification is never skipped.
  if (!PAYMOB_HMAC) {
    console.error("webhook-paymob: PAYMOB_HMAC is not configured — rejecting");
    return json({ error: "webhook_not_configured" }, 503);
  }

  // FAIL CLOSED: settlement configuration must be complete and unambiguous
  // before a single byte of the payload is trusted.
  if (!VALID_ENVIRONMENTS.has(PAYMOB_ENVIRONMENT)) {
    console.error("webhook-paymob: PAYMOB_ENVIRONMENT must be exactly 'test' or 'live' — rejecting");
    return json({ error: "webhook_not_configured" }, 503);
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("webhook-paymob: Supabase service configuration missing — rejecting");
    return json({ error: "webhook_not_configured" }, 503);
  }

  if (ALLOWED_INTEGRATION_IDS.size === 0) {
    console.error("webhook-paymob: no Paymob integration ids configured — rejecting");
    return json({ error: "webhook_not_configured" }, 503);
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("payload is not an object");
    }
    body = parsed as Record<string, unknown>;
  } catch {
    console.error("webhook-paymob: malformed payload — rejecting");
    return json({ error: "invalid_payload" }, 400);
  }

  const obj = body["obj"];
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    console.error("webhook-paymob: missing transaction object — rejecting");
    return json({ error: "invalid_payload" }, 400);
  }
  const transaction = obj as Record<string, unknown>;

  // Paymob sends the digest as the `hmac` query parameter on the processed
  // callback, and includes it in the body on some callback shapes. Accept
  // either location; both are the same digest over the same fields.
  let queryHmac: string | null = null;
  try {
    queryHmac = new URL(req.url).searchParams.get("hmac");
  } catch {
    queryHmac = null;
  }
  const bodyHmac = typeof body["hmac"] === "string" ? (body["hmac"] as string) : null;
  const providedHmac = (queryHmac ?? bodyHmac ?? "").trim();

  // FAIL CLOSED: no digest means the callback is unverifiable.
  if (!providedHmac) {
    console.error("webhook-paymob: missing hmac — rejecting");
    return json({ error: "missing_hmac" }, 401);
  }

  const expectedHmac = await hmacSha512Hex(PAYMOB_HMAC, buildHmacMessage(transaction));

  // FAIL CLOSED: a mismatched digest means the payload is not from Paymob,
  // or was altered in transit.
  if (!timingSafeEqualHex(expectedHmac, providedHmac)) {
    console.error("webhook-paymob: HMAC mismatch — rejecting");
    return json({ error: "invalid_hmac" }, 403);
  }

  // ════════════════════════════════════════════════════════════════════════
  // Verified. Everything below reads ONLY fields covered by that digest.
  // ════════════════════════════════════════════════════════════════════════
  const providerOrderRef = signedOrderId(transaction);
  const transactionRef   = signedString(transaction["id"]);
  const amountCents      = signedInteger(transaction["amount_cents"]);
  const currency         = signedString(transaction["currency"]);
  const success          = signedBoolean(transaction["success"]);
  const pending          = signedBoolean(transaction["pending"]);
  const errorOccured     = signedBoolean(transaction["error_occured"]);
  const isRefunded       = signedBoolean(transaction["is_refunded"]);
  const isVoided         = signedBoolean(transaction["is_voided"]);
  const integrationId    = signedString(transaction["integration_id"]);
  const paymentMethod    = signedSourceField(transaction, "type");
  const paymentSubtype   = signedSourceField(transaction, "sub_type");

  // Log only non-sensitive correlation identifiers: never the secret, the
  // digest, card data (source_data.pan), or the payer's details (owner,
  // billing data).
  console.log("webhook-paymob: verified callback", {
    transactionId: transactionRef,
    orderId: providerOrderRef,
    success,
    pending,
    integrationId,
  });

  // Without both signed references the callback cannot be correlated. This is
  // deterministic — a retry would carry the same payload — so acknowledge and
  // alert rather than invite an endless retry loop.
  if (!providerOrderRef || !transactionRef) {
    console.error("webhook-paymob: verified callback lacks signed correlation references", {
      hasOrderId: !!providerOrderRef,
      hasTransactionId: !!transactionRef,
    });
    return json({ received: true, verified: true }, 200);
  }

  // Integration allow-list — enforced here, where the configuration lives.
  // A callback from an integration this deployment does not serve is
  // acknowledged and never reaches settlement.
  if (!integrationId || !ALLOWED_INTEGRATION_IDS.has(integrationId)) {
    console.error("webhook-paymob: integration id not allowed for this deployment", {
      integrationId,
      orderId: providerOrderRef,
    });
    return json({ received: true, verified: true }, 200);
  }

  // ── The single settlement call ──────────────────────────────────────────
  // Service-role authority. No user JWT is involved in settlement at any
  // point. This is the only call site in the file.
  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data, error } = await db.rpc("settle_payment_order", {
    p_provider:                 "paymob",
    p_provider_order_ref:       providerOrderRef,
    p_provider_transaction_ref: transactionRef,
    p_amount_cents:             amountCents,
    p_currency:                 currency,
    p_success:                  success,
    p_pending:                  pending,
    p_error_occured:            errorOccured,
    p_is_refunded:              isRefunded,
    p_is_voided:                isVoided,
    p_integration_id:           integrationId,
    p_expected_environment:     PAYMOB_ENVIRONMENT,
    p_payment_method:           paymentMethod,
    p_payment_subtype:          paymentSubtype,
  });

  // Transient: the database was unreachable, timed out, or the function
  // raised. Paymob SHOULD retry, so answer 5xx. The RPC is atomic, so a
  // failed attempt left nothing behind.
  if (error) {
    console.error("webhook-paymob: settlement call failed", {
      orderId: providerOrderRef,
      code: error.code ?? null,
      message: error.message ?? null,
    });
    return json({ error: "settlement_unavailable" }, 500);
  }

  const result = (data ?? {}) as Record<string, unknown>;
  const outcome = typeof result["outcome"] === "string" ? (result["outcome"] as string) : null;
  const paymentOrderId = typeof result["payment_order_id"] === "string"
    ? (result["payment_order_id"] as string)
    : null;

  // An outcome this deployment does not recognise means the database and this
  // function are out of step. Treat it as transient rather than silently
  // acknowledging something we cannot reason about.
  if (!outcome || (!HANDLED_OUTCOMES.has(outcome) && !ALERT_OUTCOMES.has(outcome))) {
    console.error("webhook-paymob: unrecognised settlement outcome", {
      orderId: providerOrderRef,
      outcome,
    });
    return json({ error: "settlement_unavailable" }, 500);
  }

  // Deterministic outcome. Acknowledge so Paymob stops retrying; alert on the
  // ones a human must look at.
  if (ALERT_OUTCOMES.has(outcome)) {
    console.error("webhook-paymob: settlement refused", {
      outcome,
      orderId: providerOrderRef,
      transactionId: transactionRef,
      paymentOrderId,
    });
  } else {
    console.log("webhook-paymob: settlement outcome", {
      outcome,
      orderId: providerOrderRef,
      paymentOrderId,
    });
  }

  return json({ received: true, verified: true }, 200);
});

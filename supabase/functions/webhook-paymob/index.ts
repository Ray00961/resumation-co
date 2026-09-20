// Paymob transaction callback — VERIFY ONLY (temporary, pre-settlement).
//
// This replaces the previously deployed webhook (v9), which read the wrong
// secret name (PAYMOB_HMAC_SECRET) and therefore SKIPPED verification whenever
// that variable was unset — it failed open. This version fails closed on every
// path and still performs NO fulfilment of any kind.
//
// Deliberately does NOT: settle payment_orders, grant entitlements, issue
// invoices, award coins, create order_generations, generate CVs, update
// users/profiles, or activate anything. Settlement arrives in a later step,
// through a separate server-side path.
//
// Deployment note: Paymob posts server-to-server and cannot present a user JWT,
// so this function must stay deployed with verify_jwt = false. Authenticity
// comes from the HMAC below, never from a JWT.

const PAYMOB_HMAC = Deno.env.get("PAYMOB_HMAC") ?? "";

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

  // Verified. Log only non-sensitive correlation identifiers: never the
  // secret, the digest, card data (source_data.pan), or the payer's details
  // (owner, billing data).
  const orderValue = transaction["order"];
  const orderId = (orderValue !== null && typeof orderValue === "object")
    ? (orderValue as Record<string, unknown>)["id"]
    : orderValue;

  console.log("webhook-paymob: verified callback", {
    type: typeof body["type"] === "string" ? body["type"] : null,
    transactionId: transaction["id"] ?? null,
    orderId: orderId ?? null,
    success: transaction["success"] ?? null,
    pending: transaction["pending"] ?? null,
  });

  // Acknowledge only. No settlement, no entitlement, no invoice, no side effects.
  return json({ received: true, verified: true }, 200);
});

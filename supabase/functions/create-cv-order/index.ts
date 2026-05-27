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
  premium:   "https://accept.paymobsolutions.com/standalone?ref=p_LRR2djFVeWg0SWhkQzY2dnM3WGQxOFl6Zz09X05IeWQra29pd29zUXRTRHF5QkpxMWc9PQ",
  gold:      "https://accept.paymobsolutions.com/standalone?ref=p_LRR2U0d0ZklEUlIxZUwweWZhUVRGdDVqZz09X1hhTCtGYWhhK1pOSmVyb0pZVFE1dXc9PQ",
  ai_search: Deno.env.get("PAYMOB_AI_SEARCH_LINK") ?? "",
};

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
      amount,
      currency  = "USD",
    } = body;

    if (!bodyFormId && !rawSub) {
      return new Response(
        JSON.stringify({ error: "form_id or submission_id required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const normalizedMethod = payment_method?.toLowerCase() ?? "";
    if (normalizedMethod !== "whish" && normalizedMethod !== "wishmoney" && normalizedMethod !== "paymob") {
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

      const wmExternalId = Date.now();

      // ── Per-transaction HMAC webhook token ────────────────────────────────────
      // token = HMAC-SHA256(WISHMONEY_SECRET, "${wmExternalId}:${form_id}")
      // Embedded as `wt` in every callback/redirect URL so webhook-wishmoney can
      // verify the request is genuine before touching any database row.
      // WishMoney echoes the callback URL as-is for both POST callbacks and GET
      // browser redirects, so the same token covers both paths.
      const webhookToken = await hmacSha256Hex(
        WISHMONEY_SECRET,
        `${wmExternalId}:${form_id}`,
      );

      // Callback URL carries the reference context only — no generation_id yet.
      // webhook-wishmoney uses these params to:
      //   1. verify HMAC token (wt) — rejects anything that fails
      //   2. verify idempotency via wishmoney_order_id (= tid)
      //   3. extract cv_archive snapshot via fid
      //   4. INSERT into order_generations and mint generation_id
      //   5. redirect browser to /success?gid=<minted_gid>
      const baseCallback =
        `${EF_BASE_URL}/webhook-wishmoney` +
        `?sid=${encodeURIComponent(submission_id)}` +
        `&fid=${encodeURIComponent(form_id)}` +
        `&tid=${wmExternalId}` +
        `&plan=${encodeURIComponent(plan)}` +
        `&amount=${encodeURIComponent(String(amount ?? ""))}` +
        `&wt=${webhookToken}`;

      const wmRes = await fetch(WISHMONEY_API, {
        method: "POST",
        headers: {
          "channel":      WISHMONEY_CHANNEL,
          "secret":       WISHMONEY_SECRET,
          "websiteUrl":   "resumation.co",
          "Content-Type": "application/json",
          "User-Agent":   "Whish/1.0 (https://whish.money; support@whish.money)",
        },
        body: JSON.stringify({
          amount,
          currency:   currency || "USD",
          invoice:    `Resumation ${plan} plan`,
          externalId: wmExternalId,
          // Server-to-server callback: fires on WishMoney confirmation
          successCallbackUrl: `${baseCallback}&status=success`,
          failureCallbackUrl: `${baseCallback}&status=failed`,
          // Browser redirect: also points to the webhook — it mints gid then redirects
          // the user's browser to /success?gid=<gid>&tid=<tid>
          successRedirectUrl: `${baseCallback}&status=success`,
          failureRedirectUrl: "https://resumation.co/plans",
        }),
      });

      const wmData    = await wmRes.json().catch(() => ({}));
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

      console.error("WishMoney response:", JSON.stringify(wmData));
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

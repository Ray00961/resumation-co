import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PAYMOB_API_KEY  = Deno.env.get("PAYMOB_API_KEY") ?? "";
const PAYMOB_API_BASE = "https://accept.paymobsolutions.com/api";

// Coin rewards per plan — must stay in sync with webhook-wishmoney
const PLAN_COINS: Record<string, number> = {
  premium:   50,
  gold:      100,
  ai_search: 100,
};

// Human-readable plan labels used in receipt emails
const PLAN_DISPLAY: Record<string, string> = {
  premium:   "Premium",
  gold:      "Gold Executive",
  ai_search: "AI Hunter",
};

// Standard prices per plan per region (display only — not used for billing)
function getPriceDisplay(plan: string, region: string): string {
  const isEgypt = region === "EG";
  const prices: Record<string, { eg: string; default: string }> = {
    premium:   { eg: "250 EGP", default: "$25 USD" },
    gold:      { eg: "400 EGP", default: "$40 USD" },
    ai_search: { eg: "100 EGP", default: "$10 USD" },
  };
  const p = prices[plan] ?? prices["premium"];
  return isEgypt ? p.eg : p.default;
}

// ── Transactional receipt email ──────────────────────────────────────────────
// Uses Resend (RESEND_API_KEY env var). Wrapped in try/catch so email delivery
// failures never block or roll back the primary HTTP response.
async function sendReceiptEmail(params: {
  to:             string;
  transactionId:  string;
  gatewayVoucher: string;
  gatewayLabel:   string;
  plan:           string;
  region:         string;
  paymentMethod:  string;
}): Promise<void> {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
  if (!RESEND_API_KEY || !params.to) {
    console.warn("confirm-payment: sendReceiptEmail skipped — no RESEND_API_KEY or recipient");
    return;
  }

  const planDisplay  = PLAN_DISPLAY[params.plan] ?? params.plan;
  const priceDisplay = getPriceDisplay(params.plan, params.region);

  const beirutTime = new Date().toLocaleString("en-GB", {
    timeZone:  "Asia/Beirut",
    weekday:   "long",
    year:      "numeric",
    month:     "long",
    day:       "numeric",
    hour:      "2-digit",
    minute:    "2-digit",
    second:    "2-digit",
    hour12:    false,
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Purchase Receipt — Resumation.co</title>
</head>
<body style="margin:0;padding:0;background:#0D1117;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0D1117;padding:48px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- Platform tag -->
  <tr><td style="padding-bottom:28px;text-align:center;">
    <div style="display:inline-block;padding:7px 18px;border-radius:99px;background:rgba(18,178,193,0.07);border:1px solid rgba(18,178,193,0.18);">
      <span style="color:rgba(18,178,193,0.85);font-size:12px;font-weight:900;letter-spacing:0.3em;text-transform:uppercase;">Resumation.co</span>
    </div>
  </td></tr>

  <!-- Main card -->
  <tr><td style="background:#0E161F;border:1px solid rgba(16,185,129,0.14);border-radius:24px;padding:40px;">

    <!-- Status badge -->
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;padding:6px 18px;border-radius:99px;background:rgba(16,185,129,0.09);border:1px solid rgba(16,185,129,0.22);">
        <span style="color:#10b981;font-size:11px;font-weight:900;letter-spacing:0.2em;text-transform:uppercase;">&#x25CF;&nbsp; PAID · VERIFIED · CONFIRMED</span>
      </div>
    </div>

    <!-- Heading -->
    <h1 style="margin:0 0 8px;text-align:center;font-size:24px;font-weight:900;color:#ffffff;letter-spacing:-0.02em;">
      Your Official Purchase Receipt
    </h1>
    <p style="margin:0 0 32px;text-align:center;font-size:13px;color:rgba(225,235,237,0.45);font-weight:500;">
      Thank you for your purchase — your documents are being prepared.
    </p>

    <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent);margin-bottom:28px;"></div>

    <!-- Invoice table -->
    <table width="100%" cellpadding="0" cellspacing="0">

      <!-- Plan activated -->
      <tr>
        <td style="padding:13px 0;border-bottom:1px solid rgba(255,255,255,0.04);" colspan="2">
          <span style="font-size:10px;font-weight:900;color:rgba(225,235,237,0.35);text-transform:uppercase;letter-spacing:0.15em;">Plan Activated</span><br/>
          <span style="font-size:17px;font-weight:900;color:#ffffff;margin-top:5px;display:block;">${planDisplay}</span>
        </td>
        <td style="padding:13px 0;border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;vertical-align:bottom;">
          <span style="font-size:19px;font-weight:900;color:rgba(18,178,193,1);">${priceDisplay}</span>
        </td>
      </tr>

      <!-- Platform Invoice ID -->
      <tr>
        <td style="padding:13px 0;border-bottom:1px solid rgba(255,255,255,0.04);" colspan="3">
          <span style="font-size:10px;font-weight:900;color:rgba(225,235,237,0.35);text-transform:uppercase;letter-spacing:0.15em;">Platform Invoice ID</span><br/>
          <span style="font-size:12px;font-weight:700;color:rgba(225,235,237,0.75);font-family:monospace;margin-top:5px;display:block;word-break:break-all;">${params.transactionId || "N/A"}</span>
        </td>
      </tr>

      <!-- Gateway voucher -->
      <tr>
        <td style="padding:13px 0;border-bottom:1px solid rgba(255,255,255,0.04);" colspan="3">
          <span style="font-size:10px;font-weight:900;color:rgba(225,235,237,0.35);text-transform:uppercase;letter-spacing:0.15em;">${params.gatewayLabel}</span><br/>
          <span style="font-size:12px;font-weight:700;color:rgba(18,178,193,0.85);font-family:monospace;margin-top:5px;display:block;word-break:break-all;">${params.gatewayVoucher || "N/A"}</span>
        </td>
      </tr>

      <!-- Timestamp -->
      <tr>
        <td style="padding:13px 0;" colspan="3">
          <span style="font-size:10px;font-weight:900;color:rgba(225,235,237,0.35);text-transform:uppercase;letter-spacing:0.15em;">Transaction Timestamp (Beirut Time)</span><br/>
          <span style="font-size:13px;font-weight:500;color:rgba(225,235,237,0.7);margin-top:5px;display:block;">${beirutTime}</span>
        </td>
      </tr>

    </table>

    <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent);margin:28px 0;"></div>

    <p style="margin:0;font-size:11px;color:rgba(200,191,186,0.55);line-height:1.75;text-align:center;">
      A formal copy of this digital receipt has been dispatched to your login email.<br/>
      This invoice reference code is your unique audit token for official merchant support lookup and verification.
    </p>

  </td></tr>

  <!-- Footer -->
  <tr><td style="padding-top:24px;text-align:center;">
    <p style="margin:0;font-size:10px;color:rgba(225,235,237,0.18);font-weight:900;letter-spacing:0.2em;text-transform:uppercase;">
      Resumation.co &nbsp;·&nbsp; All Rights Reserved
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  try {
    const emailRes = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        from:    "Resumation.co <noreply@resumation.co>",
        to:      [params.to],
        subject: "Your Official Purchase Receipt — Resumation.co",
        html,
      }),
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.text().catch(() => "");
      console.error("confirm-payment: Resend delivery failed", emailRes.status, errBody);
    } else {
      console.log("confirm-payment: receipt email delivered to", params.to);
    }
  } catch (mailErr) {
    console.error("confirm-payment: email network error", mailErr);
  }
}

// ── Paymob transaction verification ──────────────────────────────────────────
// Confirms a paymob_order_id is a real, paid Paymob order before creating any
// order_generations row. Fails-open when PAYMOB_API_KEY is not configured (for
// backward compat during rollout) and on transient network errors (to avoid
// blocking legitimate payments during Paymob API outages).
// Set PAYMOB_API_KEY in Supabase Secrets to enable full verification.
async function verifyPaymobTransaction(
  orderId: string,
): Promise<{ verified: boolean; reason: string }> {
  if (!PAYMOB_API_KEY) {
    console.warn(
      "confirm-payment: PAYMOB_API_KEY not set — skipping server-side verification.",
      { orderId },
    );
    return { verified: true, reason: "skipped_no_key" };
  }
  try {
    // Step 1 — obtain a short-lived auth token
    const authRes = await fetch(`${PAYMOB_API_BASE}/auth/tokens`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ api_key: PAYMOB_API_KEY }),
    });
    if (!authRes.ok) {
      console.error("confirm-payment: Paymob auth token request failed", authRes.status);
      return { verified: true, reason: "auth_error_failopen" };
    }
    const { token } = await authRes.json();

    // Step 2 — query the order; paid_amount_cents > 0 = confirmed payment
    const orderRes = await fetch(`${PAYMOB_API_BASE}/ecommerce/orders/${orderId}`, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    if (!orderRes.ok) {
      console.error("confirm-payment: Paymob order lookup failed", orderId, orderRes.status);
      return { verified: false, reason: "order_not_found" };
    }
    const order = await orderRes.json();
    if (order?.paid_amount_cents > 0) {
      return { verified: true, reason: "paid" };
    }
    console.warn("confirm-payment: Paymob order not paid", {
      orderId,
      paid_amount_cents: order?.paid_amount_cents,
    });
    return { verified: false, reason: "not_paid" };
  } catch (err) {
    // Network / parse error — fail-open to avoid blocking real payments
    console.error("confirm-payment: Paymob verification threw", err);
    return { verified: true, reason: "exception_failopen" };
  }
}

// ── Shared coin-awarding helper ──────────────────────────────────────────────
// Calls the award_coins RPC (service_role only); falls back to a direct
// users-table update + coin_transactions ledger entry.
// Failure is logged but does NOT abort the caller — coins are non-critical
// compared to the generation row itself.
async function awardCoins(
  db:            ReturnType<typeof createClient>,
  user_id:       string,
  generation_id: string,
  plan:          string,
): Promise<void> {
  const coinsToAdd = PLAN_COINS[plan] ?? 0;
  if (coinsToAdd <= 0) return;

  // award_coins(p_user_id uuid, p_plan text, p_reference text DEFAULT NULL)
  const { error: rpcErr } = await db.rpc("award_coins", {
    p_user_id:   user_id,
    p_plan:      plan,
    p_reference: generation_id,
  });

  if (!rpcErr) return; // RPC succeeded — done

  console.warn("confirm-payment: award_coins RPC failed, using direct fallback", rpcErr);

  const { data: usr } = await db
    .from("users")
    .select("search_coins")
    .eq("id", user_id)
    .single();

  const current = usr?.search_coins ?? 0;

  await db
    .from("users")
    .update({ search_coins: current + coinsToAdd })
    .eq("id", user_id);

  await db.from("coin_transactions").insert({
    user_id,
    amount:    coinsToAdd,
    reason:    `plan_purchase_${plan}`,
    reference: generation_id,
  });
}

// ── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // ── JWT verification ──────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing authorization header" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const token = authHeader.slice(7);

  const authDb = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: { user }, error: authErr } = await authDb.auth.getUser(token);
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  // user_id is always taken from the server-verified JWT — never from the request body.
  const user_id = user.id;

  try {
    const body = await req.json().catch(() => ({}));

    // ── Payload shape ─────────────────────────────────────────────────────────
    //
    //  EXISTING-ROW PATH (SuccessPage found the row via its DB fallback query):
    //    { generation_id, paymob_order_id, source? }
    //
    //  FRESH-REDIRECT PATH (returning directly from Paymob, no row exists yet):
    //    { paymob_order_id, plan?, form_id?, source? }
    //    generation_id is absent; confirm-payment becomes the INSERT engine.
    //
    const generation_id:   string = body.generation_id   ?? "";
    const paymob_order_id: string = body.paymob_order_id ?? "";
    const form_id:         string = body.form_id         ?? "";
    const plan_hint:       string = body.plan            ?? "";
    const source:          string = body.source          ?? "paymob";

    if (!paymob_order_id && !generation_id) {
      return new Response(
        JSON.stringify({ error: "Either paymob_order_id or generation_id is required." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const db = createClient(SUPABASE_URL, SERVICE_KEY);

    // ══════════════════════════════════════════════════════════════════════════
    // STAGE 1 — IDEMPOTENCY CHECK BY PAYMOB ORDER ID
    //
    // If a row in order_generations already carries this paymob_order_id, the
    // payment has already been processed. Return immediately — no coin re-awards,
    // no duplicate rows, no risk of double-generation triggers.
    // ══════════════════════════════════════════════════════════════════════════
    if (paymob_order_id) {
      const { data: byOrder, error: byOrderErr } = await db
        .from("order_generations")
        .select("generation_id, package_name, user_id")
        .eq("paymob_order_id", paymob_order_id)
        .eq("user_id", user_id)
        .maybeSingle();

      if (byOrderErr) {
        console.error("confirm-payment: idempotency check error", byOrderErr);
      }

      if (byOrder) {
        console.log("confirm-payment: idempotency hit — already confirmed", {
          paymob_order_id,
          generation_id: byOrder.generation_id,
        });
        return new Response(
          JSON.stringify({ success: true, generation_id: byOrder.generation_id, note: "already confirmed" }),
          { headers: { ...cors, "Content-Type": "application/json" } }
        );
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // STAGE 2 — EXISTING ROW UPDATE PATH
    //
    // The caller supplied a generation_id (SuccessPage recovered it via its
    // order_generations DB query). Verify ownership, stamp Paymob payment
    // fields onto the row, award coins, and return.
    // No email is sent here — the row was born (and emailed) by a prior INSERT.
    // ══════════════════════════════════════════════════════════════════════════
    if (generation_id) {
      const { data: ogRow, error: ogErr } = await db
        .from("order_generations")
        .select("generation_id, package_name, payment_method, user_id")
        .eq("generation_id", generation_id)
        .eq("user_id", user_id)
        .maybeSingle();

      if (ogErr || !ogRow) {
        return new Response(
          JSON.stringify({ error: "Order not found or access denied." }),
          { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      if (ogRow.payment_method === source || ogRow.payment_method === "paymob") {
        return new Response(
          JSON.stringify({ success: true, generation_id: ogRow.generation_id, note: "already confirmed" }),
          { headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      const { error: updateErr } = await db
        .from("order_generations")
        .update({
          payment_method:  source,
          paymob_order_id: paymob_order_id || null,
          transaction_id:  paymob_order_id || null,
        })
        .eq("generation_id", generation_id)
        .eq("user_id", user_id);

      if (updateErr) {
        console.error("confirm-payment: UPDATE failed", updateErr);
        return new Response(
          JSON.stringify({ error: "Failed to update payment fields.", details: String(updateErr) }),
          { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      const resolvedPlan = (ogRow.package_name ?? plan_hint) || "premium";
      await awardCoins(db, user_id, generation_id, resolvedPlan);

      console.log("confirm-payment: existing row confirmed", { generation_id, plan: resolvedPlan });

      return new Response(
        JSON.stringify({ success: true, generation_id }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ══════════════════════════════════════════════════════════════════════════
    // STAGE 3 — PAYMOB INGESTION BIRTH (INSERT PATH)
    //
    // No generation_id was supplied and no existing row was found by
    // paymob_order_id. This is the cold-redirect case. confirm-payment becomes
    // the sole INSERT engine for this path, exactly mirroring webhook-wishmoney's
    // role for WishMoney.
    //
    // Paymob transaction is verified against Paymob's API before any row is
    // created — prevents forged paymob_order_id values from creating free
    // generations. Requires PAYMOB_API_KEY to be set in Supabase Secrets.
    //
    // form_id resolution order:
    //   1. Caller-supplied form_id in the request body
    //   2. Latest cv_archive entry for the authenticated user (automatic fallback)
    // ══════════════════════════════════════════════════════════════════════════

    // ── Verify the Paymob transaction is real before touching the DB ──────────
    if (paymob_order_id) {
      const { verified, reason } = await verifyPaymobTransaction(paymob_order_id);
      if (!verified) {
        console.error("confirm-payment: Stage 3 — Paymob verification rejected INSERT", {
          paymob_order_id, reason, user_id,
        });
        return new Response(
          JSON.stringify({ error: "Payment verification failed. Please contact support if you were charged." }),
          { status: 402, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
      console.log("confirm-payment: Paymob transaction verified", { paymob_order_id, reason });
    }

    let resolvedFormId = form_id;

    if (!resolvedFormId) {
      const { data: latestArchive, error: latestErr } = await db
        .from("cv_archive")
        .select("form_id")
        .eq("user_id", user_id)
        .order("created_at_utc", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestErr || !latestArchive?.form_id) {
        console.error("confirm-payment: cannot resolve form_id for INSERT path", { user_id, latestErr });
        return new Response(
          JSON.stringify({ error: "No CV submission found for this user. Submit your CV before purchasing." }),
          { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      resolvedFormId = latestArchive.form_id;
      console.log("confirm-payment: form_id derived from cv_archive latest", { user_id, resolvedFormId });
    }

    // ── Full data vault extraction ────────────────────────────────────────────
    const { data: archiveRow, error: archErr } = await db
      .from("cv_archive")
      .select(
        "form_id, user_id, submission_id, cv_data, " +
        "cv_first_name, cv_last_name, cv_email, cv_phone_number, phone_number, cv_target_job, " +
        "first_name, last_name, email, username, preferred_language, region, selected_language"
      )
      .eq("form_id", resolvedFormId)
      .eq("user_id", user_id)
      .single();

    if (archErr || !archiveRow) {
      console.error("confirm-payment: cv_archive row not found", { resolvedFormId, user_id, archErr });
      return new Response(
        JSON.stringify({ error: "CV archive record not found or access denied." }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ── Generation birth INSERT ───────────────────────────────────────────────
    const resolvedPlan = plan_hint || "premium";

    const { data: newRow, error: insertErr } = await db
      .from("order_generations")
      .insert({
        form_id:            resolvedFormId,
        user_id:            archiveRow.user_id,
        submission_id:      archiveRow.submission_id || "",
        cv_data:            archiveRow.cv_data,
        cv_first_name:      archiveRow.cv_first_name   ?? null,
        cv_last_name:       archiveRow.cv_last_name    ?? null,
        cv_email:           archiveRow.cv_email        ?? null,
        cv_phone_number:    archiveRow.cv_phone_number ?? archiveRow.phone_number ?? null,
        cv_target_job:      archiveRow.cv_target_job   ?? null,
        first_name:         archiveRow.first_name      ?? null,
        last_name:          archiveRow.last_name       ?? null,
        email:              archiveRow.email           ?? null,
        username:           archiveRow.username        ?? null,
        preferred_language: archiveRow.preferred_language ?? null,
        region:             archiveRow.region          ?? null,
        package_name:       resolvedPlan,
        payment_method:     source,
        transaction_id:     paymob_order_id || null,
        paymob_order_id:    paymob_order_id || null,
        selected_language:  archiveRow.selected_language ?? "en",
      })
      .select("generation_id")
      .single();

    if (insertErr || !newRow) {
      console.error("confirm-payment: INSERT into order_generations failed", insertErr);
      return new Response(
        JSON.stringify({ error: "Failed to create order generation row.", details: String(insertErr) }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const newGid = newRow.generation_id as string;

    // ── Award coins ───────────────────────────────────────────────────────────
    await awardCoins(db, user_id, newGid, resolvedPlan);

    // ── Transactional receipt email ───────────────────────────────────────────
    // Dispatched as fire-and-forget AFTER the row is safely committed.
    // A network timeout on email delivery will never break the HTTP response.
    const recipientEmail =
      archiveRow.cv_email || archiveRow.email || user.email || "";

    sendReceiptEmail({
      to:             recipientEmail,
      transactionId:  paymob_order_id || newGid,
      gatewayVoucher: paymob_order_id || "",
      gatewayLabel:   "Paymob Gateway Reference",
      plan:           resolvedPlan,
      region:         archiveRow.region ?? "LB",
      paymentMethod:  source,
    }).catch(e => console.error("confirm-payment: receipt email fire error", e));

    console.log("confirm-payment: Paymob ingestion birth complete", {
      generation_id:  newGid,
      form_id:        resolvedFormId,
      user_id,
      plan:           resolvedPlan,
      paymob_order_id,
      email_to:       recipientEmail,
    });

    // NOTE: generate-cv is NOT triggered here.
    // SuccessPage uses the returned generation_id to set gidRef, then lets the
    // user explicitly pick a language bundle before generating.
    return new Response(
      JSON.stringify({ success: true, generation_id: newGid }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("confirm-payment: unhandled error", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});

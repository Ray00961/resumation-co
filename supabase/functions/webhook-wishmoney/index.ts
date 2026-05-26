import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PLAN_COINS: Record<string, number> = { premium: 50, gold: 100, ai_search: 100 };

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
    console.warn("webhook-wishmoney: sendReceiptEmail skipped — no RESEND_API_KEY or recipient");
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
        <td style="padding:13px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
          <span style="font-size:10px;font-weight:900;color:rgba(225,235,237,0.35);text-transform:uppercase;letter-spacing:0.15em;">Plan Activated</span><br/>
          <span style="font-size:17px;font-weight:900;color:#ffffff;margin-top:5px;display:block;">${planDisplay}</span>
        </td>
        <td style="padding:13px 0;border-bottom:1px solid rgba(255,255,255,0.04);text-align:right;vertical-align:bottom;">
          <span style="font-size:19px;font-weight:900;color:rgba(18,178,193,1);">${priceDisplay}</span>
        </td>
      </tr>

      <!-- Platform Invoice ID -->
      <tr>
        <td style="padding:13px 0;border-bottom:1px solid rgba(255,255,255,0.04);" colspan="2">
          <span style="font-size:10px;font-weight:900;color:rgba(225,235,237,0.35);text-transform:uppercase;letter-spacing:0.15em;">Platform Invoice ID</span><br/>
          <span style="font-size:12px;font-weight:700;color:rgba(225,235,237,0.75);font-family:monospace;margin-top:5px;display:block;word-break:break-all;">${params.transactionId || "N/A"}</span>
        </td>
      </tr>

      <!-- Gateway voucher -->
      <tr>
        <td style="padding:13px 0;border-bottom:1px solid rgba(255,255,255,0.04);" colspan="2">
          <span style="font-size:10px;font-weight:900;color:rgba(225,235,237,0.35);text-transform:uppercase;letter-spacing:0.15em;">${params.gatewayLabel}</span><br/>
          <span style="font-size:12px;font-weight:700;color:rgba(18,178,193,0.85);font-family:monospace;margin-top:5px;display:block;word-break:break-all;">${params.gatewayVoucher || "N/A"}</span>
        </td>
      </tr>

      <!-- Timestamp -->
      <tr>
        <td style="padding:13px 0;" colspan="2">
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
      console.error("webhook-wishmoney: Resend delivery failed", emailRes.status, errBody);
    } else {
      console.log("webhook-wishmoney: receipt email delivered to", params.to);
    }
  } catch (mailErr) {
    console.error("webhook-wishmoney: email network error", mailErr);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = new URL(req.url);

  // ── Connection tokens forwarded by create-cv-order in the callback/redirect URL ──
  // sid = submission_id  (from cv_archive)
  // fid = form_id        (PK of cv_archive row — used to extract the data vault snapshot)
  // tid = WishMoney externalId (= Date.now() sent to WishMoney as externalId)
  // plan = package_name  (whichever plan the user selected)
  const sid    = url.searchParams.get("sid")    ?? "";
  const fid    = url.searchParams.get("fid")    ?? "";
  const tid    = url.searchParams.get("tid")    ?? "";
  const plan   = url.searchParams.get("plan")   ?? "premium";
  const status = url.searchParams.get("status") ?? "";
  const amount = url.searchParams.get("amount") ?? "";

  // WishMoney test pings arrive with no params — acknowledge silently
  if (!tid || !fid) {
    return new Response("ok", { status: 200 });
  }

  // ── Failure callback — log and redirect/acknowledge ──
  if (status === "failed") {
    console.log("webhook-wishmoney: payment failed", { sid, fid, tid, plan });
    if (req.method === "GET") {
      return new Response(null, {
        status: 302,
        headers: { Location: "https://resumation.co/plans" },
      });
    }
    return new Response(
      JSON.stringify({ success: false, status: "failed" }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  try {
    const db = createClient(SUPABASE_URL, SERVICE_KEY);

    // ════════════════════════════════════════════════════════════════════════════
    // IDEMPOTENCY CHECK
    // Uses wishmoney_order_id = tid because generation_id does not exist yet —
    // it is minted by this INSERT. Both the server-side POST callback and the
    // browser GET redirect call this same function. The first caller INSERTs
    // the row; the second caller finds it here and exits cleanly.
    // ════════════════════════════════════════════════════════════════════════════
    const { data: existing, error: existErr } = await db
      .from("order_generations")
      .select("generation_id, payment_method")
      .eq("wishmoney_order_id", tid)
      .maybeSingle();

    if (existErr) {
      console.error("webhook-wishmoney: idempotency check error", existErr);
      return new Response("ok", { status: 200 });
    }

    if (existing) {
      console.log("webhook-wishmoney: already processed, skipping", {
        tid,
        generation_id: existing.generation_id,
      });
      if (req.method === "GET") {
        return new Response(null, {
          status: 302,
          headers: {
            Location: `https://resumation.co/success?gid=${existing.generation_id}&tid=${tid}&plan=${plan}`,
          },
        });
      }
      return new Response(
        JSON.stringify({ success: true, generation_id: existing.generation_id, note: "already processed" }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ════════════════════════════════════════════════════════════════════════════
    // DATA VAULT EXTRACTION
    // Pull the full snapshot from cv_archive using fid.
    // This is the single authoritative read before the generation row is born.
    // ════════════════════════════════════════════════════════════════════════════
    const { data: archiveRow, error: archErr } = await db
      .from("cv_archive")
      .select(
        "form_id, user_id, submission_id, cv_data, " +
        "cv_first_name, cv_last_name, cv_email, cv_phone_number, phone_number, cv_target_job, " +
        "first_name, last_name, email, username, preferred_language, region, selected_language"
      )
      .eq("form_id", fid)
      .single();

    if (archErr || !archiveRow) {
      console.error("webhook-wishmoney: cv_archive not found", { fid, archErr });
      return new Response(
        JSON.stringify({ error: "cv_archive record not found for fid: " + fid }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ════════════════════════════════════════════════════════════════════════════
    // GENERATION BIRTH WRITE
    // A row is born here and ONLY here after WishMoney payment confirmation.
    // All personal context is copied from the cv_archive snapshot so that
    // downstream functions (generate-cv, SuccessPage, BuildingPage) need only
    // query order_generations with the single generation_id PK.
    // ════════════════════════════════════════════════════════════════════════════
    const { data: newRow, error: insertErr } = await db
      .from("order_generations")
      .insert({
        form_id:            fid,
        user_id:            archiveRow.user_id,
        submission_id:      sid || archiveRow.submission_id || "",
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
        package_name:       plan,
        payment_method:     "wishmoney",
        transaction_id:     tid,
        wishmoney_order_id: tid,
        selected_language:  archiveRow.selected_language ?? "en",
      })
      .select("generation_id")
      .single();

    if (insertErr || !newRow) {
      console.error("webhook-wishmoney: INSERT into order_generations failed", insertErr);
      // Return 200 to prevent WishMoney from retrying indefinitely
      return new Response(
        JSON.stringify({ error: "Failed to create order_generation row", details: String(insertErr) }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const generation_id = newRow.generation_id as string;

    // ── Add coins to user's account ──────────────────────────────────────────────
    const coinsToAdd = PLAN_COINS[plan] ?? 0;

    if (coinsToAdd > 0 && archiveRow.user_id) {
      await db.rpc("add_coins", {
        p_user_id:   archiveRow.user_id,
        p_amount:    coinsToAdd,
        p_reason:    `plan_purchase_${plan}`,
        p_reference: generation_id,
      }).catch(async () => {
        // Fallback: direct update if add_coins RPC is not available
        const { data: usr } = await db
          .from("users")
          .select("search_coins")
          .eq("id", archiveRow.user_id)
          .single();

        const current = usr?.search_coins ?? 0;
        await db
          .from("users")
          .update({ search_coins: current + coinsToAdd })
          .eq("id", archiveRow.user_id);

        // coin_transactions schema: id, user_id, amount, reason, created_at
        // NOTE: no "reference" column exists in this table.
        await db.from("coin_transactions").insert({
          user_id: archiveRow.user_id,
          amount:  coinsToAdd,
          reason:  `plan_purchase_${plan}`,
        });
      });
    }

    // ── Transactional receipt email ───────────────────────────────────────────
    // Dispatched as fire-and-forget AFTER the row is safely committed and coins
    // are awarded. A network timeout on email delivery will never block the
    // primary gateway response or the browser redirect.
    const recipientEmail =
      archiveRow.cv_email || archiveRow.email || "";

    sendReceiptEmail({
      to:             recipientEmail,
      transactionId:  tid,
      gatewayVoucher: tid,
      gatewayLabel:   "Whish Money Voucher Code",
      plan,
      region:         archiveRow.region ?? "LB",
      paymentMethod:  "wishmoney",
    }).catch(e => console.error("webhook-wishmoney: receipt email fire error", e));

    console.log("webhook-wishmoney: payment confirmed — generation row created", {
      generation_id,
      form_id:     fid,
      user_id:     archiveRow.user_id,
      plan,
      tid,
      amount,
      coins_added: coinsToAdd,
      email_to:    recipientEmail,
    });

    // NOTE: generate-cv is NOT triggered here.
    // The user lands on /success?gid=...&plan=... and explicitly clicks an English
    // or Arabic bundle. SuccessPage fires generate-cv with { generation_id, selectedLanguage }.
    // Auto-triggering here would race with that user choice.

    // ── Browser GET redirect — send user to SuccessPage with the minted gid ──
    if (req.method === "GET") {
      return new Response(null, {
        status: 302,
        headers: {
          Location: `https://resumation.co/success?gid=${generation_id}&tid=${tid}&plan=${plan}`,
        },
      });
    }

    // ── Server-to-server POST callback ──
    return new Response(
      JSON.stringify({ success: true, generation_id }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("webhook-wishmoney error:", err);
    // Return 200 to prevent WishMoney from retrying indefinitely on unexpected errors
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});

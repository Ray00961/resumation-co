import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WISHMONEY_SECRET = Deno.env.get("WISHMONEY_SECRET") ?? "";

const PLAN_COINS: Record<string, number> = {
  premium: 50,
  gold: 100,
  ai_search: 100,
};

const PLAN_DISPLAY: Record<string, string> = {
  premium: "Premium",
  gold: "Gold Executive",
  ai_search: "AI Hunter",
};

function getPriceDisplay(plan: string, region: string): string {
  const isEgypt = region === "EG";
  const prices: Record<string, { eg: string; default: string }> = {
    premium: { eg: "250 EGP", default: "$25 USD" },
    gold: { eg: "400 EGP", default: "$40 USD" },
    ai_search: { eg: "100 EGP", default: "$10 USD" },
  };

  const p = prices[plan] ?? prices.premium;
  return isEgypt ? p.eg : p.default;
}

async function sendReceiptEmail(params: {
  to: string;
  transactionId: string;
  gatewayVoucher: string;
  gatewayLabel: string;
  plan: string;
  region: string;
  paymentMethod: string;
}): Promise<void> {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

  if (!RESEND_API_KEY || !params.to) {
    console.warn("webhook-wishmoney: sendReceiptEmail skipped — no RESEND_API_KEY or recipient");
    return;
  }

  const planDisplay = PLAN_DISPLAY[params.plan] ?? params.plan;
  const priceDisplay = getPriceDisplay(params.plan, params.region);

  const beirutTime = new Date().toLocaleString("en-GB", {
    timeZone: "Asia/Beirut",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <body style="margin:0;padding:0;background:#0D1117;font-family:Arial,sans-serif;">
    <div style="max-width:600px;margin:40px auto;background:#0E161F;border-radius:24px;padding:40px;color:white;">
      <h1 style="text-align:center;">Your Official Purchase Receipt</h1>
      <p style="text-align:center;color:#94a3b8;">Thank you for your purchase — your documents are being prepared.</p>

      <hr style="border-color:rgba(255,255,255,0.08);" />

      <p><strong>Plan Activated:</strong> ${planDisplay}</p>
      <p><strong>Price:</strong> ${priceDisplay}</p>
      <p><strong>Platform Invoice ID:</strong> ${params.transactionId || "N/A"}</p>
      <p><strong>${params.gatewayLabel}:</strong> ${params.gatewayVoucher || "N/A"}</p>
      <p><strong>Transaction Timestamp Beirut Time:</strong> ${beirutTime}</p>

      <hr style="border-color:rgba(255,255,255,0.08);" />

      <p style="font-size:12px;color:#94a3b8;text-align:center;">
        Resumation.co · All Rights Reserved
      </p>
    </div>
  </body>
  </html>`;

  try {
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Resumation.co <noreply@resumation.co>",
        to: [params.to],
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

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return diff === 0;
}

async function awardCoinsSafely(params: {
  db: any;
  userId: string;
  plan: string;
  generationId: string;
  coinsToAdd: number;
}) {
  const { db, userId, plan, generationId, coinsToAdd } = params;

  if (!coinsToAdd || coinsToAdd <= 0 || !userId) return;

  try {
    const { error: coinErr } = await db.rpc("award_coins", {
      p_user_id: userId,
      p_plan: plan,
      p_reference: generationId,
    });

    if (!coinErr) {
      console.log("webhook-wishmoney: coins awarded via RPC", {
        user_id: userId,
        plan,
        coinsToAdd,
        generation_id: generationId,
      });
      return;
    }

    console.error("webhook-wishmoney: award_coins RPC failed, using fallback", coinErr);
  } catch (rpcErr) {
    console.error("webhook-wishmoney: award_coins RPC exception, using fallback", rpcErr);
  }

  try {
    const { data: usr, error: userErr } = await db
      .from("users")
      .select("search_coins")
      .eq("id", userId)
      .single();

    if (userErr) {
      console.error("webhook-wishmoney: fallback failed to fetch user coins", userErr);
      return;
    }

    const current = usr?.search_coins ?? 0;

    const { error: updateErr } = await db
      .from("users")
      .update({ search_coins: current + coinsToAdd })
      .eq("id", userId);

    if (updateErr) {
      console.error("webhook-wishmoney: fallback coin update failed", updateErr);
      return;
    }

    const { error: txErr } = await db.from("coin_transactions").insert({
      user_id: userId,
      amount: coinsToAdd,
      reason: `plan_purchase_${plan}`,
      reference: generationId,
    });

    if (txErr) {
      console.error("webhook-wishmoney: fallback coin transaction insert failed", txErr);
    }

    console.log("webhook-wishmoney: coins awarded via fallback", {
      user_id: userId,
      plan,
      coinsToAdd,
      generation_id: generationId,
    });
  } catch (fallbackErr) {
    console.error("webhook-wishmoney: fallback coin award exception", fallbackErr);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const url = new URL(req.url);

  const sid = url.searchParams.get("sid") ?? "";
  const fid = url.searchParams.get("fid") ?? "";
  const tid = url.searchParams.get("tid") ?? "";
  const plan = url.searchParams.get("plan") ?? "premium";
  const status = url.searchParams.get("status") ?? "";
  const amount = url.searchParams.get("amount") ?? "";
  const wt = url.searchParams.get("wt") ?? "";

  if (!tid && !fid) {
    return new Response("ok", { status: 200 });
  }

  if (!WISHMONEY_SECRET) {
    console.error("webhook-wishmoney: WISHMONEY_SECRET is not configured");
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (!wt) {
    console.warn("webhook-wishmoney: rejected — missing webhook token", {
      tid,
      fid,
      method: req.method,
    });

    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const expectedToken = await hmacSha256Hex(WISHMONEY_SECRET, `${tid}:${fid}`);

  if (!timingSafeEqual(wt, expectedToken)) {
    console.warn("webhook-wishmoney: rejected — invalid webhook token", {
      tid,
      fid,
      method: req.method,
    });

    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (!tid || !fid) {
    return new Response(JSON.stringify({ error: "Missing required params: tid and fid" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (status === "failed") {
    console.log("webhook-wishmoney: payment failed", { sid, fid, tid, plan });

    if (req.method === "GET") {
      return new Response(null, {
        status: 302,
        headers: { Location: "https://resumation.co/plans" },
      });
    }

    return new Response(JSON.stringify({ success: false, status: "failed" }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const db = createClient(SUPABASE_URL, SERVICE_KEY);

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
        JSON.stringify({
          success: true,
          generation_id: existing.generation_id,
          note: "already processed",
        }),
        { headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const { data: archiveRow, error: archErr } = await db
      .from("cv_archive")
      .select(
        "form_id, user_id, submission_id, cv_data, " +
          "cv_first_name, cv_last_name, cv_email, cv_phone_number, phone_number, cv_target_job, " +
          "first_name, last_name, email, username, preferred_language, region, selected_language",
      )
      .eq("form_id", fid)
      .single();

    if (archErr || !archiveRow) {
      console.error("webhook-wishmoney: cv_archive not found", { fid, archErr });

      return new Response(JSON.stringify({ error: "cv_archive record not found for fid: " + fid }), {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: newRow, error: insertErr } = await db
      .from("order_generations")
      .insert({
        form_id: fid,
        user_id: archiveRow.user_id,
        submission_id: sid || archiveRow.submission_id || "",
        cv_data: archiveRow.cv_data,

        cv_first_name: archiveRow.cv_first_name ?? null,
        cv_last_name: archiveRow.cv_last_name ?? null,
        cv_email: archiveRow.cv_email ?? null,
        cv_phone_number: archiveRow.cv_phone_number ?? archiveRow.phone_number ?? null,
        cv_target_job: archiveRow.cv_target_job ?? null,

        first_name: archiveRow.first_name ?? null,
        last_name: archiveRow.last_name ?? null,
        email: archiveRow.email ?? null,
        username: archiveRow.username ?? null,
        preferred_language: archiveRow.preferred_language ?? null,
        region: archiveRow.region ?? null,

        package_name: plan,
        payment_method: "wishmoney",
        transaction_id: tid,
        wishmoney_order_id: tid,
        selected_language: archiveRow.selected_language ?? "en",
      })
      .select("generation_id")
      .single();

    if (insertErr || !newRow) {
      console.error("webhook-wishmoney: INSERT into order_generations failed", insertErr);

      return new Response(
        JSON.stringify({
          error: "Failed to create order_generation row",
          details: String(insertErr),
        }),
        {
          status: 200,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }

    const generation_id = newRow.generation_id as string;
    const coinsToAdd = PLAN_COINS[plan] ?? 0;

    await awardCoinsSafely({
      db,
      userId: archiveRow.user_id,
      plan,
      generationId: generation_id,
      coinsToAdd,
    });

    const recipientEmail = archiveRow.cv_email || archiveRow.email || "";

    sendReceiptEmail({
      to: recipientEmail,
      transactionId: tid,
      gatewayVoucher: tid,
      gatewayLabel: "Whish Money Voucher Code",
      plan,
      region: archiveRow.region ?? "LB",
      paymentMethod: "wishmoney",
    }).catch((e) => console.error("webhook-wishmoney: receipt email fire error", e));

    console.log("webhook-wishmoney: payment confirmed — generation row created", {
      generation_id,
      form_id: fid,
      user_id: archiveRow.user_id,
      plan,
      tid,
      amount,
      coins_added: coinsToAdd,
      email_to: recipientEmail,
    });

    if (req.method === "GET") {
      return new Response(null, {
        status: 302,
        headers: {
          Location: `https://resumation.co/success?gid=${generation_id}&tid=${tid}&plan=${plan}`,
        },
      });
    }

    return new Response(JSON.stringify({ success: true, generation_id }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("webhook-wishmoney error:", err);

    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
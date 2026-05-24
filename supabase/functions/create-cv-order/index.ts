import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WISHMONEY_CHANNEL = Deno.env.get("WISHMONEY_CHANNEL") ?? "10199400";
const WISHMONEY_SECRET  = Deno.env.get("WISHMONEY_SECRET") ?? "";
const WISHMONEY_API     = Deno.env.get("WISHMONEY_API_URL") ?? "https://api.whish.money/itel-service/api/payment/whish";
const EF_BASE_URL       = `${SUPABASE_URL}/functions/v1`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const body = await req.json();
    const {
      user_id, email, full_name,
      // submission_id may come as "payment_id" (paid) or "id" (free)
      payment_id, id: freeId,
      plan = "free", region = "LB",
      amount, currency = "USD",
      payment_method = "free",
      has_referral = false,
      coins = 0,
    } = body;

    const submission_id: string = payment_id || freeId || "";
    if (!user_id || !submission_id) {
      return new Response(JSON.stringify({ error: "user_id and submission_id required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const db = createClient(SUPABASE_URL, SERVICE_KEY);

    // Upsert cv_archive record
    await db.from("cv_archive").upsert({
      user_id,
      submission_id,
      email,
      package_name: plan,
      payment_method: payment_method === "free" ? "free" : payment_method,
    }, { onConflict: "submission_id", ignoreDuplicates: false });



    // ── FREE PLAN: trigger generate-cv immediately ──
    if (plan === "free" || payment_method === "free") {
      // Fire-and-forget generation
      fetch(`${EF_BASE_URL}/generate-cv`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ submission_id, user_id, plan: "free" }),
      }).catch(e => console.error("generate-cv dispatch failed:", e));

      return new Response(JSON.stringify({ success: true, plan: "free" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── EGYPT / PAYMOB: just record intent, frontend uses static link ──
    if (payment_method === "paymob") {
      return new Response(JSON.stringify({ success: true, plan, payment_method: "paymob" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── LEBANON / WISHMONEY: create payment order ──
    if (payment_method === "whish" || payment_method === "wishmoney") {
      const callbackUrl = `${EF_BASE_URL}/webhook-wishmoney?sid=${submission_id}&user_id=${user_id}&email=${encodeURIComponent(email || "")}&plan=${plan}&amount=${amount}`;

      const wmRes = await fetch(WISHMONEY_API, {
        method: "POST",
        headers: {
          "channel": WISHMONEY_CHANNEL,
          "secret": WISHMONEY_SECRET,
          "websiteUrl": "resumation.co",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount,
          currency: currency || "USD",
          externalId: submission_id,
          successCallbackUrl: callbackUrl,
          successRedirectUrl: "https://resumation.co/package-access",
          failedRedirectUrl: "https://resumation.co/plans",
        }),
      });

      const wmData = await wmRes.json().catch(() => ({}));
      const collectUrl: string =
        wmData?.collectUrl || wmData?.data?.collectUrl ||
        wmData?.url || wmData?.paymentUrl || "";

      if (collectUrl) {
        // Save wishmoney_order_id if available
        const orderId = wmData?.id || wmData?.data?.id || wmData?.orderId || "";
        if (orderId) {
          await db.from("cv_archive")
            .update({ wishmoney_order_id: String(orderId) })
            .eq("submission_id", submission_id);
        }
        return new Response(JSON.stringify({ collectUrl }), {
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      console.error("WishMoney response:", JSON.stringify(wmData));
      return new Response(JSON.stringify({ error: "Failed to create WishMoney order", details: wmData }), {
        status: 502, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown payment_method" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("create-cv-order error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

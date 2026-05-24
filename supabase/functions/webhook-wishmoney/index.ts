import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EF_BASE_URL  = `${SUPABASE_URL}/functions/v1`;

const PLAN_COINS: Record<string, number> = { premium: 50, gold: 100, ai_search: 100 };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url    = new URL(req.url);
  const sid    = url.searchParams.get("sid")     || "";
  const userId = url.searchParams.get("user_id") || "";
  const plan   = url.searchParams.get("plan")    || "premium";
  const amount = url.searchParams.get("amount")  || "";

  // Also handle POST body
  let bodyData: Record<string, string> = {};
  try {
    if (req.method === "POST") bodyData = await req.json();
  } catch {}

  const externalId = sid || bodyData?.externalId || bodyData?.sid || "";

  // WishMoney test pings arrive with no params — acknowledge silently
  if (!externalId) {
    return new Response("ok", { status: 200 });
  }

  try {
    const db = createClient(SUPABASE_URL, SERVICE_KEY);

    // ── DB-level verification (replaces HMAC — WishMoney doesn't sign callbacks) ──
    //
    // 1. submission_id must exist in cv_archive
    // 2. user_id must match the record owner
    // 3. wishmoney_order_id must be set (proves a real order was created earlier)
    // 4. payment_method must not already be "wishmoney" (prevent double-processing)
    const { data: record, error: recErr } = await db
      .from("cv_archive")
      .select("submission_id, user_id, wishmoney_order_id, payment_method")
      .eq("submission_id", externalId)
      .maybeSingle();

    if (recErr || !record) {
      console.error("webhook-wishmoney: submission not found", externalId);
      // Return 200 so WishMoney stops retrying — this may be a stale/duplicate call
      return new Response("ok", { status: 200 });
    }

    // Verify the user_id matches (prevents forged callbacks with a real sid)
    if (userId && record.user_id !== userId) {
      console.error("webhook-wishmoney: user_id mismatch", { userId, recordUserId: record.user_id });
      return new Response("ok", { status: 200 });
    }

    // Must have a real WishMoney order on file
    if (!record.wishmoney_order_id) {
      console.error("webhook-wishmoney: no wishmoney_order_id on record", externalId);
      return new Response("ok", { status: 200 });
    }

    // Idempotency — don't process twice
    if (record.payment_method === "wishmoney") {
      console.log("webhook-wishmoney: already processed, skipping", externalId);
      if (req.method === "GET") {
        return new Response(null, {
          status: 302,
          headers: { Location: "https://resumation.co/package-access" },
        });
      }
      return new Response(JSON.stringify({ success: true, note: "already processed" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Update cv_archive
    await db.from("cv_archive")
      .update({
        package_name:   plan,
        payment_method: "wishmoney",
        transaction_id: externalId,
      })
      .eq("submission_id", externalId);

    // Add coins
    const resolvedUserId = record.user_id || userId;
    const coinsToAdd     = PLAN_COINS[plan] ?? 0;

    if (coinsToAdd > 0 && resolvedUserId) {
      const { data: usr } = await db
        .from("users")
        .select("search_coins")
        .eq("id", resolvedUserId)
        .single();

      const current = usr?.search_coins ?? 0;
      await db.from("users")
        .update({ search_coins: current + coinsToAdd })
        .eq("id", resolvedUserId);

      await db.from("coin_transactions").insert({
        user_id:   resolvedUserId,
        amount:    coinsToAdd,
        reason:    `plan_purchase_${plan}`,
        reference: externalId,
      });
    }

    // Trigger CV generation (non-blocking)
    if (plan !== "ai_search" && resolvedUserId) {
      fetch(`${EF_BASE_URL}/generate-cv`, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ submission_id: externalId, user_id: resolvedUserId, plan }),
      }).catch(e => console.error("generate-cv dispatch:", e));
    }

    // WishMoney expects a redirect for GET callbacks
    if (req.method === "GET") {
      return new Response(null, {
        status: 302,
        headers: { Location: "https://resumation.co/package-access" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("webhook-wishmoney error:", err);
    // Return 200 to prevent infinite retries from WishMoney
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

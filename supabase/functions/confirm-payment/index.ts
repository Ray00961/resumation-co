import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EF_BASE_URL  = `${SUPABASE_URL}/functions/v1`;

// Coin rewards per plan
const PLAN_COINS: Record<string, number> = {
  premium:   50,
  gold:      100,
  ai_search: 100,
};

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
  // ─────────────────────────────────────────────────────────────────────────

  try {
    const {
      submission_id,
      paymob_order_id,
      amount,
      source = "paymob",
    } = await req.json();

    // Always use authenticated user's ID — never trust user_id from the body
    const user_id    = user.id;
    const login_email = user.email ?? "";

    if (!submission_id) {
      return new Response(JSON.stringify({ error: "submission_id required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const db = createClient(SUPABASE_URL, SERVICE_KEY);

    // ── Verify the submission belongs to this user ──
    const { data: archiveRow, error: arcErr } = await db
      .from("cv_archive")
      .select("submission_id, package_name")
      .eq("submission_id", submission_id)
      .eq("user_id", user_id)          // ownership check
      .maybeSingle();

    if (arcErr || !archiveRow) {
      return new Response(JSON.stringify({ error: "Submission not found or access denied" }), {
        status: 403, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── Plan comes from DB, not from the request body ──
    const plan = archiveRow.package_name ?? "premium";

    // Update cv_archive with payment confirmation
    await db.from("cv_archive")
      .update({
        payment_method:  source,
        transaction_id:  paymob_order_id || null,
        paymob_order_id: paymob_order_id || null,
      })
      .eq("submission_id", submission_id)
      .eq("user_id", user_id);

    // Add coins to user's account
    const coinsToAdd = PLAN_COINS[plan] ?? 0;
    if (coinsToAdd > 0) {
      await db.rpc("add_coins", {
        p_user_id:   user_id,
        p_amount:    coinsToAdd,
        p_reason:    `plan_purchase_${plan}`,
        p_reference: submission_id,
      }).catch(async () => {
        // Fallback: direct update if RPC doesn't exist yet
        const { data: usr } = await db.from("users").select("search_coins").eq("id", user_id).single();
        const current = usr?.search_coins ?? 0;
        await db.from("users").update({ search_coins: current + coinsToAdd }).eq("id", user_id);
        await db.from("coin_transactions").insert({
          user_id,
          amount:    coinsToAdd,
          reason:    `plan_purchase_${plan}`,
          reference: submission_id,
        });
      });
    }

    // Trigger CV generation (non-blocking) — skip for ai_search (no CV build)
    if (plan !== "ai_search") {
      fetch(`${EF_BASE_URL}/generate-cv`, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ submission_id, user_id, plan }),
      }).catch(e => console.error("generate-cv dispatch failed:", e));
    }

    return new Response(JSON.stringify({ success: true, plan, coins_added: coinsToAdd }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("confirm-payment error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

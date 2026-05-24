import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Operations exposed to authenticated users: deduct | check
// "add" is intentionally removed — coins are added only by internal Edge Functions
//  (confirm-payment, webhook-wishmoney) using the service role key directly.
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

  // Verify the token and get the caller's identity
  const authDb = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: { user }, error: authErr } = await authDb.auth.getUser(token);
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  // ─────────────────────────────────────────────────────────────────────────

  try {
    const { operation, amount, reason, reference } = await req.json();

    // Always use the authenticated user's ID — never trust user_id from the body
    const user_id = user.id;

    const db = createClient(SUPABASE_URL, SERVICE_KEY);

    // Fetch current balance
    const { data: userData, error: fetchErr } = await db
      .from("users")
      .select("search_coins")
      .eq("id", user_id)
      .single();

    if (fetchErr || !userData) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const current: number = userData.search_coins ?? 0;

    // ── CHECK ──
    if (operation === "check" || !operation) {
      return new Response(JSON.stringify({ balance: current }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── DEDUCT ── (only allowed operation for authenticated users)
    if (operation === "deduct") {
      if (current < (amount || 0)) {
        return new Response(JSON.stringify({ error: "Insufficient coins", balance: current }), {
          status: 402, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      const newBalance = current - (amount || 0);
      await db.from("users").update({ search_coins: newBalance }).eq("id", user_id);
      await db.from("coin_transactions").insert({
        user_id,
        amount:    -(amount || 0),
        reason:    reason || "manual_deduct",
        reference: reference || null,
      });
      return new Response(JSON.stringify({ success: true, balance: newBalance }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── ADD is blocked ── (internal use only via service role)
    if (operation === "add") {
      return new Response(JSON.stringify({ error: "Operation 'add' is not allowed via this endpoint" }), {
        status: 403, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown operation. Use: deduct | check" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("manage-coins error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

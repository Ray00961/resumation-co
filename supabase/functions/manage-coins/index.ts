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

    // ── CHECK ── read current balance via service role (safe, no race condition)
    if (operation === "check" || !operation) {
      const db = createClient(SUPABASE_URL, SERVICE_KEY);
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
      return new Response(JSON.stringify({ balance: userData.search_coins ?? 0 }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── DEDUCT ── atomic via spend_coins RPC — eliminates TOCTOU race condition.
    // spend_coins uses FOR UPDATE + auth.uid() internally so the SELECT and UPDATE
    // run atomically inside a single DB transaction — no double-spend possible.
    // Must call via a user-scoped client (not service role) so PostgREST sets
    // auth.uid() correctly; service role bypasses RLS and leaves auth.uid() NULL.
    if (operation === "deduct") {
      const userDb = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: result, error: spendErr } = await userDb.rpc("spend_coins", {
        p_amount:    amount    || 0,
        p_reason:    reason    || "manual_deduct",
        p_reference: reference || null,
      });
      if (spendErr) {
        console.error("manage-coins: spend_coins RPC error:", spendErr);
        return new Response(
          JSON.stringify({ error: "Coin operation failed", detail: spendErr.message }),
          { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }
      if (!result?.success) {
        return new Response(
          JSON.stringify({ error: result?.error ?? "Insufficient coins", balance: result?.balance ?? 0 }),
          { status: 402, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: true, balance: result.balance }),
        { headers: { ...cors, "Content-Type": "application/json" } }
      );
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

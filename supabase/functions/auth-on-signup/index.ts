import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generatePromoCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "RSM-";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// Called by Supabase Auth Hook (Database Webhook on auth.users INSERT)
// Configure in Supabase Dashboard → Auth → Hooks → "After user.created"
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const payload = await req.json();

    // Supabase Auth Hook payload format
    const user = payload?.record ?? payload?.user ?? payload;
    const userId: string = user?.id;
    const email: string  = user?.email ?? "";
    const meta           = user?.raw_user_meta_data ?? user?.user_metadata ?? {};
    const fullName: string = meta?.full_name ?? meta?.name ?? "";

    if (!userId) return new Response(JSON.stringify({ error: "No user id" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

    const db = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Create public.users record (idempotent)
    let promoCode = generatePromoCode();
    // Ensure promo code uniqueness
    for (let i = 0; i < 5; i++) {
      const { data: existing } = await db.from("users").select("id").eq("promo_code", promoCode).maybeSingle();
      if (!existing) break;
      promoCode = generatePromoCode();
    }

    // is_founder: the DB trigger (trg_generate_promo_code) is only WHEN promo_code IS NULL
    // but auth-on-signup pre-generates a code and passes it here, so the trigger fires
    // for rows WITH promo_code IS NULL only — our row has a code, trigger is skipped.
    // Must compute is_founder explicitly using the same date threshold as the trigger.
    const is_founder = new Date() < new Date("2026-07-01T00:00:00Z");

    await db.from("users").upsert({
      id: userId,
      email,
      promo_code: promoCode,
      search_coins: 0,
      is_founder,
      agreed_to_terms: false,
    }, { onConflict: "id", ignoreDuplicates: true });

    // Create public.profiles record (idempotent)
    await db.from("profiles").upsert({
      id: userId,
      first_name: fullName.split(" ")[0] || "",
      last_name:  fullName.split(" ").slice(1).join(" ") || "",
    }, { onConflict: "id", ignoreDuplicates: true });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("auth-on-signup error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

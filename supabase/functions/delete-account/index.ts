import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    // ── 1. Verify caller's JWT ──
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const db = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: { user }, error: authErr } = await db.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const uid = user.id;

    // ── 2. Collect storage file paths BEFORE deleting rows ──
    const { data: cvRows }  = await db
      .from("cv_archive")
      .select("cv_file_path")
      .eq("user_id", uid);

    const { data: analysisRows } = await db
      .from("cv_analysis_requests")
      .select("rewritten_cv_file_path")
      .eq("user_id", uid);

    // ── 3. Delete in FK-safe order ──

    // ai_hunter_logs references cv_archive.form_id → must go first
    await db.from("ai_hunter_logs").delete().eq("user_id", uid);

    // cv_archive
    await db.from("cv_archive").delete().eq("user_id", uid);

    // cv_analysis_requests
    await db.from("cv_analysis_requests").delete().eq("user_id", uid);

    // coin_transactions references users.id
    await db.from("coin_transactions").delete().eq("user_id", uid);

    // referral_log references users.id on both columns
    await db.from("referral_log").delete().or(`referrer_id.eq.${uid},referred_id.eq.${uid}`);

    // profiles references auth.users.id
    await db.from("profiles").delete().eq("id", uid);

    // users
    await db.from("users").delete().eq("id", uid);

    // ── 4. Remove storage files ──
    const filePaths: string[] = [];
    (cvRows ?? []).forEach((r: any) => { if (r.cv_file_path) filePaths.push(r.cv_file_path); });
    (analysisRows ?? []).forEach((r: any) => { if (r.rewritten_cv_file_path) filePaths.push(r.rewritten_cv_file_path); });

    if (filePaths.length > 0) {
      const { error: storageErr } = await db.storage.from("cv-documents").remove(filePaths);
      if (storageErr) console.warn("Storage cleanup partial error:", storageErr.message);
    }

    // ── 5. Delete auth user (last — point of no return) ──
    const { error: deleteErr } = await db.auth.admin.deleteUser(uid);
    if (deleteErr) {
      // Data is already wiped; log but don't fail the response
      console.error("auth.admin.deleteUser failed:", deleteErr.message);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("delete-account error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

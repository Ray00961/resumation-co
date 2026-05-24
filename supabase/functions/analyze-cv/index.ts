import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY   = Deno.env.get("OPENAI_API_KEY")!;

// ── Fixed server-side prompts — NOT client-controlled ────────────────────────
const SYSTEM_PROMPTS: Record<string, string> = {
  position_titles: `You are a world-class career advisor and ATS specialist with deep expertise in Arab and international job markets.
Respond in the same language as the CV data or the user's question.
Suggest the top 7-10 professional, relevant job titles that perfectly align with this candidate's experience, skills, and education.
Format as a numbered list with a brief 1-2 sentence explanation for each title.`,

  target_markets: `You are a world-class career advisor and market analyst with deep expertise in Arab and international job markets.
Respond in the same language as the CV data or the user's question.
Identify the top 5-7 target industries, markets, and sectors for this candidate's job search.
For each, explain why it's a great fit, which types of companies to target, and what the market looks like in that sector.`,

  jd_analysis_rewrite: `You are an expert ATS resume writer and career coach.
Respond in the same language as the CV data or the user's question.
Analyze the job description provided and rewrite the candidate's CV to align with it.
Return well-formatted, ATS-optimized content with strong action verbs and quantifiable results.`,

  jd_matching: `You are a world-class career advisor and ATS specialist.
Respond in the same language as the CV data or the user's question.
Analyze how well this candidate matches the provided job description.
Identify key alignments, gaps, and specific recommendations to improve their application.
Use professional, detailed formatting with numbered lists and clear headers.`,

  cv_rewrite: `You are an expert ATS resume writer and professional career coach.
Respond in the same language as the CV data.
Rewrite and optimize this candidate's CV to be compelling, ATS-friendly, and recruiter-grade.
Use strong action verbs, quantifiable achievements, and a clear professional structure.`,

  default: `You are a world-class career advisor and ATS specialist with deep expertise in Arab and international job markets.
Respond in the same language as the CV data or the user's question.
Use professional, detailed formatting with numbered lists and clear headers.`,
};
// ─────────────────────────────────────────────────────────────────────────────

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
      query_type,  // 'position_titles' | 'target_markets' | 'jd_analysis_rewrite' | 'jd_matching' | 'cv_rewrite'
      question,    // the question text (may be omitted — falls back to analysis.jd_json.description)
      gpt_results, // cv_gpt_result jsonb
      sub_id,      // submission_id (optional — for ownership check)
      analysis,    // cv_analysis_requests record (pre-inserted by client for realtime tracking)
    } = await req.json();

    // Resolve question: explicit field first, then from the analysis record's jd_json
    const resolvedQuestion: string =
      question?.trim() ||
      analysis?.jd_json?.description?.trim() ||
      "";

    if (!resolvedQuestion) {
      return new Response(JSON.stringify({ error: "question is required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const db = createClient(SUPABASE_URL, SERVICE_KEY);

    // ── Ownership check: sub_id must belong to authenticated user ────────────
    if (sub_id) {
      const { data: arc } = await db
        .from("cv_archive")
        .select("user_id")
        .eq("submission_id", sub_id)
        .maybeSingle();

      if (arc && arc.user_id !== user.id) {
        return new Response(JSON.stringify({ error: "Access denied" }), {
          status: 403, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Server-controlled system prompt — ignores anything sent by the client
    const systemMsg = SYSTEM_PROMPTS[query_type ?? ""] ?? SYSTEM_PROMPTS.default;

    const userMsg = gpt_results
      ? `CV Data:\n${JSON.stringify(gpt_results, null, 2)}\n\n${resolvedQuestion}`
      : resolvedQuestion;

    // ── Call OpenAI ──────────────────────────────────────────────────────────
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 2500,
        temperature: 0.4,
        messages: [
          { role: "system", content: systemMsg },
          { role: "user",   content: userMsg },
        ],
      }),
    });

    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);

    const data   = await res.json();
    const result = data.choices?.[0]?.message?.content?.trim() ?? "";

    // ── Update cv_analysis_requests record ───────────────────────────────────
    const recordId: string = analysis?.id || analysis?.analysis_id || "";
    if (recordId) {
      const updateData = query_type === "jd_analysis_rewrite" || query_type === "cv_rewrite"
        ? { rewritten_cv_result: result }
        : { analysis_result: result };

      await db.from("cv_analysis_requests")
        .update(updateData)
        .eq("id", recordId);
    }

    return new Response(JSON.stringify({ result, record_id: recordId }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("analyze-cv error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

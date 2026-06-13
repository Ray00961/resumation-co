import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

type SnapshotResult = {
  career_level?: string;
  ats_score?: number;
  professional_summary?: string;
  strengths?: unknown[];
  improvements?: unknown[];
};

type CvArchiveRow = {
  form_id: string;
  user_id: string;
  submission_id: string | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_number: string | null;
  preferred_language: string | null;
  region: string | null;
  cv_first_name: string | null;
  cv_last_name: string | null;
  cv_full_name_ar: string | null;
  cv_phone_number: string | null;
  cv_email: string | null;
  cv_target_job: string | null;
  cv_data: Record<string, any> | null;
  selected_language: string | null;
  gender: string | null;
  form_version: string | null;
};

function jsonResponse(payload: unknown, status = 200, headers: Record<string, string>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers,
  });
}

function safeString(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeCareerLevel(value: unknown) {
  const raw = safeString(value);
  const allowed = new Set([
    "Fresh Graduate",
    "Junior",
    "Mid-Level",
    "Senior",
    "Executive",
  ]);

  return allowed.has(raw) ? raw : "Mid-Level";
}

function normalizeAtsScore(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 50;
  return Math.max(1, Math.min(100, Math.round(n)));
}

function normalizeStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const cleaned = value
    .map((item) => safeString(item))
    .filter(Boolean)
    .slice(0, 3);

  while (cleaned.length < 3) {
    cleaned.push(fallback[cleaned.length] || "Improve career profile clarity");
  }

  return cleaned;
}

function normalizeTextArray(value: unknown, limit = 50) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => safeString(item))
        .filter(Boolean)
    )
  ).slice(0, limit);
}

function splitFullName(fullName: string) {
  const cleaned = safeString(fullName).replace(/\s+/g, " ");
  if (!cleaned) return { firstName: "", lastName: "" };

  const parts = cleaned.split(" ");
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || "",
  };
}

function buildDuration(item: any) {
  const start = safeString(item?.startDate) ||
    [safeString(item?.startMonth), safeString(item?.startYear)].filter(Boolean).join("/");
  const end = item?.isCurrent
    ? "Present"
    : safeString(item?.endDate) ||
      [safeString(item?.endMonth), safeString(item?.endYear)].filter(Boolean).join("/");

  if (start && end) return `${start} - ${end}`;
  return start || end || "";
}

function normalizeProfileExperience(workExperience: unknown) {
  if (!Array.isArray(workExperience)) return [];

  return workExperience
    .map((item) => ({
      title: safeString(item?.jobTitle || item?.title),
      company: safeString(item?.company),
      duration: buildDuration(item),
      description: safeString(item?.responsibilities || item?.description),
    }))
    .filter((item) => item.title || item.company || item.description);
}

function normalizeProfileEducation(education: unknown) {
  if (!Array.isArray(education)) return [];

  return education
    .map((item) => ({
      degree: safeString(item?.degree),
      institution: safeString(item?.university || item?.school || item?.institution),
      major: safeString(item?.major),
      year: safeString(item?.graduationYear || item?.endYear || item?.year),
    }))
    .filter((item) => item.degree || item.institution || item.major || item.year);
}

function buildProfilePayload(params: {
  userId: string;
  archive: CvArchiveRow;
  userRow: Record<string, any> | null;
  cvData: Record<string, any>;
  snapshotData: Record<string, any>;
  careerLevel: string;
  atsScore: number;
  professionalSummary: string;
  strengths: string[];
  improvements: string[];
}) {
  const {
    userId,
    archive,
    userRow,
    cvData,
    snapshotData,
    careerLevel,
    atsScore,
    professionalSummary,
    strengths,
    improvements,
  } = params;

  const fullName = safeString(cvData.fullName);
  const splitName = splitFullName(fullName);

  const firstName =
    safeString(archive.cv_first_name) ||
    safeString(archive.first_name) ||
    safeString(userRow?.first_name) ||
    splitName.firstName;

  const lastName =
    safeString(archive.cv_last_name) ||
    safeString(archive.last_name) ||
    safeString(userRow?.last_name) ||
    splitName.lastName;

  const targetJob =
    safeString(cvData.targetJob) ||
    safeString(archive.cv_target_job);

  const location =
    safeString(cvData.location) ||
    safeString(cvData.currentLocation) ||
    safeString(archive.region) ||
    safeString(userRow?.region);

  const phone =
    safeString(cvData.phone) ||
    safeString(archive.cv_phone_number) ||
    safeString(archive.phone_number);

  const cvEmail =
    safeString(cvData.cvEmail) ||
    safeString(archive.cv_email) ||
    safeString(archive.email) ||
    safeString(userRow?.email);

  const skills = normalizeTextArray(cvData.technicalSkills, 80);
  const education = normalizeProfileEducation(cvData.education);
  const experience = normalizeProfileExperience(cvData.workExperience);

  return {
    id: userId,

    first_name: firstName,
    last_name: lastName,
    username: safeString(archive.username) || safeString(userRow?.username) || null,

    headline: targetJob || null,
    location: location || null,
    website: safeString(cvData.linkedin) || null,
    phone: phone || null,

    about: professionalSummary || null,
    ai_summary: professionalSummary || null,

    target_jobs: targetJob ? [targetJob] : [],
    skills,
    experience,
    education,

    full_name_ar: safeString(cvData.fullNameArabic) || safeString(archive.cv_full_name_ar) || null,
    gender: safeString(cvData.gender) || safeString(archive.gender) || null,

    nationality: safeString(cvData.nationality) || null,
    cv_email: cvEmail || null,
    target_job: targetJob || null,

    career_form_id: archive.form_id,
    career_submission_id: archive.submission_id,

    career_level: careerLevel,
    ats_score: atsScore,
    career_snapshot: snapshotData,
    snapshot_strengths: strengths,
    snapshot_improvements: improvements,
    snapshot_generated_at: snapshotData.snapshot_generated_at,

    updated_at: new Date().toISOString(),
  };
}

serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, cors);
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_KEY || !OPENAI_KEY) {
      throw new Error("Missing required environment variables");
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token) {
      return jsonResponse({ error: "Missing authorization header" }, 401, cors);
    }

    const authDb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const {
      data: { user: callerUser },
      error: authError,
    } = await authDb.auth.getUser(token);

    if (authError || !callerUser) {
      return jsonResponse({ error: "Unauthorized" }, 401, cors);
    }

    const body = await req.json().catch(() => ({}));
    const userId = safeString(body?.userId);
    const formId = safeString(body?.formId);
    const language = safeString(body?.language || body?.lang || "en") || "en";

    if (!userId) {
      return jsonResponse({ error: "Missing userId" }, 400, cors);
    }

    if (!formId) {
      return jsonResponse({ error: "Missing formId" }, 400, cors);
    }

    if (callerUser.id !== userId) {
      return jsonResponse({ error: "Forbidden: userId mismatch" }, 403, cors);
    }

    const db = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: archive, error: archiveError } = await db
      .from("cv_archive")
      .select("*")
      .eq("user_id", userId)
      .eq("form_id", formId)
      .eq("form_purpose", "career_profile")
      .eq("snapshot_enabled", true)
      .maybeSingle();

    if (archiveError) {
      throw new Error(`Failed to read cv_archive: ${archiveError.message}`);
    }

    if (!archive) {
      return jsonResponse(
        {
          error:
            "No matching career_profile cv_archive row found for this userId and formId",
        },
        404,
        cors
      );
    }

    const cvData = (archive as CvArchiveRow).cv_data;

    if (!cvData || typeof cvData !== "object") {
      return jsonResponse({ error: "cv_archive.cv_data is empty" }, 400, cors);
    }

    const { data: userRow, error: userReadError } = await db
      .from("users")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (userReadError) {
      throw new Error(`Failed to read users row: ${userReadError.message}`);
    }

    const prompt = `
You are a senior career assessment expert for an AI Career Platform.

Analyze the candidate profile and return ONLY valid JSON.

Required JSON schema:

{
  "career_level": "",
  "ats_score": 0,
  "professional_summary": "",
  "strengths": [],
  "improvements": []
}

Rules:
- career_level must be one of:
  Fresh Graduate
  Junior
  Mid-Level
  Senior
  Executive

- ats_score must be an integer from 1 to 100.
- strengths must contain exactly 3 short items.
- improvements must contain exactly 3 practical items.
- professional_summary must be 3 to 4 sentences.
- Do not invent facts.
- Use the candidate data only.
- If language is "ar", write the professional_summary, strengths, and improvements in Arabic.
- If language is "en", write the professional_summary, strengths, and improvements in English.
- Keep the tone professional, clear, and realistic.

Candidate language:
${language}

Candidate cv_archive metadata:
${JSON.stringify(
  {
    user_id: archive.user_id,
    form_id: archive.form_id,
    submission_id: archive.submission_id,
    username: archive.username,
    email: archive.email,
    cv_target_job: archive.cv_target_job,
    selected_language: archive.selected_language,
    form_version: archive.form_version,
  },
  null,
  2
)}

Candidate CV data:
${JSON.stringify(cvData, null, 2)}
`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "Return valid JSON only. No markdown. No explanations.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      throw new Error(`OpenAI error ${aiRes.status}: ${await aiRes.text()}`);
    }

    const aiData = await aiRes.json();
    const raw = aiData?.choices?.[0]?.message?.content ?? "{}";

    let parsed: SnapshotResult;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("OpenAI did not return valid JSON");
    }

    const careerLevel = normalizeCareerLevel(parsed.career_level);
    const atsScore = normalizeAtsScore(parsed.ats_score);
    const professionalSummary = safeString(parsed.professional_summary);

    const strengths = normalizeStringArray(parsed.strengths, [
      "Relevant professional experience",
      "Clear career direction",
      "Transferable skills",
    ]);

    const improvements = normalizeStringArray(parsed.improvements, [
      "Add measurable achievements",
      "Strengthen role-specific keywords",
      "Clarify target job direction",
    ]);

    const generatedAt = new Date().toISOString();

    const snapshotData = {
      career_level: careerLevel,
      ats_score: atsScore,
      professional_summary: professionalSummary,
      strengths,
      improvements,
      model: "gpt-4o-mini",
      language,
      generated_from: {
        user_id: archive.user_id,
        form_id: archive.form_id,
        submission_id: archive.submission_id,
      },
      usage: aiData?.usage ?? null,
      snapshot_generated_at: generatedAt,
    };

    const { data: updatedRows, error: updateError } = await db
      .from("cv_archive")
      .update({
        career_snapshot: snapshotData,
        career_level: careerLevel,
        ats_score: atsScore,
        snapshot_professional_summary: professionalSummary,
        snapshot_strengths: strengths,
        snapshot_improvements: improvements,
        snapshot_generated_at: generatedAt,
      })
      .eq("user_id", userId)
      .eq("form_id", formId)
      .select(
        "form_id,user_id,submission_id,career_level,ats_score,snapshot_professional_summary,snapshot_strengths,snapshot_improvements,snapshot_generated_at,career_snapshot"
      );

    if (updateError) {
      throw new Error(`Failed to update cv_archive: ${updateError.message}`);
    }

    const updated = Array.isArray(updatedRows) ? updatedRows[0] ?? null : null;

    const profilePayload = buildProfilePayload({
      userId,
      archive: archive as CvArchiveRow,
      userRow: userRow ?? null,
      cvData,
      snapshotData,
      careerLevel,
      atsScore,
      professionalSummary,
      strengths,
      improvements,
    });

    const { data: profileRows, error: profileError } = await db
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" })
      .select(
        "id,username,career_form_id,career_submission_id,career_level,ats_score,ai_summary,target_job,snapshot_generated_at"
      );

    if (profileError) {
      throw new Error(`Failed to upsert profiles: ${profileError.message}`);
    }

    const profile = Array.isArray(profileRows) ? profileRows[0] ?? null : null;

    return jsonResponse(
      {
        success: true,
        formId,
        userId,
        snapshot: snapshotData,
        updated,
        profile,
      },
      200,
      cors
    );
  } catch (err: any) {
    console.error("generate-career-snapshot error:", err);

    return jsonResponse(
      {
        success: false,
        error: err?.message ?? "Unknown error",
      },
      500,
      cors
    );
  }
});

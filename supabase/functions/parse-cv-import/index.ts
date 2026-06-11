import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { extractedText, language } = await req.json();

    if (!OPENAI_KEY) {
      return json({ error: "OPENAI_API_KEY is not configured" }, 500);
    }

    if (!extractedText || typeof extractedText !== "string" || !extractedText.trim()) {
      return json({ error: "extractedText is required" }, 400);
    }

    const cleanText = extractedText
      .replace(/\u0000/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{4,}/g, "\n\n\n")
      .trim();

    if (cleanText.length < 80) {
      return json({ error: "CV text is too short to parse" }, 400);
    }

    if (cleanText.length > 30000) {
      return json({ error: "CV text is too long. Please upload a shorter CV." }, 400);
    }

    const prompt = buildPrompt(cleanText, language === "ar" ? "ar" : "en");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.1,
        max_tokens: 3500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? "";
    const parsed = safeParseJson(raw);

    if (!parsed) {
      return json({ error: "Failed to parse CV import JSON" }, 500);
    }

    return json({
      success: true,
      parsedData: normalizeParsedData(parsed),
    });
  } catch (err) {
    console.error("parse-cv-import error:", err);
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeParseJson(raw: string): any | null {
  try {
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function normalizeParsedData(data: any) {
  return {
    fullName: safeString(data.fullName),
    fullNameArabic: safeString(data.fullNameArabic),
    gender: safeString(data.gender),
    phone: safeString(data.phone),
    cvEmail: safeString(data.cvEmail),
    linkedin: safeString(data.linkedin),
    nationality: safeString(data.nationality),
    location: safeString(data.location),
    targetJob: safeString(data.targetJob),

    work: Array.isArray(data.work) ? data.work : [],
    education: Array.isArray(data.education) ? data.education : [],
    technicalSkills: Array.isArray(data.technicalSkills) ? data.technicalSkills : [],
    languages: Array.isArray(data.languages) ? data.languages : [],
    certificates: Array.isArray(data.certificates) ? data.certificates : [],
    projects: Array.isArray(data.projects) ? data.projects : [],
  };
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function buildPrompt(cvText: string, language: "en" | "ar") {
  return `You are a CV data extraction engine inside Resumation.co.

Your task is ONLY to extract existing information from an uploaded CV and convert it into ResumeForm JSON.

STRICT RULES:
- Return VALID JSON only.
- No markdown.
- No code fences.
- No explanation.
- Do NOT rewrite the CV.
- Do NOT improve the CV.
- Do NOT generate a professional summary.
- Do NOT invent missing data.
- If a field is not clearly present, return an empty string or empty array.
- Preserve names, job titles, company names, schools, certificates, dates, and locations as written when possible.
- Sort work experience from newest to oldest if dates are clear.
- Sort education from newest to oldest if dates are clear.
- Extract gender ONLY if explicitly stated or clearly inferable from a dedicated gender field. Do not guess gender from name.
- Extract Arabic full name ONLY if Arabic name appears in the CV. Do not translate the name yourself.
- Keep output keys exactly as defined below.
- Output language preference: ${language}

Return this exact JSON shape:

{
  "fullName": "",
  "fullNameArabic": "",
  "gender": "",
  "phone": "",
  "cvEmail": "",
  "linkedin": "",
  "nationality": "",
  "location": "",
  "targetJob": "",
  "work": [
    {
      "jobTitle": "",
      "company": "",
      "location": "",
      "startMonth": "",
      "startYear": "",
      "endMonth": "",
      "endYear": "",
      "isCurrent": false,
      "description": ""
    }
  ],
  "education": [
    {
      "degree": "",
      "school": "",
      "location": "",
      "startMonth": "",
      "startYear": "",
      "endMonth": "",
      "endYear": "",
      "gpa": "",
      "description": ""
    }
  ],
  "technicalSkills": [],
  "languages": [
    {
      "language": "",
      "level": ""
    }
  ],
  "certificates": [
    {
      "name": "",
      "issuer": "",
      "year": "",
      "description": ""
    }
  ],
  "projects": [
    {
      "name": "",
      "description": "",
      "technologies": "",
      "year": ""
    }
  ]
}

CV TEXT:
"""
${cvText}
"""`;
}
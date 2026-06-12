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
        temperature: 0.05,
        max_tokens: 4500,
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

IMPORTANT DATE RULES:
- If a date range is written as "2022 - 2025", use startYear "2022" and endYear "2025".
- If a date range is written as "2025 - Present", use startYear "2025", endYear "", and isCurrent true.
- If education has one year only, put that year in graduationYear AND endYear.
- If month is not clearly present, keep month empty.
- Never invent months.

EDUCATION EXTRACTION RULES:
- Separate degree and major whenever possible.
- If education is written as "DEST in BUSINESS COMPUTER":
  degree = "DEST"
  major = "BUSINESS COMPUTER"
- If education is written as "Bachelor of Science in Computer Science":
  degree = "Bachelor of Science"
  major = "Computer Science"
- If education is written as "License in Business Administration":
  degree = "License"
  major = "Business Administration"
- Do NOT put country or location into school unless it is clearly the institution name.
- If the line after education is only a country/city plus year, put that value into location and the year into graduationYear/endYear.
- If the school or university name is not clearly present, return school as an empty string.

TECHNICAL SKILLS EXTRACTION RULES:
- Extract technical skills from sections named or similar to:
  Core Competencies, Technical Expertise, Technical Proficiencies, Software, Applications, Specialized Tools, Tools, Technologies, Programming, Systems, Platforms, IT Skills, Computer Skills.
- Include software, platforms, systems, programming languages, databases, cloud tools, IT tools, business tools, healthcare systems, ERP/CRM systems, and security tools.
- Examples of valid technical skills:
  MS Office, Microsoft Power BI, ERP, HIS, EMR, LIS, VMware, NAC, IPS, Firewalls, AlinIQ, HTML, CSS, JavaScript, SQL, Power Platform, SAP, Oracle, Salesforce, AutoCAD.
- Do NOT return empty technicalSkills if the CV has a technical skills/tools/proficiencies section.
- Do NOT include soft skills such as leadership, communication, coaching, facilitation, teamwork, problem solving, or project management unless they are clearly listed as technical tools/platforms.
- Preserve common tool names in their standard spelling when obvious:
  MS OFFICE -> Microsoft Office
  MS POWER BI -> Microsoft Power BI
  JAVASCRIPT -> JavaScript

LANGUAGE EXTRACTION RULES:
- Extract languages from the Languages section only, unless languages are clearly listed elsewhere.
- Normalize language names to English when obvious: Arabic, English, French.
- Normalize levels to one of these exact values when possible:
  Native/Bilingual
  Fluent/Advanced
  Proficient/Intermediate
  Conversational/Basic
- Mapping examples:
  Native, Mother Tongue, Native Speaker -> Native/Bilingual
  Fluent, Advanced, Excellent -> Fluent/Advanced
  Intermediate, Proficient, Good -> Proficient/Intermediate
  Basic, Conversational, Beginner -> Conversational/Basic

CERTIFICATE EXTRACTION RULES:
- Extract certifications/courses from sections named Certifications, Certificates, Courses, Professional Certifications.
- If a certificate includes abbreviation in parentheses, keep the abbreviation in the name.
- Extract issuer only if explicitly present.
- Extract year only if explicitly present.

TARGET JOB RULES:
- Only extract targetJob if the CV clearly states a target role/objective/job title being applied for.
- Do NOT guess targetJob from current job title.

PROJECT RULES:
- Only extract projects if there is a clear Projects section or clearly named projects.
- Do NOT create empty project objects.

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
      "major": "",
      "school": "",
      "location": "",
      "startMonth": "",
      "startYear": "",
      "endMonth": "",
      "endYear": "",
      "graduationYear": "",
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

FINAL CHECK BEFORE RETURNING JSON:
- education.degree must not contain " in " + major if it can be separated.
- education.graduationYear must be filled when an education year is visible.
- technicalSkills must include tools/technologies listed in technical/proficiency sections.
- languages.level must use the exact normalized dropdown values when possible.
- Do not include empty project objects.

CV TEXT:
"""
${cvText}
"""`;
}

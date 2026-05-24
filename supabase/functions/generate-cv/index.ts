import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, Table, TableRow, TableCell,
  WidthType, ShadingType, UnderlineType,
} from "https://esm.sh/docx@8";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY   = Deno.env.get("OPENAI_API_KEY")!;

// ── OpenAI: generate structured CV from raw form data ──────────────────────
async function generateCvJson(cvData: any, plan: string): Promise<any> {
  const isArabic = cvData?.languages?.arabic && cvData?.languages?.arabic !== "None";
  const lang = isArabic ? "ar" : "en";

  const planInstructions: Record<string, string> = {
    free:    "Generate a concise, clean CV. Use 2-3 bullet points per job. Keep professional summary to 2 sentences.",
    premium: "Generate a detailed, ATS-optimized CV. Use 4-5 strong action-verb bullet points per job with quantifiable results. Include a compelling 3-4 sentence professional summary.",
    gold:    "Generate a premium, recruiter-grade CV. Use 5-6 powerful bullet points per job with metrics and impact. Include a commanding 4-5 sentence executive summary. Add LinkedIn-ready formatting suggestions as a separate field.",
  };

  const instruction = planInstructions[plan] || planInstructions.free;

  const systemPrompt = lang === "ar"
    ? `أنت خبير كتابة سيرة ذاتية محترف. ${instruction} أعد بيانات JSON فقط بالتنسيق المحدد.`
    : `You are a professional CV writer and ATS specialist. ${instruction} Return ONLY valid JSON in the specified format.`;

  const userPrompt = `
Create a professional CV JSON from this data:
${JSON.stringify(cvData, null, 2)}

Return ONLY this exact JSON structure (no markdown, no extra text):
{
  "name": "Full Name",
  "targetJob": "Target Job Title",
  "email": "email@example.com",
  "phone": "+xxx xxx xxxx",
  "linkedin": "linkedin.com/in/...",
  "nationality": "...",
  "professionalSummary": "3-4 sentence professional summary optimized for ATS...",
  "workExperience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "location": "City, Country",
      "startDate": "Month Year",
      "endDate": "Month Year or Present",
      "bullets": ["Achieved X by doing Y, resulting in Z%...", "Led team of N to deliver..."]
    }
  ],
  "education": [
    {
      "degree": "Bachelor's / Master's / etc.",
      "major": "Field of Study",
      "university": "University Name",
      "location": "City, Country",
      "graduationYear": "2020"
    }
  ],
  "technicalSkills": ["Skill 1", "Skill 2", "Skill 3"],
  "languages": [
    {"language": "Arabic", "level": "Native"},
    {"language": "English", "level": "Fluent"}
  ],
  "certificates": [
    {"name": "Certificate Name", "institution": "Issuer", "year": "2023"}
  ],
  "projects": [
    {"title": "Project Name", "description": "Brief impactful description", "year": "2023"}
  ]
}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 2000,
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
    }),
  });

  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const raw  = data.choices?.[0]?.message?.content ?? "{}";

  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
  return JSON.parse(cleaned);
}

// ── DOCX builder ────────────────────────────────────────────────────────────
async function buildDocx(cv: any): Promise<Uint8Array> {
  const DARK  = "1A2A4A";
  const TEAL  = "0D8A8A";
  const GRAY  = "5A6B7A";
  const LIGHT = "E8EDF2";

  const divider = new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: TEAL } },
    spacing: { before: 160, after: 160 },
  });

  const sectionHeader = (text: string) => new Paragraph({
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 22, color: TEAL, characterSpacing: 60 })],
    spacing: { before: 240, after: 80 },
  });

  const bullet = (text: string) => new Paragraph({
    bullet: { level: 0 },
    children: [new TextRun({ text, size: 20, color: GRAY })],
    spacing: { before: 40, after: 40 },
  });

  // ── Header section ──
  const header = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: cv.name || "", bold: true, size: 52, color: DARK })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: cv.targetJob || "", size: 28, color: TEAL, italics: true })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: [cv.email, cv.phone, cv.linkedin, cv.nationality].filter(Boolean).join("   |   "), size: 18, color: GRAY }),
      ],
      spacing: { after: 60 },
    }),
    divider,
  ];

  // ── Professional Summary ──
  const summary = cv.professionalSummary ? [
    sectionHeader("Professional Summary"),
    new Paragraph({
      children: [new TextRun({ text: cv.professionalSummary, size: 20, color: GRAY })],
      spacing: { after: 80 },
    }),
    divider,
  ] : [];

  // ── Work Experience ──
  const workSection: Paragraph[] = [sectionHeader("Work Experience")];
  for (const job of (cv.workExperience || [])) {
    workSection.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${job.title || ""} `, bold: true, size: 22, color: DARK }),
          new TextRun({ text: `— ${job.company || ""}`, size: 22, color: TEAL }),
        ],
        spacing: { before: 160, after: 40 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: `${job.location || ""}   •   ${job.startDate || ""} – ${job.endDate || "Present"}`, size: 18, color: GRAY, italics: true }),
        ],
        spacing: { after: 60 },
      }),
      ...(job.bullets || []).map((b: string) => bullet(b))
    );
  }
  workSection.push(divider);

  // ── Education ──
  const eduSection: Paragraph[] = [sectionHeader("Education")];
  for (const edu of (cv.education || [])) {
    eduSection.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${edu.degree || ""} in ${edu.major || ""}`, bold: true, size: 22, color: DARK }),
        ],
        spacing: { before: 160, after: 40 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: `${edu.university || ""}  •  ${edu.location || ""}  •  ${edu.graduationYear || ""}`, size: 18, color: GRAY, italics: true }),
        ],
        spacing: { after: 80 },
      })
    );
  }
  eduSection.push(divider);

  // ── Technical Skills ──
  const skillSection: Paragraph[] = [];
  if ((cv.technicalSkills || []).length > 0) {
    skillSection.push(
      sectionHeader("Technical Skills"),
      new Paragraph({
        children: [new TextRun({ text: (cv.technicalSkills || []).join("   •   "), size: 20, color: GRAY })],
        spacing: { after: 80 },
      }),
      divider
    );
  }

  // ── Languages ──
  const langSection: Paragraph[] = [];
  if ((cv.languages || []).length > 0) {
    langSection.push(
      sectionHeader("Languages"),
      new Paragraph({
        children: [
          new TextRun({
            text: (cv.languages as Array<{language: string, level: string}>)
              .map(l => `${l.language}: ${l.level}`)
              .join("   |   "),
            size: 20,
            color: GRAY,
          }),
        ],
        spacing: { after: 80 },
      }),
      divider
    );
  }

  // ── Certificates ──
  const certSection: Paragraph[] = [];
  if ((cv.certificates || []).filter((c: any) => c.name).length > 0) {
    certSection.push(sectionHeader("Certifications"));
    for (const cert of cv.certificates) {
      if (!cert.name) continue;
      certSection.push(new Paragraph({
        children: [
          new TextRun({ text: `${cert.name}`, bold: true, size: 20, color: DARK }),
          new TextRun({ text: `  —  ${cert.institution || ""}  (${cert.year || ""})`, size: 18, color: GRAY }),
        ],
        spacing: { before: 60, after: 60 },
      }));
    }
    certSection.push(divider);
  }

  // ── Projects ──
  const projSection: Paragraph[] = [];
  if ((cv.projects || []).filter((p: any) => p.title).length > 0) {
    projSection.push(sectionHeader("Projects"));
    for (const proj of cv.projects) {
      if (!proj.title) continue;
      projSection.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${proj.title}`, bold: true, size: 20, color: DARK }),
            new TextRun({ text: proj.year ? `  (${proj.year})` : "", size: 18, color: GRAY }),
          ],
          spacing: { before: 120, after: 40 },
        }),
        new Paragraph({
          children: [new TextRun({ text: proj.description || "", size: 18, color: GRAY })],
          spacing: { after: 60 },
        })
      );
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 20, color: GRAY },
          paragraph: { spacing: { line: 276 } },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 900, right: 900, bottom: 900, left: 900 },
        },
      },
      children: [
        ...header,
        ...summary,
        ...workSection,
        ...eduSection,
        ...skillSection,
        ...langSection,
        ...certSection,
        ...projSection,
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}

// ── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // ── Auth: internal (service role) OR authenticated user ──────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  const token      = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return new Response(JSON.stringify({ error: "Missing authorization header" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  // Internal call from another Edge Function uses the SERVICE_KEY directly
  const isInternalCall = token === SERVICE_KEY;

  let callerUserId: string | null = null;

  if (!isInternalCall) {
    // External call — verify JWT and get user identity
    const authDb = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authErr } = await authDb.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    callerUserId = user.id;
  }
  // ─────────────────────────────────────────────────────────────────────────

  try {
    const { submission_id, user_id, plan = "free" } = await req.json();
    if (!submission_id) {
      return new Response(JSON.stringify({ error: "submission_id required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Fetch cv_archive record
    const { data: record, error: fetchErr } = await db
      .from("cv_archive")
      .select("*")
      .eq("submission_id", submission_id)
      .maybeSingle();

    if (fetchErr || !record) {
      return new Response(JSON.stringify({ error: "cv_archive record not found" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── Ownership check for non-internal calls ──
    if (!isInternalCall && record.user_id !== callerUserId) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const cvData = record.cv_data;
    if (!cvData) {
      return new Response(JSON.stringify({ error: "cv_data is empty" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Step 1: Generate structured CV via OpenAI
    const cvJson = await generateCvJson(cvData, plan || record.package_name || "free");

    // Step 2: Build DOCX
    const docxBytes = await buildDocx(cvJson);

    // Step 3: Upload to Supabase Storage
    const uid      = record.user_id || user_id;
    const fileName = `${uid}/${submission_id}.docx`;
    const { error: uploadErr } = await db.storage
      .from("cv-documents")
      .upload(fileName, docxBytes, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });

    if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);

    // Step 4: Get signed URL (90 days — reduced from 1 year)
    const { data: signedData } = await db.storage
      .from("cv-documents")
      .createSignedUrl(fileName, 60 * 60 * 24 * 90);

    const docxUrl = signedData?.signedUrl ?? "";

    // Step 5: Update cv_archive
    await db.from("cv_archive").update({
      cv_gpt_result: cvJson,
      cv_pdf_url:    docxUrl,
      cv_file_path:  fileName,
    }).eq("submission_id", submission_id);

    return new Response(JSON.stringify({ success: true, docx_url: docxUrl }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("generate-cv error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

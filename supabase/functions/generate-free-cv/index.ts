import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, BorderStyle, ShadingType,
} from "https://esm.sh/docx@8";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY   = Deno.env.get("OPENAI_API_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Strip HTML tags + decode entities ────────────────────────────────────────
const stripHtml = (s: string): string =>
  s.replace(/<[^>]+>/g, "")
   .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
   .replace(/&nbsp;/g, " ").replace(/&bull;/g, "•").trim();

// ── Step C: Call OpenAI — returns raw <div>…</div> HTML ──────────────────────
async function callOpenAI(cvData: any): Promise<string> {

  const systemPrompt =
`Act as a Senior Career Strategist & NLP Specialist. Your goal is to provide a "High-Value Career Strategy Teaser" optimized for MS Word conversion.

🚨 MANDATORY OUTPUT RULE 🚨
START directly with the <div tag.
END directly with the </div> tag.
DO NOT wrap the output in any markdown code blocks or backticks.
Output language: Summary in English | Tips in BOTH English & Arabic.`;

  const userMessage =
`🔥 INPUT DATA (JSON):
${JSON.stringify(cvData, null, 2)}

====================
✏️ HUMAN-WRITING GUIDELINES
ANTI-AI TONE: No words like "Passionate" or "Spearheaded". Use grounded verbs like "Built", "Executed", "Grew".
BILINGUAL TIPS: Task 3 must provide each tip in English followed by its Arabic translation.

====================
🎯 TASK 1: PROFESSIONAL SUMMARY (ENGLISH)
Generate a 3-4 line human-sounding executive summary focusing on professional identity and core value.

🎯 TASK 2: CAREER ALIGNMENT (ENGLISH)
Identify 2-3 specific Job Titles that perfectly fit the candidate's experience.

🎯 TASK 3: 7 BILINGUAL STRATEGIC TIPS (ENGLISH & ARABIC)
Format: [English Tip] / [Arabic Translation]
- KEYWORDS: List 3-5 industry-specific keywords currently missing.
- THE 5-POINT RULE: Explain that each position needs 4-6 bullet points focusing on REAL achievements.
- THE IMPACT FORMULA: Advise using [Action Verb] + [Numbers] + [Context].
- PORTFOLIO: Advise if a Portfolio is needed for this field and why.
- COVER LETTER: Explain why a custom Cover Letter is vital.
- METRICS: Importance of using actual numbers to beat ATS.
- CUSTOMIZATION (NEW): Advise to ALWAYS tailor the CV keywords to match the specific Job Description (JD) they are applying for. / النصيحة السابعة: يجب دائماً تعديل الكلمات المفتاحية في سيرتك الذاتية لتتطابق تماماً مع متطلبات الوصف الوظيفي لكل وظيفة تتقدم إليها.

====================
🎨 DESIGN & WORD-READY STRUCTURE (Use this exact structural template)
<div style="font-family: Calibri, sans-serif; color: #1e293b; max-width: 800px; line-height: 1.4;">
  <div style="text-align: center; margin-bottom: 20px;">
    <h1 style="font-size: 24pt; margin: 0; text-transform: uppercase; color: #000000;">[FULL NAME]</h1>
    <p style="font-size: 10pt; color: #444444; margin-top: 5px;">[Email] | [Phone] | [Location/Nationality]</p>
  </div>
  <hr style="border: 0; border-top: 1px solid #cccccc; margin-bottom: 20px;">
  <div style="margin-bottom: 20px;">
    <h2 style="font-size: 12pt; text-transform: uppercase; color: #2563eb; font-weight: bold; margin-bottom: 5px;">Recommended Roles / الوظائف المقترحة</h2>
    <p style="font-size: 11pt; color: #000000; margin: 0;"><strong>Matched Titles:</strong> [Insert Titles in English]</p>
  </div>
  <div style="margin-bottom: 25px;">
    <h2 style="font-size: 12pt; text-transform: uppercase; color: #2563eb; font-weight: bold; margin-bottom: 10px;">Professional Profile / الملخص المهني</h2>
    <div style="font-size: 11pt; color: #000000;">
      [Generate Human-Sounding Summary in English Here]
    </div>
  </div>
  <div style="background-color: #fefce8; padding: 15px; border: 1px solid #fde68a;">
    <h3 style="font-size: 11pt; margin: 0 0 10px 0; color: #92400e;">💡 Career Strategy & ATS Tips / نصائح استراتيجية التحليل</h3>
    <p style="font-size: 10pt; color: #78350f; margin: 5px 0;">• [Tip 1] / [الكلمات المفتاحية]</p>
    <p style="font-size: 10pt; color: #78350f; margin: 5px 0;">• [Tip 2] / [قاعدة الـ 5 نقاط]</p>
    <p style="font-size: 10pt; color: #78350f; margin: 5px 0;">• [Tip 3] / [معادلة الإنجاز]</p>
    <p style="font-size: 10pt; color: #78350f; margin: 5px 0;">• [Tip 4] / [البورتفوليو]</p>
    <p style="font-size: 10pt; color: #78350f; margin: 5px 0;">• [Tip 5] / [الـ Cover Letter]</p>
    <p style="font-size: 10pt; color: #78350f; margin: 5px 0;">• [Tip 6] / [الأرقام والنسب المئوية]</p>
    <p style="font-size: 10pt; color: #78350f; margin: 5px 0;">• <strong>Tailor Your CV:</strong> Always match your keywords to the Job Description. / <strong>عدّل سيرتك الذاتية:</strong> طابق دائماً كلماتك المفتاحية مع الوصف الوظيفي المعلن.</p>
  </div>
  <div style="margin-top: 40px; padding: 15px; background-color: #0f172a; text-align: center;">
    <p style="margin: 0; font-size: 11pt; font-weight: bold; color: #ffffff;">Want the full version? 🚀</p>
    <p style="font-size: 9pt; color: #cccccc; margin: 5px 0 0 0;">Upgrade to Premium to get your complete, 100% human-optimized CV / اشترك الآن للحصول على النسخة الكاملة</p>
  </div>
</div>`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model:       "gpt-4o-mini",
      max_tokens:  3000,
      temperature: 0.6,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userMessage  },
      ],
    }),
  });

  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);

  const data = await res.json();
  let html = (data.choices?.[0]?.message?.content ?? "") as string;

  // Strip any accidental markdown fences
  html = html.replace(/^```html?\n?/im, "").replace(/\n?```$/m, "").trim();

  if (!html.startsWith("<div")) {
    throw new Error("GPT did not return a valid <div> block");
  }
  return html;
}

// ── Parse HTML → structured JSON (stored in cv_gpt_result) ───────────────────
function parseHtmlToJson(html: string) {
  const name    = stripHtml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  const contact = stripHtml(html.match(/color:\s*#444444[^"]*">([\s\S]*?)<\/p>/i)?.[1] ?? "");
  const roles   = stripHtml(html.match(/Matched Titles:<\/strong>\s*([\s\S]*?)<\/p>/i)?.[1] ?? "");
  const summary = stripHtml(
    html.match(/Professional Profile[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? ""
  );

  const tips: string[] = [];
  const tipRe = /<p[^>]*#78350f[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = tipRe.exec(html)) !== null && tips.length < 7) {
    const t = stripHtml(m[1]).replace(/^•\s*/, "").trim();
    if (t) tips.push(t);
  }

  return {
    name,
    contact,
    recommendedRoles:    roles,
    professionalSummary: summary,
    tips,
  };
}

// ── Step D: Build DOCX from parsed data — mirrors the HTML layout ─────────────
async function buildDocx(p: ReturnType<typeof parseHtmlToJson>): Promise<Uint8Array> {
  const DARK     = "000000";
  const BLUE     = "2563EB";
  const AMBER    = "92400E";
  const AMBER_T  = "78350F";
  const GOLD_BG  = "FEFCE8";
  const GOLD_BR  = "FDE68A";
  const NAVY     = "0F172A";

  const centered = (runs: TextRun[]) =>
    new Paragraph({ alignment: AlignmentType.CENTER, children: runs, spacing: { after: 60 } });

  const sectionH2 = (label: string) =>
    new Paragraph({
      children: [new TextRun({ text: label.toUpperCase(), bold: true, size: 22, color: BLUE, characterSpacing: 40 })],
      spacing: { before: 200, after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" } },
    });

  const tipLine = (text: string) =>
    new Paragraph({
      shading: { type: ShadingType.SOLID, color: GOLD_BG, fill: GOLD_BG },
      children: [new TextRun({ text: `• ${text}`, size: 19, color: AMBER_T })],
      spacing: { before: 50, after: 50 },
      border: {
        left:  { style: BorderStyle.SINGLE, size: 4, color: GOLD_BR },
        right: { style: BorderStyle.SINGLE, size: 4, color: GOLD_BR },
      },
    });

  const tipSpacer = (top: boolean) =>
    new Paragraph({
      shading: { type: ShadingType.SOLID, color: GOLD_BG, fill: GOLD_BG },
      children: [],
      spacing: { before: 0, after: 0 },
      border: {
        ...(top    ? { top:    { style: BorderStyle.SINGLE, size: 4, color: GOLD_BR } } : {}),
        ...(!top   ? { bottom: { style: BorderStyle.SINGLE, size: 4, color: GOLD_BR } } : {}),
        left:  { style: BorderStyle.SINGLE, size: 4, color: GOLD_BR },
        right: { style: BorderStyle.SINGLE, size: 4, color: GOLD_BR },
      },
    });

  const tipsList = p.tips.length > 0
    ? p.tips.map(tipLine)
    : [tipLine("See full bilingual tips in the attached Career Strategy Report")];

  const children = [
    // ── Header ──────────────────────────────────────────────────────────────
    centered([new TextRun({ text: (p.name || "").toUpperCase(), bold: true, size: 52, color: DARK })]),
    centered([new TextRun({ text: p.contact || "", size: 18, color: "444444" })]),
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" } },
      spacing: { before: 80, after: 200 },
    }),

    // ── Recommended Roles ────────────────────────────────────────────────────
    sectionH2("Recommended Roles / الوظائف المقترحة"),
    new Paragraph({
      children: [
        new TextRun({ text: "Matched Titles:  ", bold: true, size: 22, color: DARK }),
        new TextRun({ text: p.recommendedRoles || "", size: 22, color: BLUE }),
      ],
      spacing: { after: 200 },
    }),

    // ── Professional Profile ─────────────────────────────────────────────────
    sectionH2("Professional Profile / الملخص المهني"),
    new Paragraph({
      children: [new TextRun({ text: p.professionalSummary || "", size: 21, color: DARK })],
      spacing: { after: 220 },
    }),

    // ── Tips box ─────────────────────────────────────────────────────────────
    tipSpacer(true),
    new Paragraph({
      shading: { type: ShadingType.SOLID, color: GOLD_BG, fill: GOLD_BG },
      children: [new TextRun({
        text: "💡 Career Strategy & ATS Tips / نصائح استراتيجية التحليل",
        bold: true, size: 22, color: AMBER,
      })],
      spacing: { before: 80, after: 80 },
      border: {
        left:  { style: BorderStyle.SINGLE, size: 4, color: GOLD_BR },
        right: { style: BorderStyle.SINGLE, size: 4, color: GOLD_BR },
      },
    }),
    ...tipsList,
    tipSpacer(false),

    // ── Upsell footer ────────────────────────────────────────────────────────
    new Paragraph({ spacing: { before: 320 } }),
    new Paragraph({
      shading: { type: ShadingType.SOLID, color: NAVY, fill: NAVY },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Want the full version? 🚀", bold: true, size: 26, color: "FFFFFF" })],
      spacing: { before: 160, after: 80 },
    }),
    new Paragraph({
      shading: { type: ShadingType.SOLID, color: NAVY, fill: NAVY },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({
        text: "Upgrade to Premium to get your complete, 100% human-optimized CV / اشترك الآن للحصول على النسخة الكاملة",
        size: 17, color: "CCCCCC",
      })],
      spacing: { after: 160 },
    }),
  ];

  const doc = new Document({
    styles: {
      default: {
        document: {
          run:       { font: "Calibri", size: 20 },
          paragraph: { spacing: { line: 276 } },
        },
      },
    },
    sections: [{
      properties: { page: { margin: { top: 720, right: 900, bottom: 900, left: 900 } } },
      children,
    }],
  });

  return new Uint8Array(await Packer.toBuffer(doc));
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // ── Auth ──
  const authHeader = req.headers.get("Authorization") ?? "";
  const token      = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  // JWT verification is mandatory for all callers — no internal bypass.
  const authDb = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: { user }, error: authErr } = await authDb.auth.getUser(token);
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const callerUid = user.id;

  try {
    // ── Step A: Parse request ──
    // generation_id = PK of order_generations (preferred, created by create-cv-order)
    // form_id       = fallback (for legacy calls before order_generations existed)
    const { generation_id, submission_id, form_id } = await req.json();

    if (!generation_id && !form_id && !submission_id) {
      return new Response(
        JSON.stringify({ error: "generation_id, form_id, or submission_id required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ── Step B: Resolve order_generations row → get form_id ─────────────────────
    // order_generations was created by create-cv-order (free plan INSERT).
    // We need its generation_id (PK) for the write-back step.
    let resolvedGenId: string | null = generation_id || null;
    let resolvedFormId: string | null = form_id || null;

    if (!resolvedGenId && resolvedFormId) {
      // Look up by form_id — get the free order_generations row
      const { data: og } = await db
        .from("order_generations")
        .select("generation_id, form_id")
        .eq("form_id", resolvedFormId)
        .eq("package_name", "free")
        .order("created_at_utc", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (og) resolvedGenId = og.generation_id;
    }

    if (!resolvedGenId && !resolvedFormId && submission_id) {
      // Legacy fallback: look up by submission_id
      const { data: og } = await db
        .from("order_generations")
        .select("generation_id, form_id")
        .eq("submission_id", submission_id)
        .eq("package_name", "free")
        .order("created_at_utc", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (og) {
        resolvedGenId  = og.generation_id;
        resolvedFormId = og.form_id;
      }
    }

    // If we have generation_id but not form_id, fetch it
    if (resolvedGenId && !resolvedFormId) {
      const { data: og } = await db
        .from("order_generations")
        .select("form_id")
        .eq("generation_id", resolvedGenId)
        .maybeSingle();
      if (og) resolvedFormId = og.form_id;
    }

    if (!resolvedFormId) {
      return new Response(
        JSON.stringify({ error: "Could not resolve form_id — order not found" }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ── Step B.5: Cache hit check ─────────────────────────────────────────────
    // If cv_file_path (HTML) and cv_pdf_url (DOCX) already exist in
    // order_generations, the free CV was already generated for this session.
    // Return the stored result immediately — do NOT call OpenAI again.
    // This prevents re-generation on page refresh, double-click, or network retry.
    if (resolvedGenId) {
      const { data: cachedRow } = await db
        .from("order_generations")
        .select("cv_file_path, cv_pdf_url, user_id")
        .eq("generation_id", resolvedGenId)
        .maybeSingle();

      if (cachedRow?.cv_file_path && cachedRow?.cv_pdf_url) {
        // Ownership check even on cache hit
        if (cachedRow.user_id !== callerUid) {
          return new Response(JSON.stringify({ error: "Access denied" }), {
            status: 403, headers: { ...cors, "Content-Type": "application/json" },
          });
        }
        console.log("generate-free-cv: cache hit — returning stored result", {
          generation_id: resolvedGenId,
        });
        return new Response(
          JSON.stringify({
            success:    true,
            htmlResult: cachedRow.cv_file_path,
            fileUrl:    cachedRow.cv_pdf_url,
            cached:     true,
          }),
          { headers: { ...cors, "Content-Type": "application/json" } }
        );
      }
    }
    // ── Cache miss — proceed to full generation ───────────────────────────────

    // ── Step C: Fetch cv_archive row for cv_data ─────────────────────────────────
    const { data: record, error: fetchErr } = await db
      .from("cv_archive")
      .select("form_id, user_id, submission_id, cv_data")
      .eq("form_id", resolvedFormId)
      .maybeSingle();

    if (fetchErr || !record) {
      return new Response(
        JSON.stringify({ error: "cv_archive record not found" }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Ownership check — always enforced
    if (record.user_id !== callerUid) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (!record.cv_data) {
      return new Response(JSON.stringify({ error: "cv_data is empty" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const uid   = record.user_id;
    const subId = record.submission_id || submission_id || resolvedFormId;
    const filePrefix = resolvedGenId || resolvedFormId;  // generation_id preferred

    // ── Step D: Call OpenAI → get HTML string ─────────────────────────────────
    const htmlResult = await callOpenAI(record.cv_data);

    // ── Step E: Parse HTML → structured JSON + build DOCX ────────────────────
    const parsed    = parseHtmlToJson(htmlResult);
    const docxBytes = await buildDocx(parsed);

    // ── Step F: Upload DOCX to Supabase Storage ───────────────────────────────
    const storagePath = `${uid}/${filePrefix}_free.docx`;
    const { error: uploadErr } = await db.storage
      .from("cv-documents")
      .upload(storagePath, docxBytes, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });
    if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);

    // Signed URL — 90 days
    const { data: signedData } = await db.storage
      .from("cv-documents")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 90);
    const fileUrl = signedData?.signedUrl ?? "";

    // ── Step G: UPDATE order_generations (write to new table, NOT cv_archive) ───
    //   cv_gpt_result  → structured JSON (parsed content)
    //   cv_file_path   → full <div>…</div> HTML string (BuildingPage renders this inline)
    //   cv_pdf_url     → signed URL of the generated DOCX file
    if (resolvedGenId) {
      await db
        .from("order_generations")
        .update({
          cv_gpt_result: parsed,      // JSONB: { name, contact, recommendedRoles, professionalSummary, tips }
          cv_file_path:  htmlResult,  // TEXT:  complete <div>…</div> HTML from GPT
          cv_pdf_url:    fileUrl,     // TEXT:  signed URL of the generated DOCX
        })
        .eq("generation_id", resolvedGenId);
    }

    // ── Step H: Insert into downloads table (best-effort) ─────────────────────
    const { error: dlErr } = await db.from("downloads").insert({
      user_id:       uid,
      submission_id: subId,
      file_url:      fileUrl,
      plan_type:     "Free",
    });
    if (dlErr) console.warn("downloads insert skipped:", dlErr.message);

    // ── Step I: Return ────────────────────────────────────────────────────────
    return new Response(
      JSON.stringify({ success: true, htmlResult, fileUrl }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("generate-free-cv error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

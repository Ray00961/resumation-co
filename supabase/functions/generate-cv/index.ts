import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import HTMLtoDOCX from "npm:html-to-docx@1.8.0";

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY       = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY        = Deno.env.get("OPENAI_API_KEY")!;

// ── OpenAI: FREE PLAN — generate HTML career teaser ─────────────────────────
async function generateFreeHtml(cvData: any): Promise<string> {
  const prompt = `You are a Senior Career Strategist and expert HTML developer.
Analyze the candidate's CV data below and generate a complete, self-contained HTML page that acts as a professional career report / CV teaser.

CANDIDATE DATA:
${JSON.stringify(cvData, null, 2)}

REQUIREMENTS:
- Return ONLY raw HTML starting with <!DOCTYPE html> — no markdown, no code fences, no explanation
- All CSS must be inline inside a <style> tag in the <head>
- No external fonts, no CDN links, no images — 100% self-contained
- Use system fonts: font-family: 'Segoe UI', Arial, sans-serif
- The page should look beautiful, modern, and professional when opened in a browser

PAGE STRUCTURE (in this exact order):

1. HEADER: Candidate name (large, dark), contact info (email | phone | location), target job title
2. AI MATCH SCORE: A visual "AI Score" badge (e.g. 74/100) with a short one-line explanation of what it means
3. RECOMMENDED ROLES: 3 job titles that match the candidate's background — styled as blue chips/tags
4. PROFESSIONAL SUMMARY: A 3-4 sentence human-sounding summary. Use strong action verbs: Built, Led, Executed, Grew, Delivered. NO words like "Passionate", "Dynamic", "Spearheaded", "Results-driven"
5. CAREER STRATEGY TIPS: 7 bilingual tips (English + Arabic) each with an emoji icon. Tips:
   - 🔑 KEYWORDS: List 3-5 industry-specific keywords missing from this CV (be specific to their field)
   - 📋 THE 5-POINT RULE: Each position needs 4-6 bullet points on REAL achievements, not duties
   - 💥 IMPACT FORMULA: [Action Verb] + [Number] + [Result] for every bullet
   - 🗂️ PORTFOLIO: Based on their field, a portfolio is essential — include work sample links
   - 📝 COVER LETTER: A tailored cover letter raises interview chances by 40%
   - 📊 METRICS: Use real numbers (%, $, team size, timeframes) to beat ATS filters
   - 🎯 CUSTOMIZATION: Always tailor CV keywords to match each specific Job Description
6. UPSELL SECTION: Dark-background banner at the bottom — "Want your full AI-optimized CV?" — with a button linking to https://resumation.co/plans styled in teal (#12b2c1)

DESIGN RULES:
- Background: #ffffff (white page)
- Primary text: #1a2a3a
- Accent color: #12b2c1 (teal)
- Section headers: uppercase, letter-spacing, border-bottom in light gray
- Tips: light yellow/amber left border, bilingual layout
- Max width: 800px, centered, padding 40px
- Score badge: bold circle or pill shape in teal
- Recommended role chips: teal background, white text, rounded
- Print-friendly (avoid heavy backgrounds except in the upsell footer)

Return ONLY the complete HTML document. Start with <!DOCTYPE html>.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 4096,
      temperature: 0.4,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`OpenAI free teaser ${res.status}: ${await res.text()}`);
  const data = await res.json();
  let raw = data.choices?.[0]?.message?.content ?? "";
  // Strip any accidental markdown fences
  raw = raw.replace(/^```html?\n?/im, "").replace(/\n?```$/m, "").trim();
  if (!raw.toLowerCase().startsWith("<!doctype")) {
    throw new Error("GPT did not return valid HTML for free teaser");
  }
  return raw;
}

// ── PAID PLAN: English CV system prompt (word-for-word, never modify) ─────────
const SYSTEM_PROMPT_EN = `Act as a Senior Resume Writer and ATS specialist with 20+ years of experience crafting professional CVs that read as human-written, are optimized for ATS auto-fill, and accurately reflect who the candidate actually is.

====================
CRITICAL OUTPUT RULES (STRICT):
- Return ONLY RAW HTML. No markdown code blocks, no explanations outside the HTML.
- Start immediately with <div> and end with </div>.
- Use inline CSS only.
- Output language: ENGLISH ONLY.
====================

DATA INPUT (FROM WEBHOOK):
{{CV_DATA}}

====================
LANGUAGE NORMALIZATION (STRICT):
- If any field is in Arabic → translate it to natural professional English.
- Proper nouns MUST be preserved exactly as-is:
  Company names, university names, certificate names, tool names, product names.
- If a company name is only in Arabic, transliterate to English or use the known English name.
- Final output: ENGLISH ONLY. No Arabic text anywhere.
====================

DATA INTEGRITY & PRESERVATION (NON-NEGOTIABLE — ZERO HALLUCINATION):
- Use ONLY the information provided. Do NOT add, invent, or assume any data.
- Job titles: copy EXACTLY as provided. Never upgrade, inflate, or rephrase them.
  Wrong: User says "Sales Representative" → do NOT write "Senior Sales Executive" or "Sales Lead".
  Right: Write "Sales Representative" exactly.
- Company names: copy EXACTLY as provided. Never shorten, translate, or modify.
- Education: degree name, university name, and dates must be copied EXACTLY as provided.
- Certifications and courses: copy names exactly.
- Skills: use only skills the candidate listed or that are directly evident from their described work.
- If a scale or level is provided (e.g. "beginner," "advanced," "native," "intermediate") → preserve it in plain language.
- If a field is missing → OMIT that section entirely. Never use placeholder text.
====================

SECTION ORDER:

PROFESSIONAL CANDIDATE (more than 1 year total professional experience):
1. Header (Name + Contact Info)
2. Professional Summary
3. Core Competencies
4. Professional Experience
5. Education
6. Certifications / Courses / Projects (if present)
7. Languages (if present)

FRESH GRADUATE (≤ 1 year total professional experience, or internships/volunteer only):
1. Header (Name + Contact Info)
2. Professional Summary
3. Education
4. Core Competencies
5. Internships / Volunteer Experience (if present)
6. Projects (if present)
7. Certifications / Courses (if present)
8. Languages (if present)

- Assess correctly. If in doubt, default to Professional order.
====================

DATE FORMAT (STRICT):
- All date ranges: "Mon YYYY – Mon YYYY" (e.g. "Jan 2020 – Mar 2023")
- Current/ongoing roles: "Jan 2022 – Present" (use "Present" — never "Current" or "Now")
- Sections with dates: sort MOST RECENT → OLDEST.
====================

PROFESSIONAL EXPERIENCE RULES:

Layout per role (stacked divs — NO flex, NO tables, NO columns):
- Line 1: Job title (bold, 10.5pt) — on its own line, nothing else
- Line 2: Company name (10pt, normal) — on its own line, nothing else
- Line 3: Date range (10pt, normal) — on its own line, nothing else
- Location: include with company name on Line 2 if available (e.g. "Acme Corp | Dubai")
- Bullets: <ul><li> list below, margin-top:6px
- NEVER combine job title + company on one line (e.g. "Sales Rep - Acme Corp" is WRONG)

Bullet rules:
- 3–5 bullets per role. NOT every role needs 5 — some roles are smaller and that is fine.
- MIX: some bullets describe real responsibilities (what the person actually did day-to-day), some describe impact or result (where applicable and honest).
- Do NOT turn every bullet into an achievement with fake numbers.
- Do NOT invent percentages, metrics, or quantities not in the data.
- If no numbers exist → describe the work and its effect in plain language.
- A normal employee should sound like a normal employee. Not every candidate is a senior manager, a team leader, or a top performer. Match the seniority and scope to the actual data.
- Expand brief inputs into specific, realistic tasks. Do NOT pad with filler.
  Example: "Managed delivery team" →
    - Ran daily route planning and schedule coordination for a team of drivers.
    - Monitored driver performance and flagged recurring issues for review.
    - Handled real-time logistics conflicts and adjusted schedules as needed.
    - Prepared weekly delivery reports and maintained operational records.
====================

CORE COMPETENCIES RULES:
- Three groups only:
  1. Technical Skills (tools, software, platforms, technologies from the data)
  2. Industry Knowledge (sector-specific knowledge from job titles and responsibilities)
  3. Professional Skills (interpersonal and professional capabilities from roles and education)
- Total: 9–15 skills across all three groups.
- No skill repeated across groups.
- No invented or assumed skills.
====================

ATS OPTIMIZATION (3-STEP):

STEP 1 — EXTRACT: Identify 8–12 keywords from the candidate's field and job titles.
  Focus on: role-specific nouns, platforms, skills, and common job description terms for their level.
  Target ATS systems: Workday, Greenhouse, Lever, BambooHR, Ashby, SmartRecruiters, Oracle, SAP SuccessFactors.

STEP 2 — PLACE: Distribute keywords naturally:
  - Professional Summary: 2–3 keywords embedded naturally
  - Core Competencies: exact-match skill terms
  - Experience bullets: keywords used in context, not forced

STEP 3 — VERIFY: Before outputting, check:
  - No keyword is stuffed or repeated awkwardly.
  - All keywords appear in at least one section.
  - The CV would parse cleanly when uploaded to a standard ATS and auto-filled into form fields.

ATS AUTO-FILL PRIORITY (IMPORTANT):
- The primary goal is that when a recruiter uploads this CV to an ATS, the system can correctly extract and auto-fill: Name, Email, Phone, Job Titles, Companies, Dates, Education, Skills.
- Keep structure clean and linear. No fancy layout tricks. No multi-column sections.
- Section headers must be plain text. No icons, no images, no tables.
====================

PROFESSIONAL SUMMARY RULES:
- 3–4 sentences. First person.
- Must sound like the person wrote it about themselves.
- Must NOT open with any of the following:
  "I am a results-driven," "I am a highly motivated," "I am a passionate,"
  "I am a dynamic," "I am a dedicated," "I am a seasoned," "I am a detail-oriented,"
  "With X years of experience in," "As an experienced," "I bring X years."

- Three acceptable opening approaches:
  Option A — Career arc: What they have been doing, where, for how long.
    Example: "I have spent the last six years working in supply chain operations, mainly focused on procurement and vendor coordination."
  Option B — Role anchor: What they are known for in their field, practically.
    Example: "Most of my work over the past four years has been in B2B sales — building pipelines and managing key accounts across the Gulf region."
  Option C — Transition or direction: Where they are going and why.
    Example: "I am moving from a technical support background into project coordination — I have spent three years troubleshooting enterprise systems and am now looking to apply that on the planning side."

- Tone: confident, grounded, practical. Not marketing language.
- No fake modesty and no overselling. Match the person's actual level.
====================

*** HUMAN WRITING RULES — ENGLISH (NON-NEGOTIABLE) ***

GOAL: Write like a real professional who wrote their own CV and had it lightly reviewed.
NOT: Write to "sound human" or "avoid AI detectors."
The difference: A real human writes naturally, imperfectly, specifically. They do not avoid patterns — they just do not think in patterns. Write like that.

BANNED WORDS & PHRASES (NEVER USE — ZERO EXCEPTIONS):

Action verbs:
spearheaded, leveraged, orchestrated, synergized, catalyzed, championed,
pioneered, revolutionized, transformed, harnessed, propelled, navigated,
cultivated, fostered, facilitated (overused), utilized (overused).

Adjective openers / summary openers:
results-driven, highly motivated, passionate, dynamic, detail-oriented,
proactive, dedicated, seasoned, innovative, forward-thinking, strategic thinker,
visionary, goal-oriented, self-starter, team player, hardworking (as opener).

Filler phrases:
"proven track record of," "strong ability to," "excellent communication skills,"
"value-added," "best-in-class," "cutting-edge," "robust," "synergy,"
"scalable solutions," "went above and beyond," "I am excited to,"
"with a passion for," "I thrive in fast-paced environments,"
"I am committed to excellence," "results-oriented," "cross-functional collaboration."

1. SENTENCE VARIETY — MANDATORY:
   - Mix short punchy sentences with longer ones naturally.
   - Never start 3 bullets in a row the same way.
   - Wrong:  "Managed X. Managed Y. Managed Z."
   - Right:  "Managed X. Worked closely with the Y team on... Built Z from scratch."

2. SPECIFIC OVER GENERIC — ALWAYS:
   - Wrong:  "Responsible for managing a team and improving performance."
   - Right:  "Ran a team of 6 and introduced a weekly check-in that cut missed deadlines."

3. REALISTIC — NO FAKE METRICS:
   - Do NOT invent numbers, percentages, or quantities not in the data.
   - If no numbers exist, describe the effect in plain language.
   - Wrong:  "Increased revenue by 40% through strategic initiatives."
   - Right:  "Helped the team close more client deals by tightening the proposal process."

4. NATURAL WRITING — NOT ROBOTIC:
   - Some bullets are longer, some shorter. That is fine.
   - Not every line needs to sound impressive. Real CVs are mixed.
   - Goal: credible and honest, not perfectly polished.

5. VERB VARIETY:
   Allowed: managed, led, built, ran, handled, set up, worked on, helped,
            improved, developed, created, supported, trained, reviewed,
            maintained, coordinated, launched, reduced, grew, prepared,
            introduced, oversaw, assisted, monitored, designed, implemented,
            delivered, executed, tested, analyzed, wrote, drafted.
   - Use each verb MAX once per job role.
   - If more verbs needed, describe the action without a strong verb opener.

6. AVOID CORPORATE/CONSULTANT LANGUAGE:
   - No jargon that only management consultants or marketing teams use.
   - No inflated scope. If someone managed a 3-person team, say 3. Not "a team."
   - Language should be accessible and clear to a recruiter reading in 30 seconds.

7. FINAL CHECK BEFORE OUTPUT:
   - Read the full output.
   - If any sentence sounds templated, inflated, or AI-generated → rewrite it.
   - Ask: would a real person at this level actually write this? If no → change it.
====================

DESIGN & TYPOGRAPHY:
- Font: Calibri, sans-serif
- Color: #000000
- Line-height: 1.3
- Max width: 800px
- All font sizes in pt (not px)

NAME: font-size: 22pt; font-weight: bold; text-transform: uppercase
CONTACT INFO: font-size: 11pt
SECTION HEADERS: font-size: 11pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 1px solid #000; padding-bottom: 3px; margin-bottom: 8px
JOB TITLE (per role): font-size: 10.5pt; font-weight: bold
COMPANY NAME: font-size: 10pt
DATE RANGE: font-size: 10pt
BODY TEXT: font-size: 10pt
BULLETS: font-size: 10pt; margin: 3px 0
SECTION SPACING: margin-bottom: 18px between every major section
====================

HTML STRUCTURE (MANDATORY — DOCX COMPATIBLE):

Rules:
- NO flex, NO grid, NO border-radius, NO box-shadow, NO multi-column.
- Use stacked <div> blocks for all layout.
- Bullets MUST use <ul><li> — NOT styled <div> bullets.
- Line breaks: use <br /> (self-closing) — NOT <br>.
- All font sizes in pt only.
- Each role: job title on its own line, company name on its own line, dates on their own line. Never combine them on one line.

<div style="font-family:Calibri, sans-serif; color:#000; max-width:800px; line-height:1.3;">

  <!-- HEADER -->
  <div style="margin-bottom:18px;">
    <div style="font-size:22pt; font-weight:bold; text-transform:uppercase;">[FULL NAME]</div>
    <div style="font-size:11pt;">[Email] | [Phone] | [Nationality] | [LinkedIn if provided]</div>
  </div>

  <!-- PROFESSIONAL SUMMARY -->
  <div style="margin-bottom:18px;">
    <div style="font-size:11pt; font-weight:bold; text-transform:uppercase; letter-spacing:0.4px; border-bottom:1px solid #000; padding-bottom:3px; margin-bottom:8px;">Professional Summary</div>
    <div style="font-size:10pt;">[Summary text]</div>
  </div>

  <!-- CORE COMPETENCIES -->
  <div style="margin-bottom:18px;">
    <div style="font-size:11pt; font-weight:bold; text-transform:uppercase; letter-spacing:0.4px; border-bottom:1px solid #000; padding-bottom:3px; margin-bottom:8px;">Core Competencies</div>
    <div style="font-size:10pt; font-weight:bold;">Technical Skills</div>
    <div style="font-size:10pt;">[skill 1] | [skill 2] | [skill 3]</div>
    <div style="font-size:10pt; font-weight:bold; margin-top:6px;">Industry Knowledge</div>
    <div style="font-size:10pt;">[skill 1] | [skill 2] | [skill 3]</div>
    <div style="font-size:10pt; font-weight:bold; margin-top:6px;">Professional Skills</div>
    <div style="font-size:10pt;">[skill 1] | [skill 2] | [skill 3]</div>
  </div>

  <!-- PROFESSIONAL EXPERIENCE -->
  <div style="margin-bottom:18px;">
    <div style="font-size:11pt; font-weight:bold; text-transform:uppercase; letter-spacing:0.4px; border-bottom:1px solid #000; padding-bottom:3px; margin-bottom:8px;">Professional Experience</div>

    <!-- Role (most recent first) — job title / company / dates each on own line -->
    <div style="margin-bottom:14px;">
      <div style="font-size:10.5pt; font-weight:bold;">[Job Title — EXACTLY as provided]</div>
      <div style="font-size:10pt;">[Company Name — EXACTLY as provided]</div>
      <div style="font-size:10pt;">[Mon YYYY – Mon YYYY]</div>
      <ul style="font-size:10pt; margin:6px 0 0 18px; padding:0;">
        <li style="margin-bottom:3px;">[Bullet point]</li>
        <li style="margin-bottom:3px;">[Bullet point]</li>
        <li style="margin-bottom:3px;">[Bullet point]</li>
      </ul>
    </div>

  </div>

  <!-- EDUCATION -->
  <div style="margin-bottom:18px;">
    <div style="font-size:11pt; font-weight:bold; text-transform:uppercase; letter-spacing:0.4px; border-bottom:1px solid #000; padding-bottom:3px; margin-bottom:8px;">Education</div>
    <div style="margin-bottom:8px;">
      <div style="font-size:10.5pt; font-weight:bold;">[Degree Name — EXACTLY as provided]</div>
      <div style="font-size:10pt;">[University Name — EXACTLY as provided]</div>
      <div style="font-size:10pt;">[Graduation year or date range — EXACTLY as provided]</div>
    </div>
  </div>

  <!-- CERTIFICATIONS / COURSES / PROJECTS (if present) -->
  <div style="margin-bottom:18px;">
    <div style="font-size:11pt; font-weight:bold; text-transform:uppercase; letter-spacing:0.4px; border-bottom:1px solid #000; padding-bottom:3px; margin-bottom:8px;">Certifications &amp; Courses</div>
    <div style="font-size:10pt;">[Certification name — EXACTLY as provided] | [Issuer] | [Year if available]</div>
  </div>

  <!-- LANGUAGES (if present) -->
  <div style="margin-bottom:18px;">
    <div style="font-size:11pt; font-weight:bold; text-transform:uppercase; letter-spacing:0.4px; border-bottom:1px solid #000; padding-bottom:3px; margin-bottom:8px;">Languages</div>
    <div style="font-size:10pt;">[Language]: [Level as provided] | [Language]: [Level as provided]</div>
  </div>

</div>

====================
FINAL VALIDATION (MANDATORY):
- Output is English only — no Arabic anywhere.
- All job titles, company names, university names, and certification names are EXACTLY as provided.
- No duplicated sections.
- No invented data, no fake metrics.
- Correct chronological order (newest first) in all sections.
- ATS-clean: linear structure, plain text headers, no tables, no icons, no multi-column.
- Each experience role: job title on line 1, company on line 2, dates on line 3. Never on one combined line.
- Writing sounds natural, practical, and credible — like a real professional at that level.
- No banned words or phrases anywhere.
- If ANY sentence reads inflated, templated, or AI-generated → rewrite it before outputting.
====================`;

// ── PAID PLAN: Arabic CV system prompt (word-for-word, never modify) ──────────
const SYSTEM_PROMPT_AR = `تصرّف كخبير كتابة سير ذاتية متخصص في تصميم CV احترافي، مع خبرة تتجاوز 20 عاماً في صياغة سير ذاتية تبدو مكتوبة من قِبل إنسان حقيقي لا من آلة.

====================
قواعد المخرج النهائي (صارمة):
- أعد RAW HTML فقط. بدون أكواد markdown، بدون أي نص خارج الـ HTML.
- ابدأ مباشرة بـ <div> وانتهِ بـ </div>.
- استخدم inline CSS فقط.
- المخرج جاهز للتحويل إلى Google Doc.
- لغة المخرج: العربية فقط.
====================

بيانات المدخلات (من الـ Webhook):
{{CV_DATA}}

====================
قاعدة اللغة (صارمة):
- إذا كانت البيانات بالعربية → حسّنها وأعد صياغتها باحترافية.
- If input data is in English → ترجمها إلى عربية مهنية طبيعية.
- المخرج النهائي: عربي فقط.
- لا كلمات إنجليزية في المخرج إلا الأسماء الصريحة:
  أسماء الشركات، أسماء الأدوات التقنية، أسماء الشهادات الدولية.
====================

قاعدة الأمانة في البيانات (لا اختراع — صفر هلوسة):
- استخدم المعلومات المُدخلة فقط.
- لا تُضف مهارات أو تواريخ أو لغات أو مؤهلات أو مسميات غير مذكورة.
- لا تفترض اللغات المتحدثة بناءً على الجنسية.
- إذا كان أي حقل مفقوداً، احذف القسم كاملاً ولا تذكره.
====================

منطق نوع الخدمة (إلزامي):
- مجاني → أنشئ قسم الملخص المهني فقط.
- مدفوع → أنشئ CV كامل.
====================

ترتيب الأقسام (صارم جداً):
1. البيانات الشخصية (الاسم + معلومات التواصل)
2. الملخص المهني
3. الكفاءات الأساسية
4. الخبرة المهنية
5. التعليم
6. الشهادات والدورات والمشاريع
7. اللغات

استثناء حديث التخرج:
- حديث التخرج = خبرة مهنية إجمالية لا تتجاوز سنة واحدة أو تدريبات وتطوع فقط.
- إذا كان حديث التخرج → التعليم قبل الخبرة المهنية.
- إذا لم يكن كذلك → التعليم دائماً بعد الخبرة المهنية.
- لا استثناءات.
====================

قواعد التواريخ والترتيب (غير قابلة للتفاوض):
- جميع الأقسام ذات التواريخ: من الأحدث إلى الأقدم.
- الخبرة المهنية: أحدث وظيفة أولاً.
- التعليم: أحدث شهادة أولاً.
- الشهادات والمشاريع: الأحدث أولاً.
====================

قواعد الخبرة المهنية:
- كل وظيفة تحتوي على 4 نقاط كحد أدنى.
- إذا كانت البيانات مختصرة، فكّك المسؤوليات إلى مهام تفصيلية.
  مثال: "أدار فريق التوصيل" →
    1. نسّق خطط التوصيل اليومية لفريق من السائقين.
    2. تابع أداء كل سائق وتعامل مع الإشكاليات فور ظهورها.
    3. حلّ مشكلات اللوجستيات والجداول الزمنية بشكل مباشر.
    4. أعدّ تقارير دورية عن مؤشرات الأداء الرئيسية.
- ركّز على نتائج حقيقية وقابلة للتصديق — لا إنجازات مبالغاً فيها.
====================

قاعدة الكفاءات الأساسية:
الهيكل:
  1. الخبرة التقنية    (من بيانات المستخدم)
  2. المعرفة القطاعية  (مستخرجة من المسميات والمسؤوليات والصناعة)
  3. المهارات المهنية  (مستخرجة من الأدوار والتعليم)

قواعد:
- لا تكرار لأي مهارة في أكثر من فئة.
- لا اختراع لأدوات أو برامج غير مذكورة.
====================

*** قواعد الكتابة البشرية — العربية (غير قابلة للتفاوض) ***
النص النهائي يجب أن يبدو كأن محترفاً حقيقياً كتبه بنفسه.
إذا بدا النص مولَّداً من الذكاء الاصطناعي — فالمخرج خاطئ.
أعد الكتابة حتى يبدو طبيعياً تماماً.
====================

كلمات وعبارات ممنوعة — العربية (لا تُستخدم أبداً — بدون استثناء):

أفعال مبالغ فيها:
قاد الثورة، أطلق العنان، أحدث تحولاً جذرياً، جسّد رؤية استراتيجية،
حفّز التغيير، دفع عجلة النمو، ارتقى بالأداء، حقّق إنجازات استثنائية،
صاغ مستقبل، أعاد رسم ملامح، أرسى ركائز.

صفات وعبارات كليشيهية:
محترف متميز، شغوف، ديناميكي، ذو كفاءة عالية، حريص على التميز،
يسعى دائماً للتطور، ملتزم بالتميز، مبدع، رؤيوي، استراتيجي التفكير،
قادر على العمل تحت الضغط (كجملة افتتاحية).

عبارات حشو:
"سجل حافل من الإنجازات"، "أثبتُ قدرتي على"،
"أتمتع بمهارات تواصل ممتازة"، "لديّ شغف حقيقي بـ"،
"في إطار مسيرتي المهنية الحافلة"، "أسعى جاهداً لتحقيق التميز"،
"أحمل رؤية طموحة"، "أؤمن بالعمل الجماعي."

====================
قواعد الكتابة البشرية بالعربية:

1. تنوع الجمل — إلزامي:
   - امزج جملاً قصيرة وطويلة بشكل طبيعي.
   - لا تبدأ ثلاث نقاط متتالية بنفس الطريقة أو نفس الفعل.
   - خطأ:  "أدار أ. أدار ب. أدار ج."
   - صح:   "أدار أ. تعاون مع فريق ب لتطوير... وبنى ج من الصفر."

2. التحديد بدل العمومية — دائماً:
   - خطأ:  "مسؤول عن إدارة الفريق وتحسين الأداء."
   - صح:   "أدار فريقاً من 6 أشخاص وأدخل نظام متابعة أسبوعي
             قلّص بشكل ملحوظ نسبة تأخر التسليمات."

3. إنجازات واقعية فقط:
   - لا تخترع أرقاماً أو نسباً غير موجودة في البيانات.
   - إذا لم تكن هناك أرقام، صِف الأثر بالكلمات بصدق.
   - خطأ:  "حقّق زيادة في الإيرادات بنسبة 40%."
   - صح:   "ساعد الفريق على إتمام المزيد من الصفقات عبر
             تبسيط عملية إعداد العروض."

4. الطبيعية المقصودة — مطلوبة:
   - السيرة الذاتية الحقيقية ليست مصقولة بشكل مثالي.
   - بعض النقاط أطول وبعضها أقصر — وهذا طبيعي ومطلوب.
   - لا يجب أن تبدو كل نقطة إنجازاً ضخماً.
   - الهدف: واثق وموثوق، لا مثالي وآلي.

5. اختيار الأفعال — متنوع ومباشر:
   مسموح به: أدار، قاد، بنى، تولّى، تعاون، طوّر، أنشأ، دعم،
             درّب، راجع، حافظ على، نسّق، أطلق، خفّض، نمّى،
             أعدّ، أشرف على، ساعد في، تابع، وثّق.
   - كل فعل يُستخدم مرة واحدة فقط في كل وظيفة.
   - إذا نفدت الأفعال، صِف العمل دون فعل افتتاحي قوي.

6. الملخص المهني — بالأسلوب البشري:
   - يجب أن يبدو كأن الشخص كتب عن نفسه مباشرة.
   - 4 أسطر كحد أقصى. بدون كليشيهات أو مبالغة.
   - خطأ:  "محترف متميز يسعى دائماً لتحقيق التميز والتطور
             ولديه سجل حافل من الإنجازات المهنية."
   - صح:   "أمضيت السنوات الثماني الماضية في مجال إدارة اللوجستيات،
             مع تركيز خاص على التوصيل وعمليات الفريق. أعمل بشكل جيد
             في بيئات العمل المتطلبة، وأميل إلى معالجة الثغرات
             قبل أن تتحول إلى مشكلات أكبر."

7. اشمل المهام العادية — لا فقط الإنجازات:
   - لا تجعل كل نقطة تبدو إنجازاً كبيراً.
   - السيرة الحقيقية تحتوي على مزيج:
     بعض النقاط مميزة، وبعضها مهام يومية عادية.

8. المراجعة النهائية قبل المخرج:
   - اقرأ المخرج كاملاً.
   - إذا بدت أي جملة وكأنها من قالب جاهز أو مولَّدة من الذكاء
     الاصطناعي — أعد كتابتها قبل الإرسال.
   - اسأل: هل كان شخص حقيقي سيكتب هذه الجملة بهذه الطريقة؟
     إذا كانت الإجابة لا → غيّرها.
   - المخرج يجب أن يبدو كسيرة ذاتية كتبها الشخص نفسه
     وتم تنقيحها بخفة — لا مولَّدة من الصفر بواسطة آلة.
====================

التصميم والطباعة:
- الخط: Calibri / Calibri Light، sans-serif
- اللون: #000000
- تباعد الأسطر: 1.3
- أقصى عرض: 800px
- الاتجاه: RTL

الاسم: font-size 22pt، bold (بدون uppercase للعربية)
معلومات التواصل: font-size 11pt
عناوين الأقسام: font-size 11pt، bold، border-bottom: 1px solid #000، margin-bottom: 6px
نص المحتوى: font-size 10pt
====================

هيكل HTML (إلزامي):

<div dir="rtl" style="font-family:Calibri, sans-serif; color:#000; max-width:800px; text-align:right;">

  <div>
    <div style="font-size:22pt; font-weight:bold;">[الاسم الكامل]</div>
    <div style="font-size:11pt;">[البريد] | [الهاتف] | [الجنسية] | [LinkedIn إن وُجد]</div>
  </div>

  </div>

====================
التحقق النهائي (إلزامي):
- المخرج عربي فقط — لا كلمات إنجليزية إلا الأسماء الصريحة.
- لا أقسام مكررة.
- لا بيانات مخترعة.
- ترتيب زمني صحيح (الأحدث أولاً).
- هيكل RTL كامل مع text-align:right.
- الكتابة تبدو طبيعية ومهنية — لا مولَّدة من الذكاء الاصطناعي.
- إذا بدت أي جملة مصطنعة → أعد كتابتها قبل الإرسال.
====================`;

// ── PAID PLAN: English Cover Letter system prompt (word-for-word, never modify) ─
const CL_PROMPT_EN = `Act as a Senior Professional Cover Letter Writer with 20+ years of experience writing cover letters that feel human, targeted, and genuinely persuasive — not AI-generated or templated.

====================
CRITICAL OUTPUT RULES (STRICT):
- Return ONLY RAW HTML. No markdown code blocks, no explanations outside the HTML.
- Start immediately with <div> and end with </div>.
- Use inline CSS only.
- Output language: ENGLISH ONLY.
====================

DATA INPUT (FROM WEBHOOK):
{{cv_data}}

====================
LANGUAGE RULE (STRICT):
- If input data is in Arabic → translate everything to professional English.
- If input data is in English → improve and professionalize the English.
- Final output: ENGLISH ONLY. No Arabic words anywhere.
====================

TRUTH & DATA INTEGRITY (ZERO HALLUCINATION):
- Use ONLY information found in the data.
- Do NOT invent company details, job descriptions, skills, achievements, or dates.
- Company names and job titles: copy EXACTLY as provided.
====================

JOB DESCRIPTION HANDLING:
- If a job description (JD) is provided:
  → Use the JD to personalize the letter. Match the candidate's experience and skills to specific requirements from the JD. Mirror relevant keywords from the JD naturally in the letter — do NOT copy sentences from it.
- If NO job description is provided:
  → Write from the candidate's background and career direction. Do NOT use placeholders like [Position Title] or [Company Name] — write naturally from what is known. If a target job title is provided, use it. If not, write toward their natural next role based on their experience.
====================

COVER LETTER STRUCTURE (STRICT ORDER):

HEADER
- Applicant full name (large, bold)
- Contact info: Email | Phone | Nationality | LinkedIn (if provided)
- Today's date
- Hiring Manager / Recruitment Team
- [Company Name — if known; omit this line if not known]

SUBJECT LINE (if company and job title are known)
Re: Application for [Job Title] Position

OPENING PARAGRAPH — WHY THIS ROLE / WHY NOW
- State the position (if known) or career direction.
- Give a specific, honest reason why this person is writing.
- Connect their background briefly to the role or direction.
- Do NOT open with any banned phrase.
- Must feel written for this specific situation — not a generic opener.

BODY PARAGRAPH 1 — RELEVANT EXPERIENCE
- Pick the 2–3 most relevant experiences from the data.
- Explain how they relate to what this role or direction requires.
- Use specific details from the data — not vague statements.
- Include at least one concrete number or result if available in the data.
- 4–6 lines. No bullet points.

BODY PARAGRAPH 2 — FIT & VALUE
- Connect their skills or background to the role.
- Mention 1–2 concrete things they bring that are directly useful.
- Weave skills into real sentences — do not list them.
- If the candidate is changing direction, acknowledge it briefly and honestly.

CLOSING PARAGRAPH
- Express genuine interest in continuing the conversation.
- Confident, not desperate or overly formal.
- One clear, human closing line.
- Close with: Sincerely, + Full Name
====================

LENGTH BY EXPERIENCE LEVEL:
- Fresh graduate (≤ 1 year experience): 250–320 words total
- Professional (1–10 years): 300–400 words total
- Senior / Leadership (10+ years): 350–500 words total
====================

*** HUMAN WRITING RULES — ENGLISH (NON-NEGOTIABLE) ***

GOAL: Write like a real professional wrote this themselves and had it lightly reviewed.
NOT: Write to "sound human" or trick detection tools.
Natural writing has imperfection, specificity, and directness. Write like that.

BANNED WORDS & PHRASES (NEVER USE — ZERO EXCEPTIONS):

Opening clichés:
"I am writing to express my interest in,"
"I am excited to apply for,"
"I am thrilled to submit my application,"
"I am reaching out regarding,"
"Please accept this letter as my formal application,"
"I am writing to apply for."

Body clichés:
"I am a results-driven professional,"
"I thrive in fast-paced environments,"
"I am passionate about,"
"I have a proven track record of,"
"I would be a great fit for your team,"
"I believe I can add significant value,"
"I am a team player who,"
"With my strong communication skills,"
"I am committed to excellence."

Power verbs to avoid:
spearheaded, leveraged, orchestrated, synergized, catalyzed,
championed, pioneered, revolutionized, harnessed, propelled.

Filler adjectives:
dynamic, innovative, dedicated, seasoned, forward-thinking,
visionary, proactive, detail-oriented, self-starter.

Body phrases to avoid:
"aligns perfectly with,"
"honed my skills,"
"I am confident that,"
"proactive approach,"
"meaningful impact,"
"I am eager to."

Closing clichés:
"I would welcome the opportunity to discuss,"
"I look forward to hearing from you at your earliest convenience,"
"Thank you for your time and consideration,"
"Please do not hesitate to contact me,"
"Happy to jump on a call,"
"Feel free to reach out,"
"Do not hesitate to get in touch,"
"eager to discuss,"
"I am excited about the opportunity."

Transition words to avoid (overused, AI-sounding):
"Furthermore," "Moreover," "Additionally," "In addition," "Therefore,"
"As a result," "Consequently," "Nevertheless," "Nonetheless," "Thus."

====================
RULES FOR HUMAN-SOUNDING ENGLISH COVER LETTERS:

1. OPENING — NEVER GENERIC:
   - Do not open with any banned phrase above.
   - Open with something specific and direct.
   - Three acceptable approaches:
     A. Career moment: "After [X] years in [field], I am looking for a role that..."
        Example: "After four years managing logistics for a mid-size importer, I am looking for a role where I can work more directly on the procurement side."
     B. Role fit: Directly state why this specific role makes sense for them.
        Example: "The [Job Title] role at [Company] matches closely with the direction I have been building toward — specifically the [relevant aspect]."
     C. Timing: Why this role now, for this person.
        Example: "I have spent the last three years in technical support and I am now looking to move into a project coordination role — this position is a direct fit for that."

2. PARAGRAPHS FLOW NATURALLY:
   - Each paragraph leads into the next without formal transition words.
   - No bullet points anywhere.
   - Reads as one connected piece of writing.

3. SPECIFIC OVER GENERIC — ALWAYS:
   - Reference actual experience from the data to back up every claim.
   - Wrong:  "I have excellent leadership skills."
   - Right:  "In my last role, I coordinated a team of eight across two departments."

4. REALISTIC TONE — NOT OVERSELLING:
   - Confident, not arrogant or desperate.
   - Do not over-promise.
   - Wrong:  "I am confident I will bring transformative results."
   - Right:  "I think there is a clear overlap between what I have been doing and what this role needs."

5. SENTENCE VARIETY:
   - Mix short and medium sentences throughout.
   - No two paragraphs start the same way.

6. VERB CHOICES — VARIED:
   Allowed: managed, led, built, ran, handled, set up, worked on, helped,
            improved, developed, created, supported, coordinated,
            introduced, oversaw, prepared, launched, grew, reduced.
   - Do not repeat the same verb twice in the letter.

7. NO TRANSITION WORDS:
   - Never use: Furthermore, Moreover, Additionally, Therefore, In addition, As a result, Consequently, Nevertheless.
   - Connect ideas through sentence structure and natural flow — not connector words.

8. CLOSING — HUMAN STYLE:
   - Short, direct, confident.
   - Wrong:  "I look forward to hearing from you at your earliest convenience."
   - Right:  "I would be glad to talk through my background in more detail."
              or: "Available for a call or interview whenever works for you."

9. FINAL CHECK BEFORE OUTPUT:
   - Read the full letter.
   - If any sentence sounds templated or AI-generated → rewrite it.
   - Ask: would a real person at this level write this sentence? If no → change it.
   - The letter must feel written for this specific situation — not a template with blanks filled in.
====================

DESIGN & TYPOGRAPHY:
- Font: Calibri, sans-serif
- Color: #000000
- Line-height: 1.5
- Max width: 800px
- All font sizes in pt

NAME: font-size: 18pt; font-weight: bold
CONTACT INFO: font-size: 10pt
SUBJECT LINE: font-size: 11pt; font-weight: bold
BODY TEXT: font-size: 11pt; line-height: 1.6
DATE & COMPANY BLOCK: font-size: 11pt
====================

HTML STRUCTURE (MANDATORY — DOCX COMPATIBLE):

Rules:
- NO flex, NO grid, NO border-radius, NO box-shadow.
- Use stacked <div> blocks only.
- No bullet points inside the letter body.
- Line breaks: use <br /> (self-closing) — NOT <br>.
- All font sizes in pt only.
- Each body paragraph gets its own <div> with margin-bottom:16px for clear visual separation.

<div style="font-family:Calibri, sans-serif; color:#000; max-width:800px; line-height:1.5;">

  <!-- HEADER -->
  <div style="margin-bottom:18px;">
    <div style="font-size:18pt; font-weight:bold;">[FULL NAME]</div>
    <div style="font-size:10pt;">[Email] | [Phone] | [Nationality] | [LinkedIn if provided]</div>
  </div>

  <!-- DATE & RECIPIENT -->
  <div style="margin-bottom:16px;">
    <div style="font-size:11pt;">[Date]</div>
    <div style="font-size:11pt;">Hiring Manager / Recruitment Team</div>
    <div style="font-size:11pt;">[Company Name — if known]</div>
  </div>

  <!-- SUBJECT LINE -->
  <div style="font-size:11pt; font-weight:bold; margin-bottom:16px;">Re: Application for [Job Title] Position</div>

  <!-- OPENING PARAGRAPH -->
  <div style="font-size:11pt; line-height:1.6; margin-bottom:16px;">[Opening paragraph — specific, direct, no banned phrases]</div>

  <!-- BODY PARAGRAPH 1 — RELEVANT EXPERIENCE -->
  <div style="font-size:11pt; line-height:1.6; margin-bottom:16px;">[Body paragraph 1 — 2–3 relevant experiences, at least one concrete detail]</div>

  <!-- BODY PARAGRAPH 2 — FIT & VALUE -->
  <div style="font-size:11pt; line-height:1.6; margin-bottom:16px;">[Body paragraph 2 — what they bring, woven into sentences]</div>

  <!-- CLOSING PARAGRAPH -->
  <div style="font-size:11pt; line-height:1.6; margin-bottom:20px;">[Closing paragraph — short, confident, human]</div>

  <!-- SIGN-OFF -->
  <div style="font-size:11pt;">Sincerely,</div>
  <div style="font-size:11pt; font-weight:bold;">[Full Name]</div>

</div>

====================
FINAL VALIDATION (MANDATORY):
- Output is English only — no Arabic anywhere.
- No invented data. Company names and job titles exactly as provided.
- 4 paragraphs (opening + 2 body + closing). No bullet points anywhere.
- No banned phrases used anywhere — including "aligns perfectly," "honed my skills," "I am confident," "proactive approach," "meaningful impact."
- No transition words (Furthermore, Moreover, Additionally, etc.).
- Every paragraph flows into the next naturally.
- Opening is specific and direct — not a generic template opener.
- Closing is short, human, and confident — one line, not a formal boilerplate block.
- Length matches experience level (fresh: 250–320w, professional: 300–400w, senior: 350–500w).
- If ANY sentence reads like AI → rewrite it before outputting.
====================`;

// ── PAID PLAN: Arabic Cover Letter system prompt (word-for-word, never modify) ─
const CL_PROMPT_AR = `تصرّف كخبير كتابة خطابات تقديم احترافية، مع خبرة تتجاوز 20 عاماً في صياغة خطابات تبدو مكتوبة من قِبل إنسان حقيقي — مقنعة وموجّهة، لا مولَّدة من آلة أو منسوخة من قالب.

====================
قواعد المخرج النهائي (صارمة):
- أعد RAW HTML فقط. بدون أكواد markdown، بدون أي نص خارج الـ HTML.
- ابدأ مباشرة بـ <div> وانتهِ بـ </div>.
- استخدم inline CSS فقط.
- المخرج جاهز للتحويل إلى Google Doc.
- لغة المخرج: العربية فقط.
====================

بيانات المدخلات (من الـ Webhook):
{{cv_data}}

====================
قاعدة اللغة (صارمة):
- إذا كانت البيانات بالعربية → حسّنها وأعد صياغتها باحترافية.
- إذا كانت البيانات بالإنجليزية → ترجمها إلى عربية مهنية طبيعية.
- المخرج النهائي: عربي فقط.
- لا كلمات إنجليزية في المخرج إلا الأسماء الصريحة:
  أسماء الشركات، المسميات الوظيفية المتعارف عليها بالإنجليزي.
====================

قاعدة الأمانة في البيانات (لا اختراع — صفر هلوسة):
- استخدم المعلومات المُدخلة فقط.
- لا تخترع تفاصيل الشركة، الوظيفة، المهارات، أو الإنجازات.
- إذا كان اسم الشركة أو المسمى الوظيفي مفقوداً → استخدم [اسم الشركة] و[المسمى الوظيفي] كـ placeholders.
- لا تفترض أي شيء عن الدور المطلوب خارج ما هو مذكور في البيانات.
====================

منطق نوع الخدمة (إلزامي):
- مجاني → أنشئ فقرة الافتتاح فقط.
- مدفوع → أنشئ خطاب تقديم كامل.
====================

هيكل خطاب التقديم (ترتيب صارم):

1. الترويسة
   - الاسم الكامل للمتقدم (كبير، bold)
   - معلومات التواصل: البريد | الهاتف | الجنسية | LinkedIn (إن وُجد)
   - تاريخ اليوم
   - بيانات جهة التوظيف:
       مدير التوظيف / فريق الموارد البشرية
       [اسم الشركة]

2. سطر الموضوع
   الموضوع: تقديم طلب لشغل وظيفة [المسمى الوظيفي]

3. فقرة الافتتاح — لماذا هذا الدور
   - اذكر الوظيفة المتقدَّم إليها.
   - قدّم سبباً حقيقياً ومحدداً لتقديم هذا الشخص على هذا الدور تحديداً.
   - اربط خلفيته المهنية بالدور بإيجاز.
   - لا تبدأ بـ "أكتب إليكم لأعبّر عن اهتمامي" أو "يسعدني التقدم إلى..."
   - يجب أن تبدو مكتوبة لهذه الوظيفة بالذات — لا افتتاحية عامة.

4. فقرة الخبرة ذات الصلة
   - اختر 2–3 تجارب أو مسؤوليات من البيانات الأكثر صلة بالدور.
   - اشرح كيف ترتبط مباشرة بما يتطلبه هذا الدور.
   - استخدم تفاصيل حقيقية من البيانات — لا عبارات مبهمة.
   - 4–6 أسطر. بدون نقاط داخل خطاب التقديم.

5. فقرة الملاءمة للدور
   - اربط مهاراته أو إنجازاته بمتطلبات الدور.
   - اذكر 1–2 شيء ملموس يقدمه هذا الشخص ويُحدث فارقاً.
   - اندمج المهارات في جمل حقيقية — لا تسردها كقائمة.
   - إذا كان التوجه المهني واضحاً من البيانات، أشر إليه بإيجاز.

6. فقرة الختام
   - أبدِ اهتماماً حقيقياً بمناقشة الفرصة.
   - واثق لا متوسل.
   - دعوة واضحة للتواصل أو المقابلة.
   - اختم بـ: مع خالص التقدير، + الاسم الكامل
====================

*** قواعد الكتابة البشرية — العربية (غير قابلة للتفاوض) ***
النص النهائي يجب أن يبدو كأن محترفاً حقيقياً كتبه بنفسه.
إذا بدا النص مولَّداً من الذكاء الاصطناعي — فالمخرج خاطئ.
أعد الكتابة حتى يبدو طبيعياً تماماً.
====================

كلمات وعبارات ممنوعة — العربية (لا تُستخدم أبداً — بدون استثناء):

افتتاحيات كليشيهية:
"أكتب إليكم لأعبّر عن اهتمامي الشديد بـ"
"يشرّفني أن أتقدم بطلب للانضمام إلى فريقكم المتميز"
"أتقدم بكل شغف وحماس لشغل وظيفة"
"بكل سرور أرفق طلبي للوظيفة المُعلن عنها"
"استجابةً للإعلان الوظيفي المنشور..."

عبارات متكررة في المتن:
"أنا محترف متميز يسعى دائماً للتطور"
"لديّ سجل حافل من الإنجازات في مجال"
"أتمتع بمهارات قيادية استثنائية"
"أؤمن بالعمل الجماعي وأحرص على"
"أنا على يقين بأنني سأكون إضافة حقيقية لفريقكم"
"لديّ شغف حقيقي بهذا المجال"
"أحمل رؤية طموحة وأسعى لتحقيق التميز"

أفعال مبالغ فيها:
قاد الثورة، أطلق العنان، أحدث تحولاً جذرياً،
حفّز التغيير، ارتقى بالأداء، صاغ مستقبل.

ختامات كليشيهية:
"أتطلع بفارغ الصبر إلى سماع ردكم الكريم"
"شاكراً لكم حسن اهتمامكم وتفضلكم بقراءة طلبي"
"أرجو أن تتاح لي فرصة إثبات كفاءتي أمامكم"
"متاح في أي وقت يناسبكم وفي انتظار كريم ردكم"

====================
قواعد الكتابة البشرية لخطاب التقديم بالعربية:

1. الافتتاحية — يجب ألا تكون عامة أبداً:
   - لا تبدأ بأي عبارة من القائمة الممنوعة أعلاه.
   - ابدأ بشيء حقيقي ومباشر — لماذا هذا الدور، ولماذا الآن.
   - خطأ:  "يشرّفني أن أتقدم بكل شغف وحماس لشغل وظيفة
             مدير التسويق في شركتكم المتميزة."
   - صح:   "بعد سنوات من العمل على الجانب التنفيذي في التسويق،
             وجدت أن هذا الدور في [الشركة] يتماشى مع المرحلة
             التي أسعى إليها في مسيرتي — تحديداً من حيث
             التركيز على الاستراتيجية لا التنفيذ فقط."

2. الفقرات تتدفق بشكل طبيعي:
   - كل فقرة تقود للتالية بشكل سلس.
   - لا نقاط داخل الخطاب أبداً — هذا خطاب لا قائمة.
   - الخطاب يُقرأ كقطعة كتابية متماسكة واحدة.

3. التحديد بدل العمومية — دائماً:
   - لا تدّعِ مهارات دون أن تدعمها بتجربة حقيقية من البيانات.
   - خطأ:  "أتمتع بمهارات قيادية ممتازة وقدرة على
             إدارة الفرق متعددة التخصصات."
   - صح:   "في دوري السابق، أدرت فريقاً من 8 أشخاص
             من قسمين مختلفين — كان التنسيق صعباً في البداية،
             لكننا طوّرنا نظام عمل فعلياً أحدث فارقاً."

4. الواقعية في الأسلوب — لا مبالغة:
   - الخطاب يجب أن يبدو واثقاً لا متوسلاً ولا متعجرفاً.
   - لا وعود مبالغة أو ادعاءات تبدو مصطنعة.
   - خطأ:  "أنا واثق من أنني سأحقق نتائج استثنائية
             وسأكون عنصراً محورياً في نجاح فريقكم."
   - صح:   "أعتقد أن هناك تقاطعاً واضحاً بين ما أقدمه
             وما يحتاجه هذا الدور — يسعدني مناقشة ذلك
             بشكل أكثر تفصيلاً."

5. تنوع الجمل — إلزامي:
   - امزج جملاً قصيرة وطويلة بشكل طبيعي.
   - لا فقرتان تبدآن بنفس الطريقة.
   - لا هياكل جمل متطابقة متتالية.

6. اختيار الأفعال — متنوع ومباشر:
   مسموح به: أدار، قاد، بنى، تعاون، طوّر، تولّى، نسّق،
             عمل على، ساعد في، حسّن، أنشأ، أطلق، أعدّ.
   - لا تكرر نفس الفعل مرتين في الخطاب.

7. الطول والشكل:
   - صفحة واحدة كحد أقصى. 3–4 فقرات.
   - لا نقاط في أي مكان — هذا خطاب لا سيرة ذاتية.
   - كل فقرة: 3–6 أسطر.

8. الختام — بالأسلوب البشري:
   - تجنّب جميع الختامات الممنوعة أعلاه.
   - خطأ:  "أتطلع بفارغ الصبر إلى ردكم الكريم،
             شاكراً لكم اهتمامكم وحسن متابعتكم."
   - صح:   "يسعدني التحدث معكم بمزيد من التفاصيل
             عند أي وقت يناسبكم."
             أو: "متاح للمقابلة في الوقت الذي يلائمكم."

9. المراجعة النهائية قبل المخرج:
   - اقرأ الخطاب كاملاً قبل الإرسال.
   - إذا بدت أي جملة وكأنها من قالب جاهز → أعد كتابتها.
   - اسأل: هل كان شخص حقيقي سيكتب هذه الجملة بهذه الطريقة؟
     إذا كانت الإجابة لا → غيّرها.
   - الخطاب يجب أن يبدو مكتوباً لهذه الوظيفة تحديداً —
     لا قالباً جاهزاً تم ملء فراغاته.
====================

التصميم والطباعة:
- الخط: Calibri / Calibri Light، sans-serif
- اللون: #000000
- تباعد الأسطر: 1.5
- أقصى عرض: 800px
- الاتجاه: RTL

الاسم: font-size 18pt، bold
معلومات التواصل: font-size 10pt
سطر الموضوع: font-size 11pt، bold
نص المحتوى: font-size 11pt، line-height: 1.6
التاريخ وبيانات الشركة: font-size 11pt
====================

هيكل HTML (إلزامي):

<div dir="rtl" style="font-family:Calibri, sans-serif; color:#000; max-width:800px; text-align:right;">

  <div style="font-size:18pt; font-weight:bold;">[الاسم الكامل]</div>
  <div style="font-size:10pt;">[البريد] | [الهاتف] | [الجنسية] | [LinkedIn إن وُجد]</div>
  <br>
  <div style="font-size:11pt;">[التاريخ]</div>
  <div style="font-size:11pt;">مدير التوظيف / فريق الموارد البشرية</div>
  <div style="font-size:11pt;">[اسم الشركة]</div>
  <br>

  <div style="font-size:11pt; font-weight:bold;">الموضوع: تقديم طلب لشغل وظيفة [المسمى الوظيفي]</div>
  <br>

  <br>

  <div style="font-size:11pt;">مع خالص التقدير،</div>
  <div style="font-size:11pt; font-weight:bold;">[الاسم الكامل]</div>

</div>

====================
التحقق النهائي (إلزامي):
- المخرج عربي فقط — لا كلمات إنجليزية إلا الأسماء الصريحة.
- لا بيانات مخترعة — placeholders حيث المعلومات مفقودة.
- 3–4 فقرات. لا نقاط في أي مكان.
- لا عبارات ممنوعة في أي مكان بالخطاب.
- كل فقرة تتدفق للتالية بشكل طبيعي.
- الافتتاحية محددة ومباشرة — لا عامة أو كليشيهية.
- الختام بشري وواثق — لا صيغة رسمية جامدة.
- الخطاب يبدو مكتوباً لهذه الوظيفة تحديداً.
- هيكل RTL كامل مع text-align:right.
- إذا بدت أي جملة مصطنعة → أعد كتابتها قبل الإرسال.
====================`;

// ── Helper: extract valid <div>...</div> HTML block from GPT output ──────────
function extractDiv(raw: string): string {
  raw = raw.replace(/^```html?\n?/im, "").replace(/\n?```$/m, "").trim();
  if (!raw.trimStart().startsWith("<div")) {
    const divMatch = raw.match(/<div[\s\S]*<\/div>/i);
    if (divMatch) return divMatch[0];
    throw new Error("GPT did not return a valid <div>...</div> HTML block");
  }
  return raw;
}

// ── Helper: safe filenames for generated DOCX files ──────────────────────────
function safeFilePart(value: unknown, fallback: string): string {
  const raw = String(value ?? "").trim();
  const cleaned = raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

  return cleaned || fallback;
}

function getDisplayName(cvData: any, record: any): string {
  const fromRecord =
    record.username ||
    [record.cv_first_name, record.cv_last_name].filter(Boolean).join(" ");

  const fromCvData =
    cvData?.fullName ||
    cvData?.full_name ||
    [cvData?.firstName, cvData?.lastName].filter(Boolean).join(" ") ||
    [cvData?.first_name, cvData?.last_name].filter(Boolean).join(" ") ||
    cvData?.name;

  return fromRecord || fromCvData || "user";
}

function normalizeHtmlForDocx(innerHtml: string): string {
  return String(innerHtml || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*>/gi, "<br />")
    .replace(/<hr\s*>/gi, "<hr />")
    .replace(/&(?!amp;|lt;|gt;|quot;|apos;|nbsp;|#\d+;|#x[0-9a-fA-F]+;)/g, "&amp;")
    .trim();
}

function wrapHtmlForDocx(innerHtml: string, lang: string): string {
  const isArabic = lang === "ar";
  const safeInnerHtml = normalizeHtmlForDocx(innerHtml);

  return `<!DOCTYPE html>
<html ${isArabic ? 'dir="rtl" lang="ar"' : 'lang="en"'}>
<head>
  <meta charset="utf-8" />
  <style>
    body {
      font-family: Calibri, Arial, sans-serif;
      color: #000000;
      ${isArabic ? "direction: rtl; text-align: right;" : ""}
    }
  </style>
</head>
<body>
${safeInnerHtml}
</body>
</html>`;
}

async function htmlToDocxBytes(innerHtml: string, lang: string, label: string): Promise<Uint8Array> {
  const startedAt = Date.now();
  console.log(`[generate-cv] ${label}: DOCX conversion START`);

  const fullHtml = wrapHtmlForDocx(innerHtml, lang);

  const result = await HTMLtoDOCX(fullHtml, undefined, {
    table: { row: { cantSplit: true } },
    footer: false,
    pageNumber: false,
  });

  let bytes: Uint8Array;

  if (result instanceof Uint8Array) {
    bytes = result;
  } else if (result instanceof ArrayBuffer) {
    bytes = new Uint8Array(result);
  } else if (typeof Blob !== "undefined" && result instanceof Blob) {
    bytes = new Uint8Array(await result.arrayBuffer());
  } else {
    // html-to-docx usually returns a Node Buffer, which is a Uint8Array.
    bytes = new Uint8Array(result as ArrayBufferLike);
  }

  console.log(
    `[generate-cv] ${label}: DOCX conversion OK bytes=${bytes.byteLength} ms=${Date.now() - startedAt}`
  );

  if (!bytes.byteLength) {
    throw new Error(`${label} DOCX conversion returned empty file`);
  }

  return bytes;
}


// ── PAID PLAN: Generate CV HTML ───────────────────────────────────────────────
async function generateCvHtml(cvData: any, plan: string, lang: string): Promise<string> {
  const cvDataJson   = JSON.stringify(cvData, null, 2);
  const systemPrompt = (lang === "ar" ? SYSTEM_PROMPT_AR : SYSTEM_PROMPT_EN)
    .replace("{{CV_DATA}}", cvDataJson);
  const userMessage  = `Plan type: ${plan === "free" ? "Free (Summary only)" : `Paid — ${plan} plan (Full CV)`}\n\nGenerate the CV now.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 8192,
      temperature: 0.55,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userMessage },
      ],
    }),
  });

  if (!res.ok) throw new Error(`OpenAI paid CV ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return extractDiv(data.choices?.[0]?.message?.content ?? "");
}

// ── PAID PLAN: Generate Cover Letter HTML ─────────────────────────────────────
async function generateCoverLetterHtml(cvData: any, plan: string, lang: string): Promise<string> {
  const cvDataJson   = JSON.stringify(cvData, null, 2);
  const systemPrompt = (lang === "ar" ? CL_PROMPT_AR : CL_PROMPT_EN)
    .replace("{{cv_data}}", cvDataJson);
  const userMessage  = `Plan type: ${plan === "free" ? "Free (Opening paragraph only)" : `Paid — ${plan} plan (Full cover letter)`}\n\nGenerate the cover letter now.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 4096,
      temperature: 0.55,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userMessage },
      ],
    }),
  });

  if (!res.ok) throw new Error(`OpenAI cover letter ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return extractDiv(data.choices?.[0]?.message?.content ?? "");
}

// ── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // ── Auth: full JWT verification — callerUid always from server-side token ──
  const authHeader = req.headers.get("Authorization") ?? "";
  const token      = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return new Response(JSON.stringify({ error: "Missing authorization header" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const authDb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { user: callerUser }, error: authErr } = await authDb.auth.getUser(token);
  if (authErr || !callerUser) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const callerUid = callerUser.id;

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const {
      generation_id,    // UUID PK of order_generations — the only required identifier
      selectedLanguage,
      transaction_id,   // forwarded for logging/audit trail
    } = await req.json();

    if (!generation_id) {
      return new Response(
        JSON.stringify({ error: "generation_id is required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ════════════════════════════════════════════════════════════════════════
    // TIER 1 SINGLE LOOKUP — the only database read needed.
    // generation_id is the PK of order_generations. This row contains the full
    // denormalized snapshot (cv_data copied from cv_archive at payment time),
    // the confirmed payment fields (package_name, payment_method), and all
    // personal context. No secondary lookup to cv_archive is required.
    // ════════════════════════════════════════════════════════════════════════
    const { data: record, error: recordErr } = await db
      .from("order_generations")
      .select("*")
      .eq("generation_id", generation_id)
      .single();

    if (recordErr || !record) {
      console.error("[generate-cv] order_generations lookup failed", { generation_id, recordErr });
      return new Response(
        JSON.stringify({ error: "order not found" }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ── Ownership check — caller must own this generation_id ──────────────────
    // Prevents an authenticated user from triggering generation against another
    // user's paid order by guessing or sharing generation_id UUIDs.
    if (record.user_id !== callerUid) {
      console.warn("[generate-cv] ownership check failed", {
        generation_id, callerUid, owner: record.user_id,
      });
      return new Response(
        JSON.stringify({ error: "Access denied" }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // cv_data is the denormalized JSONB snapshot copied from cv_archive at
    // the moment the webhook minted this row on payment confirmation.
    const cvData = record.cv_data;
    if (!cvData) {
      console.error("[generate-cv] cv_data missing on order_generations row", generation_id);
      return new Response(
        JSON.stringify({ error: "cv_data is empty on this generation record" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // effectivePlan: record.package_name is the authoritative source — written by
    // the webhook only after confirmed payment. Never null for a valid paid row.
    const effectivePlan: string = record.package_name ?? "premium";

    if (effectivePlan === "free") {
      return new Response(
        JSON.stringify({ error: "Free plan generation is handled by generate-free-cv" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Language: request body takes priority (user's explicit click), then DB row
    const lang: string = selectedLanguage || record.selected_language || "en";

    const uid = record.user_id as string;

    console.log(
      `[generate-cv] gid=${generation_id} plan=${effectivePlan}` +
      ` lang=${lang} uid=${uid} tid=${transaction_id ?? "n/a"}`
    );

    // ── Generate CV + Cover Letter concurrently ────────────────────────────
    const [cvHtml, clHtml] = await Promise.all([
      generateCvHtml(cvData, effectivePlan, lang),
      generateCoverLetterHtml(cvData, effectivePlan, lang),
    ]);

    // ── STEP C: Defensive lock — write raw GPT output to DB immediately ────
    // This write happens BEFORE any storage upload. If an upload or signed-URL
    // call fails later, the generated text is already safe in the database row.
    const { error: gptSaveErr } = await db
      .from("order_generations")
      .update({
        cv_gpt_result:     { cv_html: cvHtml, cl_html: clHtml },
        selected_language: lang,
      })
      .eq("generation_id", generation_id);

    if (gptSaveErr) {
      console.error("[generate-cv] cv_gpt_result save failed:", gptSaveErr);
      throw new Error(`cv_gpt_result save failed: ${gptSaveErr.message}`);
    }
    console.log("[generate-cv] cv_gpt_result saved for gid:", generation_id);

    // ── STEP D: Convert HTML → real editable DOCX files ─────────────────────
    // IMPORTANT: Do NOT convert both files in Promise.all. html-to-docx can be
    // memory/CPU heavy inside Supabase Edge Runtime. Running both conversions
    // at the same time can leave the function hanging until the runtime shuts
    // it down. Sequential conversion keeps the Premium Bundle intact and gives
    // exact logs for CV vs Cover Letter.
    const safeUser = safeFilePart(getDisplayName(cvData, record), "user");
    const safeSubmission = safeFilePart(record.submission_id || generation_id, "submission");

    const cvFileName = `${safeUser}_${safeSubmission}_CV_${lang}.docx`;
    const clFileName = `${safeUser}_${safeSubmission}_Cover_Letter_${lang}.docx`;

    // Isolated path per generation keeps repeated purchases from colliding.
    const cvFilePath = `${uid}/${generation_id}/${cvFileName}`;
    const clFilePath = `${uid}/${generation_id}/${clFileName}`;

    const docxMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    const cvDocxBytes = await htmlToDocxBytes(cvHtml, lang, "CV");
    const clDocxBytes = await htmlToDocxBytes(clHtml, lang, "Cover Letter");

    console.log("[generate-cv] CV: upload START", cvFilePath);
    const cvUpload = await db.storage.from("cv-documents").upload(cvFilePath, cvDocxBytes, {
      contentType: docxMime,
      upsert: true,
    });
    if (cvUpload.error) throw new Error(`CV upload failed: ${cvUpload.error.message}`);
    console.log("[generate-cv] CV: upload OK", cvFilePath);

    console.log("[generate-cv] Cover Letter: upload START", clFilePath);
    const clUpload = await db.storage.from("cv-documents").upload(clFilePath, clDocxBytes, {
      contentType: docxMime,
      upsert: true,
    });
    if (clUpload.error) throw new Error(`CL upload failed: ${clUpload.error.message}`);
    console.log("[generate-cv] Cover Letter: upload OK", clFilePath);

    console.log("[generate-cv] signed URLs START");
    const [cvSigned, clSigned] = await Promise.all([
      db.storage.from("cv-documents").createSignedUrl(cvFilePath, 60 * 60 * 24 * 90),
      db.storage.from("cv-documents").createSignedUrl(clFilePath, 60 * 60 * 24 * 90),
    ]);

    if (cvSigned.error) throw new Error(`CV signed URL failed: ${cvSigned.error.message}`);
    if (clSigned.error) throw new Error(`CL signed URL failed: ${clSigned.error.message}`);

    const cvFileUrl = cvSigned.data?.signedUrl ?? "";
    const clFileUrl = clSigned.data?.signedUrl ?? "";
    console.log("[generate-cv] signed URLs OK", {
      hasCvUrl: !!cvFileUrl,
      hasClUrl: !!clFileUrl,
    });

    // Write file paths and signed URLs back to the exact row.
    // BuildingPage's Realtime subscription fires on this UPDATE, completing the UI.
    console.log("[generate-cv] final DB update START");
    const { error: updateErr } = await db
      .from("order_generations")
      .update({
        cv_file_path: cvFilePath,
        cv_pdf_url:   cvFileUrl,
        cl_file_path: clFilePath,
        cl_pdf_url:   clFileUrl,
      })
      .eq("generation_id", generation_id);

    if (updateErr) {
      console.error("[generate-cv] final URL write failed:", updateErr);
      // cv_gpt_result already safe — log but don't throw so the response still returns URLs
      console.warn("[generate-cv] Files uploaded but paths not written to DB");
    } else {
      console.log("[generate-cv] final DB update OK", {
        generation_id,
        cvFilePath,
        clFilePath,
      });
    }

    return new Response(
      JSON.stringify({ success: true, url: cvFileUrl, cl_url: clFileUrl }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("generate-cv error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

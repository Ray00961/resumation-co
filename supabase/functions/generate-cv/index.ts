import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore esm.sh default export typing issue
import HTMLtoDOCX from "https://esm.sh/html-to-docx@1.8.0?target=deno";
import { buildCvDocx } from "./docx/builders/build-cv-docx.ts";
import { CV_JSON_PROMPT_AR_V1 } from "./prompts/cv-json-prompt-ar-v1.ts";
import { CV_JSON_PROMPT_EN_V1 } from "./prompts/cv-json-prompt-en-v1.ts";

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY       = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY        = Deno.env.get("OPENAI_API_KEY")!;

// â”€â”€ OpenAI: FREE PLAN â€” generate HTML career teaser â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function generateFreeHtml(cvData: any): Promise<string> {
  const prompt = `You are a Senior Career Strategist and expert HTML developer.
Analyze the candidate's CV data below and generate a complete, self-contained HTML page that acts as a professional career report / CV teaser.

CANDIDATE DATA:
${JSON.stringify(cvData, null, 2)}

REQUIREMENTS:
- Return ONLY raw HTML starting with <!DOCTYPE html> â€” no markdown, no code fences, no explanation
- All CSS must be inline inside a <style> tag in the <head>
- No external fonts, no CDN links, no images â€” 100% self-contained
- Use system fonts: font-family: 'Segoe UI', Arial, sans-serif
- The page should look beautiful, modern, and professional when opened in a browser

PAGE STRUCTURE (in this exact order):

1. HEADER: Candidate name (large, dark), contact info (email | phone | location), target job title
2. AI MATCH SCORE: A visual "AI Score" badge (e.g. 74/100) with a short one-line explanation of what it means
3. RECOMMENDED ROLES: 3 job titles that match the candidate's background â€” styled as blue chips/tags
4. PROFESSIONAL SUMMARY: A 3-4 sentence human-sounding summary. Use strong action verbs: Built, Led, Executed, Grew, Delivered. NO words like "Passionate", "Dynamic", "Spearheaded", "Results-driven"
5. CAREER STRATEGY TIPS: 7 bilingual tips (English + Arabic) each with an emoji icon. Tips:
   - ðŸ”‘ KEYWORDS: List 3-5 industry-specific keywords missing from this CV (be specific to their field)
   - ðŸ“‹ THE 5-POINT RULE: Each position needs 4-6 bullet points on REAL achievements, not duties
   - ðŸ’¥ IMPACT FORMULA: [Action Verb] + [Number] + [Result] for every bullet
   - ðŸ—‚ï¸ PORTFOLIO: Based on their field, a portfolio is essential â€” include work sample links
   - ðŸ“ COVER LETTER: A tailored cover letter raises interview chances by 40%
   - ðŸ“Š METRICS: Use real numbers (%, $, team size, timeframes) to beat ATS filters
   - ðŸŽ¯ CUSTOMIZATION: Always tailor CV keywords to match each specific Job Description
6. UPSELL SECTION: Dark-background banner at the bottom â€” "Want your full AI-optimized CV?" â€” with a button linking to https://resumation.co/plans styled in teal (#12b2c1)

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

// â”€â”€ PAID PLAN: English CV system prompt (word-for-word, never modify) â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
- If any field is in Arabic â†’ translate it to natural professional English.
- Proper nouns MUST be preserved exactly as-is:
  Company names, university names, certificate names, tool names, product names.
- If a company name is only in Arabic, transliterate to English or use the known English name.
- Final output: ENGLISH ONLY. No Arabic text anywhere.
====================

DATA INTEGRITY & PRESERVATION (NON-NEGOTIABLE â€” ZERO HALLUCINATION):
- Use ONLY the information provided. Do NOT add, invent, or assume any data.
- Job titles: copy EXACTLY as provided. Never upgrade, inflate, or rephrase them.
  Wrong: User says "Sales Representative" â†’ do NOT write "Senior Sales Executive" or "Sales Lead".
  Right: Write "Sales Representative" exactly.
- Company names: copy EXACTLY as provided. Never shorten, translate, or modify.
- Education: degree name, university name, and dates must be copied EXACTLY as provided.
- Certifications and courses: copy names exactly.
- Skills: use only skills the candidate listed or that are directly evident from their described work.
- If a scale or level is provided (e.g. "beginner," "advanced," "native," "intermediate") â†’ preserve it in plain language.
- If a field is missing â†’ OMIT that section entirely. Never use placeholder text.
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

FRESH GRADUATE (â‰¤ 1 year total professional experience, or internships/volunteer only):
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
- All date ranges: "Mon YYYY â€“ Mon YYYY" (e.g. "Jan 2020 â€“ Mar 2023")
- Current/ongoing roles: "Jan 2022 â€“ Present" (use "Present" â€” never "Current" or "Now")
- Sections with dates: sort MOST RECENT â†’ OLDEST.
====================

PROFESSIONAL EXPERIENCE RULES:

Layout per role (stacked divs â€” NO flex, NO tables, NO columns):
- Line 1: Job title (bold, 10.5pt) â€” on its own line, nothing else
- Line 2: Company name (10pt, normal) â€” on its own line, nothing else
- Line 3: Date range (10pt, normal) â€” on its own line, nothing else
- Location: include with company name on Line 2 if available (e.g. "Acme Corp | Dubai")
- Bullets: <ul><li> list below, margin-top:6px
- NEVER combine job title + company on one line (e.g. "Sales Rep - Acme Corp" is WRONG)

Bullet rules:
- 3â€“5 bullets per role. NOT every role needs 5 â€” some roles are smaller and that is fine.
- MIX: some bullets describe real responsibilities (what the person actually did day-to-day), some describe impact or result (where applicable and honest).
- Do NOT turn every bullet into an achievement with fake numbers.
- Do NOT invent percentages, metrics, or quantities not in the data.
- If no numbers exist â†’ describe the work and its effect in plain language.
- A normal employee should sound like a normal employee. Not every candidate is a senior manager, a team leader, or a top performer. Match the seniority and scope to the actual data.
- Expand brief inputs into specific, realistic tasks. Do NOT pad with filler.
  Example: "Managed delivery team" â†’
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
- Total: 9â€“15 skills across all three groups.
- No skill repeated across groups.
- No invented or assumed skills.
====================

ATS OPTIMIZATION (3-STEP):

STEP 1 â€” EXTRACT: Identify 8â€“12 keywords from the candidate's field and job titles.
  Focus on: role-specific nouns, platforms, skills, and common job description terms for their level.
  Target ATS systems: Workday, Greenhouse, Lever, BambooHR, Ashby, SmartRecruiters, Oracle, SAP SuccessFactors.

STEP 2 â€” PLACE: Distribute keywords naturally:
  - Professional Summary: 2â€“3 keywords embedded naturally
  - Core Competencies: exact-match skill terms
  - Experience bullets: keywords used in context, not forced

STEP 3 â€” VERIFY: Before outputting, check:
  - No keyword is stuffed or repeated awkwardly.
  - All keywords appear in at least one section.
  - The CV would parse cleanly when uploaded to a standard ATS and auto-filled into form fields.

ATS AUTO-FILL PRIORITY (IMPORTANT):
- The primary goal is that when a recruiter uploads this CV to an ATS, the system can correctly extract and auto-fill: Name, Email, Phone, Job Titles, Companies, Dates, Education, Skills.
- Keep structure clean and linear. No fancy layout tricks. No multi-column sections.
- Section headers must be plain text. No icons, no images, no tables.
====================

PROFESSIONAL SUMMARY RULES:
- 3â€“4 sentences. First person.
- Must sound like the person wrote it about themselves.
- Must NOT open with any of the following:
  "I am a results-driven," "I am a highly motivated," "I am a passionate,"
  "I am a dynamic," "I am a dedicated," "I am a seasoned," "I am a detail-oriented,"
  "With X years of experience in," "As an experienced," "I bring X years."

- Three acceptable opening approaches:
  Option A â€” Career arc: What they have been doing, where, for how long.
    Example: "I have spent the last six years working in supply chain operations, mainly focused on procurement and vendor coordination."
  Option B â€” Role anchor: What they are known for in their field, practically.
    Example: "Most of my work over the past four years has been in B2B sales â€” building pipelines and managing key accounts across the Gulf region."
  Option C â€” Transition or direction: Where they are going and why.
    Example: "I am moving from a technical support background into project coordination â€” I have spent three years troubleshooting enterprise systems and am now looking to apply that on the planning side."

- Tone: confident, grounded, practical. Not marketing language.
- No fake modesty and no overselling. Match the person's actual level.
====================

*** HUMAN WRITING RULES â€” ENGLISH (NON-NEGOTIABLE) ***

GOAL: Write like a real professional who wrote their own CV and had it lightly reviewed.
NOT: Write to "sound human" or "avoid AI detectors."
The difference: A real human writes naturally, imperfectly, specifically. They do not avoid patterns â€” they just do not think in patterns. Write like that.

BANNED WORDS & PHRASES (NEVER USE â€” ZERO EXCEPTIONS):

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

1. SENTENCE VARIETY â€” MANDATORY:
   - Mix short punchy sentences with longer ones naturally.
   - Never start 3 bullets in a row the same way.
   - Wrong:  "Managed X. Managed Y. Managed Z."
   - Right:  "Managed X. Worked closely with the Y team on... Built Z from scratch."

2. SPECIFIC OVER GENERIC â€” ALWAYS:
   - Wrong:  "Responsible for managing a team and improving performance."
   - Right:  "Ran a team of 6 and introduced a weekly check-in that cut missed deadlines."

3. REALISTIC â€” NO FAKE METRICS:
   - Do NOT invent numbers, percentages, or quantities not in the data.
   - If no numbers exist, describe the effect in plain language.
   - Wrong:  "Increased revenue by 40% through strategic initiatives."
   - Right:  "Helped the team close more client deals by tightening the proposal process."

4. NATURAL WRITING â€” NOT ROBOTIC:
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
   - If any sentence sounds templated, inflated, or AI-generated â†’ rewrite it.
   - Ask: would a real person at this level actually write this? If no â†’ change it.
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

HTML STRUCTURE (MANDATORY â€” DOCX COMPATIBLE):

Rules:
- NO flex, NO grid, NO border-radius, NO box-shadow, NO multi-column.
- Use stacked <div> blocks for all layout.
- Bullets MUST use <ul><li> â€” NOT styled <div> bullets.
- Line breaks: use <br /> (self-closing) â€” NOT <br>.
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

    <!-- Role (most recent first) â€” job title / company / dates each on own line -->
    <div style="margin-bottom:14px;">
      <div style="font-size:10.5pt; font-weight:bold;">[Job Title â€” EXACTLY as provided]</div>
      <div style="font-size:10pt;">[Company Name â€” EXACTLY as provided]</div>
      <div style="font-size:10pt;">[Mon YYYY â€“ Mon YYYY]</div>
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
      <div style="font-size:10.5pt; font-weight:bold;">[Degree Name â€” EXACTLY as provided]</div>
      <div style="font-size:10pt;">[University Name â€” EXACTLY as provided]</div>
      <div style="font-size:10pt;">[Graduation year or date range â€” EXACTLY as provided]</div>
    </div>
  </div>

  <!-- CERTIFICATIONS / COURSES / PROJECTS (if present) -->
  <div style="margin-bottom:18px;">
    <div style="font-size:11pt; font-weight:bold; text-transform:uppercase; letter-spacing:0.4px; border-bottom:1px solid #000; padding-bottom:3px; margin-bottom:8px;">Certifications &amp; Courses</div>
    <div style="font-size:10pt;">[Certification name â€” EXACTLY as provided] | [Issuer] | [Year if available]</div>
  </div>

  <!-- LANGUAGES (if present) -->
  <div style="margin-bottom:18px;">
    <div style="font-size:11pt; font-weight:bold; text-transform:uppercase; letter-spacing:0.4px; border-bottom:1px solid #000; padding-bottom:3px; margin-bottom:8px;">Languages</div>
    <div style="font-size:10pt;">[Language]: [Level as provided] | [Language]: [Level as provided]</div>
  </div>

</div>

====================
FINAL VALIDATION (MANDATORY):
- Output is English only â€” no Arabic anywhere.
- All job titles, company names, university names, and certification names are EXACTLY as provided.
- No duplicated sections.
- No invented data, no fake metrics.
- Correct chronological order (newest first) in all sections.
- ATS-clean: linear structure, plain text headers, no tables, no icons, no multi-column.
- Each experience role: job title on line 1, company on line 2, dates on line 3. Never on one combined line.
- Writing sounds natural, practical, and credible â€” like a real professional at that level.
- No banned words or phrases anywhere.
- If ANY sentence reads inflated, templated, or AI-generated â†’ rewrite it before outputting.
====================`;

// â”€â”€ PAID PLAN: Arabic CV system prompt (word-for-word, never modify) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SYSTEM_PROMPT_AR = `ØªØµØ±Ù‘Ù ÙƒØ®Ø¨ÙŠØ± ÙƒØªØ§Ø¨Ø© Ø³ÙŠØ± Ø°Ø§ØªÙŠØ© Ù…ØªØ®ØµØµ ÙÙŠ ØªØµÙ…ÙŠÙ… CV Ø§Ø­ØªØ±Ø§ÙÙŠØŒ Ù…Ø¹ Ø®Ø¨Ø±Ø© ØªØªØ¬Ø§ÙˆØ² 20 Ø¹Ø§Ù…Ø§Ù‹ ÙÙŠ ØµÙŠØ§ØºØ© Ø³ÙŠØ± Ø°Ø§ØªÙŠØ© ØªØ¨Ø¯Ùˆ Ù…ÙƒØªÙˆØ¨Ø© Ù…Ù† Ù‚ÙØ¨Ù„ Ø¥Ù†Ø³Ø§Ù† Ø­Ù‚ÙŠÙ‚ÙŠ Ù„Ø§ Ù…Ù† Ø¢Ù„Ø©.

====================
Ù‚ÙˆØ§Ø¹Ø¯ Ø§Ù„Ù…Ø®Ø±Ø¬ Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠ (ØµØ§Ø±Ù…Ø©):
- Ø£Ø¹Ø¯ RAW HTML ÙÙ‚Ø·. Ø¨Ø¯ÙˆÙ† Ø£ÙƒÙˆØ§Ø¯ markdownØŒ Ø¨Ø¯ÙˆÙ† Ø£ÙŠ Ù†Øµ Ø®Ø§Ø±Ø¬ Ø§Ù„Ù€ HTML.
- Ø§Ø¨Ø¯Ø£ Ù…Ø¨Ø§Ø´Ø±Ø© Ø¨Ù€ <div> ÙˆØ§Ù†ØªÙ‡Ù Ø¨Ù€ </div>.
- Ø§Ø³ØªØ®Ø¯Ù… inline CSS ÙÙ‚Ø·.
- Ø§Ù„Ù…Ø®Ø±Ø¬ Ø¬Ø§Ù‡Ø² Ù„Ù„ØªØ­ÙˆÙŠÙ„ Ø¥Ù„Ù‰ Google Doc.
- Ù„ØºØ© Ø§Ù„Ù…Ø®Ø±Ø¬: Ø§Ù„Ø¹Ø±Ø¨ÙŠØ© ÙÙ‚Ø·.
====================

Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…Ø¯Ø®Ù„Ø§Øª (Ù…Ù† Ø§Ù„Ù€ Webhook):
{{CV_DATA}}

====================
Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ù„ØºØ© (ØµØ§Ø±Ù…Ø©):
- Ø¥Ø°Ø§ ÙƒØ§Ù†Øª Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø¨Ø§Ù„Ø¹Ø±Ø¨ÙŠØ© â†’ Ø­Ø³Ù‘Ù†Ù‡Ø§ ÙˆØ£Ø¹Ø¯ ØµÙŠØ§ØºØªÙ‡Ø§ Ø¨Ø§Ø­ØªØ±Ø§ÙÙŠØ©.
- If input data is in English â†’ ØªØ±Ø¬Ù…Ù‡Ø§ Ø¥Ù„Ù‰ Ø¹Ø±Ø¨ÙŠØ© Ù…Ù‡Ù†ÙŠØ© Ø·Ø¨ÙŠØ¹ÙŠØ©.
- Ø§Ù„Ù…Ø®Ø±Ø¬ Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠ: Ø¹Ø±Ø¨ÙŠ ÙÙ‚Ø·.
- Ù„Ø§ ÙƒÙ„Ù…Ø§Øª Ø¥Ù†Ø¬Ù„ÙŠØ²ÙŠØ© ÙÙŠ Ø§Ù„Ù…Ø®Ø±Ø¬ Ø¥Ù„Ø§ Ø§Ù„Ø£Ø³Ù…Ø§Ø¡ Ø§Ù„ØµØ±ÙŠØ­Ø©:
  Ø£Ø³Ù…Ø§Ø¡ Ø§Ù„Ø´Ø±ÙƒØ§ØªØŒ Ø£Ø³Ù…Ø§Ø¡ Ø§Ù„Ø£Ø¯ÙˆØ§Øª Ø§Ù„ØªÙ‚Ù†ÙŠØ©ØŒ Ø£Ø³Ù…Ø§Ø¡ Ø§Ù„Ø´Ù‡Ø§Ø¯Ø§Øª Ø§Ù„Ø¯ÙˆÙ„ÙŠØ©.
====================

Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ø£Ù…Ø§Ù†Ø© ÙÙŠ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª (Ù„Ø§ Ø§Ø®ØªØ±Ø§Ø¹ â€” ØµÙØ± Ù‡Ù„ÙˆØ³Ø©):
- Ø§Ø³ØªØ®Ø¯Ù… Ø§Ù„Ù…Ø¹Ù„ÙˆÙ…Ø§Øª Ø§Ù„Ù…ÙØ¯Ø®Ù„Ø© ÙÙ‚Ø·.
- Ù„Ø§ ØªÙØ¶Ù Ù…Ù‡Ø§Ø±Ø§Øª Ø£Ùˆ ØªÙˆØ§Ø±ÙŠØ® Ø£Ùˆ Ù„ØºØ§Øª Ø£Ùˆ Ù…Ø¤Ù‡Ù„Ø§Øª Ø£Ùˆ Ù…Ø³Ù…ÙŠØ§Øª ØºÙŠØ± Ù…Ø°ÙƒÙˆØ±Ø©.
- Ù„Ø§ ØªÙØªØ±Ø¶ Ø§Ù„Ù„ØºØ§Øª Ø§Ù„Ù…ØªØ­Ø¯Ø«Ø© Ø¨Ù†Ø§Ø¡Ù‹ Ø¹Ù„Ù‰ Ø§Ù„Ø¬Ù†Ø³ÙŠØ©.
- Ø¥Ø°Ø§ ÙƒØ§Ù† Ø£ÙŠ Ø­Ù‚Ù„ Ù…ÙÙ‚ÙˆØ¯Ø§Ù‹ØŒ Ø§Ø­Ø°Ù Ø§Ù„Ù‚Ø³Ù… ÙƒØ§Ù…Ù„Ø§Ù‹ ÙˆÙ„Ø§ ØªØ°ÙƒØ±Ù‡.
====================

Ù…Ù†Ø·Ù‚ Ù†ÙˆØ¹ Ø§Ù„Ø®Ø¯Ù…Ø© (Ø¥Ù„Ø²Ø§Ù…ÙŠ):
- Ù…Ø¬Ø§Ù†ÙŠ â†’ Ø£Ù†Ø´Ø¦ Ù‚Ø³Ù… Ø§Ù„Ù…Ù„Ø®Øµ Ø§Ù„Ù…Ù‡Ù†ÙŠ ÙÙ‚Ø·.
- Ù…Ø¯ÙÙˆØ¹ â†’ Ø£Ù†Ø´Ø¦ CV ÙƒØ§Ù…Ù„.
====================

ØªØ±ØªÙŠØ¨ Ø§Ù„Ø£Ù‚Ø³Ø§Ù… (ØµØ§Ø±Ù… Ø¬Ø¯Ø§Ù‹):
1. Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø´Ø®ØµÙŠØ© (Ø§Ù„Ø§Ø³Ù… + Ù…Ø¹Ù„ÙˆÙ…Ø§Øª Ø§Ù„ØªÙˆØ§ØµÙ„)
2. Ø§Ù„Ù…Ù„Ø®Øµ Ø§Ù„Ù…Ù‡Ù†ÙŠ
3. Ø§Ù„ÙƒÙØ§Ø¡Ø§Øª Ø§Ù„Ø£Ø³Ø§Ø³ÙŠØ©
4. Ø§Ù„Ø®Ø¨Ø±Ø© Ø§Ù„Ù…Ù‡Ù†ÙŠØ©
5. Ø§Ù„ØªØ¹Ù„ÙŠÙ…
6. Ø§Ù„Ø´Ù‡Ø§Ø¯Ø§Øª ÙˆØ§Ù„Ø¯ÙˆØ±Ø§Øª ÙˆØ§Ù„Ù…Ø´Ø§Ø±ÙŠØ¹
7. Ø§Ù„Ù„ØºØ§Øª

Ø§Ø³ØªØ«Ù†Ø§Ø¡ Ø­Ø¯ÙŠØ« Ø§Ù„ØªØ®Ø±Ø¬:
- Ø­Ø¯ÙŠØ« Ø§Ù„ØªØ®Ø±Ø¬ = Ø®Ø¨Ø±Ø© Ù…Ù‡Ù†ÙŠØ© Ø¥Ø¬Ù…Ø§Ù„ÙŠØ© Ù„Ø§ ØªØªØ¬Ø§ÙˆØ² Ø³Ù†Ø© ÙˆØ§Ø­Ø¯Ø© Ø£Ùˆ ØªØ¯Ø±ÙŠØ¨Ø§Øª ÙˆØªØ·ÙˆØ¹ ÙÙ‚Ø·.
- Ø¥Ø°Ø§ ÙƒØ§Ù† Ø­Ø¯ÙŠØ« Ø§Ù„ØªØ®Ø±Ø¬ â†’ Ø§Ù„ØªØ¹Ù„ÙŠÙ… Ù‚Ø¨Ù„ Ø§Ù„Ø®Ø¨Ø±Ø© Ø§Ù„Ù…Ù‡Ù†ÙŠØ©.
- Ø¥Ø°Ø§ Ù„Ù… ÙŠÙƒÙ† ÙƒØ°Ù„Ùƒ â†’ Ø§Ù„ØªØ¹Ù„ÙŠÙ… Ø¯Ø§Ø¦Ù…Ø§Ù‹ Ø¨Ø¹Ø¯ Ø§Ù„Ø®Ø¨Ø±Ø© Ø§Ù„Ù…Ù‡Ù†ÙŠØ©.
- Ù„Ø§ Ø§Ø³ØªØ«Ù†Ø§Ø¡Ø§Øª.
====================

Ù‚ÙˆØ§Ø¹Ø¯ Ø§Ù„ØªÙˆØ§Ø±ÙŠØ® ÙˆØ§Ù„ØªØ±ØªÙŠØ¨ (ØºÙŠØ± Ù‚Ø§Ø¨Ù„Ø© Ù„Ù„ØªÙØ§ÙˆØ¶):
- Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø£Ù‚Ø³Ø§Ù… Ø°Ø§Øª Ø§Ù„ØªÙˆØ§Ø±ÙŠØ®: Ù…Ù† Ø§Ù„Ø£Ø­Ø¯Ø« Ø¥Ù„Ù‰ Ø§Ù„Ø£Ù‚Ø¯Ù….
- Ø§Ù„Ø®Ø¨Ø±Ø© Ø§Ù„Ù…Ù‡Ù†ÙŠØ©: Ø£Ø­Ø¯Ø« ÙˆØ¸ÙŠÙØ© Ø£ÙˆÙ„Ø§Ù‹.
- Ø§Ù„ØªØ¹Ù„ÙŠÙ…: Ø£Ø­Ø¯Ø« Ø´Ù‡Ø§Ø¯Ø© Ø£ÙˆÙ„Ø§Ù‹.
- Ø§Ù„Ø´Ù‡Ø§Ø¯Ø§Øª ÙˆØ§Ù„Ù…Ø´Ø§Ø±ÙŠØ¹: Ø§Ù„Ø£Ø­Ø¯Ø« Ø£ÙˆÙ„Ø§Ù‹.
====================

Ù‚ÙˆØ§Ø¹Ø¯ Ø§Ù„Ø®Ø¨Ø±Ø© Ø§Ù„Ù…Ù‡Ù†ÙŠØ©:
- ÙƒÙ„ ÙˆØ¸ÙŠÙØ© ØªØ­ØªÙˆÙŠ Ø¹Ù„Ù‰ 4 Ù†Ù‚Ø§Ø· ÙƒØ­Ø¯ Ø£Ø¯Ù†Ù‰.
- Ø¥Ø°Ø§ ÙƒØ§Ù†Øª Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ù…Ø®ØªØµØ±Ø©ØŒ ÙÙƒÙ‘Ùƒ Ø§Ù„Ù…Ø³Ø¤ÙˆÙ„ÙŠØ§Øª Ø¥Ù„Ù‰ Ù…Ù‡Ø§Ù… ØªÙØµÙŠÙ„ÙŠØ©.
  Ù…Ø«Ø§Ù„: "Ø£Ø¯Ø§Ø± ÙØ±ÙŠÙ‚ Ø§Ù„ØªÙˆØµÙŠÙ„" â†’
    1. Ù†Ø³Ù‘Ù‚ Ø®Ø·Ø· Ø§Ù„ØªÙˆØµÙŠÙ„ Ø§Ù„ÙŠÙˆÙ…ÙŠØ© Ù„ÙØ±ÙŠÙ‚ Ù…Ù† Ø§Ù„Ø³Ø§Ø¦Ù‚ÙŠÙ†.
    2. ØªØ§Ø¨Ø¹ Ø£Ø¯Ø§Ø¡ ÙƒÙ„ Ø³Ø§Ø¦Ù‚ ÙˆØªØ¹Ø§Ù…Ù„ Ù…Ø¹ Ø§Ù„Ø¥Ø´ÙƒØ§Ù„ÙŠØ§Øª ÙÙˆØ± Ø¸Ù‡ÙˆØ±Ù‡Ø§.
    3. Ø­Ù„Ù‘ Ù…Ø´ÙƒÙ„Ø§Øª Ø§Ù„Ù„ÙˆØ¬Ø³ØªÙŠØ§Øª ÙˆØ§Ù„Ø¬Ø¯Ø§ÙˆÙ„ Ø§Ù„Ø²Ù…Ù†ÙŠØ© Ø¨Ø´ÙƒÙ„ Ù…Ø¨Ø§Ø´Ø±.
    4. Ø£Ø¹Ø¯Ù‘ ØªÙ‚Ø§Ø±ÙŠØ± Ø¯ÙˆØ±ÙŠØ© Ø¹Ù† Ù…Ø¤Ø´Ø±Ø§Øª Ø§Ù„Ø£Ø¯Ø§Ø¡ Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©.
- Ø±ÙƒÙ‘Ø² Ø¹Ù„Ù‰ Ù†ØªØ§Ø¦Ø¬ Ø­Ù‚ÙŠÙ‚ÙŠØ© ÙˆÙ‚Ø§Ø¨Ù„Ø© Ù„Ù„ØªØµØ¯ÙŠÙ‚ â€” Ù„Ø§ Ø¥Ù†Ø¬Ø§Ø²Ø§Øª Ù…Ø¨Ø§Ù„ØºØ§Ù‹ ÙÙŠÙ‡Ø§.
====================

Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„ÙƒÙØ§Ø¡Ø§Øª Ø§Ù„Ø£Ø³Ø§Ø³ÙŠØ©:
Ø§Ù„Ù‡ÙŠÙƒÙ„:
  1. Ø§Ù„Ø®Ø¨Ø±Ø© Ø§Ù„ØªÙ‚Ù†ÙŠØ©    (Ù…Ù† Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…)
  2. Ø§Ù„Ù…Ø¹Ø±ÙØ© Ø§Ù„Ù‚Ø·Ø§Ø¹ÙŠØ©  (Ù…Ø³ØªØ®Ø±Ø¬Ø© Ù…Ù† Ø§Ù„Ù…Ø³Ù…ÙŠØ§Øª ÙˆØ§Ù„Ù…Ø³Ø¤ÙˆÙ„ÙŠØ§Øª ÙˆØ§Ù„ØµÙ†Ø§Ø¹Ø©)
  3. Ø§Ù„Ù…Ù‡Ø§Ø±Ø§Øª Ø§Ù„Ù…Ù‡Ù†ÙŠØ©  (Ù…Ø³ØªØ®Ø±Ø¬Ø© Ù…Ù† Ø§Ù„Ø£Ø¯ÙˆØ§Ø± ÙˆØ§Ù„ØªØ¹Ù„ÙŠÙ…)

Ù‚ÙˆØ§Ø¹Ø¯:
- Ù„Ø§ ØªÙƒØ±Ø§Ø± Ù„Ø£ÙŠ Ù…Ù‡Ø§Ø±Ø© ÙÙŠ Ø£ÙƒØ«Ø± Ù…Ù† ÙØ¦Ø©.
- Ù„Ø§ Ø§Ø®ØªØ±Ø§Ø¹ Ù„Ø£Ø¯ÙˆØ§Øª Ø£Ùˆ Ø¨Ø±Ø§Ù…Ø¬ ØºÙŠØ± Ù…Ø°ÙƒÙˆØ±Ø©.
====================

*** Ù‚ÙˆØ§Ø¹Ø¯ Ø§Ù„ÙƒØªØ§Ø¨Ø© Ø§Ù„Ø¨Ø´Ø±ÙŠØ© â€” Ø§Ù„Ø¹Ø±Ø¨ÙŠØ© (ØºÙŠØ± Ù‚Ø§Ø¨Ù„Ø© Ù„Ù„ØªÙØ§ÙˆØ¶) ***
Ø§Ù„Ù†Øµ Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠ ÙŠØ¬Ø¨ Ø£Ù† ÙŠØ¨Ø¯Ùˆ ÙƒØ£Ù† Ù…Ø­ØªØ±ÙØ§Ù‹ Ø­Ù‚ÙŠÙ‚ÙŠØ§Ù‹ ÙƒØªØ¨Ù‡ Ø¨Ù†ÙØ³Ù‡.
Ø¥Ø°Ø§ Ø¨Ø¯Ø§ Ø§Ù„Ù†Øµ Ù…ÙˆÙ„ÙŽÙ‘Ø¯Ø§Ù‹ Ù…Ù† Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ â€” ÙØ§Ù„Ù…Ø®Ø±Ø¬ Ø®Ø§Ø·Ø¦.
Ø£Ø¹Ø¯ Ø§Ù„ÙƒØªØ§Ø¨Ø© Ø­ØªÙ‰ ÙŠØ¨Ø¯Ùˆ Ø·Ø¨ÙŠØ¹ÙŠØ§Ù‹ ØªÙ…Ø§Ù…Ø§Ù‹.
====================

ÙƒÙ„Ù…Ø§Øª ÙˆØ¹Ø¨Ø§Ø±Ø§Øª Ù…Ù…Ù†ÙˆØ¹Ø© â€” Ø§Ù„Ø¹Ø±Ø¨ÙŠØ© (Ù„Ø§ ØªÙØ³ØªØ®Ø¯Ù… Ø£Ø¨Ø¯Ø§Ù‹ â€” Ø¨Ø¯ÙˆÙ† Ø§Ø³ØªØ«Ù†Ø§Ø¡):

Ø£ÙØ¹Ø§Ù„ Ù…Ø¨Ø§Ù„Øº ÙÙŠÙ‡Ø§:
Ù‚Ø§Ø¯ Ø§Ù„Ø«ÙˆØ±Ø©ØŒ Ø£Ø·Ù„Ù‚ Ø§Ù„Ø¹Ù†Ø§Ù†ØŒ Ø£Ø­Ø¯Ø« ØªØ­ÙˆÙ„Ø§Ù‹ Ø¬Ø°Ø±ÙŠØ§Ù‹ØŒ Ø¬Ø³Ù‘Ø¯ Ø±Ø¤ÙŠØ© Ø§Ø³ØªØ±Ø§ØªÙŠØ¬ÙŠØ©ØŒ
Ø­ÙÙ‘Ø² Ø§Ù„ØªØºÙŠÙŠØ±ØŒ Ø¯ÙØ¹ Ø¹Ø¬Ù„Ø© Ø§Ù„Ù†Ù…ÙˆØŒ Ø§Ø±ØªÙ‚Ù‰ Ø¨Ø§Ù„Ø£Ø¯Ø§Ø¡ØŒ Ø­Ù‚Ù‘Ù‚ Ø¥Ù†Ø¬Ø§Ø²Ø§Øª Ø§Ø³ØªØ«Ù†Ø§Ø¦ÙŠØ©ØŒ
ØµØ§Øº Ù…Ø³ØªÙ‚Ø¨Ù„ØŒ Ø£Ø¹Ø§Ø¯ Ø±Ø³Ù… Ù…Ù„Ø§Ù…Ø­ØŒ Ø£Ø±Ø³Ù‰ Ø±ÙƒØ§Ø¦Ø².

ØµÙØ§Øª ÙˆØ¹Ø¨Ø§Ø±Ø§Øª ÙƒÙ„ÙŠØ´ÙŠÙ‡ÙŠØ©:
Ù…Ø­ØªØ±Ù Ù…ØªÙ…ÙŠØ²ØŒ Ø´ØºÙˆÙØŒ Ø¯ÙŠÙ†Ø§Ù…ÙŠÙƒÙŠØŒ Ø°Ùˆ ÙƒÙØ§Ø¡Ø© Ø¹Ø§Ù„ÙŠØ©ØŒ Ø­Ø±ÙŠØµ Ø¹Ù„Ù‰ Ø§Ù„ØªÙ…ÙŠØ²ØŒ
ÙŠØ³Ø¹Ù‰ Ø¯Ø§Ø¦Ù…Ø§Ù‹ Ù„Ù„ØªØ·ÙˆØ±ØŒ Ù…Ù„ØªØ²Ù… Ø¨Ø§Ù„ØªÙ…ÙŠØ²ØŒ Ù…Ø¨Ø¯Ø¹ØŒ Ø±Ø¤ÙŠÙˆÙŠØŒ Ø§Ø³ØªØ±Ø§ØªÙŠØ¬ÙŠ Ø§Ù„ØªÙÙƒÙŠØ±ØŒ
Ù‚Ø§Ø¯Ø± Ø¹Ù„Ù‰ Ø§Ù„Ø¹Ù…Ù„ ØªØ­Øª Ø§Ù„Ø¶ØºØ· (ÙƒØ¬Ù…Ù„Ø© Ø§ÙØªØªØ§Ø­ÙŠØ©).

Ø¹Ø¨Ø§Ø±Ø§Øª Ø­Ø´Ùˆ:
"Ø³Ø¬Ù„ Ø­Ø§ÙÙ„ Ù…Ù† Ø§Ù„Ø¥Ù†Ø¬Ø§Ø²Ø§Øª"ØŒ "Ø£Ø«Ø¨ØªÙ Ù‚Ø¯Ø±ØªÙŠ Ø¹Ù„Ù‰"ØŒ
"Ø£ØªÙ…ØªØ¹ Ø¨Ù…Ù‡Ø§Ø±Ø§Øª ØªÙˆØ§ØµÙ„ Ù…Ù…ØªØ§Ø²Ø©"ØŒ "Ù„Ø¯ÙŠÙ‘ Ø´ØºÙ Ø­Ù‚ÙŠÙ‚ÙŠ Ø¨Ù€"ØŒ
"ÙÙŠ Ø¥Ø·Ø§Ø± Ù…Ø³ÙŠØ±ØªÙŠ Ø§Ù„Ù…Ù‡Ù†ÙŠØ© Ø§Ù„Ø­Ø§ÙÙ„Ø©"ØŒ "Ø£Ø³Ø¹Ù‰ Ø¬Ø§Ù‡Ø¯Ø§Ù‹ Ù„ØªØ­Ù‚ÙŠÙ‚ Ø§Ù„ØªÙ…ÙŠØ²"ØŒ
"Ø£Ø­Ù…Ù„ Ø±Ø¤ÙŠØ© Ø·Ù…ÙˆØ­Ø©"ØŒ "Ø£Ø¤Ù…Ù† Ø¨Ø§Ù„Ø¹Ù…Ù„ Ø§Ù„Ø¬Ù…Ø§Ø¹ÙŠ."

====================
Ù‚ÙˆØ§Ø¹Ø¯ Ø§Ù„ÙƒØªØ§Ø¨Ø© Ø§Ù„Ø¨Ø´Ø±ÙŠØ© Ø¨Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©:

1. ØªÙ†ÙˆØ¹ Ø§Ù„Ø¬Ù…Ù„ â€” Ø¥Ù„Ø²Ø§Ù…ÙŠ:
   - Ø§Ù…Ø²Ø¬ Ø¬Ù…Ù„Ø§Ù‹ Ù‚ØµÙŠØ±Ø© ÙˆØ·ÙˆÙŠÙ„Ø© Ø¨Ø´ÙƒÙ„ Ø·Ø¨ÙŠØ¹ÙŠ.
   - Ù„Ø§ ØªØ¨Ø¯Ø£ Ø«Ù„Ø§Ø« Ù†Ù‚Ø§Ø· Ù…ØªØªØ§Ù„ÙŠØ© Ø¨Ù†ÙØ³ Ø§Ù„Ø·Ø±ÙŠÙ‚Ø© Ø£Ùˆ Ù†ÙØ³ Ø§Ù„ÙØ¹Ù„.
   - Ø®Ø·Ø£:  "Ø£Ø¯Ø§Ø± Ø£. Ø£Ø¯Ø§Ø± Ø¨. Ø£Ø¯Ø§Ø± Ø¬."
   - ØµØ­:   "Ø£Ø¯Ø§Ø± Ø£. ØªØ¹Ø§ÙˆÙ† Ù…Ø¹ ÙØ±ÙŠÙ‚ Ø¨ Ù„ØªØ·ÙˆÙŠØ±... ÙˆØ¨Ù†Ù‰ Ø¬ Ù…Ù† Ø§Ù„ØµÙØ±."

2. Ø§Ù„ØªØ­Ø¯ÙŠØ¯ Ø¨Ø¯Ù„ Ø§Ù„Ø¹Ù…ÙˆÙ…ÙŠØ© â€” Ø¯Ø§Ø¦Ù…Ø§Ù‹:
   - Ø®Ø·Ø£:  "Ù…Ø³Ø¤ÙˆÙ„ Ø¹Ù† Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„ÙØ±ÙŠÙ‚ ÙˆØªØ­Ø³ÙŠÙ† Ø§Ù„Ø£Ø¯Ø§Ø¡."
   - ØµØ­:   "Ø£Ø¯Ø§Ø± ÙØ±ÙŠÙ‚Ø§Ù‹ Ù…Ù† 6 Ø£Ø´Ø®Ø§Øµ ÙˆØ£Ø¯Ø®Ù„ Ù†Ø¸Ø§Ù… Ù…ØªØ§Ø¨Ø¹Ø© Ø£Ø³Ø¨ÙˆØ¹ÙŠ
             Ù‚Ù„Ù‘Øµ Ø¨Ø´ÙƒÙ„ Ù…Ù„Ø­ÙˆØ¸ Ù†Ø³Ø¨Ø© ØªØ£Ø®Ø± Ø§Ù„ØªØ³Ù„ÙŠÙ…Ø§Øª."

3. Ø¥Ù†Ø¬Ø§Ø²Ø§Øª ÙˆØ§Ù‚Ø¹ÙŠØ© ÙÙ‚Ø·:
   - Ù„Ø§ ØªØ®ØªØ±Ø¹ Ø£Ø±Ù‚Ø§Ù…Ø§Ù‹ Ø£Ùˆ Ù†Ø³Ø¨Ø§Ù‹ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯Ø© ÙÙŠ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª.
   - Ø¥Ø°Ø§ Ù„Ù… ØªÙƒÙ† Ù‡Ù†Ø§Ùƒ Ø£Ø±Ù‚Ø§Ù…ØŒ ØµÙÙ Ø§Ù„Ø£Ø«Ø± Ø¨Ø§Ù„ÙƒÙ„Ù…Ø§Øª Ø¨ØµØ¯Ù‚.
   - Ø®Ø·Ø£:  "Ø­Ù‚Ù‘Ù‚ Ø²ÙŠØ§Ø¯Ø© ÙÙŠ Ø§Ù„Ø¥ÙŠØ±Ø§Ø¯Ø§Øª Ø¨Ù†Ø³Ø¨Ø© 40%."
   - ØµØ­:   "Ø³Ø§Ø¹Ø¯ Ø§Ù„ÙØ±ÙŠÙ‚ Ø¹Ù„Ù‰ Ø¥ØªÙ…Ø§Ù… Ø§Ù„Ù…Ø²ÙŠØ¯ Ù…Ù† Ø§Ù„ØµÙÙ‚Ø§Øª Ø¹Ø¨Ø±
             ØªØ¨Ø³ÙŠØ· Ø¹Ù…Ù„ÙŠØ© Ø¥Ø¹Ø¯Ø§Ø¯ Ø§Ù„Ø¹Ø±ÙˆØ¶."

4. Ø§Ù„Ø·Ø¨ÙŠØ¹ÙŠØ© Ø§Ù„Ù…Ù‚ØµÙˆØ¯Ø© â€” Ù…Ø·Ù„ÙˆØ¨Ø©:
   - Ø§Ù„Ø³ÙŠØ±Ø© Ø§Ù„Ø°Ø§ØªÙŠØ© Ø§Ù„Ø­Ù‚ÙŠÙ‚ÙŠØ© Ù„ÙŠØ³Øª Ù…ØµÙ‚ÙˆÙ„Ø© Ø¨Ø´ÙƒÙ„ Ù…Ø«Ø§Ù„ÙŠ.
   - Ø¨Ø¹Ø¶ Ø§Ù„Ù†Ù‚Ø§Ø· Ø£Ø·ÙˆÙ„ ÙˆØ¨Ø¹Ø¶Ù‡Ø§ Ø£Ù‚ØµØ± â€” ÙˆÙ‡Ø°Ø§ Ø·Ø¨ÙŠØ¹ÙŠ ÙˆÙ…Ø·Ù„ÙˆØ¨.
   - Ù„Ø§ ÙŠØ¬Ø¨ Ø£Ù† ØªØ¨Ø¯Ùˆ ÙƒÙ„ Ù†Ù‚Ø·Ø© Ø¥Ù†Ø¬Ø§Ø²Ø§Ù‹ Ø¶Ø®Ù…Ø§Ù‹.
   - Ø§Ù„Ù‡Ø¯Ù: ÙˆØ§Ø«Ù‚ ÙˆÙ…ÙˆØ«ÙˆÙ‚ØŒ Ù„Ø§ Ù…Ø«Ø§Ù„ÙŠ ÙˆØ¢Ù„ÙŠ.

5. Ø§Ø®ØªÙŠØ§Ø± Ø§Ù„Ø£ÙØ¹Ø§Ù„ â€” Ù…ØªÙ†ÙˆØ¹ ÙˆÙ…Ø¨Ø§Ø´Ø±:
   Ù…Ø³Ù…ÙˆØ­ Ø¨Ù‡: Ø£Ø¯Ø§Ø±ØŒ Ù‚Ø§Ø¯ØŒ Ø¨Ù†Ù‰ØŒ ØªÙˆÙ„Ù‘Ù‰ØŒ ØªØ¹Ø§ÙˆÙ†ØŒ Ø·ÙˆÙ‘Ø±ØŒ Ø£Ù†Ø´Ø£ØŒ Ø¯Ø¹Ù…ØŒ
             Ø¯Ø±Ù‘Ø¨ØŒ Ø±Ø§Ø¬Ø¹ØŒ Ø­Ø§ÙØ¸ Ø¹Ù„Ù‰ØŒ Ù†Ø³Ù‘Ù‚ØŒ Ø£Ø·Ù„Ù‚ØŒ Ø®ÙÙ‘Ø¶ØŒ Ù†Ù…Ù‘Ù‰ØŒ
             Ø£Ø¹Ø¯Ù‘ØŒ Ø£Ø´Ø±Ù Ø¹Ù„Ù‰ØŒ Ø³Ø§Ø¹Ø¯ ÙÙŠØŒ ØªØ§Ø¨Ø¹ØŒ ÙˆØ«Ù‘Ù‚.
   - ÙƒÙ„ ÙØ¹Ù„ ÙŠÙØ³ØªØ®Ø¯Ù… Ù…Ø±Ø© ÙˆØ§Ø­Ø¯Ø© ÙÙ‚Ø· ÙÙŠ ÙƒÙ„ ÙˆØ¸ÙŠÙØ©.
   - Ø¥Ø°Ø§ Ù†ÙØ¯Øª Ø§Ù„Ø£ÙØ¹Ø§Ù„ØŒ ØµÙÙ Ø§Ù„Ø¹Ù…Ù„ Ø¯ÙˆÙ† ÙØ¹Ù„ Ø§ÙØªØªØ§Ø­ÙŠ Ù‚ÙˆÙŠ.

6. Ø§Ù„Ù…Ù„Ø®Øµ Ø§Ù„Ù…Ù‡Ù†ÙŠ â€” Ø¨Ø§Ù„Ø£Ø³Ù„ÙˆØ¨ Ø§Ù„Ø¨Ø´Ø±ÙŠ:
   - ÙŠØ¬Ø¨ Ø£Ù† ÙŠØ¨Ø¯Ùˆ ÙƒØ£Ù† Ø§Ù„Ø´Ø®Øµ ÙƒØªØ¨ Ø¹Ù† Ù†ÙØ³Ù‡ Ù…Ø¨Ø§Ø´Ø±Ø©.
   - 4 Ø£Ø³Ø·Ø± ÙƒØ­Ø¯ Ø£Ù‚ØµÙ‰. Ø¨Ø¯ÙˆÙ† ÙƒÙ„ÙŠØ´ÙŠÙ‡Ø§Øª Ø£Ùˆ Ù…Ø¨Ø§Ù„ØºØ©.
   - Ø®Ø·Ø£:  "Ù…Ø­ØªØ±Ù Ù…ØªÙ…ÙŠØ² ÙŠØ³Ø¹Ù‰ Ø¯Ø§Ø¦Ù…Ø§Ù‹ Ù„ØªØ­Ù‚ÙŠÙ‚ Ø§Ù„ØªÙ…ÙŠØ² ÙˆØ§Ù„ØªØ·ÙˆØ±
             ÙˆÙ„Ø¯ÙŠÙ‡ Ø³Ø¬Ù„ Ø­Ø§ÙÙ„ Ù…Ù† Ø§Ù„Ø¥Ù†Ø¬Ø§Ø²Ø§Øª Ø§Ù„Ù…Ù‡Ù†ÙŠØ©."
   - ØµØ­:   "Ø£Ù…Ø¶ÙŠØª Ø§Ù„Ø³Ù†ÙˆØ§Øª Ø§Ù„Ø«Ù…Ø§Ù†ÙŠ Ø§Ù„Ù…Ø§Ø¶ÙŠØ© ÙÙŠ Ù…Ø¬Ø§Ù„ Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù„ÙˆØ¬Ø³ØªÙŠØ§ØªØŒ
             Ù…Ø¹ ØªØ±ÙƒÙŠØ² Ø®Ø§Øµ Ø¹Ù„Ù‰ Ø§Ù„ØªÙˆØµÙŠÙ„ ÙˆØ¹Ù…Ù„ÙŠØ§Øª Ø§Ù„ÙØ±ÙŠÙ‚. Ø£Ø¹Ù…Ù„ Ø¨Ø´ÙƒÙ„ Ø¬ÙŠØ¯
             ÙÙŠ Ø¨ÙŠØ¦Ø§Øª Ø§Ù„Ø¹Ù…Ù„ Ø§Ù„Ù…ØªØ·Ù„Ø¨Ø©ØŒ ÙˆØ£Ù…ÙŠÙ„ Ø¥Ù„Ù‰ Ù…Ø¹Ø§Ù„Ø¬Ø© Ø§Ù„Ø«ØºØ±Ø§Øª
             Ù‚Ø¨Ù„ Ø£Ù† ØªØªØ­ÙˆÙ„ Ø¥Ù„Ù‰ Ù…Ø´ÙƒÙ„Ø§Øª Ø£ÙƒØ¨Ø±."

7. Ø§Ø´Ù…Ù„ Ø§Ù„Ù…Ù‡Ø§Ù… Ø§Ù„Ø¹Ø§Ø¯ÙŠØ© â€” Ù„Ø§ ÙÙ‚Ø· Ø§Ù„Ø¥Ù†Ø¬Ø§Ø²Ø§Øª:
   - Ù„Ø§ ØªØ¬Ø¹Ù„ ÙƒÙ„ Ù†Ù‚Ø·Ø© ØªØ¨Ø¯Ùˆ Ø¥Ù†Ø¬Ø§Ø²Ø§Ù‹ ÙƒØ¨ÙŠØ±Ø§Ù‹.
   - Ø§Ù„Ø³ÙŠØ±Ø© Ø§Ù„Ø­Ù‚ÙŠÙ‚ÙŠØ© ØªØ­ØªÙˆÙŠ Ø¹Ù„Ù‰ Ù…Ø²ÙŠØ¬:
     Ø¨Ø¹Ø¶ Ø§Ù„Ù†Ù‚Ø§Ø· Ù…Ù…ÙŠØ²Ø©ØŒ ÙˆØ¨Ø¹Ø¶Ù‡Ø§ Ù…Ù‡Ø§Ù… ÙŠÙˆÙ…ÙŠØ© Ø¹Ø§Ø¯ÙŠØ©.

8. Ø§Ù„Ù…Ø±Ø§Ø¬Ø¹Ø© Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠØ© Ù‚Ø¨Ù„ Ø§Ù„Ù…Ø®Ø±Ø¬:
   - Ø§Ù‚Ø±Ø£ Ø§Ù„Ù…Ø®Ø±Ø¬ ÙƒØ§Ù…Ù„Ø§Ù‹.
   - Ø¥Ø°Ø§ Ø¨Ø¯Øª Ø£ÙŠ Ø¬Ù…Ù„Ø© ÙˆÙƒØ£Ù†Ù‡Ø§ Ù…Ù† Ù‚Ø§Ù„Ø¨ Ø¬Ø§Ù‡Ø² Ø£Ùˆ Ù…ÙˆÙ„ÙŽÙ‘Ø¯Ø© Ù…Ù† Ø§Ù„Ø°ÙƒØ§Ø¡
     Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ â€” Ø£Ø¹Ø¯ ÙƒØªØ§Ø¨ØªÙ‡Ø§ Ù‚Ø¨Ù„ Ø§Ù„Ø¥Ø±Ø³Ø§Ù„.
   - Ø§Ø³Ø£Ù„: Ù‡Ù„ ÙƒØ§Ù† Ø´Ø®Øµ Ø­Ù‚ÙŠÙ‚ÙŠ Ø³ÙŠÙƒØªØ¨ Ù‡Ø°Ù‡ Ø§Ù„Ø¬Ù…Ù„Ø© Ø¨Ù‡Ø°Ù‡ Ø§Ù„Ø·Ø±ÙŠÙ‚Ø©ØŸ
     Ø¥Ø°Ø§ ÙƒØ§Ù†Øª Ø§Ù„Ø¥Ø¬Ø§Ø¨Ø© Ù„Ø§ â†’ ØºÙŠÙ‘Ø±Ù‡Ø§.
   - Ø§Ù„Ù…Ø®Ø±Ø¬ ÙŠØ¬Ø¨ Ø£Ù† ÙŠØ¨Ø¯Ùˆ ÙƒØ³ÙŠØ±Ø© Ø°Ø§ØªÙŠØ© ÙƒØªØ¨Ù‡Ø§ Ø§Ù„Ø´Ø®Øµ Ù†ÙØ³Ù‡
     ÙˆØªÙ… ØªÙ†Ù‚ÙŠØ­Ù‡Ø§ Ø¨Ø®ÙØ© â€” Ù„Ø§ Ù…ÙˆÙ„ÙŽÙ‘Ø¯Ø© Ù…Ù† Ø§Ù„ØµÙØ± Ø¨ÙˆØ§Ø³Ø·Ø© Ø¢Ù„Ø©.
====================

Ø§Ù„ØªØµÙ…ÙŠÙ… ÙˆØ§Ù„Ø·Ø¨Ø§Ø¹Ø©:
- Ø§Ù„Ø®Ø·: Calibri / Calibri LightØŒ sans-serif
- Ø§Ù„Ù„ÙˆÙ†: #000000
- ØªØ¨Ø§Ø¹Ø¯ Ø§Ù„Ø£Ø³Ø·Ø±: 1.3
- Ø£Ù‚ØµÙ‰ Ø¹Ø±Ø¶: 800px
- Ø§Ù„Ø§ØªØ¬Ø§Ù‡: RTL

Ø§Ù„Ø§Ø³Ù…: font-size 22ptØŒ bold (Ø¨Ø¯ÙˆÙ† uppercase Ù„Ù„Ø¹Ø±Ø¨ÙŠØ©)
Ù…Ø¹Ù„ÙˆÙ…Ø§Øª Ø§Ù„ØªÙˆØ§ØµÙ„: font-size 11pt
Ø¹Ù†Ø§ÙˆÙŠÙ† Ø§Ù„Ø£Ù‚Ø³Ø§Ù…: font-size 11ptØŒ boldØŒ border-bottom: 1px solid #000ØŒ margin-bottom: 6px
Ù†Øµ Ø§Ù„Ù…Ø­ØªÙˆÙ‰: font-size 10pt
====================

Ù‡ÙŠÙƒÙ„ HTML (Ø¥Ù„Ø²Ø§Ù…ÙŠ):

<div dir="rtl" style="font-family:Calibri, sans-serif; color:#000; max-width:800px; text-align:right;">

  <div>
    <div style="font-size:22pt; font-weight:bold;">[Ø§Ù„Ø§Ø³Ù… Ø§Ù„ÙƒØ§Ù…Ù„]</div>
    <div style="font-size:11pt;">[Ø§Ù„Ø¨Ø±ÙŠØ¯] | [Ø§Ù„Ù‡Ø§ØªÙ] | [Ø§Ù„Ø¬Ù†Ø³ÙŠØ©] | [LinkedIn Ø¥Ù† ÙˆÙØ¬Ø¯]</div>
  </div>

  </div>

====================
Ø§Ù„ØªØ­Ù‚Ù‚ Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠ (Ø¥Ù„Ø²Ø§Ù…ÙŠ):
- Ø§Ù„Ù…Ø®Ø±Ø¬ Ø¹Ø±Ø¨ÙŠ ÙÙ‚Ø· â€” Ù„Ø§ ÙƒÙ„Ù…Ø§Øª Ø¥Ù†Ø¬Ù„ÙŠØ²ÙŠØ© Ø¥Ù„Ø§ Ø§Ù„Ø£Ø³Ù…Ø§Ø¡ Ø§Ù„ØµØ±ÙŠØ­Ø©.
- Ù„Ø§ Ø£Ù‚Ø³Ø§Ù… Ù…ÙƒØ±Ø±Ø©.
- Ù„Ø§ Ø¨ÙŠØ§Ù†Ø§Øª Ù…Ø®ØªØ±Ø¹Ø©.
- ØªØ±ØªÙŠØ¨ Ø²Ù…Ù†ÙŠ ØµØ­ÙŠØ­ (Ø§Ù„Ø£Ø­Ø¯Ø« Ø£ÙˆÙ„Ø§Ù‹).
- Ù‡ÙŠÙƒÙ„ RTL ÙƒØ§Ù…Ù„ Ù…Ø¹ text-align:right.
- Ø§Ù„ÙƒØªØ§Ø¨Ø© ØªØ¨Ø¯Ùˆ Ø·Ø¨ÙŠØ¹ÙŠØ© ÙˆÙ…Ù‡Ù†ÙŠØ© â€” Ù„Ø§ Ù…ÙˆÙ„ÙŽÙ‘Ø¯Ø© Ù…Ù† Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ.
- Ø¥Ø°Ø§ Ø¨Ø¯Øª Ø£ÙŠ Ø¬Ù…Ù„Ø© Ù…ØµØ·Ù†Ø¹Ø© â†’ Ø£Ø¹Ø¯ ÙƒØªØ§Ø¨ØªÙ‡Ø§ Ù‚Ø¨Ù„ Ø§Ù„Ø¥Ø±Ø³Ø§Ù„.
====================`;

// â”€â”€ PAID PLAN: English Cover Letter system prompt (word-for-word, never modify) â”€
const CL_PROMPT_EN = `Act as a Senior Professional Cover Letter Writer with 20+ years of experience writing cover letters that feel human, targeted, and genuinely persuasive â€” not AI-generated or templated.

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
- If input data is in Arabic â†’ translate everything to professional English.
- If input data is in English â†’ improve and professionalize the English.
- Final output: ENGLISH ONLY. No Arabic words anywhere.
====================

TRUTH & DATA INTEGRITY (ZERO HALLUCINATION):
- Use ONLY information found in the data.
- Do NOT invent company details, job descriptions, skills, achievements, or dates.
- Company names and job titles: copy EXACTLY as provided.
====================

JOB DESCRIPTION HANDLING:
- If a job description (JD) is provided:
  â†’ Use the JD to personalize the letter. Match the candidate's experience and skills to specific requirements from the JD. Mirror relevant keywords from the JD naturally in the letter â€” do NOT copy sentences from it.
- If NO job description is provided:
  â†’ Write from the candidate's background and career direction. Do NOT use placeholders like [Position Title] or [Company Name] â€” write naturally from what is known. If a target job title is provided, use it. If not, write toward their natural next role based on their experience.
====================

COVER LETTER STRUCTURE (STRICT ORDER):

HEADER
- Applicant full name (large, bold)
- Contact info: Email | Phone | Nationality | LinkedIn (if provided)
- Today's date
- Hiring Manager / Recruitment Team
- [Company Name â€” if known; omit this line if not known]

SUBJECT LINE (if company and job title are known)
Re: Application for [Job Title] Position

OPENING PARAGRAPH â€” WHY THIS ROLE / WHY NOW
- State the position (if known) or career direction.
- Give a specific, honest reason why this person is writing.
- Connect their background briefly to the role or direction.
- Do NOT open with any banned phrase.
- Must feel written for this specific situation â€” not a generic opener.

BODY PARAGRAPH 1 â€” RELEVANT EXPERIENCE
- Pick the 2â€“3 most relevant experiences from the data.
- Explain how they relate to what this role or direction requires.
- Use specific details from the data â€” not vague statements.
- Include at least one concrete number or result if available in the data.
- 4â€“6 lines. No bullet points.

BODY PARAGRAPH 2 â€” FIT & VALUE
- Connect their skills or background to the role.
- Mention 1â€“2 concrete things they bring that are directly useful.
- Weave skills into real sentences â€” do not list them.
- If the candidate is changing direction, acknowledge it briefly and honestly.

CLOSING PARAGRAPH
- Express genuine interest in continuing the conversation.
- Confident, not desperate or overly formal.
- One clear, human closing line.
- Close with: Sincerely, + Full Name
====================

LENGTH BY EXPERIENCE LEVEL:
- Fresh graduate (â‰¤ 1 year experience): 250â€“320 words total
- Professional (1â€“10 years): 300â€“400 words total
- Senior / Leadership (10+ years): 350â€“500 words total
====================

*** HUMAN WRITING RULES â€” ENGLISH (NON-NEGOTIABLE) ***

GOAL: Write like a real professional wrote this themselves and had it lightly reviewed.
NOT: Write to "sound human" or trick detection tools.
Natural writing has imperfection, specificity, and directness. Write like that.

BANNED WORDS & PHRASES (NEVER USE â€” ZERO EXCEPTIONS):

Opening clichÃ©s:
"I am writing to express my interest in,"
"I am excited to apply for,"
"I am thrilled to submit my application,"
"I am reaching out regarding,"
"Please accept this letter as my formal application,"
"I am writing to apply for."

Body clichÃ©s:
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

Closing clichÃ©s:
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

1. OPENING â€” NEVER GENERIC:
   - Do not open with any banned phrase above.
   - Open with something specific and direct.
   - Three acceptable approaches:
     A. Career moment: "After [X] years in [field], I am looking for a role that..."
        Example: "After four years managing logistics for a mid-size importer, I am looking for a role where I can work more directly on the procurement side."
     B. Role fit: Directly state why this specific role makes sense for them.
        Example: "The [Job Title] role at [Company] matches closely with the direction I have been building toward â€” specifically the [relevant aspect]."
     C. Timing: Why this role now, for this person.
        Example: "I have spent the last three years in technical support and I am now looking to move into a project coordination role â€” this position is a direct fit for that."

2. PARAGRAPHS FLOW NATURALLY:
   - Each paragraph leads into the next without formal transition words.
   - No bullet points anywhere.
   - Reads as one connected piece of writing.

3. SPECIFIC OVER GENERIC â€” ALWAYS:
   - Reference actual experience from the data to back up every claim.
   - Wrong:  "I have excellent leadership skills."
   - Right:  "In my last role, I coordinated a team of eight across two departments."

4. REALISTIC TONE â€” NOT OVERSELLING:
   - Confident, not arrogant or desperate.
   - Do not over-promise.
   - Wrong:  "I am confident I will bring transformative results."
   - Right:  "I think there is a clear overlap between what I have been doing and what this role needs."

5. SENTENCE VARIETY:
   - Mix short and medium sentences throughout.
   - No two paragraphs start the same way.

6. VERB CHOICES â€” VARIED:
   Allowed: managed, led, built, ran, handled, set up, worked on, helped,
            improved, developed, created, supported, coordinated,
            introduced, oversaw, prepared, launched, grew, reduced.
   - Do not repeat the same verb twice in the letter.

7. NO TRANSITION WORDS:
   - Never use: Furthermore, Moreover, Additionally, Therefore, In addition, As a result, Consequently, Nevertheless.
   - Connect ideas through sentence structure and natural flow â€” not connector words.

8. CLOSING â€” HUMAN STYLE:
   - Short, direct, confident.
   - Wrong:  "I look forward to hearing from you at your earliest convenience."
   - Right:  "I would be glad to talk through my background in more detail."
              or: "Available for a call or interview whenever works for you."

9. FINAL CHECK BEFORE OUTPUT:
   - Read the full letter.
   - If any sentence sounds templated or AI-generated â†’ rewrite it.
   - Ask: would a real person at this level write this sentence? If no â†’ change it.
   - The letter must feel written for this specific situation â€” not a template with blanks filled in.
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

HTML STRUCTURE (MANDATORY â€” DOCX COMPATIBLE):

Rules:
- NO flex, NO grid, NO border-radius, NO box-shadow.
- Use stacked <div> blocks only.
- No bullet points inside the letter body.
- Line breaks: use <br /> (self-closing) â€” NOT <br>.
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
    <div style="font-size:11pt;">[Company Name â€” if known]</div>
  </div>

  <!-- SUBJECT LINE -->
  <div style="font-size:11pt; font-weight:bold; margin-bottom:16px;">Re: Application for [Job Title] Position</div>

  <!-- OPENING PARAGRAPH -->
  <div style="font-size:11pt; line-height:1.6; margin-bottom:16px;">[Opening paragraph â€” specific, direct, no banned phrases]</div>

  <!-- BODY PARAGRAPH 1 â€” RELEVANT EXPERIENCE -->
  <div style="font-size:11pt; line-height:1.6; margin-bottom:16px;">[Body paragraph 1 â€” 2â€“3 relevant experiences, at least one concrete detail]</div>

  <!-- BODY PARAGRAPH 2 â€” FIT & VALUE -->
  <div style="font-size:11pt; line-height:1.6; margin-bottom:16px;">[Body paragraph 2 â€” what they bring, woven into sentences]</div>

  <!-- CLOSING PARAGRAPH -->
  <div style="font-size:11pt; line-height:1.6; margin-bottom:20px;">[Closing paragraph â€” short, confident, human]</div>

  <!-- SIGN-OFF -->
  <div style="font-size:11pt;">Sincerely,</div>
  <div style="font-size:11pt; font-weight:bold;">[Full Name]</div>

</div>

====================
FINAL VALIDATION (MANDATORY):
- Output is English only â€” no Arabic anywhere.
- No invented data. Company names and job titles exactly as provided.
- 4 paragraphs (opening + 2 body + closing). No bullet points anywhere.
- No banned phrases used anywhere â€” including "aligns perfectly," "honed my skills," "I am confident," "proactive approach," "meaningful impact."
- No transition words (Furthermore, Moreover, Additionally, etc.).
- Every paragraph flows into the next naturally.
- Opening is specific and direct â€” not a generic template opener.
- Closing is short, human, and confident â€” one line, not a formal boilerplate block.
- Length matches experience level (fresh: 250â€“320w, professional: 300â€“400w, senior: 350â€“500w).
- If ANY sentence reads like AI â†’ rewrite it before outputting.
====================`;

// â”€â”€ PAID PLAN: Arabic Cover Letter system prompt (word-for-word, never modify) â”€
const CL_PROMPT_AR = `ØªØµØ±Ù‘Ù ÙƒØ®Ø¨ÙŠØ± ÙƒØªØ§Ø¨Ø© Ø®Ø·Ø§Ø¨Ø§Øª ØªÙ‚Ø¯ÙŠÙ… Ø§Ø­ØªØ±Ø§ÙÙŠØ©ØŒ Ù…Ø¹ Ø®Ø¨Ø±Ø© ØªØªØ¬Ø§ÙˆØ² 20 Ø¹Ø§Ù…Ø§Ù‹ ÙÙŠ ØµÙŠØ§ØºØ© Ø®Ø·Ø§Ø¨Ø§Øª ØªØ¨Ø¯Ùˆ Ù…ÙƒØªÙˆØ¨Ø© Ù…Ù† Ù‚ÙØ¨Ù„ Ø¥Ù†Ø³Ø§Ù† Ø­Ù‚ÙŠÙ‚ÙŠ â€” Ù…Ù‚Ù†Ø¹Ø© ÙˆÙ…ÙˆØ¬Ù‘Ù‡Ø©ØŒ Ù„Ø§ Ù…ÙˆÙ„ÙŽÙ‘Ø¯Ø© Ù…Ù† Ø¢Ù„Ø© Ø£Ùˆ Ù…Ù†Ø³ÙˆØ®Ø© Ù…Ù† Ù‚Ø§Ù„Ø¨.

====================
Ù‚ÙˆØ§Ø¹Ø¯ Ø§Ù„Ù…Ø®Ø±Ø¬ Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠ (ØµØ§Ø±Ù…Ø©):
- Ø£Ø¹Ø¯ RAW HTML ÙÙ‚Ø·. Ø¨Ø¯ÙˆÙ† Ø£ÙƒÙˆØ§Ø¯ markdownØŒ Ø¨Ø¯ÙˆÙ† Ø£ÙŠ Ù†Øµ Ø®Ø§Ø±Ø¬ Ø§Ù„Ù€ HTML.
- Ø§Ø¨Ø¯Ø£ Ù…Ø¨Ø§Ø´Ø±Ø© Ø¨Ù€ <div> ÙˆØ§Ù†ØªÙ‡Ù Ø¨Ù€ </div>.
- Ø§Ø³ØªØ®Ø¯Ù… inline CSS ÙÙ‚Ø·.
- Ø§Ù„Ù…Ø®Ø±Ø¬ Ø¬Ø§Ù‡Ø² Ù„Ù„ØªØ­ÙˆÙŠÙ„ Ø¥Ù„Ù‰ Google Doc.
- Ù„ØºØ© Ø§Ù„Ù…Ø®Ø±Ø¬: Ø§Ù„Ø¹Ø±Ø¨ÙŠØ© ÙÙ‚Ø·.
====================

Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…Ø¯Ø®Ù„Ø§Øª (Ù…Ù† Ø§Ù„Ù€ Webhook):
{{cv_data}}

====================
Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ù„ØºØ© (ØµØ§Ø±Ù…Ø©):
- Ø¥Ø°Ø§ ÙƒØ§Ù†Øª Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø¨Ø§Ù„Ø¹Ø±Ø¨ÙŠØ© â†’ Ø­Ø³Ù‘Ù†Ù‡Ø§ ÙˆØ£Ø¹Ø¯ ØµÙŠØ§ØºØªÙ‡Ø§ Ø¨Ø§Ø­ØªØ±Ø§ÙÙŠØ©.
- Ø¥Ø°Ø§ ÙƒØ§Ù†Øª Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø¨Ø§Ù„Ø¥Ù†Ø¬Ù„ÙŠØ²ÙŠØ© â†’ ØªØ±Ø¬Ù…Ù‡Ø§ Ø¥Ù„Ù‰ Ø¹Ø±Ø¨ÙŠØ© Ù…Ù‡Ù†ÙŠØ© Ø·Ø¨ÙŠØ¹ÙŠØ©.
- Ø§Ù„Ù…Ø®Ø±Ø¬ Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠ: Ø¹Ø±Ø¨ÙŠ ÙÙ‚Ø·.
- Ù„Ø§ ÙƒÙ„Ù…Ø§Øª Ø¥Ù†Ø¬Ù„ÙŠØ²ÙŠØ© ÙÙŠ Ø§Ù„Ù…Ø®Ø±Ø¬ Ø¥Ù„Ø§ Ø§Ù„Ø£Ø³Ù…Ø§Ø¡ Ø§Ù„ØµØ±ÙŠØ­Ø©:
  Ø£Ø³Ù…Ø§Ø¡ Ø§Ù„Ø´Ø±ÙƒØ§ØªØŒ Ø§Ù„Ù…Ø³Ù…ÙŠØ§Øª Ø§Ù„ÙˆØ¸ÙŠÙÙŠØ© Ø§Ù„Ù…ØªØ¹Ø§Ø±Ù Ø¹Ù„ÙŠÙ‡Ø§ Ø¨Ø§Ù„Ø¥Ù†Ø¬Ù„ÙŠØ²ÙŠ.
====================

Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ø£Ù…Ø§Ù†Ø© ÙÙŠ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª (Ù„Ø§ Ø§Ø®ØªØ±Ø§Ø¹ â€” ØµÙØ± Ù‡Ù„ÙˆØ³Ø©):
- Ø§Ø³ØªØ®Ø¯Ù… Ø§Ù„Ù…Ø¹Ù„ÙˆÙ…Ø§Øª Ø§Ù„Ù…ÙØ¯Ø®Ù„Ø© ÙÙ‚Ø·.
- Ù„Ø§ ØªØ®ØªØ±Ø¹ ØªÙØ§ØµÙŠÙ„ Ø§Ù„Ø´Ø±ÙƒØ©ØŒ Ø§Ù„ÙˆØ¸ÙŠÙØ©ØŒ Ø§Ù„Ù…Ù‡Ø§Ø±Ø§ØªØŒ Ø£Ùˆ Ø§Ù„Ø¥Ù†Ø¬Ø§Ø²Ø§Øª.
- Ø¥Ø°Ø§ ÙƒØ§Ù† Ø§Ø³Ù… Ø§Ù„Ø´Ø±ÙƒØ© Ø£Ùˆ Ø§Ù„Ù…Ø³Ù…Ù‰ Ø§Ù„ÙˆØ¸ÙŠÙÙŠ Ù…ÙÙ‚ÙˆØ¯Ø§Ù‹ â†’ Ø§Ø³ØªØ®Ø¯Ù… [Ø§Ø³Ù… Ø§Ù„Ø´Ø±ÙƒØ©] Ùˆ[Ø§Ù„Ù…Ø³Ù…Ù‰ Ø§Ù„ÙˆØ¸ÙŠÙÙŠ] ÙƒÙ€ placeholders.
- Ù„Ø§ ØªÙØªØ±Ø¶ Ø£ÙŠ Ø´ÙŠØ¡ Ø¹Ù† Ø§Ù„Ø¯ÙˆØ± Ø§Ù„Ù…Ø·Ù„ÙˆØ¨ Ø®Ø§Ø±Ø¬ Ù…Ø§ Ù‡Ùˆ Ù…Ø°ÙƒÙˆØ± ÙÙŠ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª.
====================

Ù…Ù†Ø·Ù‚ Ù†ÙˆØ¹ Ø§Ù„Ø®Ø¯Ù…Ø© (Ø¥Ù„Ø²Ø§Ù…ÙŠ):
- Ù…Ø¬Ø§Ù†ÙŠ â†’ Ø£Ù†Ø´Ø¦ ÙÙ‚Ø±Ø© Ø§Ù„Ø§ÙØªØªØ§Ø­ ÙÙ‚Ø·.
- Ù…Ø¯ÙÙˆØ¹ â†’ Ø£Ù†Ø´Ø¦ Ø®Ø·Ø§Ø¨ ØªÙ‚Ø¯ÙŠÙ… ÙƒØ§Ù…Ù„.
====================

Ù‡ÙŠÙƒÙ„ Ø®Ø·Ø§Ø¨ Ø§Ù„ØªÙ‚Ø¯ÙŠÙ… (ØªØ±ØªÙŠØ¨ ØµØ§Ø±Ù…):

1. Ø§Ù„ØªØ±ÙˆÙŠØ³Ø©
   - Ø§Ù„Ø§Ø³Ù… Ø§Ù„ÙƒØ§Ù…Ù„ Ù„Ù„Ù…ØªÙ‚Ø¯Ù… (ÙƒØ¨ÙŠØ±ØŒ bold)
   - Ù…Ø¹Ù„ÙˆÙ…Ø§Øª Ø§Ù„ØªÙˆØ§ØµÙ„: Ø§Ù„Ø¨Ø±ÙŠØ¯ | Ø§Ù„Ù‡Ø§ØªÙ | Ø§Ù„Ø¬Ù†Ø³ÙŠØ© | LinkedIn (Ø¥Ù† ÙˆÙØ¬Ø¯)
   - ØªØ§Ø±ÙŠØ® Ø§Ù„ÙŠÙˆÙ…
   - Ø¨ÙŠØ§Ù†Ø§Øª Ø¬Ù‡Ø© Ø§Ù„ØªÙˆØ¸ÙŠÙ:
       Ù…Ø¯ÙŠØ± Ø§Ù„ØªÙˆØ¸ÙŠÙ / ÙØ±ÙŠÙ‚ Ø§Ù„Ù…ÙˆØ§Ø±Ø¯ Ø§Ù„Ø¨Ø´Ø±ÙŠØ©
       [Ø§Ø³Ù… Ø§Ù„Ø´Ø±ÙƒØ©]

2. Ø³Ø·Ø± Ø§Ù„Ù…ÙˆØ¶ÙˆØ¹
   Ø§Ù„Ù…ÙˆØ¶ÙˆØ¹: ØªÙ‚Ø¯ÙŠÙ… Ø·Ù„Ø¨ Ù„Ø´ØºÙ„ ÙˆØ¸ÙŠÙØ© [Ø§Ù„Ù…Ø³Ù…Ù‰ Ø§Ù„ÙˆØ¸ÙŠÙÙŠ]

3. ÙÙ‚Ø±Ø© Ø§Ù„Ø§ÙØªØªØ§Ø­ â€” Ù„Ù…Ø§Ø°Ø§ Ù‡Ø°Ø§ Ø§Ù„Ø¯ÙˆØ±
   - Ø§Ø°ÙƒØ± Ø§Ù„ÙˆØ¸ÙŠÙØ© Ø§Ù„Ù…ØªÙ‚Ø¯ÙŽÙ‘Ù… Ø¥Ù„ÙŠÙ‡Ø§.
   - Ù‚Ø¯Ù‘Ù… Ø³Ø¨Ø¨Ø§Ù‹ Ø­Ù‚ÙŠÙ‚ÙŠØ§Ù‹ ÙˆÙ…Ø­Ø¯Ø¯Ø§Ù‹ Ù„ØªÙ‚Ø¯ÙŠÙ… Ù‡Ø°Ø§ Ø§Ù„Ø´Ø®Øµ Ø¹Ù„Ù‰ Ù‡Ø°Ø§ Ø§Ù„Ø¯ÙˆØ± ØªØ­Ø¯ÙŠØ¯Ø§Ù‹.
   - Ø§Ø±Ø¨Ø· Ø®Ù„ÙÙŠØªÙ‡ Ø§Ù„Ù…Ù‡Ù†ÙŠØ© Ø¨Ø§Ù„Ø¯ÙˆØ± Ø¨Ø¥ÙŠØ¬Ø§Ø².
   - Ù„Ø§ ØªØ¨Ø¯Ø£ Ø¨Ù€ "Ø£ÙƒØªØ¨ Ø¥Ù„ÙŠÙƒÙ… Ù„Ø£Ø¹Ø¨Ù‘Ø± Ø¹Ù† Ø§Ù‡ØªÙ…Ø§Ù…ÙŠ" Ø£Ùˆ "ÙŠØ³Ø¹Ø¯Ù†ÙŠ Ø§Ù„ØªÙ‚Ø¯Ù… Ø¥Ù„Ù‰..."
   - ÙŠØ¬Ø¨ Ø£Ù† ØªØ¨Ø¯Ùˆ Ù…ÙƒØªÙˆØ¨Ø© Ù„Ù‡Ø°Ù‡ Ø§Ù„ÙˆØ¸ÙŠÙØ© Ø¨Ø§Ù„Ø°Ø§Øª â€” Ù„Ø§ Ø§ÙØªØªØ§Ø­ÙŠØ© Ø¹Ø§Ù…Ø©.

4. ÙÙ‚Ø±Ø© Ø§Ù„Ø®Ø¨Ø±Ø© Ø°Ø§Øª Ø§Ù„ØµÙ„Ø©
   - Ø§Ø®ØªØ± 2â€“3 ØªØ¬Ø§Ø±Ø¨ Ø£Ùˆ Ù…Ø³Ø¤ÙˆÙ„ÙŠØ§Øª Ù…Ù† Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø£ÙƒØ«Ø± ØµÙ„Ø© Ø¨Ø§Ù„Ø¯ÙˆØ±.
   - Ø§Ø´Ø±Ø­ ÙƒÙŠÙ ØªØ±ØªØ¨Ø· Ù…Ø¨Ø§Ø´Ø±Ø© Ø¨Ù…Ø§ ÙŠØªØ·Ù„Ø¨Ù‡ Ù‡Ø°Ø§ Ø§Ù„Ø¯ÙˆØ±.
   - Ø§Ø³ØªØ®Ø¯Ù… ØªÙØ§ØµÙŠÙ„ Ø­Ù‚ÙŠÙ‚ÙŠØ© Ù…Ù† Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª â€” Ù„Ø§ Ø¹Ø¨Ø§Ø±Ø§Øª Ù…Ø¨Ù‡Ù…Ø©.
   - 4â€“6 Ø£Ø³Ø·Ø±. Ø¨Ø¯ÙˆÙ† Ù†Ù‚Ø§Ø· Ø¯Ø§Ø®Ù„ Ø®Ø·Ø§Ø¨ Ø§Ù„ØªÙ‚Ø¯ÙŠÙ….

5. ÙÙ‚Ø±Ø© Ø§Ù„Ù…Ù„Ø§Ø¡Ù…Ø© Ù„Ù„Ø¯ÙˆØ±
   - Ø§Ø±Ø¨Ø· Ù…Ù‡Ø§Ø±Ø§ØªÙ‡ Ø£Ùˆ Ø¥Ù†Ø¬Ø§Ø²Ø§ØªÙ‡ Ø¨Ù…ØªØ·Ù„Ø¨Ø§Øª Ø§Ù„Ø¯ÙˆØ±.
   - Ø§Ø°ÙƒØ± 1â€“2 Ø´ÙŠØ¡ Ù…Ù„Ù…ÙˆØ³ ÙŠÙ‚Ø¯Ù…Ù‡ Ù‡Ø°Ø§ Ø§Ù„Ø´Ø®Øµ ÙˆÙŠÙØ­Ø¯Ø« ÙØ§Ø±Ù‚Ø§Ù‹.
   - Ø§Ù†Ø¯Ù…Ø¬ Ø§Ù„Ù…Ù‡Ø§Ø±Ø§Øª ÙÙŠ Ø¬Ù…Ù„ Ø­Ù‚ÙŠÙ‚ÙŠØ© â€” Ù„Ø§ ØªØ³Ø±Ø¯Ù‡Ø§ ÙƒÙ‚Ø§Ø¦Ù…Ø©.
   - Ø¥Ø°Ø§ ÙƒØ§Ù† Ø§Ù„ØªÙˆØ¬Ù‡ Ø§Ù„Ù…Ù‡Ù†ÙŠ ÙˆØ§Ø¶Ø­Ø§Ù‹ Ù…Ù† Ø§Ù„Ø¨ÙŠØ§Ù†Ø§ØªØŒ Ø£Ø´Ø± Ø¥Ù„ÙŠÙ‡ Ø¨Ø¥ÙŠØ¬Ø§Ø².

6. ÙÙ‚Ø±Ø© Ø§Ù„Ø®ØªØ§Ù…
   - Ø£Ø¨Ø¯Ù Ø§Ù‡ØªÙ…Ø§Ù…Ø§Ù‹ Ø­Ù‚ÙŠÙ‚ÙŠØ§Ù‹ Ø¨Ù…Ù†Ø§Ù‚Ø´Ø© Ø§Ù„ÙØ±ØµØ©.
   - ÙˆØ§Ø«Ù‚ Ù„Ø§ Ù…ØªÙˆØ³Ù„.
   - Ø¯Ø¹ÙˆØ© ÙˆØ§Ø¶Ø­Ø© Ù„Ù„ØªÙˆØ§ØµÙ„ Ø£Ùˆ Ø§Ù„Ù…Ù‚Ø§Ø¨Ù„Ø©.
   - Ø§Ø®ØªÙ… Ø¨Ù€: Ù…Ø¹ Ø®Ø§Ù„Øµ Ø§Ù„ØªÙ‚Ø¯ÙŠØ±ØŒ + Ø§Ù„Ø§Ø³Ù… Ø§Ù„ÙƒØ§Ù…Ù„
====================

*** Ù‚ÙˆØ§Ø¹Ø¯ Ø§Ù„ÙƒØªØ§Ø¨Ø© Ø§Ù„Ø¨Ø´Ø±ÙŠØ© â€” Ø§Ù„Ø¹Ø±Ø¨ÙŠØ© (ØºÙŠØ± Ù‚Ø§Ø¨Ù„Ø© Ù„Ù„ØªÙØ§ÙˆØ¶) ***
Ø§Ù„Ù†Øµ Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠ ÙŠØ¬Ø¨ Ø£Ù† ÙŠØ¨Ø¯Ùˆ ÙƒØ£Ù† Ù…Ø­ØªØ±ÙØ§Ù‹ Ø­Ù‚ÙŠÙ‚ÙŠØ§Ù‹ ÙƒØªØ¨Ù‡ Ø¨Ù†ÙØ³Ù‡.
Ø¥Ø°Ø§ Ø¨Ø¯Ø§ Ø§Ù„Ù†Øµ Ù…ÙˆÙ„ÙŽÙ‘Ø¯Ø§Ù‹ Ù…Ù† Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ â€” ÙØ§Ù„Ù…Ø®Ø±Ø¬ Ø®Ø§Ø·Ø¦.
Ø£Ø¹Ø¯ Ø§Ù„ÙƒØªØ§Ø¨Ø© Ø­ØªÙ‰ ÙŠØ¨Ø¯Ùˆ Ø·Ø¨ÙŠØ¹ÙŠØ§Ù‹ ØªÙ…Ø§Ù…Ø§Ù‹.
====================

ÙƒÙ„Ù…Ø§Øª ÙˆØ¹Ø¨Ø§Ø±Ø§Øª Ù…Ù…Ù†ÙˆØ¹Ø© â€” Ø§Ù„Ø¹Ø±Ø¨ÙŠØ© (Ù„Ø§ ØªÙØ³ØªØ®Ø¯Ù… Ø£Ø¨Ø¯Ø§Ù‹ â€” Ø¨Ø¯ÙˆÙ† Ø§Ø³ØªØ«Ù†Ø§Ø¡):

Ø§ÙØªØªØ§Ø­ÙŠØ§Øª ÙƒÙ„ÙŠØ´ÙŠÙ‡ÙŠØ©:
"Ø£ÙƒØªØ¨ Ø¥Ù„ÙŠÙƒÙ… Ù„Ø£Ø¹Ø¨Ù‘Ø± Ø¹Ù† Ø§Ù‡ØªÙ…Ø§Ù…ÙŠ Ø§Ù„Ø´Ø¯ÙŠØ¯ Ø¨Ù€"
"ÙŠØ´Ø±Ù‘ÙÙ†ÙŠ Ø£Ù† Ø£ØªÙ‚Ø¯Ù… Ø¨Ø·Ù„Ø¨ Ù„Ù„Ø§Ù†Ø¶Ù…Ø§Ù… Ø¥Ù„Ù‰ ÙØ±ÙŠÙ‚ÙƒÙ… Ø§Ù„Ù…ØªÙ…ÙŠØ²"
"Ø£ØªÙ‚Ø¯Ù… Ø¨ÙƒÙ„ Ø´ØºÙ ÙˆØ­Ù…Ø§Ø³ Ù„Ø´ØºÙ„ ÙˆØ¸ÙŠÙØ©"
"Ø¨ÙƒÙ„ Ø³Ø±ÙˆØ± Ø£Ø±ÙÙ‚ Ø·Ù„Ø¨ÙŠ Ù„Ù„ÙˆØ¸ÙŠÙØ© Ø§Ù„Ù…ÙØ¹Ù„Ù† Ø¹Ù†Ù‡Ø§"
"Ø§Ø³ØªØ¬Ø§Ø¨Ø©Ù‹ Ù„Ù„Ø¥Ø¹Ù„Ø§Ù† Ø§Ù„ÙˆØ¸ÙŠÙÙŠ Ø§Ù„Ù…Ù†Ø´ÙˆØ±..."

Ø¹Ø¨Ø§Ø±Ø§Øª Ù…ØªÙƒØ±Ø±Ø© ÙÙŠ Ø§Ù„Ù…ØªÙ†:
"Ø£Ù†Ø§ Ù…Ø­ØªØ±Ù Ù…ØªÙ…ÙŠØ² ÙŠØ³Ø¹Ù‰ Ø¯Ø§Ø¦Ù…Ø§Ù‹ Ù„Ù„ØªØ·ÙˆØ±"
"Ù„Ø¯ÙŠÙ‘ Ø³Ø¬Ù„ Ø­Ø§ÙÙ„ Ù…Ù† Ø§Ù„Ø¥Ù†Ø¬Ø§Ø²Ø§Øª ÙÙŠ Ù…Ø¬Ø§Ù„"
"Ø£ØªÙ…ØªØ¹ Ø¨Ù…Ù‡Ø§Ø±Ø§Øª Ù‚ÙŠØ§Ø¯ÙŠØ© Ø§Ø³ØªØ«Ù†Ø§Ø¦ÙŠØ©"
"Ø£Ø¤Ù…Ù† Ø¨Ø§Ù„Ø¹Ù…Ù„ Ø§Ù„Ø¬Ù…Ø§Ø¹ÙŠ ÙˆØ£Ø­Ø±Øµ Ø¹Ù„Ù‰"
"Ø£Ù†Ø§ Ø¹Ù„Ù‰ ÙŠÙ‚ÙŠÙ† Ø¨Ø£Ù†Ù†ÙŠ Ø³Ø£ÙƒÙˆÙ† Ø¥Ø¶Ø§ÙØ© Ø­Ù‚ÙŠÙ‚ÙŠØ© Ù„ÙØ±ÙŠÙ‚ÙƒÙ…"
"Ù„Ø¯ÙŠÙ‘ Ø´ØºÙ Ø­Ù‚ÙŠÙ‚ÙŠ Ø¨Ù‡Ø°Ø§ Ø§Ù„Ù…Ø¬Ø§Ù„"
"Ø£Ø­Ù…Ù„ Ø±Ø¤ÙŠØ© Ø·Ù…ÙˆØ­Ø© ÙˆØ£Ø³Ø¹Ù‰ Ù„ØªØ­Ù‚ÙŠÙ‚ Ø§Ù„ØªÙ…ÙŠØ²"

Ø£ÙØ¹Ø§Ù„ Ù…Ø¨Ø§Ù„Øº ÙÙŠÙ‡Ø§:
Ù‚Ø§Ø¯ Ø§Ù„Ø«ÙˆØ±Ø©ØŒ Ø£Ø·Ù„Ù‚ Ø§Ù„Ø¹Ù†Ø§Ù†ØŒ Ø£Ø­Ø¯Ø« ØªØ­ÙˆÙ„Ø§Ù‹ Ø¬Ø°Ø±ÙŠØ§Ù‹ØŒ
Ø­ÙÙ‘Ø² Ø§Ù„ØªØºÙŠÙŠØ±ØŒ Ø§Ø±ØªÙ‚Ù‰ Ø¨Ø§Ù„Ø£Ø¯Ø§Ø¡ØŒ ØµØ§Øº Ù…Ø³ØªÙ‚Ø¨Ù„.

Ø®ØªØ§Ù…Ø§Øª ÙƒÙ„ÙŠØ´ÙŠÙ‡ÙŠØ©:
"Ø£ØªØ·Ù„Ø¹ Ø¨ÙØ§Ø±Øº Ø§Ù„ØµØ¨Ø± Ø¥Ù„Ù‰ Ø³Ù…Ø§Ø¹ Ø±Ø¯ÙƒÙ… Ø§Ù„ÙƒØ±ÙŠÙ…"
"Ø´Ø§ÙƒØ±Ø§Ù‹ Ù„ÙƒÙ… Ø­Ø³Ù† Ø§Ù‡ØªÙ…Ø§Ù…ÙƒÙ… ÙˆØªÙØ¶Ù„ÙƒÙ… Ø¨Ù‚Ø±Ø§Ø¡Ø© Ø·Ù„Ø¨ÙŠ"
"Ø£Ø±Ø¬Ùˆ Ø£Ù† ØªØªØ§Ø­ Ù„ÙŠ ÙØ±ØµØ© Ø¥Ø«Ø¨Ø§Øª ÙƒÙØ§Ø¡ØªÙŠ Ø£Ù…Ø§Ù…ÙƒÙ…"
"Ù…ØªØ§Ø­ ÙÙŠ Ø£ÙŠ ÙˆÙ‚Øª ÙŠÙ†Ø§Ø³Ø¨ÙƒÙ… ÙˆÙÙŠ Ø§Ù†ØªØ¸Ø§Ø± ÙƒØ±ÙŠÙ… Ø±Ø¯ÙƒÙ…"

====================
Ù‚ÙˆØ§Ø¹Ø¯ Ø§Ù„ÙƒØªØ§Ø¨Ø© Ø§Ù„Ø¨Ø´Ø±ÙŠØ© Ù„Ø®Ø·Ø§Ø¨ Ø§Ù„ØªÙ‚Ø¯ÙŠÙ… Ø¨Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©:

1. Ø§Ù„Ø§ÙØªØªØ§Ø­ÙŠØ© â€” ÙŠØ¬Ø¨ Ø£Ù„Ø§ ØªÙƒÙˆÙ† Ø¹Ø§Ù…Ø© Ø£Ø¨Ø¯Ø§Ù‹:
   - Ù„Ø§ ØªØ¨Ø¯Ø£ Ø¨Ø£ÙŠ Ø¹Ø¨Ø§Ø±Ø© Ù…Ù† Ø§Ù„Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ù…Ù…Ù†ÙˆØ¹Ø© Ø£Ø¹Ù„Ø§Ù‡.
   - Ø§Ø¨Ø¯Ø£ Ø¨Ø´ÙŠØ¡ Ø­Ù‚ÙŠÙ‚ÙŠ ÙˆÙ…Ø¨Ø§Ø´Ø± â€” Ù„Ù…Ø§Ø°Ø§ Ù‡Ø°Ø§ Ø§Ù„Ø¯ÙˆØ±ØŒ ÙˆÙ„Ù…Ø§Ø°Ø§ Ø§Ù„Ø¢Ù†.
   - Ø®Ø·Ø£:  "ÙŠØ´Ø±Ù‘ÙÙ†ÙŠ Ø£Ù† Ø£ØªÙ‚Ø¯Ù… Ø¨ÙƒÙ„ Ø´ØºÙ ÙˆØ­Ù…Ø§Ø³ Ù„Ø´ØºÙ„ ÙˆØ¸ÙŠÙØ©
             Ù…Ø¯ÙŠØ± Ø§Ù„ØªØ³ÙˆÙŠÙ‚ ÙÙŠ Ø´Ø±ÙƒØªÙƒÙ… Ø§Ù„Ù…ØªÙ…ÙŠØ²Ø©."
   - ØµØ­:   "Ø¨Ø¹Ø¯ Ø³Ù†ÙˆØ§Øª Ù…Ù† Ø§Ù„Ø¹Ù…Ù„ Ø¹Ù„Ù‰ Ø§Ù„Ø¬Ø§Ù†Ø¨ Ø§Ù„ØªÙ†ÙÙŠØ°ÙŠ ÙÙŠ Ø§Ù„ØªØ³ÙˆÙŠÙ‚ØŒ
             ÙˆØ¬Ø¯Øª Ø£Ù† Ù‡Ø°Ø§ Ø§Ù„Ø¯ÙˆØ± ÙÙŠ [Ø§Ù„Ø´Ø±ÙƒØ©] ÙŠØªÙ…Ø§Ø´Ù‰ Ù…Ø¹ Ø§Ù„Ù…Ø±Ø­Ù„Ø©
             Ø§Ù„ØªÙŠ Ø£Ø³Ø¹Ù‰ Ø¥Ù„ÙŠÙ‡Ø§ ÙÙŠ Ù…Ø³ÙŠØ±ØªÙŠ â€” ØªØ­Ø¯ÙŠØ¯Ø§Ù‹ Ù…Ù† Ø­ÙŠØ«
             Ø§Ù„ØªØ±ÙƒÙŠØ² Ø¹Ù„Ù‰ Ø§Ù„Ø§Ø³ØªØ±Ø§ØªÙŠØ¬ÙŠØ© Ù„Ø§ Ø§Ù„ØªÙ†ÙÙŠØ° ÙÙ‚Ø·."

2. Ø§Ù„ÙÙ‚Ø±Ø§Øª ØªØªØ¯ÙÙ‚ Ø¨Ø´ÙƒÙ„ Ø·Ø¨ÙŠØ¹ÙŠ:
   - ÙƒÙ„ ÙÙ‚Ø±Ø© ØªÙ‚ÙˆØ¯ Ù„Ù„ØªØ§Ù„ÙŠØ© Ø¨Ø´ÙƒÙ„ Ø³Ù„Ø³.
   - Ù„Ø§ Ù†Ù‚Ø§Ø· Ø¯Ø§Ø®Ù„ Ø§Ù„Ø®Ø·Ø§Ø¨ Ø£Ø¨Ø¯Ø§Ù‹ â€” Ù‡Ø°Ø§ Ø®Ø·Ø§Ø¨ Ù„Ø§ Ù‚Ø§Ø¦Ù…Ø©.
   - Ø§Ù„Ø®Ø·Ø§Ø¨ ÙŠÙÙ‚Ø±Ø£ ÙƒÙ‚Ø·Ø¹Ø© ÙƒØªØ§Ø¨ÙŠØ© Ù…ØªÙ…Ø§Ø³ÙƒØ© ÙˆØ§Ø­Ø¯Ø©.

3. Ø§Ù„ØªØ­Ø¯ÙŠØ¯ Ø¨Ø¯Ù„ Ø§Ù„Ø¹Ù…ÙˆÙ…ÙŠØ© â€” Ø¯Ø§Ø¦Ù…Ø§Ù‹:
   - Ù„Ø§ ØªØ¯Ù‘Ø¹Ù Ù…Ù‡Ø§Ø±Ø§Øª Ø¯ÙˆÙ† Ø£Ù† ØªØ¯Ø¹Ù…Ù‡Ø§ Ø¨ØªØ¬Ø±Ø¨Ø© Ø­Ù‚ÙŠÙ‚ÙŠØ© Ù…Ù† Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª.
   - Ø®Ø·Ø£:  "Ø£ØªÙ…ØªØ¹ Ø¨Ù…Ù‡Ø§Ø±Ø§Øª Ù‚ÙŠØ§Ø¯ÙŠØ© Ù…Ù…ØªØ§Ø²Ø© ÙˆÙ‚Ø¯Ø±Ø© Ø¹Ù„Ù‰
             Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„ÙØ±Ù‚ Ù…ØªØ¹Ø¯Ø¯Ø© Ø§Ù„ØªØ®ØµØµØ§Øª."
   - ØµØ­:   "ÙÙŠ Ø¯ÙˆØ±ÙŠ Ø§Ù„Ø³Ø§Ø¨Ù‚ØŒ Ø£Ø¯Ø±Øª ÙØ±ÙŠÙ‚Ø§Ù‹ Ù…Ù† 8 Ø£Ø´Ø®Ø§Øµ
             Ù…Ù† Ù‚Ø³Ù…ÙŠÙ† Ù…Ø®ØªÙ„ÙÙŠÙ† â€” ÙƒØ§Ù† Ø§Ù„ØªÙ†Ø³ÙŠÙ‚ ØµØ¹Ø¨Ø§Ù‹ ÙÙŠ Ø§Ù„Ø¨Ø¯Ø§ÙŠØ©ØŒ
             Ù„ÙƒÙ†Ù†Ø§ Ø·ÙˆÙ‘Ø±Ù†Ø§ Ù†Ø¸Ø§Ù… Ø¹Ù…Ù„ ÙØ¹Ù„ÙŠØ§Ù‹ Ø£Ø­Ø¯Ø« ÙØ§Ø±Ù‚Ø§Ù‹."

4. Ø§Ù„ÙˆØ§Ù‚Ø¹ÙŠØ© ÙÙŠ Ø§Ù„Ø£Ø³Ù„ÙˆØ¨ â€” Ù„Ø§ Ù…Ø¨Ø§Ù„ØºØ©:
   - Ø§Ù„Ø®Ø·Ø§Ø¨ ÙŠØ¬Ø¨ Ø£Ù† ÙŠØ¨Ø¯Ùˆ ÙˆØ§Ø«Ù‚Ø§Ù‹ Ù„Ø§ Ù…ØªÙˆØ³Ù„Ø§Ù‹ ÙˆÙ„Ø§ Ù…ØªØ¹Ø¬Ø±ÙØ§Ù‹.
   - Ù„Ø§ ÙˆØ¹ÙˆØ¯ Ù…Ø¨Ø§Ù„ØºØ© Ø£Ùˆ Ø§Ø¯Ø¹Ø§Ø¡Ø§Øª ØªØ¨Ø¯Ùˆ Ù…ØµØ·Ù†Ø¹Ø©.
   - Ø®Ø·Ø£:  "Ø£Ù†Ø§ ÙˆØ§Ø«Ù‚ Ù…Ù† Ø£Ù†Ù†ÙŠ Ø³Ø£Ø­Ù‚Ù‚ Ù†ØªØ§Ø¦Ø¬ Ø§Ø³ØªØ«Ù†Ø§Ø¦ÙŠØ©
             ÙˆØ³Ø£ÙƒÙˆÙ† Ø¹Ù†ØµØ±Ø§Ù‹ Ù…Ø­ÙˆØ±ÙŠØ§Ù‹ ÙÙŠ Ù†Ø¬Ø§Ø­ ÙØ±ÙŠÙ‚ÙƒÙ…."
   - ØµØ­:   "Ø£Ø¹ØªÙ‚Ø¯ Ø£Ù† Ù‡Ù†Ø§Ùƒ ØªÙ‚Ø§Ø·Ø¹Ø§Ù‹ ÙˆØ§Ø¶Ø­Ø§Ù‹ Ø¨ÙŠÙ† Ù…Ø§ Ø£Ù‚Ø¯Ù…Ù‡
             ÙˆÙ…Ø§ ÙŠØ­ØªØ§Ø¬Ù‡ Ù‡Ø°Ø§ Ø§Ù„Ø¯ÙˆØ± â€” ÙŠØ³Ø¹Ø¯Ù†ÙŠ Ù…Ù†Ø§Ù‚Ø´Ø© Ø°Ù„Ùƒ
             Ø¨Ø´ÙƒÙ„ Ø£ÙƒØ«Ø± ØªÙØµÙŠÙ„Ø§Ù‹."

5. ØªÙ†ÙˆØ¹ Ø§Ù„Ø¬Ù…Ù„ â€” Ø¥Ù„Ø²Ø§Ù…ÙŠ:
   - Ø§Ù…Ø²Ø¬ Ø¬Ù…Ù„Ø§Ù‹ Ù‚ØµÙŠØ±Ø© ÙˆØ·ÙˆÙŠÙ„Ø© Ø¨Ø´ÙƒÙ„ Ø·Ø¨ÙŠØ¹ÙŠ.
   - Ù„Ø§ ÙÙ‚Ø±ØªØ§Ù† ØªØ¨Ø¯Ø¢Ù† Ø¨Ù†ÙØ³ Ø§Ù„Ø·Ø±ÙŠÙ‚Ø©.
   - Ù„Ø§ Ù‡ÙŠØ§ÙƒÙ„ Ø¬Ù…Ù„ Ù…ØªØ·Ø§Ø¨Ù‚Ø© Ù…ØªØªØ§Ù„ÙŠØ©.

6. Ø§Ø®ØªÙŠØ§Ø± Ø§Ù„Ø£ÙØ¹Ø§Ù„ â€” Ù…ØªÙ†ÙˆØ¹ ÙˆÙ…Ø¨Ø§Ø´Ø±:
   Ù…Ø³Ù…ÙˆØ­ Ø¨Ù‡: Ø£Ø¯Ø§Ø±ØŒ Ù‚Ø§Ø¯ØŒ Ø¨Ù†Ù‰ØŒ ØªØ¹Ø§ÙˆÙ†ØŒ Ø·ÙˆÙ‘Ø±ØŒ ØªÙˆÙ„Ù‘Ù‰ØŒ Ù†Ø³Ù‘Ù‚ØŒ
             Ø¹Ù…Ù„ Ø¹Ù„Ù‰ØŒ Ø³Ø§Ø¹Ø¯ ÙÙŠØŒ Ø­Ø³Ù‘Ù†ØŒ Ø£Ù†Ø´Ø£ØŒ Ø£Ø·Ù„Ù‚ØŒ Ø£Ø¹Ø¯Ù‘.
   - Ù„Ø§ ØªÙƒØ±Ø± Ù†ÙØ³ Ø§Ù„ÙØ¹Ù„ Ù…Ø±ØªÙŠÙ† ÙÙŠ Ø§Ù„Ø®Ø·Ø§Ø¨.

7. Ø§Ù„Ø·ÙˆÙ„ ÙˆØ§Ù„Ø´ÙƒÙ„:
   - ØµÙØ­Ø© ÙˆØ§Ø­Ø¯Ø© ÙƒØ­Ø¯ Ø£Ù‚ØµÙ‰. 3â€“4 ÙÙ‚Ø±Ø§Øª.
   - Ù„Ø§ Ù†Ù‚Ø§Ø· ÙÙŠ Ø£ÙŠ Ù…ÙƒØ§Ù† â€” Ù‡Ø°Ø§ Ø®Ø·Ø§Ø¨ Ù„Ø§ Ø³ÙŠØ±Ø© Ø°Ø§ØªÙŠØ©.
   - ÙƒÙ„ ÙÙ‚Ø±Ø©: 3â€“6 Ø£Ø³Ø·Ø±.

8. Ø§Ù„Ø®ØªØ§Ù… â€” Ø¨Ø§Ù„Ø£Ø³Ù„ÙˆØ¨ Ø§Ù„Ø¨Ø´Ø±ÙŠ:
   - ØªØ¬Ù†Ù‘Ø¨ Ø¬Ù…ÙŠØ¹ Ø§Ù„Ø®ØªØ§Ù…Ø§Øª Ø§Ù„Ù…Ù…Ù†ÙˆØ¹Ø© Ø£Ø¹Ù„Ø§Ù‡.
   - Ø®Ø·Ø£:  "Ø£ØªØ·Ù„Ø¹ Ø¨ÙØ§Ø±Øº Ø§Ù„ØµØ¨Ø± Ø¥Ù„Ù‰ Ø±Ø¯ÙƒÙ… Ø§Ù„ÙƒØ±ÙŠÙ…ØŒ
             Ø´Ø§ÙƒØ±Ø§Ù‹ Ù„ÙƒÙ… Ø§Ù‡ØªÙ…Ø§Ù…ÙƒÙ… ÙˆØ­Ø³Ù† Ù…ØªØ§Ø¨Ø¹ØªÙƒÙ…."
   - ØµØ­:   "ÙŠØ³Ø¹Ø¯Ù†ÙŠ Ø§Ù„ØªØ­Ø¯Ø« Ù…Ø¹ÙƒÙ… Ø¨Ù…Ø²ÙŠØ¯ Ù…Ù† Ø§Ù„ØªÙØ§ØµÙŠÙ„
             Ø¹Ù†Ø¯ Ø£ÙŠ ÙˆÙ‚Øª ÙŠÙ†Ø§Ø³Ø¨ÙƒÙ…."
             Ø£Ùˆ: "Ù…ØªØ§Ø­ Ù„Ù„Ù…Ù‚Ø§Ø¨Ù„Ø© ÙÙŠ Ø§Ù„ÙˆÙ‚Øª Ø§Ù„Ø°ÙŠ ÙŠÙ„Ø§Ø¦Ù…ÙƒÙ…."

9. Ø§Ù„Ù…Ø±Ø§Ø¬Ø¹Ø© Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠØ© Ù‚Ø¨Ù„ Ø§Ù„Ù…Ø®Ø±Ø¬:
   - Ø§Ù‚Ø±Ø£ Ø§Ù„Ø®Ø·Ø§Ø¨ ÙƒØ§Ù…Ù„Ø§Ù‹ Ù‚Ø¨Ù„ Ø§Ù„Ø¥Ø±Ø³Ø§Ù„.
   - Ø¥Ø°Ø§ Ø¨Ø¯Øª Ø£ÙŠ Ø¬Ù…Ù„Ø© ÙˆÙƒØ£Ù†Ù‡Ø§ Ù…Ù† Ù‚Ø§Ù„Ø¨ Ø¬Ø§Ù‡Ø² â†’ Ø£Ø¹Ø¯ ÙƒØªØ§Ø¨ØªÙ‡Ø§.
   - Ø§Ø³Ø£Ù„: Ù‡Ù„ ÙƒØ§Ù† Ø´Ø®Øµ Ø­Ù‚ÙŠÙ‚ÙŠ Ø³ÙŠÙƒØªØ¨ Ù‡Ø°Ù‡ Ø§Ù„Ø¬Ù…Ù„Ø© Ø¨Ù‡Ø°Ù‡ Ø§Ù„Ø·Ø±ÙŠÙ‚Ø©ØŸ
     Ø¥Ø°Ø§ ÙƒØ§Ù†Øª Ø§Ù„Ø¥Ø¬Ø§Ø¨Ø© Ù„Ø§ â†’ ØºÙŠÙ‘Ø±Ù‡Ø§.
   - Ø§Ù„Ø®Ø·Ø§Ø¨ ÙŠØ¬Ø¨ Ø£Ù† ÙŠØ¨Ø¯Ùˆ Ù…ÙƒØªÙˆØ¨Ø§Ù‹ Ù„Ù‡Ø°Ù‡ Ø§Ù„ÙˆØ¸ÙŠÙØ© ØªØ­Ø¯ÙŠØ¯Ø§Ù‹ â€”
     Ù„Ø§ Ù‚Ø§Ù„Ø¨Ø§Ù‹ Ø¬Ø§Ù‡Ø²Ø§Ù‹ ØªÙ… Ù…Ù„Ø¡ ÙØ±Ø§ØºØ§ØªÙ‡.
====================

Ø§Ù„ØªØµÙ…ÙŠÙ… ÙˆØ§Ù„Ø·Ø¨Ø§Ø¹Ø©:
- Ø§Ù„Ø®Ø·: Calibri / Calibri LightØŒ sans-serif
- Ø§Ù„Ù„ÙˆÙ†: #000000
- ØªØ¨Ø§Ø¹Ø¯ Ø§Ù„Ø£Ø³Ø·Ø±: 1.5
- Ø£Ù‚ØµÙ‰ Ø¹Ø±Ø¶: 800px
- Ø§Ù„Ø§ØªØ¬Ø§Ù‡: RTL

Ø§Ù„Ø§Ø³Ù…: font-size 18ptØŒ bold
Ù…Ø¹Ù„ÙˆÙ…Ø§Øª Ø§Ù„ØªÙˆØ§ØµÙ„: font-size 10pt
Ø³Ø·Ø± Ø§Ù„Ù…ÙˆØ¶ÙˆØ¹: font-size 11ptØŒ bold
Ù†Øµ Ø§Ù„Ù…Ø­ØªÙˆÙ‰: font-size 11ptØŒ line-height: 1.6
Ø§Ù„ØªØ§Ø±ÙŠØ® ÙˆØ¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø´Ø±ÙƒØ©: font-size 11pt
====================

Ù‡ÙŠÙƒÙ„ HTML (Ø¥Ù„Ø²Ø§Ù…ÙŠ):

<div dir="rtl" style="font-family:Calibri, sans-serif; color:#000; max-width:800px; text-align:right;">

  <div style="font-size:18pt; font-weight:bold;">[Ø§Ù„Ø§Ø³Ù… Ø§Ù„ÙƒØ§Ù…Ù„]</div>
  <div style="font-size:10pt;">[Ø§Ù„Ø¨Ø±ÙŠØ¯] | [Ø§Ù„Ù‡Ø§ØªÙ] | [Ø§Ù„Ø¬Ù†Ø³ÙŠØ©] | [LinkedIn Ø¥Ù† ÙˆÙØ¬Ø¯]</div>
  <br>
  <div style="font-size:11pt;">[Ø§Ù„ØªØ§Ø±ÙŠØ®]</div>
  <div style="font-size:11pt;">Ù…Ø¯ÙŠØ± Ø§Ù„ØªÙˆØ¸ÙŠÙ / ÙØ±ÙŠÙ‚ Ø§Ù„Ù…ÙˆØ§Ø±Ø¯ Ø§Ù„Ø¨Ø´Ø±ÙŠØ©</div>
  <div style="font-size:11pt;">[Ø§Ø³Ù… Ø§Ù„Ø´Ø±ÙƒØ©]</div>
  <br>

  <div style="font-size:11pt; font-weight:bold;">Ø§Ù„Ù…ÙˆØ¶ÙˆØ¹: ØªÙ‚Ø¯ÙŠÙ… Ø·Ù„Ø¨ Ù„Ø´ØºÙ„ ÙˆØ¸ÙŠÙØ© [Ø§Ù„Ù…Ø³Ù…Ù‰ Ø§Ù„ÙˆØ¸ÙŠÙÙŠ]</div>
  <br>

  <br>

  <div style="font-size:11pt;">Ù…Ø¹ Ø®Ø§Ù„Øµ Ø§Ù„ØªÙ‚Ø¯ÙŠØ±ØŒ</div>
  <div style="font-size:11pt; font-weight:bold;">[Ø§Ù„Ø§Ø³Ù… Ø§Ù„ÙƒØ§Ù…Ù„]</div>

</div>

====================
Ø§Ù„ØªØ­Ù‚Ù‚ Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠ (Ø¥Ù„Ø²Ø§Ù…ÙŠ):
- Ø§Ù„Ù…Ø®Ø±Ø¬ Ø¹Ø±Ø¨ÙŠ ÙÙ‚Ø· â€” Ù„Ø§ ÙƒÙ„Ù…Ø§Øª Ø¥Ù†Ø¬Ù„ÙŠØ²ÙŠØ© Ø¥Ù„Ø§ Ø§Ù„Ø£Ø³Ù…Ø§Ø¡ Ø§Ù„ØµØ±ÙŠØ­Ø©.
- Ù„Ø§ Ø¨ÙŠØ§Ù†Ø§Øª Ù…Ø®ØªØ±Ø¹Ø© â€” placeholders Ø­ÙŠØ« Ø§Ù„Ù…Ø¹Ù„ÙˆÙ…Ø§Øª Ù…ÙÙ‚ÙˆØ¯Ø©.
- 3â€“4 ÙÙ‚Ø±Ø§Øª. Ù„Ø§ Ù†Ù‚Ø§Ø· ÙÙŠ Ø£ÙŠ Ù…ÙƒØ§Ù†.
- Ù„Ø§ Ø¹Ø¨Ø§Ø±Ø§Øª Ù…Ù…Ù†ÙˆØ¹Ø© ÙÙŠ Ø£ÙŠ Ù…ÙƒØ§Ù† Ø¨Ø§Ù„Ø®Ø·Ø§Ø¨.
- ÙƒÙ„ ÙÙ‚Ø±Ø© ØªØªØ¯ÙÙ‚ Ù„Ù„ØªØ§Ù„ÙŠØ© Ø¨Ø´ÙƒÙ„ Ø·Ø¨ÙŠØ¹ÙŠ.
- Ø§Ù„Ø§ÙØªØªØ§Ø­ÙŠØ© Ù…Ø­Ø¯Ø¯Ø© ÙˆÙ…Ø¨Ø§Ø´Ø±Ø© â€” Ù„Ø§ Ø¹Ø§Ù…Ø© Ø£Ùˆ ÙƒÙ„ÙŠØ´ÙŠÙ‡ÙŠØ©.
- Ø§Ù„Ø®ØªØ§Ù… Ø¨Ø´Ø±ÙŠ ÙˆÙˆØ§Ø«Ù‚ â€” Ù„Ø§ ØµÙŠØºØ© Ø±Ø³Ù…ÙŠØ© Ø¬Ø§Ù…Ø¯Ø©.
- Ø§Ù„Ø®Ø·Ø§Ø¨ ÙŠØ¨Ø¯Ùˆ Ù…ÙƒØªÙˆØ¨Ø§Ù‹ Ù„Ù‡Ø°Ù‡ Ø§Ù„ÙˆØ¸ÙŠÙØ© ØªØ­Ø¯ÙŠØ¯Ø§Ù‹.
- Ù‡ÙŠÙƒÙ„ RTL ÙƒØ§Ù…Ù„ Ù…Ø¹ text-align:right.
- Ø¥Ø°Ø§ Ø¨Ø¯Øª Ø£ÙŠ Ø¬Ù…Ù„Ø© Ù…ØµØ·Ù†Ø¹Ø© â†’ Ø£Ø¹Ø¯ ÙƒØªØ§Ø¨ØªÙ‡Ø§ Ù‚Ø¨Ù„ Ø§Ù„Ø¥Ø±Ø³Ø§Ù„.
====================`;

// â”€â”€ Helper: extract valid <div>...</div> HTML block from GPT output â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function extractDiv(raw: string): string {
  raw = raw.replace(/^```html?\n?/im, "").replace(/\n?```$/m, "").trim();
  if (!raw.trimStart().startsWith("<div")) {
    const divMatch = raw.match(/<div[\s\S]*<\/div>/i);
    if (divMatch) return divMatch[0];
    throw new Error("GPT did not return a valid <div>...</div> HTML block");
  }
  return raw;
}

// â”€â”€ Helper: safe filenames for generated DOCX files â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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


// â”€â”€ PAID PLAN: Generate CV HTML â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function generateCvHtml(cvData: any, plan: string, lang: string): Promise<string> {
  const cvDataJson   = JSON.stringify(cvData, null, 2);
  const systemPrompt = (lang === "ar" ? SYSTEM_PROMPT_AR : SYSTEM_PROMPT_EN)
    .replace("{{CV_DATA}}", cvDataJson);
  const userMessage  = `Plan type: ${plan === "free" ? "Free (Summary only)" : `Paid â€” ${plan} plan (Full CV)`}\n\nGenerate the CV now.`;

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

function extractJsonObject(raw: string): unknown {
  const cleaned = String(raw || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("GPT did not return a valid JSON object");
  }

  return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
}

async function generateCvJson(cvData: any, plan: string, lang: string): Promise<unknown> {
  const cvDataJson = JSON.stringify(cvData, null, 2);
  const basePrompt = lang === "ar" ? CV_JSON_PROMPT_AR_V1 : CV_JSON_PROMPT_EN_V1;

  const systemPrompt = basePrompt.replace("{{CV_DATA}}", cvDataJson);

  const userMessage =
    `Plan type: ${plan === "free" ? "Free (Summary only)" : `Paid â€” ${plan} plan (Full CV)`}\n\n` +
    `Generate the CV_JSON_V1 now. Return valid JSON only.`;

  console.log("[generate-cv] CV Engine 2.0: GPT JSON generation START");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 8192,
      temperature: 0.45,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI CV JSON ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();

  console.log(
    "[generate-cv] CV JSON usage:",
    JSON.stringify(data.usage || null)
  );

  const raw = data.choices?.[0]?.message?.content ?? "";

  const parsed = extractJsonObject(raw);

  console.log("[generate-cv] CV Engine 2.0: GPT JSON generation OK");

  return parsed;
}

// â”€â”€ PAID PLAN: Generate Cover Letter HTML â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function generateCoverLetterHtml(cvData: any, plan: string, lang: string): Promise<string> {
  const cvDataJson   = JSON.stringify(cvData, null, 2);
  const systemPrompt = (lang === "ar" ? CL_PROMPT_AR : CL_PROMPT_EN)
    .replace("{{cv_data}}", cvDataJson);
  const userMessage  = `Plan type: ${plan === "free" ? "Free (Opening paragraph only)" : `Paid â€” ${plan} plan (Full cover letter)`}\n\nGenerate the cover letter now.`;

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

  console.log(
    "[generate-cv] Cover Letter usage:",
    JSON.stringify(data.usage || null)
  );

  return extractDiv(data.choices?.[0]?.message?.content ?? "");
}

// â”€â”€ Main handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // â”€â”€ Auth: full JWT verification â€” callerUid always from server-side token â”€â”€
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
      generation_id,    // UUID PK of order_generations â€” the only required identifier
      selectedLanguage,
      transaction_id,   // forwarded for logging/audit trail
    } = await req.json();

    if (!generation_id) {
      return new Response(
        JSON.stringify({ error: "generation_id is required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // TIER 1 SINGLE LOOKUP â€” the only database read needed.
    // generation_id is the PK of order_generations. This row contains the full
    // denormalized snapshot (cv_data copied from cv_archive at payment time),
    // the confirmed payment fields (package_name, payment_method), and all
    // personal context. No secondary lookup to cv_archive is required.
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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

    // â”€â”€ Ownership check â€” caller must own this generation_id â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    // effectivePlan: record.package_name is the authoritative source â€” written by
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

    // â”€â”€ Generate CV + Cover Letter concurrently â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const [cvJson, clHtml] = await Promise.all([
      generateCvJson(cvData, effectivePlan, lang),
      generateCoverLetterHtml(cvData, effectivePlan, lang),
    ]);

    // â”€â”€ STEP C: Defensive lock â€” write raw GPT output to DB immediately â”€â”€â”€â”€
    // This write happens BEFORE any storage upload. If an upload or signed-URL
    // call fails later, the generated text is already safe in the database row.
    const { error: gptSaveErr } = await db
      .from("order_generations")
      .update({
        cv_gpt_result:     { cv_json: cvJson, cl_html: clHtml },
        selected_language: lang,
      })
      .eq("generation_id", generation_id);

    if (gptSaveErr) {
      console.error("[generate-cv] cv_gpt_result save failed:", gptSaveErr);
      throw new Error(`cv_gpt_result save failed: ${gptSaveErr.message}`);
    }
    console.log("[generate-cv] cv_gpt_result saved for gid:", generation_id);

    // â”€â”€ STEP D: Convert HTML â†’ real editable DOCX files â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    const cvDocxBytes = await buildCvDocx(cvJson);
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
      // cv_gpt_result already safe â€” log but don't throw so the response still returns URLs
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



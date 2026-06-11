import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function cleanLines(content: string, max = 8) {
  return content
    .split("\n")
    .map((line) => line.replace(/^[-•*\d.)\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, max);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { jobTitle, roleDescription, industry, company, language } = await req.json();

    const title = String(jobTitle || "").trim();
    const duties = String(roleDescription || "").trim();
    const sector = String(industry || "").trim();
    const companyName = String(company || "").trim();

    if (!title && !duties) {
      return new Response(JSON.stringify({ error: "jobTitle or roleDescription is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isArabic = language === "ar";
    const companyText = companyName
      ? isArabic
        ? `\nالشركة: ${companyName}`
        : `\nCompany: ${companyName}`
      : "";
    const industryText = sector
      ? isArabic
        ? `\nقطاع الشركة / نوع النشاط: ${sector}`
        : `\nCompany industry / business type: ${sector}`
      : "";

    const prompt = isArabic
      ? `
أنت مساعد ذكي داخل منصة Resumation. هدفك ليس كتابة مهام جاهزة للمستخدم، بل طرح أسئلة دقيقة تساعده على تذكّر تفاصيل عمله حتى يتمكن محرك السيرة الذاتية لاحقاً من تحويل إجاباته إلى مسؤوليات وإنجازات احترافية.

اعتمد على المعلومات التالية بهذا الترتيب:
1. المهام الفعلية التي كتبها المستخدم.
2. قطاع الشركة / نوع النشاط.
3. المسمى الوظيفي المقترح أو الرسمي.

المسمى الوظيفي:
${title || "غير محدد"}

المهام الفعلية المكتوبة من المستخدم:
${duties || "غير محددة"}${industryText}${companyText}

المطلوب:
- اكتب من 6 إلى 8 أسئلة قصيرة ومباشرة.
- يجب أن تكون الأسئلة مبنية على المهام الفعلية والقطاع، وليس على المسمى فقط.
- إذا كانت المهام متعددة، اسأل أسئلة تغطي الدور كوظيفة واحدة متكاملة وليس كل مهمة كوظيفة منفصلة.
- اسأل عن أرقام ونتائج حقيقية إن أمكن: عدد العملاء، عدد الطلبات، عدد الملفات، عدد السير الذاتية، عدد المقابلات، نسبة التحسن، حجم الفريق، الأدوات والأنظمة، المنصات، الميزانية.
- لا تكتب مسؤوليات جاهزة.
- لا تكتب bullets للسيرة الذاتية.
- لا تخترع أي إنجاز.
- لا تسأل أسئلة طويلة أو معقدة.
- اجعل الأسئلة سهلة لشخص لا يعرف كيف يكتب CV.
- اكتب كل سؤال في سطر مستقل.
- بدون ترقيم.
- بدون مقدمات.
- بدون شرح إضافي.

مثال مهم:
إذا كتب المستخدم أنه كان يبحث عن وظائف للعملاء، يكتب CV وCover Letter، يدخل بيانات، ويتواصل مع العملاء، فلا تسأل أسئلة عامة عن "باحث عن عمل".
اسأل عن عدد العملاء، عدد السير الذاتية، منصات البحث، التواصل مع الشركات، عدد الطلبات، المقابلات، ونوع ملفات العملاء.
`
      : `
You are an AI assistant inside Resumation. Your job is not to write CV bullets for the user. Your job is to ask smart, role-specific questions that help the user remember factual details about their work, so the CV engine can later turn those answers into professional responsibilities and achievements.

Use the information in this priority order:
1. The actual duties described by the user.
2. The company industry / business type.
3. The official or suggested job title.

Job title:
${title || "Not specified"}

Actual duties described by the user:
${duties || "Not specified"}${industryText}${companyText}

Requirements:
- Write 6 to 8 short, direct questions.
- Questions must be based on the actual duties and industry, not on the job title alone.
- If the duties are mixed, ask questions that cover one unified role, not one separate role per duty.
- Ask about real numbers and outcomes when relevant: customers handled, applications sent, CVs written, files processed, interviews generated, tools used, platforms, team size, budget, process improvements.
- Do not write ready CV bullets.
- Do not write responsibilities for the user.
- Do not invent achievements.
- Keep questions simple for someone who does not know how to write a CV.
- One question per line.
- No numbering.
- No bullet symbols.
- No introduction.
- No extra explanation.

Important example:
If the user says they searched jobs for clients, wrote CVs and cover letters, entered data, and communicated with customers, do not ask generic questions about a "job searcher".
Ask about number of clients, number of CVs, job boards used, employer communication, applications submitted, interviews secured, and client files handled.
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY") ?? ""}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 850,
        temperature: 0.35,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";
    const questions = cleanLines(content, 8);

    return new Response(
      JSON.stringify({
        content: questions.join("\n"),
        questions,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("generate-cv-bullets error:", err);

    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

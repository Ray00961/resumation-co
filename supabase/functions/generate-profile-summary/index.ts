import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function cleanLines(content: string, max = 5) {
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
    const { roleDescription, industry, company, language } = await req.json();

    const duties = String(roleDescription || "").trim();
    const sector = String(industry || "").trim();
    const companyName = String(company || "").trim();

    if (!duties) {
      return new Response(JSON.stringify({ error: "roleDescription is required" }), {
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
      ? `أنت خبير موارد بشرية وتصنيف مسميات وظيفية داخل منصة Resumation.

المستخدم لا يعرف مسماه الوظيفي الرسمي. كتب مجموعة مهام كان يقوم بها ضمن نفس الوظيفة، وليس عدة وظائف منفصلة.

المهام التي كتبها المستخدم:
"""
${duties}
"""${industryText}${companyText}

المطلوب:
- اقترح 5 مسميات وظيفية احترافية مناسبة للسيرة الذاتية.
- كل مسمى يجب أن يجمع كل المهام تحت وظيفة واحدة شاملة.
- لا تعطِ مسمى منفصل لكل مهمة.
- لا تترجم المهام حرفياً.
- استخدم قطاع الشركة لفهم السياق.
- لا تستخدم كلمات عامية أو غامضة مثل: شغل مكتب، موظف كمبيوتر، باحث عن عمل.
- يجب أن تكون المسميات مناسبة لـ HR و ATS.
- كل مسمى في سطر مستقل.
- بدون ترقيم وبدون رموز.
- بدون شرح.

مثال:
إذا كانت المهام: البحث عن وظائف للعملاء + كتابة CV وCover Letter + إدخال بيانات + خدمة عملاء
فالمسميات المناسبة تكون جامعة مثل:
أخصائي خدمات مهنية ودعم عملاء
منسق خدمات مهنية
أخصائي دعم توظيف وخدمات عملاء
وليس: باحث عن عمل، مدخل بيانات، خدمة عملاء، كاتب CV كمسميات منفصلة.`
      : `You are an HR expert and professional job-title classifier inside Resumation.

The user does not know their official job title. They described multiple duties they performed within the same position, not separate jobs.

User duties:
"""
${duties}
"""${industryText}${companyText}

Task:
- Suggest 5 professional CV-ready job titles.
- Each title must combine all duties into ONE unified role.
- Do NOT suggest one title per duty.
- Do NOT translate the duties literally.
- Use the company industry to understand the context.
- Do not use vague titles like: job searcher, computer employee, office work, helper.
- Titles must be suitable for HR and ATS.
- One title per line.
- No numbering and no bullet symbols.
- No explanation.

Example:
If duties are job searching for clients + CV and cover letter writing + data entry + customer service,
good unified titles are:
Career Services & Client Support Specialist
Career Services Coordinator
Recruitment Support & Client Services Specialist
Do not output separate titles like Job Searcher, Data Entry Clerk, Customer Service Agent, CV Writer.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY") ?? ""}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 400,
        temperature: 0.25,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";
    const titles = cleanLines(content, 5);

    return new Response(JSON.stringify({ titles, content: titles.join("\n") }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("suggest-position-titles error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { jobTitle, company, language } = await req.json();

    if (!jobTitle?.trim()) {
      return new Response(JSON.stringify({ error: "jobTitle is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isArabic = language === "ar";
    const companyText = company?.trim()
      ? isArabic
        ? ` في شركة "${company.trim()}"`
        : ` at "${company.trim()}"`
      : "";

    const prompt = isArabic
      ? `
أنت مساعد ذكي داخل منصة Resumation. هدفك ليس كتابة مهام جاهزة للمستخدم، بل طرح أسئلة دقيقة تساعده على تذكّر تفاصيل عمله حتى يتمكن محرك السيرة الذاتية لاحقاً من تحويل إجاباته إلى مسؤوليات وإنجازات احترافية.

المستخدم يكتب خبرته لوظيفة: "${jobTitle.trim()}"${companyText}.

المطلوب:
- اكتب من 6 إلى 8 أسئلة قصيرة ومباشرة.
- يجب أن تكون الأسئلة مخصصة جداً لهذا المسمى الوظيفي، وليست عامة.
- اسأل عن الأرقام والنتائج إن كانت مناسبة: عدد العملاء، حجم المبيعات، نسبة التحسن، عدد الفريق، حجم الميزانية، عدد الطلبات، الأنظمة المستخدمة.
- لا تكتب أي مسؤوليات جاهزة.
- لا تكتب bullets للسيرة الذاتية.
- لا تخترع أي إنجاز.
- لا تسأل أسئلة طويلة أو معقدة.
- اجعل الأسئلة سهلة لشخص لا يعرف كيف يكتب CV.
- اكتب كل سؤال في سطر مستقل.
- بدون ترقيم.
- بدون مقدمات.
- بدون شرح إضافي.

أمثلة على نوعية الأسئلة المطلوبة حسب الوظيفة:
إذا كانت الوظيفة مبيعات، اسأل عن target، نسبة تحقيق الهدف، عدد العملاء، الصفقات.
إذا كانت خدمة عملاء، اسأل عن عدد العملاء يومياً، الشكاوى، القنوات، CRM.
إذا كانت محاسبة، اسأل عن التقارير، الضرائب، البرامج المحاسبية، الإقفال الشهري.
إذا كانت تسويق، اسأل عن المنصات، الميزانية، leads، ROAS.
إذا كانت صيدلة، اسأل عن الوصفات، المرضى، المخزون، الأنظمة الصيدلية.
إذا كانت برمجة، اسأل عن التقنيات، المشاريع، الأداء، قواعد البيانات.
`
      : `
You are an AI assistant inside Resumation. Your job is not to write CV bullets for the user. Your job is to ask smart, role-specific questions that help the user remember factual details about their work, so the CV engine can later turn those answers into professional responsibilities and achievements.

The user is writing experience for this role: "${jobTitle.trim()}"${companyText}.

Requirements:
- Write 6 to 8 short, direct questions.
- Questions must be highly specific to this job title, not generic.
- Ask about numbers and outcomes when relevant: customers handled, sales targets, revenue growth, team size, budget, number of requests, tools, systems, platforms, processes improved.
- Do not write ready CV bullets.
- Do not write responsibilities for the user.
- Do not invent achievements.
- Keep questions simple for someone who does not know how to write a CV.
- One question per line.
- No numbering.
- No bullet symbols.
- No introduction.
- No extra explanation.

Examples of question direction:
For sales roles, ask about targets, achievement percentage, clients, deals.
For customer service, ask about daily customers, complaints, channels, CRM tools.
For accounting, ask about reports, tax, accounting software, monthly closing.
For marketing, ask about platforms, budgets, leads, ROAS.
For pharmacy, ask about prescriptions, patients, inventory, pharmacy systems.
For software roles, ask about technologies, projects, performance, databases.
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY") ?? ""}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 700,
        temperature: 0.4,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";

    const questions = content
      .split("\n")
      .map((line) =>
        line
          .replace(/^[-•*\d.)\s]+/, "")
          .trim(),
      )
      .filter(Boolean)
      .slice(0, 8);

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
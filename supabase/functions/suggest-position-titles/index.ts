import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { roleDescription, company, language } = await req.json();

    if (!roleDescription?.trim()) {
      return new Response(JSON.stringify({ error: "roleDescription is required" }), {
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
      ? `أنت خبير موارد بشرية وتصنيف مسميات وظيفية داخل منصة Resumation.

المستخدم لا يعرف مسماه الوظيفي الرسمي. كتب ما كان يقوم به في العمل${companyText}:
"""
${roleDescription.trim()}
"""

المطلوب:
- اقترح 5 مسميات وظيفية احترافية مناسبة للسيرة الذاتية.
- لا تستخدم كلمات عامية أو غامضة مثل: شغل مكتب، موظف كمبيوتر، باحث عن عمل.
- لا تكتب شرحاً.
- لا تترجم حرفياً إذا كان الوصف يحتوي كلمات إنجليزية.
- يجب أن تكون المسميات مناسبة لـ HR و ATS.
- كل مسمى في سطر مستقل.
- بدون ترقيم وبدون رموز.`
      : `You are an HR expert and professional job-title classifier inside Resumation.

The user does not know their official job title. They described what they did${companyText}:
"""
${roleDescription.trim()}
"""

Task:
- Suggest 5 professional CV-ready job titles.
- Do not use vague titles like: job searcher, computer employee, office work, helper.
- Do not explain.
- Do not translate literally if the description contains mixed language.
- Titles must be suitable for HR and ATS.
- One title per line.
- No numbering and no bullet symbols.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY") ?? ""}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 350,
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

    const titles = content
      .split("\n")
      .map((line) => line.replace(/^[-•*\d.)\s]+/, "").trim())
      .filter(Boolean)
      .slice(0, 5);

    return new Response(JSON.stringify({ titles, content: titles.join("\n") }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("suggest-job-titles error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

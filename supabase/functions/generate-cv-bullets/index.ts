import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
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
    const companyPart = company?.trim() ? ` في شركة "${company}"` : "";
    const companyPartEn = company?.trim() ? ` at ${company}` : "";

    const prompt = isArabic
      ? `أنت خبير في كتابة السير الذاتية وتحسينها لأنظمة ATS. المستخدم يكتب سيرته الذاتية لوظيفة "${jobTitle}"${companyPart}.

أعطه 5 نصائح عملية ومحددة لكتابة نقاط قوية في خانة المهام والإنجازات. ركّز على:
- ما نوع الأرقام والنسب المئوية التي يجب ذكرها (مثل: نسبة زيادة المبيعات، حجم الفريق، الميزانية المُدارة)
- الكلمات المفتاحية التي يبحث عنها الـ ATS في هذه الوظيفة تحديداً
- الإنجازات والمسؤوليات الأكثر أهمية لهذا الدور
- كيف يصيغ الجملة (فعل ماضٍ قوي + نتيجة قابلة للقياس)

اكتب النصائح بشكل مباشر وعملي، كل نصيحة في سطر، بدون ترقيم.`
      : `You are a CV and ATS expert. The user is writing their CV for a "${jobTitle}" role${companyPartEn}.

Give them 5 specific, actionable tips for writing strong bullet points for this exact role. Cover:
- What numbers and percentages to include (e.g. % revenue growth, team size, budget managed, deals closed)
- ATS keywords that recruiters search for in this specific role
- The most impactful achievements and responsibilities to highlight
- How to frame each bullet (strong past-tense verb + measurable result)

Be specific to the "${jobTitle}" role — not generic advice. One tip per line, no numbering, no bullet symbols.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY") ?? ""}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-cv-bullets error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { firstName, lastName, headline, skills, experience, targetJobs, location, language } = await req.json();

  const isAr = language === "ar";

  const expText = (experience ?? [])
    .map((e: any) => `${e.title} at ${e.company} (${e.duration})`)
    .join(", ");

  const prompt = isAr
    ? `أنت خبير كتابة سيرة ذاتية. اكتب ملخصاً مهنياً موجزاً وجذاباً (3-4 جمل) بالعربية لشخص اسمه ${firstName} ${lastName}.
معلوماته:
- المسمى الوظيفي: ${headline || "غير محدد"}
- المهارات: ${(skills ?? []).join("، ") || "غير محددة"}
- الخبرات: ${expText || "غير محددة"}
- الوظائف المستهدفة: ${(targetJobs ?? []).join("، ") || "غير محددة"}
- الموقع: ${location || "غير محدد"}
اكتب الملخص بصيغة المتكلم (أنا...) بأسلوب احترافي ومختصر. لا تذكر الاسم في البداية.`
    : `You are a professional resume writer. Write a concise and compelling professional summary (3-4 sentences) in English for ${firstName} ${lastName}.
Their info:
- Headline: ${headline || "not specified"}
- Skills: ${(skills ?? []).join(", ") || "not specified"}
- Experience: ${expText || "not specified"}
- Target Jobs: ${(targetJobs ?? []).join(", ") || "not specified"}
- Location: ${location || "not specified"}
Write in first person (I am...) in a professional and concise tone. Do not start with the name.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY") ?? ""}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();
  const summary: string = data.choices?.[0]?.message?.content?.trim() ?? "";

  return new Response(JSON.stringify({ summary }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { skills, experience, language } = await req.json();

  const isAr = language === "ar";

  const expText = (experience ?? [])
    .map((e: any) => `${e.title} at ${e.company}`)
    .join(", ");

  const prompt = isAr
    ? `بناءً على هذه المهارات: ${(skills ?? []).join("، ") || "غير محددة"}
والخبرات: ${expText || "غير محددة"}
اقترح 6 مسميات وظيفية مناسبة ومحددة يمكن لهذا الشخص استهدافها في سوق العمل.
أجب فقط بقائمة مرقمة من 6 مسميات وظيفية واضحة ومختصرة باللغة العربية. بدون أي شرح إضافي.`
    : `Based on these skills: ${(skills ?? []).join(", ") || "not specified"}
And experience: ${expText || "not specified"}
Suggest 6 specific and realistic job titles this person could target in the job market.
Reply ONLY with a numbered list of 6 clear and concise job titles in English. No extra explanation.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY") ?? ""}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();
  const raw: string = data.choices?.[0]?.message?.content?.trim() ?? "";

  // Parse numbered list into array
  const titles = raw
    .split("\n")
    .map(l => l.replace(/^\d+[\.\-\)]\s*/, "").trim())
    .filter(l => l.length > 0)
    .slice(0, 6);

  return new Response(JSON.stringify({ titles }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});

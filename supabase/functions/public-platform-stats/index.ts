import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const [generations, users, companies] = await Promise.all([
      admin
        .from("order_generations")
        .select("generation_id", { count: "exact", head: true }),

      admin
        .from("users")
        .select("id", { count: "exact", head: true }),

      admin
        .from("hunter_companies")
        .select("id", { count: "exact", head: true }),
    ]);

    return new Response(
      JSON.stringify({
        resumes: generations.count ?? 0,
        users: users.count ?? 0,
        companies: companies.count ?? 0,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        resumes: 0,
        users: 0,
        companies: 0,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
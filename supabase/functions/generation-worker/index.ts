// generation-worker — internal infrastructure, not a browser endpoint.
//
// POST with header `x-worker-secret: <GENERATION_WORKER_SECRET>`. The body is
// ignored. Each request processes at most ONE job chosen by
// claim_generation_job(). Deployed with verify_jwt = false because no customer
// JWT is ever involved; the dedicated secret is the only way in.
//
// Never logged: secrets, the claim token, prompts, form data, generated CV or
// cover letter content, or any contact details.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore esm.sh default export typing issue (same import as generate-cv)
import HTMLtoDOCX from "https://esm.sh/html-to-docx@1.8.0?target=deno";
import { buildCvDocx } from "../generate-cv/docx/builders/build-cv-docx.ts";
import { DOCX_MIME, handleRequest, STORAGE_BUCKET, type WorkerDeps } from "./worker.ts";
import { createAnthropicChat } from "./anthropic.ts";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const WORKER_SECRET = Deno.env.get("GENERATION_WORKER_SECRET") ?? "";

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const chat = createAnthropicChat({
  apiKey: ANTHROPIC_KEY,
  fetch: (input, init) => fetch(input, init),
  log: (e) => console.log(JSON.stringify(e)),
});

const deps: WorkerDeps = {
  workerSecret: WORKER_SECRET,

  async rpc(name, args) {
    const { data, error } = await db.rpc(name, args);
    return { data, error: error ? { code: error.code } : null };
  },

  async loadForm(formId) {
    const { data, error } = await db
      .from("cv_archive")
      .select("form_id, user_id, submission_id, cv_data")
      .eq("form_id", formId)
      .maybeSingle();
    return { row: data ?? null, error: !!error };
  },

  async isCurrentClaim(jobId, claimToken) {
    const { data, error } = await db
      .from("generation_jobs")
      .select("status, claim_token, lease_expires_at")
      .eq("id", jobId)
      .maybeSingle();
    if (error || !data) return false;
    return data.status === "running" && data.claim_token === claimToken &&
      new Date(data.lease_expires_at).getTime() > Date.now();
  },

  chat,
  buildCvDocx: (cv) => buildCvDocx(cv),
  htmlToDocx: HTMLtoDOCX,

  async upload(path, bytes) {
    const { error } = await db.storage.from(STORAGE_BUCKET).upload(path, bytes, {
      contentType: DOCX_MIME,
      upsert: true,               // idempotent within one attempt's own paths
    });
    return { ok: !error };
  },

  now: () => new Date(),
  log: (e) => console.log(JSON.stringify(e)),
};

Deno.serve(async (req) => {
  // Configuration must be complete before a job is claimed, so an infra fault
  // never burns one of the job's attempts.
  if (!SUPABASE_URL || !SERVICE_KEY || !ANTHROPIC_KEY) {
    console.log(JSON.stringify({ event: "worker_not_configured" }));
    return Response.json({ outcome: "worker_not_configured" }, { status: 503 });
  }
  try {
    const result = await handleRequest(req, deps);
    return Response.json(result.body, { status: result.status });
  } catch (e) {
    console.log(JSON.stringify({ event: "unhandled", kind: e instanceof Error ? e.name : typeof e }));
    return Response.json({ outcome: "internal_error" }, { status: 500 });
  }
});

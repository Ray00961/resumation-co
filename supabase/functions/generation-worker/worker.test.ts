// Offline tests for generation-worker. No network, no database, no model provider:
// the real handleRequest/processJob run against in-memory fakes, and the real
// DOCX builders run on the repository's sample CVs.
//
//   deno test --allow-read --allow-net=esm.sh --no-check=remote supabase/functions/generation-worker/worker.test.ts

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
// @ts-ignore esm.sh default export typing issue
import HTMLtoDOCX from "https://esm.sh/html-to-docx@1.8.0?target=deno";
import { buildCvDocx } from "../generate-cv/docx/builders/build-cv-docx.ts";
import {
  type Claim, CL_MODEL, CV_MODEL, handleRequest, type LogEvent, outputPaths, WORKER_SECRET_HEADER,
  type WorkerDeps,
} from "./worker.ts";
import { toFinalCvJsonV1 } from "./final-cv.ts";
import { coverLetterHtmlToDocx } from "./cover-letter.ts";
import { CL_PROMPT_AR, CL_PROMPT_EN } from "./cover-letter-prompts.ts";
import { CV_JSON_PROMPT_AR_V1 } from "../generate-cv/prompts/cv-json-prompt-ar-v1.ts";
import { CV_JSON_PROMPT_EN_V1 } from "../generate-cv/prompts/cv-json-prompt-en-v1.ts";

const SECRET = "s".repeat(24) + "-worker-secret-0123456789";
const USER = "5c0b2dc5-d041-480f-8aee-beaa4a40db49";
const JOB = "11111111-2222-4333-8444-555555555555";
const TOKEN = "99999999-8888-4777-8666-555555555555";
const ORDER = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const FORM = "250dcbde-ba0a-4969-bd77-fa9fd4aa9702";
const SUB = "7mUvEQ1";

// Personal data that must never appear in logs or responses.
const PII = {
  email: "private.person@example.com", phone: "+201234567890", name: "Private Person",
  summary: "UNIQUE-SUMMARY-MARKER builds reliable systems",
};

const FORM_DATA = {
  fullName: PII.name, cvEmail: PII.email, phone: PII.phone, targetJob: "Data Analyst",
  workExperience: [{ company: "Acme", title: "Analyst" }],
};

function cvJsonFor(lang: "en" | "ar", extra: Record<string, unknown> = {}) {
  return {
    document_language: lang,
    candidate_level: "junior",
    full_name: `  ${PII.name}  `,
    contact: { email: PII.email, phone: PII.phone, linkedin: "", location: "Cairo" },
    contact_line: "",
    target_job: "Data Analyst",
    nationality: "Egyptian",
    summary: PII.summary,
    core_competencies: { technical_skills: ["SQL", " ", "Python"], industry_knowledge: [], professional_skills: ["Reporting"] },
    experience: [{ job_title: "Analyst", company: "Acme", location: "Cairo", date_range: "2022 - Present",
                   bullets: ["Built weekly reports", ""], unexpected_key: "x" }],
    internships: [],
    education: [{ degree: "BSc", major: "Statistics", institution: "Cairo University", location: "", date_range: "2018 - 2022", gpa: "" }],
    certifications: [],
    projects: [],
    languages: [{ language: "English", level: "Fluent" }],
    rogue_top_level_key: "must be dropped",
    ...extra,
  };
}

const EN_LETTER = "<div>" + "I have spent three years building weekly reporting for a regional distributor. ".repeat(8) + "</div>";
const AR_LETTER = "<div>" + "عملت ثلاث سنوات في إعداد التقارير الأسبوعية لشركة توزيع إقليمية وأسعى الآن لدور جديد. ".repeat(8) + "</div>";

interface Recorder {
  rpc: { name: string; args: Record<string, unknown> }[];
  uploads: { path: string; size: number }[];
  chat: { system: string; user: string; model: string }[];
  forms: string[];
  logs: LogEvent[];
  builtCv: unknown[];
}

function claimData(over: Record<string, unknown> = {}) {
  return {
    outcome: "claimed", job_id: JOB, claim_token: TOKEN, attempt_count: 1, max_attempts: 3,
    lease_expires_at: "2026-09-22T01:00:00Z", payment_order_id: ORDER, user_id: USER,
    form_id: FORM, submission_id: SUB, selected_language: "en", ...over,
  };
}

function makeDeps(opts: {
  secret?: string; claim?: unknown; claimError?: boolean;
  form?: Record<string, unknown> | null; formError?: boolean;
  cvRaw?: string; clRaw?: string; chatThrows?: "cv" | "cl" | "cv_timeout" | "cv_max_tokens" | "cl_refusal";
  uploadFails?: "cv" | "cl"; currentClaim?: boolean;
  finalize?: unknown; finalizeError?: boolean; failOutcome?: string;
} = {}): { deps: WorkerDeps; rec: Recorder } {
  const rec: Recorder = { rpc: [], uploads: [], chat: [], forms: [], logs: [], builtCv: [] };
  const claim = opts.claim ?? claimData();
  const lang = (claim as Record<string, unknown>).selected_language === "ar" ? "ar" : "en";
  let chatN = 0;
  const deps: WorkerDeps = {
    workerSecret: opts.secret ?? SECRET,
    async rpc(name, args) {
      rec.rpc.push({ name, args });
      if (name === "claim_generation_job") {
        return opts.claimError ? { data: null, error: { code: "XX000" } } : { data: claim, error: null };
      }
      if (name === "finalize_generation_job") {
        return opts.finalizeError ? { data: null, error: { code: "08006" } }
          : { data: opts.finalize ?? { outcome: "finalized", job_id: JOB }, error: null };
      }
      if (name === "fail_generation_job") {
        return { data: { outcome: opts.failOutcome ?? "requeued", job_id: JOB }, error: null };
      }
      throw new Error(`unexpected rpc ${name}`);
    },
    async loadForm(formId) {
      rec.forms.push(formId);
      if (opts.formError) return { row: null, error: true };
      if (opts.form === null) return { row: null, error: false };
      return {
        row: { form_id: FORM, user_id: USER, submission_id: SUB, cv_data: FORM_DATA, ...(opts.form ?? {}) } as never,
        error: false,
      };
    },
    async isCurrentClaim() { return opts.currentClaim ?? true; },
    async chat(req) {
      rec.chat.push({ system: req.system, user: req.user, model: req.model });
      chatN++;
      if (chatN === 1) {
        if (opts.chatThrows === "cv") throw new Error("model_status_500");
        if (opts.chatThrows === "cv_max_tokens") throw new Error("model_stop_max_tokens");
        if (opts.chatThrows === "cv_timeout") { const e = new Error("aborted"); e.name = "AbortError"; throw e; }
        return opts.cvRaw ?? "```json\n" + JSON.stringify(cvJsonFor(lang)) + "\n```";
      }
      if (opts.chatThrows === "cl") throw new Error("model_status_429");
      if (opts.chatThrows === "cl_refusal") throw new Error("model_stop_refusal");
      return opts.clRaw ?? (lang === "ar" ? AR_LETTER : EN_LETTER);
    },
    async buildCvDocx(cv) { rec.builtCv.push(cv); return new Uint8Array([80, 75, 3, 4]); },
    htmlToDocx: async () => new Uint8Array([80, 75, 3, 4]),
    async upload(path, bytes) {
      rec.uploads.push({ path, size: bytes.byteLength });
      if (opts.uploadFails === "cv" && path.includes("/cv_")) return { ok: false };
      if (opts.uploadFails === "cl" && path.includes("/cover_letter_")) return { ok: false };
      return { ok: true };
    },
    now: () => new Date("2026-09-22T10:00:00Z"),
    log: (e) => rec.logs.push(e),
  };
  return { deps, rec };
}

function req(secret: string | null = SECRET, body: unknown = {}, method = "POST") {
  const headers = new Headers({ "content-type": "application/json" });
  if (secret !== null) headers.set(WORKER_SECRET_HEADER, secret);
  return new Request("https://worker.local/", { method, headers, body: method === "POST" ? JSON.stringify(body) : undefined });
}

const rpcNames = (r: Recorder) => r.rpc.map((x) => x.name);
const failCall = (r: Recorder) => r.rpc.find((x) => x.name === "fail_generation_job");
const finalizeCall = (r: Recorder) => r.rpc.find((x) => x.name === "finalize_generation_job");

// ── A. authentication ────────────────────────────────────────────────────────
Deno.test("A unauthorized: missing / wrong secret → 401, nothing claimed; unconfigured → 503", async () => {
  for (const s of [null, "", "wrong", SECRET + "x", SECRET.slice(0, -1)]) {
    const { deps, rec } = makeDeps();
    const r = await handleRequest(req(s), deps);
    assertEquals(r.status, 401);
    assertEquals(rec.rpc.length, 0);
  }
  const weak = makeDeps({ secret: "short" });
  const r = await handleRequest(req("short"), weak.deps);
  assertEquals(r.status, 503);
  assertEquals(weak.rec.rpc.length, 0);
  const get = makeDeps();
  assertEquals((await handleRequest(req(SECRET, {}, "GET"), get.deps)).status, 405);
  assertEquals(get.rec.rpc.length, 0);
});

// ── B. empty queue ───────────────────────────────────────────────────────────
Deno.test("B empty queue → 200 no_job, one claim call only", async () => {
  const { deps, rec } = makeDeps({ claim: { outcome: "no_job" } });
  const r = await handleRequest(req(), deps);
  assertEquals(r, { status: 200, body: { outcome: "no_job" } });
  assertEquals(rpcNames(rec), ["claim_generation_job"]);
  assertEquals(rec.chat.length, 0);
});

// ── C. the caller cannot choose the job ──────────────────────────────────────
Deno.test("C request body is ignored: DB-claimed job, form, language and paths win", async () => {
  const evil = {
    job_id: "00000000-0000-4000-8000-000000000000", payment_order_id: "x", user_id: "attacker",
    form_id: "00000000-0000-4000-8000-000000000001", submission_id: "evil", selected_language: "ar",
    product: "career_package", amount: 1, entitlement: "cv_generation", storage_path: "../../x.docx",
  };
  const { deps, rec } = makeDeps();
  const r = await handleRequest(req(SECRET, evil), deps);
  assertEquals(r.body.outcome, "succeeded");
  assertEquals(rec.rpc[0], { name: "claim_generation_job", args: {} });
  assertEquals(rec.forms, [FORM]);
  const fin = finalizeCall(rec)!.args;
  assertEquals(fin.p_job_id, JOB);
  assertEquals((fin.p_cv_json as Record<string, unknown>).document_language, "en");
  assert(String(fin.p_cv_storage_path).startsWith(`${USER}/${JOB}/`));
});

// ── D. canonical form provenance ─────────────────────────────────────────────
Deno.test("D exact form provenance required (missing / wrong user / wrong submission / wrong form / empty)", async () => {
  const cases: [Record<string, unknown> | null, string][] = [
    [null, "canonical_form_not_found"],
    [{ user_id: "c5a8b57a-a900-471b-ab9e-21064bdf4c7d" }, "canonical_form_mismatch"],
    [{ submission_id: "OTHER" }, "canonical_form_mismatch"],
    [{ submission_id: null }, "canonical_form_mismatch"],
    [{ form_id: "00000000-0000-4000-8000-000000000009" }, "canonical_form_mismatch"],
    [{ cv_data: {} }, "canonical_form_not_found"],
    [{ cv_data: null }, "canonical_form_not_found"],
  ];
  for (const [form, code] of cases) {
    const { deps, rec } = makeDeps({ form });
    const r = await handleRequest(req(), deps);
    assertEquals(r.body.error_code, code);
    assertEquals(rec.chat.length, 0, "no generation from wrong/partial data");
    assertEquals(rec.uploads.length, 0);
    assertEquals(failCall(rec)!.args.p_error_code, code);
  }
});

// ── E / F. language authority ────────────────────────────────────────────────
Deno.test("E language comes only from the claim (ar claim → Arabic prompts, body 'en' ignored)", async () => {
  const { deps, rec } = makeDeps({ claim: claimData({ selected_language: "ar" }) });
  const r = await handleRequest(req(SECRET, { selected_language: "en" }), deps);
  assertEquals(r.body.outcome, "succeeded");
  assert(rec.chat[0].system.startsWith(CV_JSON_PROMPT_AR_V1.split("{{CV_DATA}}")[0]));
  assert(rec.chat[1].system.startsWith(CL_PROMPT_AR.split("{{cv_data}}")[0]));
  assert(rec.chat[1].user.includes("in Arabic only"));
  assert(String(finalizeCall(rec)!.args.p_cv_storage_path).endsWith("/cv_ar_attempt1.docx"));
});

Deno.test("E2 en claim → English prompts", async () => {
  const { deps, rec } = makeDeps();
  await handleRequest(req(), deps);
  assert(rec.chat[0].system.startsWith(CV_JSON_PROMPT_EN_V1.split("{{CV_DATA}}")[0]));
  assert(rec.chat[1].system.startsWith(CL_PROMPT_EN.split("{{cv_data}}")[0]));
});

Deno.test("F invalid claimed language fails safely before any generation", async () => {
  for (const bad of ["fr", "", null, "EN"]) {
    const { deps, rec } = makeDeps({ claim: claimData({ selected_language: bad }) });
    const r = await handleRequest(req(), deps);
    assertEquals(r.body.error_code, "invalid_language");
    assertEquals(rec.chat.length, 0);
    assertEquals(rec.forms.length, 0);
    assertEquals(failCall(rec)!.args.p_claim_token, TOKEN);
  }
});

// ── G / H. only the final validated CvJsonV1 reaches finalize ────────────────
Deno.test("G raw GPT JSON is never finalized; H finalize gets the normalized CvJsonV1 (same object rendered)", async () => {
  const { deps, rec } = makeDeps();
  await handleRequest(req(), deps);
  const sent = finalizeCall(rec)!.args.p_cv_json as Record<string, unknown>;
  assert(!("rogue_top_level_key" in sent), "unknown top-level key dropped");
  const exp = (sent.experience as Record<string, unknown>[])[0];
  assert(!("unexpected_key" in exp), "unknown nested key dropped");
  assertEquals(sent.full_name, PII.name, "trimmed");
  assertEquals((sent.core_competencies as Record<string, string[]>).technical_skills, ["SQL", "Python"], "blank dropped");
  assertEquals(exp.bullets, ["Built weekly reports"]);
  assert(String(sent.contact_line).length > 0, "legacy normalizer filled contact_line");
  assertEquals(finalizeCall(rec)!.args.p_cv_json_schema_version, "cv-json-v1");
  assertEquals(sent, toFinalCvJsonV1(cvJsonFor("en"), "en") as unknown as Record<string, unknown>);
  assertEquals(rec.builtCv[0], sent, "DOCX rendered from exactly the finalized object");
});

Deno.test("G2 invalid model CV never reaches DOCX, storage or finalize", async () => {
  const bad: [string, string][] = [
    ["not json at all", "cv_parse_failed"],
    ["{ broken json ", "cv_parse_failed"],
    [JSON.stringify(cvJsonFor("ar")), "cv_validation_failed"],                        // wrong language
    [JSON.stringify(cvJsonFor("en", { candidate_level: "wizard" })), "cv_validation_failed"],
    [JSON.stringify(cvJsonFor("en", { summary: "<b>hi</b>" })), "cv_validation_failed"],
    [JSON.stringify(cvJsonFor("en", { experience: ["just a string"] })), "cv_validation_failed"],
    [JSON.stringify(cvJsonFor("en", { experience: [{ job_title: 7 }] })), "cv_validation_failed"],
    [JSON.stringify(cvJsonFor("en", { full_name: "   " })), "cv_validation_failed"],
    [JSON.stringify(cvJsonFor("en", { core_competencies: { technical_skills: [1], industry_knowledge: [], professional_skills: [] } })), "cv_validation_failed"],
  ];
  for (const [raw, code] of bad) {
    const { deps, rec } = makeDeps({ cvRaw: raw });
    const r = await handleRequest(req(), deps);
    assertEquals(r.body.error_code, code, raw.slice(0, 40));
    assertEquals(rec.builtCv.length, 0);
    assertEquals(rec.uploads.length, 0);
    assertEquals(finalizeCall(rec), undefined);
    assertEquals(rec.chat.length, 1, "no cover letter call after a bad CV");
  }
});

Deno.test("G3 section_order + software_tools reach finalize and DOCX; schema version stays cv-json-v1", async () => {
  const cv = cvJsonFor("en", { section_order: ["education", "experience", "summary"] });
  (cv.core_competencies as Record<string, unknown>).software_tools = [" Excel ", ""];
  const { deps, rec } = makeDeps({ cvRaw: JSON.stringify(cv) });
  assertEquals((await handleRequest(req(), deps)).body.outcome, "succeeded");
  const fin = finalizeCall(rec)!.args;
  const sent = fin.p_cv_json as Record<string, unknown>;
  assertEquals(sent.section_order, ["education", "experience", "summary"]);
  assertEquals((sent.core_competencies as Record<string, string[]>).software_tools, ["Excel"]);
  assertEquals(fin.p_cv_json_schema_version, "cv-json-v1");
  assertEquals(rec.builtCv[0], sent);

  const bad = makeDeps({ cvRaw: JSON.stringify(cvJsonFor("en", { section_order: ["summary", "summary"] })) });
  assertEquals((await handleRequest(req(), bad.deps)).body.error_code, "cv_validation_failed");
  assertEquals(finalizeCall(bad.rec), undefined);
  assertEquals(bad.rec.builtCv.length, 0);
});

// ── I. cover letter language + grounding ─────────────────────────────────────
Deno.test("I cover letter: grounded in final CV, frozen language enforced", async () => {
  const ok = makeDeps();
  await handleRequest(req(), ok.deps);
  const clCall = ok.rec.chat[1];
  const cvSent = finalizeCall(ok.rec)!.args.p_cv_json;
  assert(clCall.system.includes(JSON.stringify({ final_cv: cvSent }, null, 2)), "CL data input is the final CV");
  assert(!clCall.system.includes("workExperience"), "raw form not given to the CL model");
  assert(clCall.user.includes("in English only"));
  assertEquals(clCall.model, CL_MODEL.model);

  const wrongLang = makeDeps({ claim: claimData({ selected_language: "ar" }), clRaw: EN_LETTER });
  assertEquals((await handleRequest(req(), wrongLang.deps)).body.error_code, "cover_letter_validation_failed");
  const wrongLang2 = makeDeps({ clRaw: AR_LETTER });
  assertEquals((await handleRequest(req(), wrongLang2.deps)).body.error_code, "cover_letter_validation_failed");
  const script = makeDeps({ clRaw: EN_LETTER.replace("</div>", "<script>x</script></div>") });
  assertEquals((await handleRequest(req(), script.deps)).body.error_code, "cover_letter_validation_failed");
  const short = makeDeps({ clRaw: "<div>Hi</div>" });
  assertEquals((await handleRequest(req(), short.deps)).body.error_code, "cover_letter_validation_failed");
  const noDiv = makeDeps({ clRaw: "plain text letter" });
  assertEquals((await handleRequest(req(), noDiv.deps)).body.error_code, "cover_letter_validation_failed");
  for (const d of [wrongLang, wrongLang2, script, short, noDiv]) assertEquals(d.rec.uploads.length, 0);
});

// ── J / K. deterministic, confined storage paths ─────────────────────────────
Deno.test("J deterministic paths {user}/{job}/cv|cover_letter_{lang}_attempt{n}.docx", async () => {
  const { deps, rec } = makeDeps({ claim: claimData({ attempt_count: 2 }) });
  await handleRequest(req(), deps);
  assertEquals(rec.uploads.map((u) => u.path), [
    `${USER}/${JOB}/cv_en_attempt2.docx`, `${USER}/${JOB}/cover_letter_en_attempt2.docx`,
  ]);
  const fin = finalizeCall(rec)!.args;
  assertEquals(fin.p_cv_storage_path, `${USER}/${JOB}/cv_en_attempt2.docx`);
  assertEquals(fin.p_cover_letter_storage_path, `${USER}/${JOB}/cover_letter_en_attempt2.docx`);
  // Same claim → same paths (idempotent upsert); different attempt → different objects.
  const a = outputPaths({ ...claimData(), attempt_count: 1 } as unknown as Claim);
  const b = outputPaths({ ...claimData(), attempt_count: 1 } as unknown as Claim);
  const c = outputPaths({ ...claimData(), attempt_count: 2 } as unknown as Claim);
  assertEquals(a, b);
  assert(a.cv !== c.cv && a.coverLetter !== c.coverLetter);
});

Deno.test("K a malformed claim can never produce an escaping path", async () => {
  for (const bad of [{ user_id: "../other-user" }, { job_id: "../../x" }, { user_id: "a/b" }, { form_id: "nope" }]) {
    const { deps, rec } = makeDeps({ claim: claimData(bad) });
    const r = await handleRequest(req(), deps);
    assert(["invalid_claim", "claim_error"].includes(String(r.body.error_code ?? r.body.outcome)));
    assertEquals(rec.uploads.length, 0);
    assertEquals(rec.chat.length, 0);
  }
});

// ── L / M. upload failures ───────────────────────────────────────────────────
Deno.test("L CV upload failure → fail RPC, no finalize", async () => {
  const { deps, rec } = makeDeps({ uploadFails: "cv" });
  const r = await handleRequest(req(), deps);
  assertEquals(r.body.error_code, "storage_upload_failed");
  assertEquals(finalizeCall(rec), undefined);
  assertEquals(failCall(rec)!.args.p_error_code, "storage_upload_failed");
  assertEquals(rec.uploads.length, 1);
});

Deno.test("M cover letter upload failure → fail RPC, no finalize", async () => {
  const { deps, rec } = makeDeps({ uploadFails: "cl" });
  const r = await handleRequest(req(), deps);
  assertEquals(r.body.error_code, "storage_upload_failed");
  assertEquals(finalizeCall(rec), undefined);
  assertEquals(failCall(rec)!.args.p_error_message, "cover letter upload failed");
  assertEquals(rec.uploads.length, 2);
});

// ── N / O. the claim token is passed through unchanged ───────────────────────
Deno.test("N finalize uses the same job id + claim token", async () => {
  const { deps, rec } = makeDeps();
  await handleRequest(req(), deps);
  assertEquals(finalizeCall(rec)!.args.p_job_id, JOB);
  assertEquals(finalizeCall(rec)!.args.p_claim_token, TOKEN);
});

Deno.test("O fail uses the same job id + claim token", async () => {
  const { deps, rec } = makeDeps({ chatThrows: "cv" });
  const r = await handleRequest(req(), deps);
  assertEquals(r.body.error_code, "cv_generation_failed");
  assertEquals(failCall(rec)!.args.p_job_id, JOB);
  assertEquals(failCall(rec)!.args.p_claim_token, TOKEN);
});

Deno.test("O2 model failures (CV or cover letter) → fail RPC with a neutral message; no upload, no finalize", async () => {
  const cases: [Parameters<typeof makeDeps>[0], string, string, number][] = [
    [{ chatThrows: "cv_max_tokens" }, "cv_generation_failed", "model output truncated", 1],
    [{ chatThrows: "cv" }, "cv_generation_failed", "model request failed (500)", 1],
    [{ chatThrows: "cl_refusal" }, "cover_letter_generation_failed", "model refused", 2],
    [{ chatThrows: "cl" }, "cover_letter_generation_failed", "model request failed (429)", 2],
  ];
  for (const [opts, code, message, chatCalls] of cases) {
    const { deps, rec } = makeDeps(opts);
    const r = await handleRequest(req(), deps);
    assertEquals(r.body.outcome, "failed");
    assertEquals(r.body.error_code, code);
    assertEquals(failCall(rec)!.args.p_error_code, code);
    assertEquals(failCall(rec)!.args.p_error_message, message);
    assertEquals(rec.chat.length, chatCalls, "no extra model call, no in-process retry");
    assertEquals(rec.uploads.length, 0);
    assertEquals(rec.builtCv.length, 0);
    assertEquals(finalizeCall(rec), undefined, "finalize (the only entitlement consumer) is never called");
  }
});

// ── P. stale workers never interfere ─────────────────────────────────────────
Deno.test("P stale claim: finalize says stale/expired → no fail call; lost claim → no upload", async () => {
  for (const outcome of ["rejected_stale_claim", "rejected_lease_expired", "job_not_found"]) {
    const { deps, rec } = makeDeps({ finalize: { outcome } });
    const r = await handleRequest(req(), deps);
    assertEquals(r.body.outcome, "stale_claim");
    assertEquals(failCall(rec), undefined, "never mutates another claim");
  }
  const lost = makeDeps({ currentClaim: false });
  const r = await handleRequest(req(), lost.deps);
  assertEquals(r.body.outcome, "stale_claim");
  assertEquals(lost.rec.uploads.length, 0, "no upload for a claim that is no longer ours");
  assertEquals(finalizeCall(lost.rec), undefined);
  assertEquals(failCall(lost.rec), undefined);
});

Deno.test("P2 other finalize rejections → finalize_rejected via fail; transport error → fail (DB decides)", async () => {
  for (const outcome of ["rejected_output_missing", "rejected_entitlement_unavailable", "conflict_already_finalized", "rejected_invalid_output"]) {
    const { deps, rec } = makeDeps({ finalize: { outcome } });
    const r = await handleRequest(req(), deps);
    assertEquals(r.body.error_code, "finalize_rejected");
    assertEquals(failCall(rec)!.args.p_claim_token, TOKEN);
  }
  const net = makeDeps({ finalizeError: true });
  assertEquals((await handleRequest(req(), net.deps)).body.error_code, "finalize_rejected");
  assert(failCall(net.rec));
  const ok2 = makeDeps({ finalize: { outcome: "already_finalized" } });
  assertEquals((await handleRequest(req(), ok2.deps)).body.outcome, "succeeded");
});

// ── Q. no PII / secrets / content in logs, responses or DB error messages ────
Deno.test("Q logs, responses and fail messages carry no PII, secrets, prompts or content", async () => {
  const scenarios = [
    makeDeps(), makeDeps({ chatThrows: "cv" }), makeDeps({ chatThrows: "cl" }), makeDeps({ chatThrows: "cv_timeout" }),
    makeDeps({ uploadFails: "cl" }), makeDeps({ finalize: { outcome: "rejected_stale_claim" } }),
    makeDeps({ cvRaw: JSON.stringify(cvJsonFor("en", { summary: "<i>" + PII.summary + "</i>" })) }),
    makeDeps({ form: { user_id: "c5a8b57a-a900-471b-ab9e-21064bdf4c7d" } }),
  ];
  for (const { deps, rec } of scenarios) {
    const r = await handleRequest(req(), deps);
    const failArgs = failCall(rec)?.args ?? {};
    // The token is legitimately an RPC argument; what must stay clean is what is
    // logged, returned, or stored in generation_jobs (error code + message).
    const blob = JSON.stringify({ logs: rec.logs, body: r.body, code: failArgs.p_error_code, msg: failArgs.p_error_message });
    for (const secret of [SECRET, TOKEN, PII.email, PII.phone, PII.name, "UNIQUE-SUMMARY-MARKER", "Senior Professional Cover Letter Writer", "CV_JSON_PROMPT"]) {
      assert(!blob.includes(secret), `leaked: ${secret.slice(0, 12)}`);
    }
    assert(String(failArgs.p_error_message ?? "").length <= 300);
  }
  const t = makeDeps({ chatThrows: "cv_timeout" });
  await handleRequest(req(), t.deps);
  assertEquals(failCall(t.rec)!.args.p_error_message, "model request timed out");
  const s = makeDeps({ chatThrows: "cl" });
  await handleRequest(req(), s.deps);
  assertEquals(failCall(s.rec)!.args.p_error_message, "model request failed (429)");
});

// ── R / S / T / U. bounded scope of writes ───────────────────────────────────
Deno.test("R exactly one job per invocation; bounded model calls", async () => {
  const { deps, rec } = makeDeps();
  await handleRequest(req(), deps);
  assertEquals(rpcNames(rec).filter((n) => n === "claim_generation_job").length, 1);
  assertEquals(rpcNames(rec), ["claim_generation_job", "finalize_generation_job"]);
  assertEquals(rec.chat.length, 2, "one CV call + one cover letter call");
  assertEquals(rec.chat[0].model, CV_MODEL.model);
  assertEquals(rec.uploads.length, 2);
});

Deno.test("S/T/U the worker source writes only storage + the 3 RPCs (no entitlement/payment/profile writes)", async () => {
  const dir = new URL(".", import.meta.url);
  const src = ["index.ts", "worker.ts", "final-cv.ts", "cover-letter.ts", "anthropic.ts"]
    .map((f) => Deno.readTextFileSync(new URL(f, dir))).join("\n");
  // Checked on the raw source: the comment stripper below also cuts URLs at "//".
  for (const t of ["api.openai.com", "OPENAI_API_KEY", "openai_status_", "temperature"]) {
    assert(!src.includes(t), `worker source still references ${t}`);
  }
  assert(src.includes('"https://api.anthropic.com/v1/messages"'));
  const code = src.replace(/\/\/.*$/gm, "");
  assert(!/\.(insert|update|delete)\s*\(/.test(code), "no table insert/update/delete");
  assert(!/\.upsert\s*\(/.test(code), "no table upsert");
  const froms = [...code.matchAll(/\.from\(\s*"([^"]+)"\s*\)/g)].map((m) => m[1]).sort();
  assertEquals(froms, ["cv_archive", "generation_jobs"], "only reads these two tables");
  const rpcs = [...code.matchAll(/rpc\(\s*"([^"]+)"/g)].map((m) => m[1]).sort();
  assertEquals([...new Set(rpcs)], ["claim_generation_job", "fail_generation_job", "finalize_generation_job"]);
  for (const t of ["entitlement", "payment_orders", "profiles", "invoices", "order_generations", "active_plan", "signedUrl", "createSignedUrl"]) {
    assert(!code.includes(t), `worker code references ${t}`);
  }
});

// ── Real builders on the repository sample CVs (no network beyond esm.sh) ─────
const SAMPLES = [
  ["professional-cv.sample.json", "en"], ["fresh-graduate-cv.sample.json", "en"],
  ["arabic-professional-cv.sample.json", "ar"], ["arabic-fresh-graduate-cv.sample.json", "ar"],
] as const;

Deno.test("DOCX: real buildCvDocx renders every template from the final CvJsonV1", async () => {
  for (const [file, lang] of SAMPLES) {
    const raw = JSON.parse(Deno.readTextFileSync(new URL(`../generate-cv/test-data/${file}`, import.meta.url)).replace(/^﻿/, ""));
    const finalCv = toFinalCvJsonV1(raw, lang);
    const bytes = await buildCvDocx(finalCv);
    assert(bytes.byteLength > 2000, file);
    assertEquals([bytes[0], bytes[1]], [0x50, 0x4b], `${file} is a zip/docx`);
  }
});

Deno.test("DOCX: real html-to-docx builds English and Arabic cover letters", async () => {
  for (const [html, lang] of [[EN_LETTER, "en"], [AR_LETTER, "ar"]] as const) {
    const bytes = await coverLetterHtmlToDocx(HTMLtoDOCX, html, lang);
    assert(bytes.byteLength > 2000);
    assertEquals([bytes[0], bytes[1]], [0x50, 0x4b]);
  }
});

Deno.test("Prompts: CV placeholders present once; Arabic CL prompt is real Arabic", () => {
  assertEquals(CV_JSON_PROMPT_EN_V1.split("{{CV_DATA}}").length, 2);
  assertEquals(CV_JSON_PROMPT_AR_V1.split("{{CV_DATA}}").length, 2);
  assertEquals(CL_PROMPT_EN.split("{{cv_data}}").length, 2);
  assertEquals(CL_PROMPT_AR.split("{{cv_data}}").length, 2);
  assert((CL_PROMPT_AR.match(/[؀-ۿ]/g) ?? []).length > 4000);
  assert(!/[ÃØÙ]{2}/.test(CL_PROMPT_AR), "no mojibake");
});

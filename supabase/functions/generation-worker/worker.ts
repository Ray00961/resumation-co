// generation-worker core. Processes AT MOST ONE generation job per request.
//
// Authority lives in the database:
//   claim_generation_job()     chooses the job and issues the claim token
//   finalize_generation_job()  validates outputs, consumes entitlements, succeeds
//   fail_generation_job()      decides retry vs terminal failure
// This module never writes generation_jobs, entitlements, payments or profiles
// itself. Its only writes are the two DOCX objects and those three RPC calls.
//
// All I/O is injected (WorkerDeps) so the exact same logic runs in production
// and in the offline tests.

import type { CvJsonV1 } from "../generate-cv/schemas/cv-json-v1.ts";
import { CV_JSON_PROMPT_AR_V1 } from "../generate-cv/prompts/cv-json-prompt-ar-v1.ts";
import { CV_JSON_PROMPT_EN_V1 } from "../generate-cv/prompts/cv-json-prompt-en-v1.ts";
import { CV_JSON_SCHEMA_VERSION, extractJsonObject, toFinalCvJsonV1 } from "./final-cv.ts";
import {
  buildCoverLetterMessages, coverLetterHtmlToDocx, extractDiv, validateCoverLetterHtml,
  type HtmlToDocx,
} from "./cover-letter.ts";
import { safeFailMessage, StageError } from "./errors.ts";

export const WORKER_SECRET_HEADER = "x-worker-secret";
export const STORAGE_BUCKET = "cv-documents";
export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Claude Sonnet 5 with thinking disabled (see anthropic.ts); it rejects
// non-default sampling parameters, so none are sent. Timeouts keep one attempt
// well inside the 10-minute database lease (worst case ≈ 5.5 minutes).
export const CV_MODEL = { model: "claude-sonnet-5", maxTokens: 8192, timeoutMs: 180_000 };
export const CL_MODEL = { model: "claude-sonnet-5", maxTokens: 4096, timeoutMs: 120_000 };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FILE_RE = /^[^/]+\/[^/]+\/[A-Za-z0-9._-]{1,200}\.docx$/;

export interface ChatRequest {
  model: string; maxTokens: number; timeoutMs: number;
  system: string; user: string;
}

export interface FormRow {
  form_id: string; user_id: string; submission_id: string | null; cv_data: unknown;
}

export interface LogEvent {
  event: string;
  job_id?: string; payment_order_id?: string; attempt?: number;
  stage?: string; error_code?: string; outcome?: string; ms?: number;
  [k: string]: string | number | boolean | undefined;
}

export interface WorkerDeps {
  /** GENERATION_WORKER_SECRET; empty when not configured. */
  workerSecret: string;
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { code?: string } | null }>;
  loadForm(formId: string): Promise<{ row: FormRow | null; error: boolean }>;
  /** True while this claim is still the job's current, unexpired claim. */
  isCurrentClaim(jobId: string, claimToken: string): Promise<boolean>;
  chat(req: ChatRequest): Promise<string>;
  buildCvDocx(cv: CvJsonV1): Promise<Uint8Array>;
  htmlToDocx: HtmlToDocx;
  upload(path: string, bytes: Uint8Array): Promise<{ ok: boolean }>;
  now(): Date;
  log(e: LogEvent): void;
}

export interface Claim {
  job_id: string; claim_token: string; attempt_count: number; max_attempts: number;
  payment_order_id: string; user_id: string; form_id: string; submission_id: string;
  selected_language: "en" | "ar";
}

export type WorkerResult =
  | { status: number; body: { outcome: string; job_id?: string; error_code?: string; fail_outcome?: string } };

// ── Authentication ──────────────────────────────────────────────────────────

/** Constant-time comparison: both sides are hashed to equal-length digests first. */
export async function secretMatches(provided: string, expected: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(provided)),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

// ── Deterministic storage paths ─────────────────────────────────────────────

/**
 * {user_id}/{job_id}/cv_{lang}_attempt{n}.docx and
 * {user_id}/{job_id}/cover_letter_{lang}_attempt{n}.docx
 *
 * The attempt number makes each CLAIM own its own pair of objects: a stale
 * worker (older attempt) can never overwrite the files a newer claim uploads
 * or finalized. Within one attempt the upload is an idempotent upsert.
 * At most max_attempts (3) pairs can ever exist per job.
 */
export function outputPaths(claim: Claim): { cv: string; coverLetter: string } {
  const base = `${claim.user_id}/${claim.job_id}/`;
  const tag = `${claim.selected_language}_attempt${claim.attempt_count}`;
  const paths = { cv: `${base}cv_${tag}.docx`, coverLetter: `${base}cover_letter_${tag}.docx` };
  for (const p of [paths.cv, paths.coverLetter]) {
    if (!p.startsWith(base) || !FILE_RE.test(p) || p.includes("..")) {
      throw new StageError("internal_error", "computed storage path is invalid");
    }
  }
  return paths;
}

// ── Claim parsing ───────────────────────────────────────────────────────────

function parseClaim(data: unknown): Claim | { partial: { job_id?: string; claim_token?: string }; code: "invalid_claim" | "invalid_language" } {
  const d = (data ?? {}) as Record<string, unknown>;
  const job_id = typeof d.job_id === "string" && UUID_RE.test(d.job_id) ? d.job_id : undefined;
  const claim_token = typeof d.claim_token === "string" && UUID_RE.test(d.claim_token) ? d.claim_token : undefined;
  const ids = ["payment_order_id", "user_id", "form_id"].every(
    (k) => typeof d[k] === "string" && UUID_RE.test(d[k] as string),
  );
  const sub = typeof d.submission_id === "string" && d.submission_id.trim().length > 0;
  const attempts = Number.isInteger(d.attempt_count) && Number.isInteger(d.max_attempts);

  if (!job_id || !claim_token || !ids || !sub || !attempts) {
    return { partial: { job_id, claim_token }, code: "invalid_claim" };
  }
  if (d.selected_language !== "en" && d.selected_language !== "ar") {
    return { partial: { job_id, claim_token }, code: "invalid_language" };
  }
  return {
    job_id, claim_token,
    attempt_count: d.attempt_count as number, max_attempts: d.max_attempts as number,
    payment_order_id: d.payment_order_id as string, user_id: d.user_id as string,
    form_id: d.form_id as string, submission_id: d.submission_id as string,
    selected_language: d.selected_language as "en" | "ar",
  };
}

// ── Request entry point ─────────────────────────────────────────────────────

export async function handleRequest(req: Request, deps: WorkerDeps): Promise<WorkerResult> {
  if (req.method !== "POST") return { status: 405, body: { outcome: "method_not_allowed" } };

  // Fail closed when the secret is missing or too weak to be meaningful.
  if (deps.workerSecret.length < 32) {
    deps.log({ event: "worker_not_configured" });
    return { status: 503, body: { outcome: "worker_not_configured" } };
  }
  const provided = req.headers.get(WORKER_SECRET_HEADER) ?? "";
  if (!provided || !(await secretMatches(provided, deps.workerSecret))) {
    return { status: 401, body: { outcome: "unauthorized" } };
  }

  // The request body is deliberately never read: the database chooses the job.

  const claimRes = await deps.rpc("claim_generation_job", {});
  if (claimRes.error) {
    deps.log({ event: "claim_error", error_code: claimRes.error.code ?? "unknown" });
    return { status: 500, body: { outcome: "claim_error" } };
  }
  const outcome = (claimRes.data as Record<string, unknown> | null)?.outcome;
  if (outcome === "no_job") {
    deps.log({ event: "no_job" });
    return { status: 200, body: { outcome: "no_job" } };
  }
  if (outcome !== "claimed") {
    deps.log({ event: "claim_unexpected" });
    return { status: 500, body: { outcome: "claim_error" } };
  }

  const parsed = parseClaim(claimRes.data);
  if ("partial" in parsed) {
    const { job_id, claim_token } = parsed.partial;
    deps.log({ event: "claim_invalid", job_id, error_code: parsed.code });
    if (job_id && claim_token) {
      const f = await reportFailure(deps, job_id, claim_token,
        new StageError(parsed.code, parsed.code === "invalid_language" ? "claimed job has no valid language" : "claim response was incomplete"));
      return { status: 200, body: { outcome: "failed", job_id, error_code: parsed.code, fail_outcome: f } };
    }
    return { status: 500, body: { outcome: "claim_error" } };
  }

  return await processJob(parsed, deps);
}

// ── One job ─────────────────────────────────────────────────────────────────

export async function processJob(claim: Claim, deps: WorkerDeps): Promise<WorkerResult> {
  const ctx = { job_id: claim.job_id, payment_order_id: claim.payment_order_id, attempt: claim.attempt_count };
  const started = Date.now();
  let stage = "start";
  const mark = (s: string) => { stage = s; deps.log({ event: "stage", ...ctx, stage: s, ms: Date.now() - started }); };

  try {
    // 1. The exact canonical form: form_id, user_id AND submission_id must all match.
    mark("load_form");
    const { row, error } = await deps.loadForm(claim.form_id);
    if (error) throw new StageError("internal_error", "form lookup failed");
    if (!row) throw new StageError("canonical_form_not_found", "no cv_archive row for the claimed form");
    if (row.form_id !== claim.form_id || row.user_id !== claim.user_id ||
        (row.submission_id ?? "") !== claim.submission_id) {
      throw new StageError("canonical_form_mismatch", "cv_archive provenance differs from the claimed job");
    }
    if (!row.cv_data || typeof row.cv_data !== "object" || Array.isArray(row.cv_data) ||
        Object.keys(row.cv_data as object).length === 0) {
      throw new StageError("canonical_form_not_found", "claimed form has no cv_data");
    }

    const language = claim.selected_language; // the ONLY language authority

    // 2. CV: model → parse → validate → normalize. Only the final object survives.
    mark("cv_generate");
    const cvPrompt = (language === "ar" ? CV_JSON_PROMPT_AR_V1 : CV_JSON_PROMPT_EN_V1)
      .replace("{{CV_DATA}}", JSON.stringify(row.cv_data, null, 2));
    let rawCv: string;
    try {
      rawCv = await deps.chat({
        ...CV_MODEL, system: cvPrompt,
        user: "Plan type: Paid — career_package plan (Full CV)\n\nGenerate the CV_JSON_V1 now. Return valid JSON only.",
      });
    } catch (e) {
      throw new StageError("cv_generation_failed", describeChatError(e));
    }
    mark("cv_validate");
    const finalCv = toFinalCvJsonV1(extractJsonObject(rawCv), language);

    // 3. Cover letter grounded in the FINAL CV, same frozen language.
    mark("cover_letter_generate");
    const letterDate = deps.now().toISOString().slice(0, 10);
    const cl = buildCoverLetterMessages(finalCv, language, letterDate);
    let rawCl: string;
    try {
      rawCl = await deps.chat({ ...CL_MODEL, system: cl.system, user: cl.user });
    } catch (e) {
      throw new StageError("cover_letter_generation_failed", describeChatError(e));
    }
    mark("cover_letter_validate");
    const clHtml = validateCoverLetterHtml(extractDiv(rawCl), language);

    // 4. DOCX, sequentially (html-to-docx is memory heavy in the edge runtime).
    mark("cv_docx");
    let cvBytes: Uint8Array;
    try {
      cvBytes = await deps.buildCvDocx(finalCv);
    } catch {
      throw new StageError("cv_docx_failed", "CV DOCX builder threw");
    }
    if (!cvBytes.byteLength) throw new StageError("cv_docx_failed", "CV DOCX is empty");

    mark("cover_letter_docx");
    const clBytes = await coverLetterHtmlToDocx(deps.htmlToDocx, clHtml, language);

    // 5. Do not upload for a claim that is no longer ours.
    mark("claim_check");
    if (!(await deps.isCurrentClaim(claim.job_id, claim.claim_token))) {
      deps.log({ event: "stale_claim", ...ctx, stage });
      return { status: 200, body: { outcome: "stale_claim", job_id: claim.job_id } };
    }

    // 6. Upload to this claim's own deterministic paths.
    const paths = outputPaths(claim);
    mark("cv_upload");
    if (!(await deps.upload(paths.cv, cvBytes)).ok) {
      throw new StageError("storage_upload_failed", "CV upload failed");
    }
    mark("cover_letter_upload");
    if (!(await deps.upload(paths.coverLetter, clBytes)).ok) {
      throw new StageError("storage_upload_failed", "cover letter upload failed");
    }

    // 7. Finalize: the database verifies everything and consumes entitlements.
    mark("finalize");
    const fin = await deps.rpc("finalize_generation_job", {
      p_job_id: claim.job_id,
      p_claim_token: claim.claim_token,
      p_cv_json: finalCv,
      p_cv_storage_path: paths.cv,
      p_cover_letter_storage_path: paths.coverLetter,
      p_cv_json_schema_version: CV_JSON_SCHEMA_VERSION,
    });
    if (fin.error) {
      // Unknown whether it committed. fail_generation_job is safe either way:
      // on a succeeded job it is rejected; otherwise it requeues.
      throw new StageError("finalize_rejected", "finalize call failed");
    }
    const finOutcome = String((fin.data as Record<string, unknown> | null)?.outcome ?? "");

    if (finOutcome === "finalized" || finOutcome === "already_finalized") {
      deps.log({ event: "succeeded", ...ctx, outcome: finOutcome, ms: Date.now() - started });
      return { status: 200, body: { outcome: "succeeded", job_id: claim.job_id } };
    }
    if (finOutcome === "rejected_stale_claim" || finOutcome === "rejected_lease_expired" ||
        finOutcome === "job_not_found") {
      // Another claim owns the job now (or ours lapsed). Never touch it.
      deps.log({ event: "stale_claim", ...ctx, stage, outcome: finOutcome });
      return { status: 200, body: { outcome: "stale_claim", job_id: claim.job_id } };
    }
    throw new StageError("finalize_rejected", `finalize returned ${finOutcome.slice(0, 60) || "no outcome"}`);

  } catch (err) {
    const f = await reportFailure(deps, claim.job_id, claim.claim_token, err, ctx, stage);
    const { code } = safeFailMessage(err);
    return { status: 200, body: { outcome: "failed", job_id: claim.job_id, error_code: code, fail_outcome: f } };
  }
}

async function reportFailure(
  deps: WorkerDeps, jobId: string, claimToken: string, err: unknown,
  ctx: Record<string, string | number> = {}, stage = "claim",
): Promise<string> {
  const { code, message } = safeFailMessage(err);
  const res = await deps.rpc("fail_generation_job", {
    p_job_id: jobId,
    p_claim_token: claimToken,
    p_error_code: code,
    p_error_message: message,
  });
  const outcome = res.error ? "fail_call_error"
    : String((res.data as Record<string, unknown> | null)?.outcome ?? "unknown");
  deps.log({ event: "job_failed", ...ctx, job_id: jobId, stage, error_code: code, outcome });
  return outcome;
}

/** A short, content-free description of a chat failure. */
function describeChatError(e: unknown): string {
  if (e instanceof Error && e.name === "AbortError") return "model request timed out";
  if (e instanceof Error) {
    const m = e.message;
    if (/^model_status_\d{3}$/.test(m)) return `model request failed (${m.slice(13)})`;
    if (m === "model_stop_max_tokens") return "model output truncated";
    if (m === "model_stop_refusal") return "model refused";
    if (m === "model_empty_response") return "model returned no text";
  }
  return "model request failed";
}

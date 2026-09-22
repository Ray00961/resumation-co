// Cover letter: prompt grounded in the FINAL CvJsonV1, output validation, DOCX.

import type { CvJsonV1 } from "../generate-cv/schemas/cv-json-v1.ts";
import { CL_PROMPT_AR, CL_PROMPT_EN } from "./cover-letter-prompts.ts";
import { StageError } from "./errors.ts";

/**
 * System + user messages. The only data given to the model is the final,
 * validated CV, so the letter cannot contradict it. The career form holds no
 * job description or target company, so no form context is added.
 */
export function buildCoverLetterMessages(cv: CvJsonV1, language: "en" | "ar", letterDate: string) {
  const system = (language === "ar" ? CL_PROMPT_AR : CL_PROMPT_EN)
    .replace("{{cv_data}}", JSON.stringify({ final_cv: cv }, null, 2));

  const user =
    "The DATA INPUT is the candidate's FINAL, already-validated CV (final_cv). " +
    "It is the single source of truth: every name, employer, job title, date, degree, " +
    "certification, skill and number in the letter must come from it. Do not state or infer " +
    "anything that is not in it. No job description and no target company are provided; " +
    "write toward final_cv.target_job. " +
    `Letter date: ${letterDate} (write it naturally in the letter's language). ` +
    `Write the letter in ${language === "ar" ? "Arabic" : "English"} only.\n\n` +
    "Generate the cover letter now.";

  return { system, user };
}

/** Same extraction as the legacy generator: strip fences, take the <div> block. */
export function extractDiv(raw: string): string {
  const s = String(raw || "").replace(/^```html?\n?/im, "").replace(/\n?```$/m, "").trim();
  if (s.startsWith("<div")) return s;
  const m = s.match(/<div[\s\S]*<\/div>/i);
  if (m) return m[0];
  throw new StageError("cover_letter_validation_failed", "model output contained no <div> block");
}

const ARABIC_LETTER = /[؀-ۿ]/g;
const LATIN_LETTER = /[A-Za-z]/g;

/** Rejects empty, scripted or wrong-language letters. */
export function validateCoverLetterHtml(html: string, language: "en" | "ar"): string {
  if (/<script|<iframe|<object|<embed|javascript:/i.test(html)) {
    throw new StageError("cover_letter_validation_failed", "letter contains active content");
  }
  const text = html.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
  if (text.length < 400) {
    throw new StageError("cover_letter_validation_failed", "letter text is too short");
  }
  const arabic = (text.match(ARABIC_LETTER) || []).length;
  const latin = (text.match(LATIN_LETTER) || []).length;
  const arabicShare = arabic / Math.max(1, arabic + latin);
  // Arabic letters may keep Latin emails/URLs/brands; English letters must not be Arabic.
  if (language === "ar" && arabicShare < 0.6) {
    throw new StageError("cover_letter_validation_failed", "letter is not in Arabic");
  }
  if (language === "en" && arabicShare > 0.02) {
    throw new StageError("cover_letter_validation_failed", "letter is not in English");
  }
  return html;
}

// ── HTML → DOCX: same library, version and options as the legacy generator ──

function normalizeHtmlForDocx(innerHtml: string): string {
  return String(innerHtml || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*>/gi, "<br />")
    .replace(/<hr\s*>/gi, "<hr />")
    .replace(/&(?!amp;|lt;|gt;|quot;|apos;|nbsp;|#\d+;|#x[0-9a-fA-F]+;)/g, "&amp;")
    .trim();
}

export function wrapHtmlForDocx(innerHtml: string, language: "en" | "ar"): string {
  const isArabic = language === "ar";
  return `<!DOCTYPE html>
<html ${isArabic ? 'dir="rtl" lang="ar"' : 'lang="en"'}>
<head>
  <meta charset="utf-8" />
  <style>
    body {
      font-family: Calibri, Arial, sans-serif;
      color: #000000;
      ${isArabic ? "direction: rtl; text-align: right;" : ""}
    }
  </style>
</head>
<body>
${normalizeHtmlForDocx(innerHtml)}
</body>
</html>`;
}

export type HtmlToDocx = (html: string, header: undefined, options: Record<string, unknown>) => Promise<unknown>;

export async function coverLetterHtmlToDocx(
  convert: HtmlToDocx, innerHtml: string, language: "en" | "ar",
): Promise<Uint8Array> {
  let result: unknown;
  try {
    result = await convert(wrapHtmlForDocx(innerHtml, language), undefined, {
      table: { row: { cantSplit: true } },
      footer: false,
      pageNumber: false,
    });
  } catch {
    throw new StageError("cover_letter_docx_failed", "html-to-docx conversion threw");
  }

  let bytes: Uint8Array;
  if (result instanceof Uint8Array) bytes = result;
  else if (result instanceof ArrayBuffer) bytes = new Uint8Array(result);
  else if (typeof Blob !== "undefined" && result instanceof Blob) bytes = new Uint8Array(await result.arrayBuffer());
  else bytes = new Uint8Array(result as ArrayBufferLike);

  if (!bytes.byteLength) {
    throw new StageError("cover_letter_docx_failed", "conversion produced an empty file");
  }
  return bytes;
}

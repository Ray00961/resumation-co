// Raw GPT output → the FINAL, validated, normalized CvJsonV1.
//
// This is the only object the worker ever renders or sends to
// finalize_generation_job. Raw model output never leaves this module.
//
//   1. extractJsonObject   : text → parsed JSON               (cv_parse_failed)
//   2. validateCvJsonV1    : legacy top-level schema check     (cv_validation_failed)
//   3. strict deep checks  : every array item, every string,
//                            no HTML, frozen language          (cv_validation_failed)
//   4. rebuild             : only CvJsonV1 keys, trimmed strings,
//                            empty strings/items dropped
//   5. normalizeCvJsonV1   : legacy normalizer (contact_line fallback)

import type {
  CvJsonV1, CvSectionKey, ExperienceItem, EducationItem, CertificationItem, ProjectItem, LanguageItem,
} from "../generate-cv/schemas/cv-json-v1.ts";
import { validateCvJsonV1 } from "../generate-cv/validators/validate-cv-json.ts";
import { normalizeCvJsonV1 } from "../generate-cv/validators/normalize-cv-json.ts";
import { StageError } from "./errors.ts";

export const CV_JSON_SCHEMA_VERSION = "cv-json-v1";

const HTML_RE = /<[a-z!/][\s\S]*?>/i;

/** Same tolerant extraction the legacy generator uses: strip fences, take {...}. */
export function extractJsonObject(raw: string): unknown {
  const cleaned = String(raw || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new StageError("cv_parse_failed", "model output contained no JSON object");
  }
  try {
    return JSON.parse(cleaned.slice(first, last + 1));
  } catch {
    throw new StageError("cv_parse_failed", "model output was not valid JSON");
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** A string field: absent/null → "", string → trimmed, anything else → invalid. */
function str(obj: Record<string, unknown>, key: string, where: string): string {
  const v = obj[key];
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") {
    throw new StageError("cv_validation_failed", `${where}.${key} is not a string`);
  }
  if (HTML_RE.test(v)) {
    throw new StageError("cv_validation_failed", `${where}.${key} contains markup`);
  }
  return v.trim();
}

/** An array of strings: non-strings invalid, blanks dropped. */
function strList(v: unknown, where: string): string[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) {
    throw new StageError("cv_validation_failed", `${where} is not an array`);
  }
  return v.map((item, i) => {
    if (typeof item !== "string") {
      throw new StageError("cv_validation_failed", `${where}[${i}] is not a string`);
    }
    if (HTML_RE.test(item)) {
      throw new StageError("cv_validation_failed", `${where}[${i}] contains markup`);
    }
    return item.trim();
  }).filter((s) => s.length > 0);
}

function items<T>(v: unknown, where: string, map: (o: Record<string, unknown>, w: string) => T,
                  isEmpty: (t: T) => boolean): T[] {
  if (!Array.isArray(v)) {
    throw new StageError("cv_validation_failed", `${where} is not an array`);
  }
  return v.map((item, i) => {
    if (!isPlainObject(item)) {
      throw new StageError("cv_validation_failed", `${where}[${i}] is not an object`);
    }
    return map(item, `${where}[${i}]`);
  }).filter((t) => !isEmpty(t));
}

const allBlank = (o: object) =>
  Object.values(o).every((v) => (Array.isArray(v) ? v.length === 0 : v === ""));

function experienceItem(o: Record<string, unknown>, w: string): ExperienceItem {
  return {
    job_title: str(o, "job_title", w),
    company: str(o, "company", w),
    location: str(o, "location", w),
    date_range: str(o, "date_range", w),
    bullets: strList(o.bullets, `${w}.bullets`),
  };
}

function educationItem(o: Record<string, unknown>, w: string): EducationItem {
  return {
    degree: str(o, "degree", w),
    major: str(o, "major", w),
    institution: str(o, "institution", w),
    location: str(o, "location", w),
    date_range: str(o, "date_range", w),
    gpa: str(o, "gpa", w),
  };
}

function certificationItem(o: Record<string, unknown>, w: string): CertificationItem {
  return { name: str(o, "name", w), issuer: str(o, "issuer", w), date: str(o, "date", w) };
}

function projectItem(o: Record<string, unknown>, w: string): ProjectItem {
  return {
    title: str(o, "title", w),
    date: str(o, "date", w),
    description: str(o, "description", w),
    bullets: strList(o.bullets, `${w}.bullets`),
  };
}

function languageItem(o: Record<string, unknown>, w: string): LanguageItem {
  return { language: str(o, "language", w), level: str(o, "level", w) };
}

/**
 * The single gate between model output and anything durable.
 * Throws StageError("cv_validation_failed", ...) on any defect.
 */
export function toFinalCvJsonV1(parsed: unknown, language: "en" | "ar"): CvJsonV1 {
  const base = validateCvJsonV1(parsed);
  if (!base.valid) {
    // Field names only; values are never echoed.
    throw new StageError("cv_validation_failed", `schema: ${base.errors.length} error(s)`);
  }
  const cv = parsed as Record<string, unknown>;

  if (cv.document_language !== language) {
    throw new StageError("cv_validation_failed", "document_language does not match the frozen job language");
  }

  const contact = cv.contact as Record<string, unknown>;
  const cc = cv.core_competencies as Record<string, unknown>;

  const rebuilt: CvJsonV1 = {
    document_language: language,
    candidate_level: cv.candidate_level as CvJsonV1["candidate_level"],
    full_name: str(cv, "full_name", "cv"),
    contact: {
      email: str(contact, "email", "contact"),
      phone: str(contact, "phone", "contact"),
      linkedin: str(contact, "linkedin", "contact"),
      location: str(contact, "location", "contact"),
    },
    contact_line: str(cv, "contact_line", "cv"),
    target_job: str(cv, "target_job", "cv"),
    nationality: str(cv, "nationality", "cv"),
    summary: str(cv, "summary", "cv"),
    core_competencies: {
      software_tools: strList(cc.software_tools, "core_competencies.software_tools"),
      technical_skills: strList(cc.technical_skills, "core_competencies.technical_skills"),
      industry_knowledge: strList(cc.industry_knowledge, "core_competencies.industry_knowledge"),
      professional_skills: strList(cc.professional_skills, "core_competencies.professional_skills"),
    },
    experience: items(cv.experience, "experience", experienceItem, allBlank),
    internships: items(cv.internships, "internships", experienceItem, allBlank),
    education: items(cv.education, "education", educationItem, allBlank),
    certifications: items(cv.certifications, "certifications", certificationItem, allBlank),
    projects: items(cv.projects, "projects", projectItem, allBlank),
    languages: items(cv.languages, "languages", languageItem, allBlank),
    // Already checked by validateCvJsonV1 (unique, known keys). Absent stays
    // absent so the DOCX keeps the legacy template order.
    ...(Array.isArray(cv.section_order)
      ? { section_order: [...(cv.section_order as CvSectionKey[])] }
      : {}),
  };

  if (!rebuilt.full_name) {
    throw new StageError("cv_validation_failed", "full_name is empty");
  }

  const finalCv = normalizeCvJsonV1(rebuilt);

  // Belt and braces: the final object must itself pass the legacy validator.
  if (!validateCvJsonV1(finalCv).valid) {
    throw new StageError("cv_validation_failed", "normalized CV failed schema validation");
  }
  return finalCv;
}

import type { CvJsonV1 } from "../schemas/cv-json-v1.ts";
import {
  allowedDocumentLanguages,
  allowedCandidateLevels,
} from "../schemas/cv-json-v1.ts";
import { normalizeCvJsonV1 } from "./normalize-cv-json.ts";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  normalized?: CvJsonV1;
}

const HTML_TAG_RE = /<\/?[a-z][\s\S]*?>/i;
const CSS_PROP_RE =
  /(?:font-size|color|margin|padding|background|border|display|position|width|height)\s*:/i;
const HTML_ENTITY_RE = /&(?:lt|gt|amp|quot|apos);/i;
const MD_FENCE_RE = /```/;
const PLACEHOLDER_RE =
  /^(?:N\/A|TBD|Lorem Ipsum|Coming Soon|Example Company|Example Name)$/i;

function detectUnsafe(value: string): string | null {
  if (HTML_TAG_RE.test(value)) return "contains HTML tags";
  if (CSS_PROP_RE.test(value)) return "contains CSS-like content";
  if (HTML_ENTITY_RE.test(value)) return "contains HTML entities";
  if (MD_FENCE_RE.test(value)) return "contains markdown code fences";
  if (PLACEHOLDER_RE.test(value.trim())) return "is a placeholder value";
  return null;
}

function checkStr(value: unknown, path: string, errors: string[]): void {
  if (value === null || value === undefined) {
    errors.push(`${path} is required`);
    return;
  }
  if (typeof value !== "string") {
    errors.push(`${path} must be a string`);
    return;
  }
  const issue = detectUnsafe(value);
  if (issue) errors.push(`${path} ${issue}`);
}

function checkStrArr(value: unknown, path: string, errors: string[]): void {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return;
  }
  (value as unknown[]).forEach((item, i) => {
    if (typeof item !== "string") {
      errors.push(`${path}[${i}] must be a string`);
    } else {
      const issue = detectUnsafe(item);
      if (issue) errors.push(`${path}[${i}] ${issue}`);
    }
  });
}

function validateExpItem(
  item: unknown,
  path: string,
  errors: string[]
): void {
  if (typeof item !== "object" || item === null) {
    errors.push(`${path} must be an object`);
    return;
  }
  const i = item as Record<string, unknown>;
  checkStr(i.job_title, `${path}.job_title`, errors);
  checkStr(i.company, `${path}.company`, errors);
  checkStr(i.location, `${path}.location`, errors);
  checkStr(i.date_range, `${path}.date_range`, errors);
  checkStrArr(i.bullets, `${path}.bullets`, errors);
}

function validateEduItem(
  item: unknown,
  path: string,
  errors: string[]
): void {
  if (typeof item !== "object" || item === null) {
    errors.push(`${path} must be an object`);
    return;
  }
  const i = item as Record<string, unknown>;
  checkStr(i.degree, `${path}.degree`, errors);
  checkStr(i.major, `${path}.major`, errors);
  checkStr(i.institution, `${path}.institution`, errors);
  checkStr(i.location, `${path}.location`, errors);
  checkStr(i.date_range, `${path}.date_range`, errors);
  checkStr(i.gpa, `${path}.gpa`, errors);
}

function validateCertItem(
  item: unknown,
  path: string,
  errors: string[]
): void {
  if (typeof item !== "object" || item === null) {
    errors.push(`${path} must be an object`);
    return;
  }
  const i = item as Record<string, unknown>;
  checkStr(i.name, `${path}.name`, errors);
  checkStr(i.issuer, `${path}.issuer`, errors);
  checkStr(i.date, `${path}.date`, errors);
}

function validateProjectItem(
  item: unknown,
  path: string,
  errors: string[]
): void {
  if (typeof item !== "object" || item === null) {
    errors.push(`${path} must be an object`);
    return;
  }
  const i = item as Record<string, unknown>;
  checkStr(i.title, `${path}.title`, errors);
  checkStr(i.date, `${path}.date`, errors);
  checkStr(i.description, `${path}.description`, errors);
  checkStrArr(i.bullets, `${path}.bullets`, errors);
}

function validateLangItem(
  item: unknown,
  path: string,
  errors: string[]
): void {
  if (typeof item !== "object" || item === null) {
    errors.push(`${path} must be an object`);
    return;
  }
  const i = item as Record<string, unknown>;
  checkStr(i.language, `${path}.language`, errors);
  checkStr(i.level, `${path}.level`, errors);
}

export function validateCvJsonV1(input: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { valid: false, errors: ["input must be a non-null object"] };
  }

  const cv = input as Record<string, unknown>;

  // Required root keys
  const requiredKeys = [
    "document_language",
    "candidate_level",
    "full_name",
    "contact",
    "contact_line",
    "target_job",
    "nationality",
    "summary",
    "core_competencies",
    "experience",
    "internships",
    "education",
    "certifications",
    "projects",
    "languages",
  ];
  for (const key of requiredKeys) {
    if (!(key in cv)) {
      errors.push(`${key} is required`);
    }
  }

  // document_language
  if ("document_language" in cv) {
    const lang = cv.document_language;
    if (
      typeof lang !== "string" ||
      !(allowedDocumentLanguages as readonly string[]).includes(lang)
    ) {
      errors.push(
        `document_language must be one of: ${allowedDocumentLanguages.join(", ")}`
      );
    }
  }

  // candidate_level
  if ("candidate_level" in cv) {
    const level = cv.candidate_level;
    if (
      typeof level !== "string" ||
      !(allowedCandidateLevels as readonly string[]).includes(level)
    ) {
      errors.push(
        `candidate_level must be one of: ${allowedCandidateLevels.join(", ")}`
      );
    }
  }

  // Root string fields
  for (const field of [
    "full_name",
    "contact_line",
    "target_job",
    "nationality",
    "summary",
  ]) {
    if (field in cv) {
      checkStr(cv[field], field, errors);
    }
  }

  // contact
  if ("contact" in cv) {
    if (
      typeof cv.contact !== "object" ||
      cv.contact === null ||
      Array.isArray(cv.contact)
    ) {
      errors.push("contact must be a non-null object");
    } else {
      const contact = cv.contact as Record<string, unknown>;
      for (const field of ["email", "phone", "linkedin", "location"]) {
        checkStr(contact[field], `contact.${field}`, errors);
      }
    }
  }

  // core_competencies
  if ("core_competencies" in cv) {
    if (
      typeof cv.core_competencies !== "object" ||
      cv.core_competencies === null ||
      Array.isArray(cv.core_competencies)
    ) {
      errors.push("core_competencies must be a non-null object");
    } else {
      const cc = cv.core_competencies as Record<string, unknown>;
      for (const group of [
        "technical_skills",
        "industry_knowledge",
        "professional_skills",
      ]) {
        checkStrArr(cc[group], `core_competencies.${group}`, errors);
      }
    }
  }

  // Array sections
  const arrayFields: Array<
    [string, (item: unknown, path: string, errors: string[]) => void]
  > = [
    ["experience", validateExpItem],
    ["internships", validateExpItem],
    ["education", validateEduItem],
    ["certifications", validateCertItem],
    ["projects", validateProjectItem],
    ["languages", validateLangItem],
  ];

  for (const [field, validateItem] of arrayFields) {
    if (field in cv) {
      if (!Array.isArray(cv[field])) {
        errors.push(`${field} must be an array`);
      } else {
        (cv[field] as unknown[]).forEach((item, i) => {
          validateItem(item, `${field}[${i}]`, errors);
        });
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const normalized = normalizeCvJsonV1(input as CvJsonV1);
  return { valid: true, errors: [], normalized };
}

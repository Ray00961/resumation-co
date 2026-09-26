import { CV_SECTION_KEYS } from "../schemas/cv-json-v1.ts";

const ALLOWED_LANGUAGES = ["en", "ar"];
const ALLOWED_LEVELS = ["fresh_graduate", "junior", "mid", "senior", "executive"];
const HTML_RE = /<[a-z][\s\S]*>/i;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateCvJsonV1(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { valid: false, errors: ["Input must be a plain object"] };
  }

  const cv = data as Record<string, unknown>;

  if (typeof cv.document_language !== "string" || !ALLOWED_LANGUAGES.includes(cv.document_language)) {
    errors.push(`document_language must be "en" or "ar"`);
  }

  if (typeof cv.candidate_level !== "string" || !ALLOWED_LEVELS.includes(cv.candidate_level)) {
    errors.push(`candidate_level "${cv.candidate_level}" is not valid`);
  }

  if (typeof cv.full_name !== "string") errors.push("full_name must be a string");
  else if (HTML_RE.test(cv.full_name)) errors.push("full_name must not contain HTML");

  if (!cv.contact || typeof cv.contact !== "object" || Array.isArray(cv.contact)) {
    errors.push("contact must be an object");
  } else {
    const c = cv.contact as Record<string, unknown>;
    for (const f of ["email", "phone", "linkedin", "location"]) {
      if (typeof c[f] !== "string") errors.push(`contact.${f} must be a string`);
    }
  }

  for (const f of ["contact_line", "target_job", "nationality", "summary"]) {
    if (typeof cv[f] !== "string") errors.push(`${f} must be a string`);
  }

  if (!cv.core_competencies || typeof cv.core_competencies !== "object") {
    errors.push("core_competencies must be an object");
  } else {
    const cc = cv.core_competencies as Record<string, unknown>;
    for (const g of ["technical_skills", "industry_knowledge", "professional_skills"]) {
      if (!Array.isArray(cc[g])) errors.push(`core_competencies.${g} must be an array`);
    }
    // Optional: absent is valid (legacy JSON); present must be string[].
    if (cc.software_tools !== undefined) {
      if (!Array.isArray(cc.software_tools)) {
        errors.push("core_competencies.software_tools must be an array");
      } else if (cc.software_tools.some((s) => typeof s !== "string")) {
        errors.push("core_competencies.software_tools must contain only strings");
      }
    }
  }

  // Optional: absent is valid (legacy JSON); present must be unique known keys.
  if (cv.section_order !== undefined) {
    if (!Array.isArray(cv.section_order)) {
      errors.push("section_order must be an array");
    } else {
      const seen = new Set<string>();
      cv.section_order.forEach((k, i) => {
        if (typeof k !== "string") errors.push(`section_order[${i}] must be a string`);
        else if (!(CV_SECTION_KEYS as readonly string[]).includes(k)) errors.push(`section_order[${i}] is not a known section`);
        else if (seen.has(k)) errors.push(`section_order[${i}] is a duplicate`);
        else seen.add(k);
      });
    }
  }

  for (const f of ["experience", "internships", "education", "certifications", "projects", "languages"]) {
    if (!Array.isArray(cv[f])) errors.push(`${f} must be an array`);
  }

  return { valid: errors.length === 0, errors };
}
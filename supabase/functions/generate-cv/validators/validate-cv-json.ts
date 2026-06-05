import type { CvJsonV1 } from "../schemas/cv-json-v1.ts";
import {
  allowedCandidateLevels,
  allowedDocumentLanguages,
} from "../schemas/cv-json-v1.ts";
import { normalizeCvJsonV1 } from "./normalize-cv-json.ts";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  normalized?: CvJsonV1;
}

type ItemValidator = (
  item: unknown,
  path: string,
  errors: string[]
) => void;

const REQUIRED_ROOT_KEYS = [
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
] as const;

const ROOT_STRING_FIELDS = [
  "full_name",
  "contact_line",
  "target_job",
  "nationality",
  "summary",
] as const;

const CONTACT_FIELDS = ["email", "phone", "linkedin", "location"] as const;

const CORE_COMPETENCY_GROUPS = [
  "technical_skills",
  "industry_knowledge",
  "professional_skills",
] as const;

const HTML_TAG_RE = new RegExp("</?[a-z][\\s\\S]*?>", "i");

const CSS_PROP_RE = new RegExp(
  "(color|font-size|font-weight|font-family|text-transform|text-align|line-height|letter-spacing|margin|margin-top|margin-bottom|margin-left|margin-right|padding|padding-top|padding-bottom|padding-left|padding-right|background|background-color|border|border-top|border-bottom|border-left|border-right|display|position|width|height|white-space)\\s*:",
  "i"
);

const HTML_ENTITY_RE = /&(?:lt|gt|amp|quot|apos);/i;
const MD_FENCE_RE = /```/;

const PLACEHOLDER_RE = new RegExp(
  "^(N/A|TBD|Lorem Ipsum|Coming Soon|Example Company|Example Name|Sample Company|Sample Name|Your Name|Your Email|your\\.email@example\\.com|example@example\\.com)$",
  "i"
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function detectUnsafe(value: string): string | null {
  const trimmed = value.trim();

  if (HTML_TAG_RE.test(value)) return "contains HTML tags";
  if (CSS_PROP_RE.test(value)) return "contains CSS-like content";
  if (HTML_ENTITY_RE.test(value)) return "contains HTML entities";
  if (MD_FENCE_RE.test(value)) return "contains markdown code fences";
  if (PLACEHOLDER_RE.test(trimmed)) return "is a placeholder value";

  return null;
}

function checkRequiredKeys(
  obj: Record<string, unknown>,
  keys: readonly string[],
  path: string,
  errors: string[]
): void {
  for (const key of keys) {
    if (!(key in obj)) {
      errors.push(`${path}.${key} is required`);
    }
  }
}

function checkString(value: unknown, path: string, errors: string[]): void {
  if (value === null || value === undefined) {
    errors.push(`${path} is required`);
    return;
  }

  if (typeof value !== "string") {
    errors.push(`${path} must be a string`);
    return;
  }

  const issue = detectUnsafe(value);
  if (issue) {
    errors.push(`${path} ${issue}`);
  }
}

function checkStringArray(
  value: unknown,
  path: string,
  errors: string[]
): void {
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array`);
    return;
  }

  value.forEach((item, index) => {
    if (typeof item !== "string") {
      errors.push(`${path}[${index}] must be a string`);
      return;
    }

    const issue = detectUnsafe(item);
    if (issue) {
      errors.push(`${path}[${index}] ${issue}`);
    }
  });
}

function validateObjectItem(
  item: unknown,
  path: string,
  errors: string[],
  stringFields: readonly string[],
  stringArrayFields: readonly string[] = []
): void {
  if (!isRecord(item)) {
    errors.push(`${path} must be a non-null object`);
    return;
  }

  checkRequiredKeys(item, [...stringFields, ...stringArrayFields], path, errors);

  for (const field of stringFields) {
    if (field in item) {
      checkString(item[field], `${path}.${field}`, errors);
    }
  }

  for (const field of stringArrayFields) {
    if (field in item) {
      checkStringArray(item[field], `${path}.${field}`, errors);
    }
  }
}

function validateExperienceItem(
  item: unknown,
  path: string,
  errors: string[]
): void {
  validateObjectItem(
    item,
    path,
    errors,
    ["job_title", "company", "location", "date_range"],
    ["bullets"]
  );
}

function validateEducationItem(
  item: unknown,
  path: string,
  errors: string[]
): void {
  validateObjectItem(item, path, errors, [
    "degree",
    "major",
    "institution",
    "location",
    "date_range",
    "gpa",
  ]);
}

function validateCertificationItem(
  item: unknown,
  path: string,
  errors: string[]
): void {
  validateObjectItem(item, path, errors, ["name", "issuer", "date"]);
}

function validateProjectItem(
  item: unknown,
  path: string,
  errors: string[]
): void {
  validateObjectItem(
    item,
    path,
    errors,
    ["title", "date", "description"],
    ["bullets"]
  );
}

function validateLanguageItem(
  item: unknown,
  path: string,
  errors: string[]
): void {
  validateObjectItem(item, path, errors, ["language", "level"]);
}

function validateArraySection(
  cv: Record<string, unknown>,
  field: string,
  validateItem: ItemValidator,
  errors: string[]
): void {
  if (!(field in cv)) {
    return;
  }

  const value = cv[field];

  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array`);
    return;
  }

  value.forEach((item, index) => {
    validateItem(item, `${field}[${index}]`, errors);
  });
}

export function validateCvJsonV1(input: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return {
      valid: false,
      errors: ["input must be a non-null object"],
    };
  }

  const cv = input;

  for (const key of REQUIRED_ROOT_KEYS) {
    if (!(key in cv)) {
      errors.push(`${key} is required`);
    }
  }

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

  for (const field of ROOT_STRING_FIELDS) {
    if (field in cv) {
      checkString(cv[field], field, errors);
    }
  }

  if ("contact" in cv) {
    const contact = cv.contact;

    if (!isRecord(contact)) {
      errors.push("contact must be a non-null object");
    } else {
      checkRequiredKeys(contact, CONTACT_FIELDS, "contact", errors);

      for (const field of CONTACT_FIELDS) {
        if (field in contact) {
          checkString(contact[field], `contact.${field}`, errors);
        }
      }
    }
  }

  if ("core_competencies" in cv) {
    const coreCompetencies = cv.core_competencies;

    if (!isRecord(coreCompetencies)) {
      errors.push("core_competencies must be a non-null object");
    } else {
      checkRequiredKeys(
        coreCompetencies,
        CORE_COMPETENCY_GROUPS,
        "core_competencies",
        errors
      );

      for (const group of CORE_COMPETENCY_GROUPS) {
        if (group in coreCompetencies) {
          checkStringArray(
            coreCompetencies[group],
            `core_competencies.${group}`,
            errors
          );
        }
      }
    }
  }

  validateArraySection(cv, "experience", validateExperienceItem, errors);
  validateArraySection(cv, "internships", validateExperienceItem, errors);
  validateArraySection(cv, "education", validateEducationItem, errors);
  validateArraySection(cv, "certifications", validateCertificationItem, errors);
  validateArraySection(cv, "projects", validateProjectItem, errors);
  validateArraySection(cv, "languages", validateLanguageItem, errors);

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
    };
  }

  const normalized = normalizeCvJsonV1(cv as unknown as CvJsonV1);

  return {
    valid: true,
    errors: [],
    normalized,
  };
}
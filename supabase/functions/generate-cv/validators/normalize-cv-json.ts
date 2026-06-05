import type {
  CertificationItem,
  CvJsonV1,
  EducationItem,
  ExperienceItem,
  LanguageItem,
  ProjectItem,
} from "../schemas/cv-json-v1.ts";
import { buildContactLine } from "../docx/utils/contact-utils.ts";

function safeStr(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeStrArr(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => safeStr(item))
    .filter((item) => item !== "");
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeExperienceItem(item: ExperienceItem): ExperienceItem {
  return {
    job_title: safeStr(item.job_title),
    company: safeStr(item.company),
    location: safeStr(item.location),
    date_range: safeStr(item.date_range),
    bullets: safeStrArr(item.bullets),
  };
}

function normalizeEducationItem(item: EducationItem): EducationItem {
  return {
    degree: safeStr(item.degree),
    major: safeStr(item.major),
    institution: safeStr(item.institution),
    location: safeStr(item.location),
    date_range: safeStr(item.date_range),
    gpa: safeStr(item.gpa),
  };
}

function normalizeCertificationItem(
  item: CertificationItem
): CertificationItem {
  return {
    name: safeStr(item.name),
    issuer: safeStr(item.issuer),
    date: safeStr(item.date),
  };
}

function normalizeProjectItem(item: ProjectItem): ProjectItem {
  return {
    title: safeStr(item.title),
    date: safeStr(item.date),
    description: safeStr(item.description),
    bullets: safeStrArr(item.bullets),
  };
}

function normalizeLanguageItem(item: LanguageItem): LanguageItem {
  return {
    language: safeStr(item.language),
    level: safeStr(item.level),
  };
}

export function normalizeCvJsonV1(cv: CvJsonV1): CvJsonV1 {
  const contact = {
    email: safeStr(cv.contact?.email),
    phone: safeStr(cv.contact?.phone),
    linkedin: safeStr(cv.contact?.linkedin),
    location: safeStr(cv.contact?.location),
  };

  const contactLineFromInput = safeStr(cv.contact_line);

  const contact_line =
    contactLineFromInput !== "" ? contactLineFromInput : buildContactLine(contact);

  return {
    document_language: cv.document_language,
    candidate_level: cv.candidate_level,
    full_name: safeStr(cv.full_name),
    contact,
    contact_line,
    target_job: safeStr(cv.target_job),
    nationality: safeStr(cv.nationality),
    summary: safeStr(cv.summary),
    core_competencies: {
      technical_skills: safeStrArr(cv.core_competencies?.technical_skills),
      industry_knowledge: safeStrArr(cv.core_competencies?.industry_knowledge),
      professional_skills: safeStrArr(cv.core_competencies?.professional_skills),
    },
    experience: safeArray<ExperienceItem>(cv.experience).map(
      normalizeExperienceItem
    ),
    internships: safeArray<ExperienceItem>(cv.internships).map(
      normalizeExperienceItem
    ),
    education: safeArray<EducationItem>(cv.education).map(
      normalizeEducationItem
    ),
    certifications: safeArray<CertificationItem>(cv.certifications).map(
      normalizeCertificationItem
    ),
    projects: safeArray<ProjectItem>(cv.projects).map(normalizeProjectItem),
    languages: safeArray<LanguageItem>(cv.languages).map(normalizeLanguageItem),
  };
}
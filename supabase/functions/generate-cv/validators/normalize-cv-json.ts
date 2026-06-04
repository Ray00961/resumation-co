import type {
  CvJsonV1,
  ExperienceItem,
  EducationItem,
  CertificationItem,
  ProjectItem,
  LanguageItem,
} from "../schemas/cv-json-v1.ts";
import { buildContactLine } from "../docx/utils/contact-utils.ts";

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function safeStrArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return (v as unknown[])
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item !== "");
}

function normalizeExpItem(item: ExperienceItem): ExperienceItem {
  return {
    job_title: safeStr(item.job_title),
    company: safeStr(item.company),
    location: safeStr(item.location),
    date_range: safeStr(item.date_range),
    bullets: safeStrArr(item.bullets),
  };
}

function normalizeEduItem(item: EducationItem): EducationItem {
  return {
    degree: safeStr(item.degree),
    major: safeStr(item.major),
    institution: safeStr(item.institution),
    location: safeStr(item.location),
    date_range: safeStr(item.date_range),
    gpa: safeStr(item.gpa),
  };
}

function normalizeCertItem(item: CertificationItem): CertificationItem {
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

function normalizeLangItem(item: LanguageItem): LanguageItem {
  return {
    language: safeStr(item.language),
    level: safeStr(item.level),
  };
}

export function normalizeCvJsonV1(cv: CvJsonV1): CvJsonV1 {
  const contact = {
    email: safeStr(cv.contact.email),
    phone: safeStr(cv.contact.phone),
    linkedin: safeStr(cv.contact.linkedin),
    location: safeStr(cv.contact.location),
  };

  const rawLine = safeStr(cv.contact_line);
  const contact_line = rawLine !== "" ? rawLine : buildContactLine(contact);

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
      technical_skills: safeStrArr(cv.core_competencies.technical_skills),
      industry_knowledge: safeStrArr(cv.core_competencies.industry_knowledge),
      professional_skills: safeStrArr(cv.core_competencies.professional_skills),
    },
    experience: cv.experience.map(normalizeExpItem),
    internships: cv.internships.map(normalizeExpItem),
    education: cv.education.map(normalizeEduItem),
    certifications: cv.certifications.map(normalizeCertItem),
    projects: cv.projects.map(normalizeProjectItem),
    languages: cv.languages.map(normalizeLangItem),
  };
}

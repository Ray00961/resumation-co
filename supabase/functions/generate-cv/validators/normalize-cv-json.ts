import type { CvJsonV1 } from "../schemas/cv-json-v1.ts";
import { buildContactLine } from "../docx/utils/contact-utils.ts";

const trim = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? v : []);

export function normalizeCvJsonV1(cv: CvJsonV1): CvJsonV1 {
  const contact = {
    email: trim(cv.contact?.email),
    phone: trim(cv.contact?.phone),
    linkedin: trim(cv.contact?.linkedin),
    location: trim(cv.contact?.location),
  };

  return {
    document_language: cv.document_language,
    candidate_level: cv.candidate_level,
    full_name: trim(cv.full_name),
    contact,
    contact_line: trim(cv.contact_line) || buildContactLine(contact),
    target_job: trim(cv.target_job),
    nationality: trim(cv.nationality),
    summary: trim(cv.summary),
    core_competencies: {
      technical_skills: arr<string>(cv.core_competencies?.technical_skills),
      industry_knowledge: arr<string>(cv.core_competencies?.industry_knowledge),
      professional_skills: arr<string>(cv.core_competencies?.professional_skills),
    },
    experience: arr(cv.experience),
    internships: arr(cv.internships),
    education: arr(cv.education),
    certifications: arr(cv.certifications),
    projects: arr(cv.projects),
    languages: arr(cv.languages),
  };
}
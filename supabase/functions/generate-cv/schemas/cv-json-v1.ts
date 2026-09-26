export interface ContactInfo {
  email: string;
  phone: string;
  linkedin: string;
  location: string;
}

export interface CoreCompetencies {
  /** Optional in incoming JSON; normalized to [] when absent. */
  software_tools?: string[];
  technical_skills: string[];
  industry_knowledge: string[];
  professional_skills: string[];
}

export interface ExperienceItem {
  job_title: string;
  company: string;
  location: string;
  date_range: string;
  bullets: string[];
}

export interface EducationItem {
  degree: string;
  major: string;
  institution: string;
  location: string;
  date_range: string;
  gpa: string;
}

export interface CertificationItem {
  name: string;
  issuer: string;
  date: string;
}

export interface ProjectItem {
  title: string;
  date: string;
  description: string;
  bullets: string[];
}

export interface LanguageItem {
  language: string;
  level: string;
}

/**
 * Body sections a CV may order via section_order, in canonical order. The
 * header always renders first and is never part of section_order.
 */
export const CV_SECTION_KEYS = [
  "summary",
  "core_competencies",
  "experience",
  "education",
  "internships",
  "projects",
  "certifications",
  "languages",
] as const;

export type CvSectionKey = typeof CV_SECTION_KEYS[number];

export interface CvJsonV1 {
  /**
   * Optional. When present: unique keys from CV_SECTION_KEYS. When absent the
   * DOCX uses the fixed template order for the candidate level and language.
   */
  section_order?: CvSectionKey[];
  document_language: "en" | "ar";
  candidate_level: "fresh_graduate" | "junior" | "mid" | "senior" | "executive";
  full_name: string;
  contact: ContactInfo;
  contact_line: string;
  target_job: string;
  nationality: string;
  summary: string;
  core_competencies: CoreCompetencies;
  experience: ExperienceItem[];
  internships: ExperienceItem[];
  education: EducationItem[];
  certifications: CertificationItem[];
  projects: ProjectItem[];
  languages: LanguageItem[];
}
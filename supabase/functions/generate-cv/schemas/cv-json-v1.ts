export interface ContactInfo {
  email: string;
  phone: string;
  linkedin: string;
  location: string;
}

export interface CoreCompetencies {
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

export interface CvJsonV1 {
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
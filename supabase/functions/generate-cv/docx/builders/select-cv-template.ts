import type { Paragraph } from "https://esm.sh/docx@8.5.0";
import { CV_SECTION_KEYS, type CvJsonV1, type CvSectionKey } from "../../schemas/cv-json-v1.ts";
import { renderHeader } from "../renderers/render-header.ts";
import { renderSummary } from "../renderers/render-summary.ts";
import { renderCoreCompetencies } from "../renderers/render-core-competencies.ts";
import { renderExperience, renderInternships } from "../renderers/render-experience.ts";
import { renderEducation } from "../renderers/render-education.ts";
import { renderProjects } from "../renderers/render-projects.ts";
import { renderCertifications } from "../renderers/render-certifications.ts";
import { renderLanguages } from "../renderers/render-languages.ts";
import { buildProfessionalSections } from "../templates/professional-template.ts";
import { buildFreshGraduateSections } from "../templates/fresh-graduate-template.ts";
import { buildArabicProfessionalTemplate } from "../templates/arabic-professional-template.ts";
import { buildArabicFreshGraduateTemplate } from "../templates/arabic-fresh-graduate-template.ts";

export type CvTemplateBuilder = (cv: CvJsonV1) => Paragraph[];

const SECTION_RENDERERS: Record<CvSectionKey, CvTemplateBuilder> = {
  summary: renderSummary,
  core_competencies: renderCoreCompetencies,
  experience: renderExperience,
  education: renderEducation,
  internships: renderInternships,
  projects: renderProjects,
  certifications: renderCertifications,
  languages: renderLanguages,
};

/**
 * The listed sections in order, then every unlisted section that has
 * renderable data, in canonical CV_SECTION_KEYS order, so no content is lost.
 */
export function resolveSectionOrder(cv: CvJsonV1): CvSectionKey[] {
  const listed = cv.section_order ?? [];
  const missing = CV_SECTION_KEYS.filter(
    (k) => !listed.includes(k) && SECTION_RENDERERS[k](cv).length > 0,
  );
  return [...listed, ...missing];
}

function buildOrderedSections(cv: CvJsonV1): Paragraph[] {
  return [
    ...renderHeader(cv),
    ...resolveSectionOrder(cv).flatMap((k) => SECTION_RENDERERS[k](cv)),
  ];
}

export function selectCvTemplate(cv: CvJsonV1): CvTemplateBuilder {
  // Without section_order the fixed templates below apply exactly as before.
  if (cv.section_order !== undefined) {
    return buildOrderedSections;
  }

  if (cv.document_language === "ar" && cv.candidate_level === "fresh_graduate") {
    return buildArabicFreshGraduateTemplate;
  }

  if (cv.document_language === "ar") {
    return buildArabicProfessionalTemplate;
  }

  if (cv.candidate_level === "fresh_graduate") {
    return buildFreshGraduateSections;
  }

  return buildProfessionalSections;
}

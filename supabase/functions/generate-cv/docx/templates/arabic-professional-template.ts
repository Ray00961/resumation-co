import type { Paragraph } from "https://esm.sh/docx@8.5.0";
import type { CvJsonV1 } from "../../schemas/cv-json-v1.ts";
import { renderHeader } from "../renderers/render-header.ts";
import { renderSummary } from "../renderers/render-summary.ts";
import { renderCoreCompetencies } from "../renderers/render-core-competencies.ts";
import { renderExperience } from "../renderers/render-experience.ts";
import { renderEducation } from "../renderers/render-education.ts";
import { renderCertifications } from "../renderers/render-certifications.ts";
import { renderProjects } from "../renderers/render-projects.ts";
import { renderLanguages } from "../renderers/render-languages.ts";

export function buildArabicProfessionalTemplate(cv: CvJsonV1): Paragraph[] {
  return [
    ...renderHeader(cv),
    ...renderSummary(cv),
    ...renderCoreCompetencies(cv),
    ...renderExperience(cv),
    ...renderEducation(cv),
    ...renderCertifications(cv),
    ...renderProjects(cv),
    ...renderLanguages(cv),
  ];
}

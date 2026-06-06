import type { Paragraph } from "npm:docx@9.7.1";
import type { CvJsonV1 } from "../../schemas/cv-json-v1.ts";
import { renderHeader } from "../renderers/render-header.ts";
import { renderSectionTitle } from "../renderers/render-section-title.ts";
import { renderSummary } from "../renderers/render-summary.ts";
import { renderCoreCompetencies } from "../renderers/render-core-competencies.ts";
import { renderExperienceItems } from "../renderers/render-experience.ts";
import { renderEducationItems } from "../renderers/render-education.ts";
import { renderCertifications } from "../renderers/render-certifications.ts";
import { renderProjects } from "../renderers/render-projects.ts";
import { renderLanguages } from "../renderers/render-languages.ts";

function hasItems<T>(items: T[]): boolean {
  return Array.isArray(items) && items.length > 0;
}

function hasCoreCompetencies(cv: CvJsonV1): boolean {
  return (
    cv.core_competencies.technical_skills.length > 0 ||
    cv.core_competencies.industry_knowledge.length > 0 ||
    cv.core_competencies.professional_skills.length > 0
  );
}

export function buildArabicFreshGraduateTemplate(cv: CvJsonV1): Paragraph[] {
  const language = "ar";
  const sections: Paragraph[] = [];

  sections.push(...renderHeader(cv));

  if (cv.summary.trim() !== "") {
    sections.push(renderSectionTitle("الملخص المهني", language));
    sections.push(...renderSummary(cv));
  }

  if (hasItems(cv.education)) {
    sections.push(renderSectionTitle("التعليم", language));
    sections.push(...renderEducationItems(cv.education, language));
  }

  if (hasItems(cv.projects)) {
    sections.push(renderSectionTitle("المشاريع", language));
    sections.push(...renderProjects(cv.projects, language));
  }

  if (hasItems(cv.internships)) {
    sections.push(renderSectionTitle("التدريب", language));
    sections.push(...renderExperienceItems(cv.internships, language));
  }

  if (hasCoreCompetencies(cv)) {
    sections.push(renderSectionTitle("الكفاءات الأساسية", language));
    sections.push(...renderCoreCompetencies(cv));
  }

  if (hasItems(cv.certifications)) {
    sections.push(renderSectionTitle("الشهادات", language));
    sections.push(...renderCertifications(cv.certifications, language));
  }

  if (hasItems(cv.languages)) {
    sections.push(renderSectionTitle("اللغات", language));
    sections.push(...renderLanguages(cv.languages, language));
  }

  return sections;
}
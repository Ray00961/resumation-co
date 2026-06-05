import type { Paragraph } from "npm:docx@9.7.1";
import type { CvJsonV1 } from "../../schemas/cv-json-v1.ts";
import { buildProfessionalTemplate } from "../templates/professional-template.ts";
import { buildFreshGraduateTemplate } from "../templates/fresh-graduate-template.ts";
import { buildArabicProfessionalTemplate } from "../templates/arabic-professional-template.ts";
import { buildArabicFreshGraduateTemplate } from "../templates/arabic-fresh-graduate-template.ts";

export type CvTemplateBuilder = (cv: CvJsonV1) => Paragraph[];

export function selectCvTemplate(cv: CvJsonV1): CvTemplateBuilder {
  if (
    cv.document_language === "ar" &&
    cv.candidate_level === "fresh_graduate"
  ) {
    return buildArabicFreshGraduateTemplate;
  }

  if (cv.document_language === "ar") {
    return buildArabicProfessionalTemplate;
  }

  if (cv.candidate_level === "fresh_graduate") {
    return buildFreshGraduateTemplate;
  }

  return buildProfessionalTemplate;
}
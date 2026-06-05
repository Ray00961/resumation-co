import { Paragraph, TextRun } from "npm:docx@9.7.1";
import type { CoreCompetencies, CvJsonV1 } from "../../schemas/cv-json-v1.ts";
import {
  COLOR,
  FONT_SIZE,
  SPACING,
  getPrimaryFont,
  type CvDocxLanguage,
} from "../styles/cv-docx-styles.ts";
import { cleanTextArray } from "../utils/text-utils.ts";

function renderCompetencyLine(
  label: string,
  values: string[],
  language: CvDocxLanguage
): Paragraph | null {
  const cleanedValues = cleanTextArray(values);

  if (cleanedValues.length === 0) {
    return null;
  }

  return new Paragraph({
    bidirectional: language === "ar",
    spacing: {
      after: SPACING.afterParagraph,
    },
    children: [
      new TextRun({
        text: `${label}: `,
        bold: true,
        size: FONT_SIZE.body,
        color: COLOR.mainText,
        font: getPrimaryFont(language),
      }),
      new TextRun({
        text: cleanedValues.join(", "),
        size: FONT_SIZE.body,
        color: COLOR.mainText,
        font: getPrimaryFont(language),
      }),
    ],
  });
}

function getCompetencyLabels(language: CvDocxLanguage) {
  if (language === "ar") {
    return {
      technical_skills: "المهارات التقنية",
      industry_knowledge: "المعرفة بالمجال",
      professional_skills: "المهارات المهنية",
    };
  }

  return {
    technical_skills: "Technical Skills",
    industry_knowledge: "Industry Knowledge",
    professional_skills: "Professional Skills",
  };
}

export function renderCoreCompetencies(cv: CvJsonV1): Paragraph[] {
  const language = cv.document_language as CvDocxLanguage;
  const labels = getCompetencyLabels(language);
  const competencies: CoreCompetencies = cv.core_competencies;

  const paragraphs = [
    renderCompetencyLine(
      labels.technical_skills,
      competencies.technical_skills,
      language
    ),
    renderCompetencyLine(
      labels.industry_knowledge,
      competencies.industry_knowledge,
      language
    ),
    renderCompetencyLine(
      labels.professional_skills,
      competencies.professional_skills,
      language
    ),
  ];

  return paragraphs.filter((paragraph): paragraph is Paragraph => paragraph !== null);
}
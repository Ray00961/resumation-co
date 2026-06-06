import { AlignmentType, Paragraph, TextRun } from "https://esm.sh/docx@8.5.0";
import type { CvJsonV1, ExperienceItem } from "../../schemas/cv-json-v1.ts";
import { renderSectionTitle } from "./render-section-title.ts";
import { FONT_SIZE, FONT, SPACING } from "../styles/cv-docx-styles.ts";

function joinNonEmpty(vals: string[], sep = " | ") {
  return vals.filter((v) => v?.trim()).join(sep);
}

function renderRole(item: ExperienceItem, isAr: boolean): Paragraph[] {
  const font = isAr ? FONT.ar : FONT.en;
  const align = isAr ? AlignmentType.RIGHT : AlignmentType.LEFT;
  const paras: Paragraph[] = [];

  paras.push(new Paragraph({
    bidirectional: isAr, alignment: align,
    spacing: { before: SPACING.itemBefore, after: 0 },
    children: [new TextRun({ text: item.job_title, bold: true, size: FONT_SIZE.jobTitle, font })],
  }));

  const companyLine = joinNonEmpty([item.company, item.location]);
  if (companyLine) {
    paras.push(new Paragraph({
      bidirectional: isAr, alignment: align,
      spacing: { before: 0, after: 0 },
      children: [new TextRun({ text: companyLine, size: FONT_SIZE.body, font })],
    }));
  }

  if (item.date_range) {
    paras.push(new Paragraph({
      bidirectional: isAr, alignment: align,
      spacing: { before: 0, after: 80 },
      children: [new TextRun({ text: item.date_range, size: FONT_SIZE.body, font, italics: !isAr })],
    }));
  }

  for (const bullet of item.bullets) {
    if (!bullet?.trim()) continue;
    paras.push(new Paragraph({
      bidirectional: isAr, alignment: align,
      bullet: { level: 0 },
      spacing: { before: 40, after: SPACING.bulletAfter },
      children: [new TextRun({ text: bullet, size: FONT_SIZE.body, font })],
    }));
  }

  return paras;
}

export function renderExperience(cv: CvJsonV1): Paragraph[] {
  if (!cv.experience.length) return [];
  const isAr = cv.document_language === "ar";
  return [
    renderSectionTitle(isAr ? "الخبرات المهنية" : "Professional Experience", isAr),
    ...cv.experience.flatMap((item) => renderRole(item, isAr)),
  ];
}

export function renderInternships(cv: CvJsonV1): Paragraph[] {
  if (!cv.internships.length) return [];
  const isAr = cv.document_language === "ar";
  return [
    renderSectionTitle(isAr ? "التدريب" : "Internships", isAr),
    ...cv.internships.flatMap((item) => renderRole(item, isAr)),
  ];
}
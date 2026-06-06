import { AlignmentType, Paragraph, TextRun } from "https://esm.sh/docx@8.5.0";
import type { CvJsonV1 } from "../../schemas/cv-json-v1.ts";
import { renderSectionTitle } from "./render-section-title.ts";
import { FONT_SIZE, FONT, SPACING } from "../styles/cv-docx-styles.ts";

function joinNonEmpty(vals: string[], sep = " | ") {
  return vals.filter((v) => v?.trim()).join(sep);
}

export function renderEducation(cv: CvJsonV1): Paragraph[] {
  if (!cv.education.length) return [];
  const isAr = cv.document_language === "ar";
  const font = isAr ? FONT.ar : FONT.en;
  const align = isAr ? AlignmentType.RIGHT : AlignmentType.LEFT;
  const paras: Paragraph[] = [renderSectionTitle(isAr ? "التعليم" : "Education", isAr)];

  for (const item of cv.education) {
    const degreeLine = item.major
      ? isAr ? `${item.degree} — ${item.major}` : `${item.degree} in ${item.major}`
      : item.degree;

    paras.push(new Paragraph({
      bidirectional: isAr, alignment: align,
      spacing: { before: SPACING.itemBefore, after: 0 },
      children: [new TextRun({ text: degreeLine, bold: true, size: FONT_SIZE.jobTitle, font })],
    }));

    const meta = joinNonEmpty([item.institution, item.location, item.date_range]);
    if (meta) {
      paras.push(new Paragraph({
        bidirectional: isAr, alignment: align,
        spacing: { before: 0, after: item.gpa ? 0 : SPACING.itemAfter },
        children: [new TextRun({ text: meta, size: FONT_SIZE.body, font })],
      }));
    }

    if (item.gpa) {
      paras.push(new Paragraph({
        bidirectional: isAr, alignment: align,
        spacing: { before: 0, after: SPACING.itemAfter },
        children: [new TextRun({ text: `${isAr ? "المعدل" : "GPA"}: ${item.gpa}`, size: FONT_SIZE.body, font })],
      }));
    }
  }

  return paras;
}
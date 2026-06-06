import { AlignmentType, Paragraph, TextRun } from "https://esm.sh/docx@8.5.0";
import type { CvJsonV1 } from "../../schemas/cv-json-v1.ts";
import { renderSectionTitle } from "./render-section-title.ts";
import { FONT_SIZE, FONT } from "../styles/cv-docx-styles.ts";

export function renderSummary(cv: CvJsonV1): Paragraph[] {
  if (!cv.summary) return [];
  const isAr = cv.document_language === "ar";
  return [
    renderSectionTitle(isAr ? "الملخص المهني" : "Professional Summary", isAr),
    new Paragraph({
      bidirectional: isAr,
      alignment: isAr ? AlignmentType.RIGHT : AlignmentType.LEFT,
      spacing: { before: 0, after: 60 },
      children: [new TextRun({ text: cv.summary, size: FONT_SIZE.body, font: isAr ? FONT.ar : FONT.en })],
    }),
  ];
}
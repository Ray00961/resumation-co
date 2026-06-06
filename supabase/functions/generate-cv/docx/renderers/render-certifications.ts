import { AlignmentType, Paragraph, TextRun } from "https://esm.sh/docx@8.5.0";
import type { CvJsonV1 } from "../../schemas/cv-json-v1.ts";
import { renderSectionTitle } from "./render-section-title.ts";
import { FONT_SIZE, FONT, SPACING } from "../styles/cv-docx-styles.ts";

export function renderCertifications(cv: CvJsonV1): Paragraph[] {
  if (!cv.certifications.length) return [];
  const isAr = cv.document_language === "ar";
  const font = isAr ? FONT.ar : FONT.en;
  const align = isAr ? AlignmentType.RIGHT : AlignmentType.LEFT;
  const paras: Paragraph[] = [renderSectionTitle(isAr ? "الشهادات والدورات" : "Certifications", isAr)];

  for (const item of cv.certifications) {
    const line = [item.name, item.issuer, item.date].filter((v) => v?.trim()).join(" — ");
    if (!line) continue;
    paras.push(new Paragraph({
      bidirectional: isAr, alignment: align,
      spacing: { before: SPACING.itemBefore, after: 0 },
      children: [new TextRun({ text: line, size: FONT_SIZE.body, font })],
    }));
  }

  return paras;
}
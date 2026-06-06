import { AlignmentType, Paragraph, TextRun } from "https://esm.sh/docx@8.5.0";
import type { CvJsonV1 } from "../../schemas/cv-json-v1.ts";
import { renderSectionTitle } from "./render-section-title.ts";
import { FONT_SIZE, FONT, SPACING } from "../styles/cv-docx-styles.ts";

export function renderProjects(cv: CvJsonV1): Paragraph[] {
  if (!cv.projects.length) return [];
  const isAr = cv.document_language === "ar";
  const font = isAr ? FONT.ar : FONT.en;
  const align = isAr ? AlignmentType.RIGHT : AlignmentType.LEFT;
  const paras: Paragraph[] = [renderSectionTitle(isAr ? "المشاريع" : "Projects", isAr)];

  for (const item of cv.projects) {
    const titleLine = item.date ? `${item.title} — ${item.date}` : item.title;
    paras.push(new Paragraph({
      bidirectional: isAr, alignment: align,
      spacing: { before: SPACING.itemBefore, after: 0 },
      children: [new TextRun({ text: titleLine, bold: true, size: FONT_SIZE.jobTitle, font })],
    }));

    if (item.description) {
      paras.push(new Paragraph({
        bidirectional: isAr, alignment: align,
        spacing: { before: 0, after: item.bullets.length ? 0 : SPACING.itemAfter },
        children: [new TextRun({ text: item.description, size: FONT_SIZE.body, font })],
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
  }

  return paras;
}
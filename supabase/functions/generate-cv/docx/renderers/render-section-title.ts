import { AlignmentType, BorderStyle, Paragraph, TextRun } from "https://esm.sh/docx@8.5.0";
import { FONT_SIZE, FONT, SPACING, COLOR } from "../styles/cv-docx-styles.ts";

export function renderSectionTitle(title: string, isAr: boolean): Paragraph {
  return new Paragraph({
    bidirectional: isAr,
    alignment: isAr ? AlignmentType.RIGHT : AlignmentType.LEFT,
    spacing: { before: SPACING.sectionBefore, after: SPACING.sectionAfter },
    border: {
      bottom: { color: COLOR.black, space: 1, style: BorderStyle.SINGLE, size: 6 },
    },
    children: [
      new TextRun({
        text: title,
        bold: true,
        size: FONT_SIZE.sectionHeader,
        font: isAr ? FONT.ar : FONT.en,
        allCaps: !isAr,
      }),
    ],
  });
}
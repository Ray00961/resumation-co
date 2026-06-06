import { AlignmentType, Paragraph, TextRun } from "https://esm.sh/docx@8.5.0";
import type { CvJsonV1 } from "../../schemas/cv-json-v1.ts";
import { FONT_SIZE, FONT, SPACING } from "../styles/cv-docx-styles.ts";

export function renderHeader(cv: CvJsonV1): Paragraph[] {
  const isAr = cv.document_language === "ar";
  const font = isAr ? FONT.ar : FONT.en;
  const align = isAr ? AlignmentType.RIGHT : AlignmentType.CENTER;

  const paras: Paragraph[] = [
    new Paragraph({
      bidirectional: isAr,
      alignment: align,
      spacing: { before: 0, after: 60 },
      children: [
        new TextRun({
          text: isAr ? cv.full_name : cv.full_name.toUpperCase(),
          bold: true,
          size: FONT_SIZE.name,
          font,
        }),
      ],
    }),
  ];

  if (cv.contact_line) {
    paras.push(
      new Paragraph({
        bidirectional: isAr,
        alignment: align,
        spacing: { before: 0, after: SPACING.headerAfter },
        children: [
          new TextRun({ text: cv.contact_line, size: FONT_SIZE.contact, font }),
        ],
      })
    );
  }

  return paras;
}
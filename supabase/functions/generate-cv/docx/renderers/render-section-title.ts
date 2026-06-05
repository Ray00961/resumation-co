import {
  AlignmentType,
  BorderStyle,
  Paragraph,
  TextRun,
} from "npm:docx@9.7.1";
import {
  BORDER,
  COLOR,
  FONT_SIZE,
  getPrimaryFont,
  type CvDocxLanguage,
} from "../styles/cv-docx-styles.ts";

export function renderSectionTitle(
  title: string,
  language: CvDocxLanguage
): Paragraph {
  const isArabic = language === "ar";

  return new Paragraph({
    alignment: isArabic ? AlignmentType.RIGHT : AlignmentType.LEFT,
    bidirectional: isArabic,
    spacing: {
      before: 220,
      after: 120,
    },
    border: {
      bottom: {
        style: BorderStyle.SINGLE,
        color: BORDER.sectionTitle.color,
        size: BORDER.sectionTitle.size,
        space: BORDER.sectionTitle.space,
      },
    },
    children: [
      new TextRun({
        text: isArabic ? title : title.toUpperCase(),
        bold: true,
        size: FONT_SIZE.sectionTitle,
        color: COLOR.mainText,
        font: getPrimaryFont(language),
      }),
    ],
  });
}
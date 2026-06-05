import {
  AlignmentType,
  Paragraph,
  TextRun,
} from "npm:docx@9.7.1";
import type { CvJsonV1 } from "../../schemas/cv-json-v1.ts";
import {
  COLOR,
  FONT_SIZE,
  SPACING,
  getPrimaryFont,
  type CvDocxLanguage,
} from "../styles/cv-docx-styles.ts";
import { cleanText } from "../utils/text-utils.ts";

export function renderSummary(cv: CvJsonV1): Paragraph[] {
  const language = cv.document_language as CvDocxLanguage;
  const isArabic = language === "ar";
  const summary = cleanText(cv.summary);

  if (summary === "") {
    return [];
  }

  return [
    new Paragraph({
      alignment: isArabic ? AlignmentType.RIGHT : AlignmentType.LEFT,
      bidirectional: isArabic,
      spacing: {
        after: SPACING.afterParagraph,
      },
      children: [
        new TextRun({
          text: summary,
          size: FONT_SIZE.body,
          color: COLOR.mainText,
          font: getPrimaryFont(language),
        }),
      ],
    }),
  ];
}
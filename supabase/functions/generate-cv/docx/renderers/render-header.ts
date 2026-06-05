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
import { buildContactLine } from "../utils/contact-utils.ts";
import { cleanText } from "../utils/text-utils.ts";

export function renderHeader(cv: CvJsonV1): Paragraph[] {
  const language = cv.document_language as CvDocxLanguage;
  const isArabic = language === "ar";

  const fullName = cleanText(cv.full_name);
  const contactLine =
    cleanText(cv.contact_line) !== ""
      ? cleanText(cv.contact_line)
      : buildContactLine(cv.contact);

  const paragraphs: Paragraph[] = [];

  if (fullName !== "") {
    paragraphs.push(
      new Paragraph({
        alignment: isArabic ? AlignmentType.RIGHT : AlignmentType.CENTER,
        bidirectional: isArabic,
        spacing: {
          after: SPACING.afterName,
        },
        children: [
          new TextRun({
            text: fullName,
            bold: true,
            size: FONT_SIZE.name,
            color: COLOR.mainText,
            font: getPrimaryFont(language),
          }),
        ],
      })
    );
  }

  if (contactLine !== "") {
    paragraphs.push(
      new Paragraph({
        alignment: isArabic ? AlignmentType.RIGHT : AlignmentType.CENTER,
        bidirectional: isArabic,
        spacing: {
          after: SPACING.afterContactLine,
        },
        children: [
          new TextRun({
            text: contactLine,
            size: FONT_SIZE.contactLine,
            color: COLOR.secondaryText,
            font: getPrimaryFont(language),
          }),
        ],
      })
    );
  }

  return paragraphs;
}
import {
  AlignmentType,
  Paragraph,
  TextRun,
} from "npm:docx@9.7.1";
import type { EducationItem } from "../../schemas/cv-json-v1.ts";
import {
  COLOR,
  FONT_SIZE,
  SPACING,
  getPrimaryFont,
  type CvDocxLanguage,
} from "../styles/cv-docx-styles.ts";
import {
  cleanText,
  joinNonEmpty,
} from "../utils/text-utils.ts";

export function renderEducationItems(
  items: EducationItem[],
  language: CvDocxLanguage
): Paragraph[] {
  const isArabic = language === "ar";
  const paragraphs: Paragraph[] = [];

  for (const item of items) {
    const degreeLine =
      item.major.trim() !== ""
        ? isArabic
          ? `${cleanText(item.degree)}`
          : `${cleanText(item.degree)} in ${cleanText(item.major)}`
        : cleanText(item.degree);

    const institutionLine = joinNonEmpty(
      [
        cleanText(item.institution),
        cleanText(item.location),
        cleanText(item.date_range),
      ],
      " | "
    );

    if (degreeLine !== "") {
      paragraphs.push(
        new Paragraph({
          alignment: isArabic
            ? AlignmentType.RIGHT
            : AlignmentType.LEFT,
          bidirectional: isArabic,
          children: [
            new TextRun({
              text: degreeLine,
              bold: true,
              size: FONT_SIZE.body,
              color: COLOR.mainText,
              font: getPrimaryFont(language),
            }),
          ],
        })
      );
    }

    if (institutionLine !== "") {
      paragraphs.push(
        new Paragraph({
          alignment: isArabic
            ? AlignmentType.RIGHT
            : AlignmentType.LEFT,
          bidirectional: isArabic,
          children: [
            new TextRun({
              text: institutionLine,
              size: FONT_SIZE.body,
              color: COLOR.secondaryText,
              font: getPrimaryFont(language),
            }),
          ],
        })
      );
    }

    if (cleanText(item.gpa) !== "") {
      paragraphs.push(
        new Paragraph({
          alignment: isArabic
            ? AlignmentType.RIGHT
            : AlignmentType.LEFT,
          bidirectional: isArabic,
          spacing: {
            after: SPACING.afterRole,
          },
          children: [
            new TextRun({
              text: isArabic
                ? `المعدل: ${item.gpa}`
                : `GPA: ${item.gpa}`,
              size: FONT_SIZE.body,
              color: COLOR.mainText,
              font: getPrimaryFont(language),
            }),
          ],
        })
      );
    }
  }

  return paragraphs;
}
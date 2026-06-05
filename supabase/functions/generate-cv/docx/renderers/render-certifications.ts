import { Paragraph, TextRun } from "npm:docx@9.7.1";
import type { CertificationItem } from "../../schemas/cv-json-v1.ts";
import {
  COLOR,
  FONT_SIZE,
  SPACING,
  getPrimaryFont,
  type CvDocxLanguage,
} from "../styles/cv-docx-styles.ts";
import { joinNonEmpty } from "../utils/text-utils.ts";

export function renderCertifications(
  items: CertificationItem[],
  language: CvDocxLanguage
): Paragraph[] {
  return items
    .map((item) => {
      const line = joinNonEmpty(
        [item.name, item.issuer, item.date],
        " — "
      );

      if (!line) return null;

      return new Paragraph({
        bidirectional: language === "ar",
        spacing: {
          after: SPACING.afterParagraph,
        },
        children: [
          new TextRun({
            text: line,
            size: FONT_SIZE.body,
            color: COLOR.mainText,
            font: getPrimaryFont(language),
          }),
        ],
      });
    })
    .filter(Boolean) as Paragraph[];
}
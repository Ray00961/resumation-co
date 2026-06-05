import { Paragraph, TextRun } from "npm:docx@9.7.1";
import type { LanguageItem } from "../../schemas/cv-json-v1.ts";
import {
  COLOR,
  FONT_SIZE,
  SPACING,
  getPrimaryFont,
  type CvDocxLanguage,
} from "../styles/cv-docx-styles.ts";

export function renderLanguages(
  items: LanguageItem[],
  language: CvDocxLanguage
): Paragraph[] {
  return items.map(
    (item) =>
      new Paragraph({
        bidirectional: language === "ar",
        spacing: {
          after: SPACING.afterParagraph,
        },
        children: [
          new TextRun({
            text: `${item.language}: ${item.level}`,
            size: FONT_SIZE.body,
            color: COLOR.mainText,
            font: getPrimaryFont(language),
          }),
        ],
      })
  );
}
import { Paragraph, TextRun } from "npm:docx@9.7.1";
import type { ProjectItem } from "../../schemas/cv-json-v1.ts";
import {
  COLOR,
  FONT_SIZE,
  SPACING,
  getPrimaryFont,
  type CvDocxLanguage,
} from "../styles/cv-docx-styles.ts";

export function renderProjects(
  items: ProjectItem[],
  language: CvDocxLanguage
): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  for (const item of items) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: item.title,
            bold: true,
            size: FONT_SIZE.body,
            color: COLOR.mainText,
            font: getPrimaryFont(language),
          }),
        ],
      })
    );

    if (item.description) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: item.description,
              size: FONT_SIZE.body,
              color: COLOR.mainText,
              font: getPrimaryFont(language),
            }),
          ],
        })
      );
    }

    for (const bullet of item.bullets) {
      paragraphs.push(
        new Paragraph({
          bullet: {
            level: 0,
          },
          children: [
            new TextRun({
              text: bullet,
              size: FONT_SIZE.bullet,
              font: getPrimaryFont(language),
            }),
          ],
        })
      );
    }

    paragraphs.push(
      new Paragraph({
        spacing: {
          after: SPACING.afterRole,
        },
      })
    );
  }

  return paragraphs;
}
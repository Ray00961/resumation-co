import {
  AlignmentType,
  Paragraph,
  TextRun,
} from "npm:docx@9.7.1";
import type { ExperienceItem } from "../../schemas/cv-json-v1.ts";
import {
  COLOR,
  FONT_SIZE,
  INDENT,
  SPACING,
  getPrimaryFont,
  type CvDocxLanguage,
} from "../styles/cv-docx-styles.ts";
import {
  cleanText,
  cleanTextArray,
  joinNonEmpty,
} from "../utils/text-utils.ts";

function renderRoleHeader(
  item: ExperienceItem,
  language: CvDocxLanguage
): Paragraph[] {
  const isArabic = language === "ar";

  const titleCompanyLine = joinNonEmpty(
    [item.job_title, item.company],
    " | "
  );

  const locationDateLine = joinNonEmpty(
    [item.location, item.date_range],
    " | "
  );

  const paragraphs: Paragraph[] = [];

  if (titleCompanyLine !== "") {
    paragraphs.push(
      new Paragraph({
        alignment: isArabic ? AlignmentType.RIGHT : AlignmentType.LEFT,
        bidirectional: isArabic,
        spacing: {
          after: 60,
        },
        children: [
          new TextRun({
            text: titleCompanyLine,
            bold: true,
            size: FONT_SIZE.body,
            color: COLOR.mainText,
            font: getPrimaryFont(language),
          }),
        ],
      })
    );
  }

  if (locationDateLine !== "") {
    paragraphs.push(
      new Paragraph({
        alignment: isArabic ? AlignmentType.RIGHT : AlignmentType.LEFT,
        bidirectional: isArabic,
        spacing: {
          after: 80,
        },
        children: [
          new TextRun({
            text: locationDateLine,
            italics: language === "en",
            size: FONT_SIZE.date,
            color: COLOR.secondaryText,
            font: getPrimaryFont(language),
          }),
        ],
      })
    );
  }

  return paragraphs;
}

function renderBullet(
  text: string,
  language: CvDocxLanguage
): Paragraph {
  const isArabic = language === "ar";

  return new Paragraph({
    alignment: isArabic ? AlignmentType.RIGHT : AlignmentType.LEFT,
    bidirectional: isArabic,
    bullet: {
      level: 0,
    },
    indent: {
      left: isArabic ? 0 : INDENT.bulletLeft,
      hanging: isArabic ? 0 : INDENT.bulletHanging,
    },
    spacing: {
      after: SPACING.bulletAfter,
    },
    children: [
      new TextRun({
        text,
        size: FONT_SIZE.bullet,
        color: COLOR.mainText,
        font: getPrimaryFont(language),
      }),
    ],
  });
}

export function renderExperienceItems(
  items: ExperienceItem[],
  language: CvDocxLanguage
): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  for (const item of items) {
    const cleanedItem: ExperienceItem = {
      job_title: cleanText(item.job_title),
      company: cleanText(item.company),
      location: cleanText(item.location),
      date_range: cleanText(item.date_range),
      bullets: cleanTextArray(item.bullets),
    };

    const hasHeader =
      cleanedItem.job_title !== "" ||
      cleanedItem.company !== "" ||
      cleanedItem.location !== "" ||
      cleanedItem.date_range !== "";

    const hasBullets = cleanedItem.bullets.length > 0;

    if (!hasHeader && !hasBullets) {
      continue;
    }

    paragraphs.push(...renderRoleHeader(cleanedItem, language));

    for (const bullet of cleanedItem.bullets) {
      paragraphs.push(renderBullet(bullet, language));
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
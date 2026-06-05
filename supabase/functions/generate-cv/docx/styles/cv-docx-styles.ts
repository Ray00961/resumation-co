export const PAGE = {
  size: "A4",
  margin: {
    top: 864,
    bottom: 864,
    left: 936,
    right: 936,
  },
} as const;

export const FONT = {
  english: "Calibri",
  arabic: "Arial",
  arabicFallback: "Arial Unicode MS",
} as const;

export const FONT_SIZE = {
  name: 48,
  contactLine: 20,
  sectionTitle: 22,
  body: 20,
  bullet: 20,
  date: 20,
} as const;

export const COLOR = {
  mainText: "000000",
  secondaryText: "404040",
  border: "404040",
} as const;

export const SPACING = {
  afterName: 120,
  afterContactLine: 240,
  beforeSection: 220,
  afterSectionTitle: 120,
  afterParagraph: 100,
  afterRole: 180,
  bulletAfter: 80,
} as const;

export const INDENT = {
  bulletLeft: 360,
  bulletHanging: 180,
} as const;

export const BORDER = {
  sectionTitle: {
    color: COLOR.border,
    size: 6,
    space: 1,
  },
} as const;

export type CvDocxLanguage = "en" | "ar";

export function isArabic(language: CvDocxLanguage): boolean {
  return language === "ar";
}

export function getPrimaryFont(language: CvDocxLanguage): string {
  return isArabic(language) ? FONT.arabic : FONT.english;
}

export function getBodyFontSize(): number {
  return FONT_SIZE.body;
}

export function getBulletFontSize(): number {
  return FONT_SIZE.bullet;
}

export function getSectionTitleFontSize(): number {
  return FONT_SIZE.sectionTitle;
}
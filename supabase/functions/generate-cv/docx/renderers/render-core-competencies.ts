import { AlignmentType, Paragraph, TextRun } from "https://esm.sh/docx@8.5.0";
import type { CvJsonV1 } from "../../schemas/cv-json-v1.ts";
import { renderSectionTitle } from "./render-section-title.ts";
import { FONT_SIZE, FONT, SPACING } from "../styles/cv-docx-styles.ts";

const LABELS = {
  en: { section: "Core Competencies", technical: "Technical Skills", industry: "Industry Knowledge", professional: "Professional Skills" },
  ar: { section: "الكفاءات الأساسية", technical: "المهارات التقنية", industry: "المعرفة بالمجال", professional: "المهارات المهنية" },
};

export function renderCoreCompetencies(cv: CvJsonV1): Paragraph[] {
  const { technical_skills: ts, industry_knowledge: ik, professional_skills: ps } = cv.core_competencies;
  if (!ts.length && !ik.length && !ps.length) return [];

  const isAr = cv.document_language === "ar";
  const font = isAr ? FONT.ar : FONT.en;
  const align = isAr ? AlignmentType.RIGHT : AlignmentType.LEFT;
  const L = isAr ? LABELS.ar : LABELS.en;
  const paras: Paragraph[] = [renderSectionTitle(L.section, isAr)];

  const addRow = (label: string, items: string[]) => {
    if (!items.length) return;
    paras.push(
      new Paragraph({
        bidirectional: isAr,
        alignment: align,
        spacing: { before: SPACING.itemBefore, after: 0 },
        children: [
          new TextRun({ text: `${label}: `, bold: true, size: FONT_SIZE.body, font }),
          new TextRun({ text: items.join("  |  "), size: FONT_SIZE.body, font }),
        ],
      })
    );
  };

  addRow(L.technical, ts);
  addRow(L.industry, ik);
  addRow(L.professional, ps);
  return paras;
}
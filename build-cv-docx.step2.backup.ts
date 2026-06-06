import { Document, Packer } from "https://esm.sh/docx@8.5.0";
import type { CvJsonV1 } from "../../schemas/cv-json-v1.ts";
import { validateCvJsonV1 } from "../../validators/validate-cv-json.ts";
import { normalizeCvJsonV1 } from "../../validators/normalize-cv-json.ts";
import { PAGE_MARGINS } from "../styles/cv-docx-styles.ts";
import { buildProfessionalSections } from "../templates/professional-template.ts";
import { buildFreshGraduateSections } from "../templates/fresh-graduate-template.ts";

export async function buildCvDocx(rawCv: unknown): Promise<Uint8Array> {
  const validation = validateCvJsonV1(rawCv);
  if (!validation.valid) {
    throw new Error(`CvJsonV1 validation failed: ${validation.errors.join(" | ")}`);
  }

  const cv = normalizeCvJsonV1(rawCv as CvJsonV1);

  const sections = cv.candidate_level === "fresh_graduate"
    ? buildFreshGraduateSections(cv)
    : buildProfessionalSections(cv);

  const doc = new Document({
    sections: [{
      properties: { page: { margin: PAGE_MARGINS } },
      children: sections,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}
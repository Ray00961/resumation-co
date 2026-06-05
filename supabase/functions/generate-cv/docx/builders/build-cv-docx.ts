import {
  Document,
  Packer,
} from "npm:docx@9.7.1";
import type { CvJsonV1 } from "../../schemas/cv-json-v1.ts";
import { validateCvJsonV1 } from "../../validators/validate-cv-json.ts";
import { PAGE } from "../styles/cv-docx-styles.ts";
import { selectCvTemplate } from "./select-cv-template.ts";

export async function buildCvDocx(cv: CvJsonV1): Promise<Uint8Array> {
  const result = validateCvJsonV1(cv);

  if (!result.valid || !result.normalized) {
    throw new Error(`Invalid CvJsonV1: ${result.errors.join(", ")}`);
  }

  const normalized = result.normalized;
  const template = selectCvTemplate(normalized);
  const children = template(normalized);

  const document = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: PAGE.margin,
          },
        },
        children,
      },
    ],
  });

  return await Packer.toBuffer(document);
}
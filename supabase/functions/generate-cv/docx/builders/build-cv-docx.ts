import { Document, Packer } from "https://esm.sh/docx@8.5.0";
import JSZip from "https://esm.sh/jszip@3.10.1";
import type { CvJsonV1 } from "../../schemas/cv-json-v1.ts";
import { validateCvJsonV1 } from "../../validators/validate-cv-json.ts";
import { normalizeCvJsonV1 } from "../../validators/normalize-cv-json.ts";
import { PAGE_MARGINS } from "../styles/cv-docx-styles.ts";
import { selectCvTemplate } from "./select-cv-template.ts";

async function forceArabicParagraphDirection(bytes: Uint8Array): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(bytes);
  const documentXmlFile = zip.file("word/document.xml");
  if (!documentXmlFile) return bytes;

  let xml = await documentXmlFile.async("string");
  xml = xml.replace(/<w:jc w:val="right"\/>/g, "");

  xml = xml.replace(/<w:pPr>(?![\s\S]*?<\/w:pPr>[\s\S]*?<w:pPr>)([\s\S]*?)<\/w:pPr>/g, (match, inner) => {
    if (inner.includes("<w:bidi")) return match;
    return `<w:pPr><w:bidi/>${inner}</w:pPr>`;
  });

  xml = xml.replace(/<w:pPr>([\s\S]*?)<\/w:pPr>/g, (match, inner) => {
    if (inner.includes("<w:bidi")) return match;
    return `<w:pPr><w:bidi/>${inner}</w:pPr>`;
  });

  xml = xml.replace(/<w:sectPr([^>]*)>([\s\S]*?)<\/w:sectPr>/g, (match, attrs, inner) => inner.includes("<w:bidi") ? match : `<w:sectPr${attrs}>${inner}<w:bidi/></w:sectPr>`);
  zip.file("word/document.xml", xml);

  const settingsXmlFile = zip.file("word/settings.xml");
  if (settingsXmlFile) {
    let settings = await settingsXmlFile.async("string");

    if (settings.includes("<w:themeFontLang")) {
      settings = settings.replace(
        /<w:themeFontLang[^>]*\/>/,
        '<w:themeFontLang w:val="en-US" w:bidi="ar-SA"/>'
      );
    } else {
      settings = settings.replace(
        "</w:settings>",
        '<w:themeFontLang w:val="en-US" w:bidi="ar-SA"/></w:settings>'
      );
    }

    zip.file("word/settings.xml", settings);
  }

  const patched = await zip.generateAsync({ type: "uint8array" });
  return patched;
}

export async function buildCvDocx(rawCv: unknown): Promise<Uint8Array> {
  const validation = validateCvJsonV1(rawCv);
  if (!validation.valid) {
    throw new Error(`CvJsonV1 validation failed: ${validation.errors.join(" | ")}`);
  }

  const cv = normalizeCvJsonV1(rawCv as CvJsonV1);
  const isAr = cv.document_language === "ar";
  const buildSections = selectCvTemplate(cv);
  const sections = buildSections(cv);

  const doc = new Document({
    sections: [{
      properties: {
        page: { margin: PAGE_MARGINS },
      },
      children: sections,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const bytes = new Uint8Array(buffer);

  return isAr ? await forceArabicParagraphDirection(bytes) : bytes;
}

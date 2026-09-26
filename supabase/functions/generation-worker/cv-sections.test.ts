// Offline tests for the additive cv-json-v1 fields section_order and
// core_competencies.software_tools: validation, the final-CV rebuild,
// normalization, template selection and the real DOCX output.
//
//   deno test --allow-read --allow-env --allow-net=esm.sh --no-check=remote supabase/functions/generation-worker/cv-sections.test.ts

import { assert, assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
// @ts-ignore esm.sh default export typing issue
import JSZip from "https://esm.sh/jszip@3.10.1?target=deno";
import type { CvJsonV1 } from "../generate-cv/schemas/cv-json-v1.ts";
import { validateCvJsonV1 } from "../generate-cv/validators/validate-cv-json.ts";
import { normalizeCvJsonV1 } from "../generate-cv/validators/normalize-cv-json.ts";
import { buildCvDocx } from "../generate-cv/docx/builders/build-cv-docx.ts";
import { resolveSectionOrder, selectCvTemplate } from "../generate-cv/docx/builders/select-cv-template.ts";
import { buildProfessionalSections } from "../generate-cv/docx/templates/professional-template.ts";
import { buildFreshGraduateSections } from "../generate-cv/docx/templates/fresh-graduate-template.ts";
import { buildArabicProfessionalTemplate } from "../generate-cv/docx/templates/arabic-professional-template.ts";
import { buildArabicFreshGraduateTemplate } from "../generate-cv/docx/templates/arabic-fresh-graduate-template.ts";
import { toFinalCvJsonV1 } from "./final-cv.ts";
import { StageError } from "./errors.ts";

/** A legacy CV (no new fields) with data in every section. */
function legacyCv(lang: "en" | "ar" = "en", extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    document_language: lang,
    candidate_level: "mid",
    full_name: "Test Candidate",
    contact: { email: "t@example.com", phone: "+10000000000", linkedin: "", location: "Cairo" },
    contact_line: "",
    target_job: "Data Analyst",
    nationality: "Egyptian",
    summary: "Summary text.",
    core_competencies: { technical_skills: ["SQL"], industry_knowledge: ["Retail"], professional_skills: ["Reporting"] },
    experience: [{ job_title: "Analyst", company: "Acme", location: "", date_range: "2022 - Present", bullets: ["Built reports"] }],
    internships: [{ job_title: "Intern", company: "Beta", location: "", date_range: "2021", bullets: [] }],
    education: [{ degree: "BSc", major: "Statistics", institution: "Cairo University", location: "", date_range: "2018 - 2022", gpa: "" }],
    certifications: [{ name: "Cert A", issuer: "Issuer", date: "2023" }],
    projects: [{ title: "Project A", date: "", description: "Desc", bullets: [] }],
    languages: [{ language: "English", level: "Fluent" }],
    ...extra,
  };
}

function withCc(cv: Record<string, unknown>, cc: Record<string, unknown>): Record<string, unknown> {
  return { ...cv, core_competencies: { ...(cv.core_competencies as object), ...cc } };
}

async function documentXml(cv: unknown): Promise<string> {
  const zip = await JSZip.loadAsync(await buildCvDocx(cv));
  return await zip.file("word/document.xml").async("string");
}

/** Positions of the given texts in document.xml; each must be present. */
function positions(xml: string, texts: string[]): number[] {
  return texts.map((t) => {
    const i = xml.indexOf(`>${t}<`);
    assert(i >= 0, `missing in DOCX: ${t}`);
    return i;
  });
}

const isAscending = (xs: number[]) => xs.every((x, i) => i === 0 || xs[i - 1] < x);

// ── validateCvJsonV1 ─────────────────────────────────────────────────────────
Deno.test("validator: legacy JSON without the new fields stays valid; valid new fields accepted", () => {
  assert(validateCvJsonV1(legacyCv()).valid);
  const full = withCc(legacyCv("en", { section_order: ["education", "summary"] }), { software_tools: ["Excel", "Power BI"] });
  assert(validateCvJsonV1(full).valid);
  assert(validateCvJsonV1(legacyCv("en", { section_order: [] })).valid, "empty section_order is a valid array");
});

Deno.test("validator: invalid section_order (type, unknown key, duplicate) fails", () => {
  const bad: unknown[] = [
    "summary", null, {}, 3,
    [1],
    ["header"],
    ["summary", "Skills"],
    ["summary", "summary"],
    ["education", "experience", "education"],
  ];
  for (const section_order of bad) {
    const r = validateCvJsonV1(legacyCv("en", { section_order }));
    assert(!r.valid, JSON.stringify(section_order));
    assert(r.errors.every((e) => !e.includes("Test Candidate")), "no values echoed");
  }
});

Deno.test("validator: invalid software_tools (type, non-string item) fails", () => {
  for (const software_tools of ["Excel", null, {}, ["Excel", 2], [null]]) {
    const r = validateCvJsonV1(withCc(legacyCv(), { software_tools }));
    assert(!r.valid, JSON.stringify(software_tools));
  }
});

// ── toFinalCvJsonV1 ──────────────────────────────────────────────────────────
Deno.test("final CV: legacy JSON → software_tools [] and no section_order key", () => {
  const out = toFinalCvJsonV1(legacyCv(), "en");
  assertEquals(out.core_competencies.software_tools, []);
  assert(!("section_order" in out));
  assertEquals(Object.keys(out.core_competencies)[0], "software_tools");
});

Deno.test("final CV: section_order and software_tools preserved (trimmed, blanks dropped)", () => {
  const raw = withCc(
    legacyCv("en", { section_order: ["education", "experience", "summary"] }),
    { software_tools: ["  Excel ", "", " ", "Power BI"] },
  );
  const out = toFinalCvJsonV1(raw, "en");
  assertEquals(out.section_order, ["education", "experience", "summary"]);
  assertEquals(out.core_competencies.software_tools, ["Excel", "Power BI"]);
  assert(validateCvJsonV1(out).valid);
  // Rebuilt, not aliased: mutating the input cannot change the final object.
  (raw.section_order as string[]).push("languages");
  assertEquals(out.section_order, ["education", "experience", "summary"]);
});

Deno.test("final CV: bad new fields → cv_validation_failed", () => {
  const cases = [
    legacyCv("en", { section_order: ["summary", "summary"] }),
    legacyCv("en", { section_order: ["unknown_section"] }),
    legacyCv("en", { section_order: "summary" }),
    withCc(legacyCv(), { software_tools: "Excel" }),
    withCc(legacyCv(), { software_tools: [42] }),
    withCc(legacyCv(), { software_tools: ["<b>Excel</b>"] }),
  ];
  for (const raw of cases) {
    const e = assertThrows(() => toFinalCvJsonV1(raw, "en"), StageError);
    assertEquals(e.code, "cv_validation_failed");
  }
});

// ── normalizeCvJsonV1 ────────────────────────────────────────────────────────
Deno.test("normalizer: keeps both fields; absent software_tools → []; absent section_order stays absent", () => {
  const legacy = normalizeCvJsonV1(legacyCv() as unknown as CvJsonV1);
  assertEquals(legacy.core_competencies.software_tools, []);
  assert(!("section_order" in legacy));
  const full = normalizeCvJsonV1(withCc(legacyCv("en", { section_order: ["languages"] }), { software_tools: ["Excel"] }) as unknown as CvJsonV1);
  assertEquals(full.section_order, ["languages"]);
  assertEquals(full.core_competencies.software_tools, ["Excel"]);
});

// ── Template selection / ordering ────────────────────────────────────────────
Deno.test("selectCvTemplate: without section_order the exact legacy template is chosen", () => {
  const cases: [string, string, unknown][] = [
    ["en", "mid", buildProfessionalSections],
    ["en", "fresh_graduate", buildFreshGraduateSections],
    ["ar", "senior", buildArabicProfessionalTemplate],
    ["ar", "fresh_graduate", buildArabicFreshGraduateTemplate],
  ];
  for (const [lang, level, expected] of cases) {
    const cv = toFinalCvJsonV1(legacyCv(lang as "en" | "ar", { candidate_level: level }), lang as "en" | "ar");
    assertEquals(selectCvTemplate(cv), expected, `${lang}/${level}`);
  }
  const ordered = toFinalCvJsonV1(legacyCv("en", { section_order: ["summary"] }), "en");
  assert(![buildProfessionalSections, buildFreshGraduateSections].includes(selectCvTemplate(ordered) as never));
});

Deno.test("resolveSectionOrder: listed first, then unlisted sections with data in canonical order", () => {
  const cv = toFinalCvJsonV1(legacyCv("en", { section_order: ["education", "experience", "summary"], projects: [] }), "en");
  assertEquals(resolveSectionOrder(cv), [
    "education", "experience", "summary",
    // appended, canonical order; projects omitted because it has no data
    "core_competencies", "internships", "certifications", "languages",
  ]);
  const empty = toFinalCvJsonV1(legacyCv("en", { section_order: [] }), "en");
  assertEquals(resolveSectionOrder(empty), [
    "summary", "core_competencies", "experience", "education", "internships", "projects", "certifications", "languages",
  ]);
  // software_tools alone makes core_competencies renderable.
  const onlyTools = toFinalCvJsonV1(withCc(legacyCv("en", { section_order: ["summary"] }),
    { software_tools: ["Excel"], technical_skills: [], industry_knowledge: [], professional_skills: [] }), "en");
  assert(resolveSectionOrder(onlyTools).includes("core_competencies"));
});

// ── Real DOCX output ─────────────────────────────────────────────────────────
Deno.test("DOCX: section_order drives section order; header first; missing sections appended", async () => {
  const cv = toFinalCvJsonV1(legacyCv("en", { section_order: ["education", "experience", "summary"] }), "en");
  const xml = await documentXml(cv);
  const pos = positions(xml, [
    "TEST CANDIDATE", "Education", "Professional Experience", "Professional Summary",
    "Core Competencies", "Internships", "Projects", "Certifications", "Languages",
  ]);
  assert(isAscending(pos), `unexpected order: ${pos}`);
});

Deno.test("DOCX: legacy JSON keeps the fixed template order (and its existing omissions)", async () => {
  const pro = await documentXml(toFinalCvJsonV1(legacyCv("en"), "en"));
  assert(isAscending(positions(pro, [
    "Professional Summary", "Core Competencies", "Professional Experience", "Education", "Certifications", "Projects", "Languages",
  ])));
  assert(!pro.includes(">Internships<"), "professional template does not render internships");

  const fresh = await documentXml(toFinalCvJsonV1(legacyCv("en", { candidate_level: "fresh_graduate" }), "en"));
  assert(isAscending(positions(fresh, [
    "Professional Summary", "Education", "Projects", "Internships", "Core Competencies", "Certifications", "Languages",
  ])));
  assert(!fresh.includes(">Professional Experience<"), "fresh-graduate template does not render experience");
});

Deno.test("DOCX: software_tools renders first in Core Competencies (EN + AR), also when it is the only group", async () => {
  const en = await documentXml(toFinalCvJsonV1(withCc(legacyCv("en"), { software_tools: ["Excel"] }), "en"));
  assert(isAscending(positions(en, ["Software &amp; Tools: ", "Technical Skills: ", "Industry Knowledge: ", "Professional Skills: "])));
  assert(en.includes(">Excel<"));

  const ar = await documentXml(toFinalCvJsonV1(withCc(legacyCv("ar"), { software_tools: ["Excel"] }), "ar"));
  assert(isAscending(positions(ar, ["البرامج والأدوات: ", "المهارات التقنية: ", "المعرفة بالمجال: ", "المهارات المهنية: "])));

  const only = await documentXml(toFinalCvJsonV1(withCc(legacyCv("en"),
    { software_tools: ["Excel"], technical_skills: [], industry_knowledge: [], professional_skills: [] }), "en"));
  positions(only, ["Core Competencies", "Software &amp; Tools: "]);
  assert(!only.includes("Technical Skills: "));

  const none = await documentXml(toFinalCvJsonV1(legacyCv("en"), "en"));
  assert(!none.includes("Software &amp; Tools"), "no row when software_tools is empty");
});

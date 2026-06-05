# DOCX Builder Architecture

Status: Approved

Version: 1.1

Purpose:

Convert `CvJsonV1` into professional, ATS-safe DOCX files using `docx@8`.

Input:

`CvJsonV1`

Output:

DOCX

Technology:

`docx@8`

---

## Context

The old CV generation architecture was:

```txt
GPT
→ HTML
→ html-to-docx
→ DOCX
```

This caused unstable DOCX formatting because HTML/CSS rules were not reliably preserved inside Word documents.

The new CV Engine 2.0 architecture is:

```txt
GPT
→ CvJsonV1
→ Validation
→ Normalization
→ docx@8 Template Builder
→ DOCX
```

The purpose of this builder is to fully remove HTML/CSS responsibility from GPT and move all layout, spacing, borders, typography, and DOCX formatting into code.

---

## Architecture Decision

The DOCX Builder must be responsible for:

* Page layout
* Margins
* Fonts
* Font sizes
* Section spacing
* Section borders
* Header layout
* Bullet rendering
* Dates styling
* Section ordering
* Arabic RTL rendering
* DOCX export

The DOCX Builder must NOT be responsible for:

* Generating CV content
* Rewriting candidate experience
* Creating ATS keywords
* Translating text
* Classifying candidate level
* Inventing missing data
* Parsing PDFs
* Parsing Word documents
* Parsing LinkedIn profiles
* Mapping raw import payloads

Content belongs to the GPT prompts and import mapping layers.

Design and DOCX rendering belong to the DOCX Builder.

---

## Non-Goals

This phase must not change:

* Frontend flow
* Payment flow
* Supabase schema
* Storage logic
* Paymob logic
* WishMoney logic
* SuccessPage
* BuildingPage
* User authentication
* Existing production generation flow until the new builder is tested

---

## Source of Truth

The DOCX Builder must use:

```txt
CV_JSON_V1_SPEC.md
```

as the official schema source.

The builder must accept only validated `CvJsonV1` data.

The builder must not depend on GPT output directly without validation.

The builder must not depend on raw import data from PDF, Word, LinkedIn, or manual form sources.

All sources must be mapped into `CvJsonV1` before validation and rendering.

---

## Input Contract

The builder receives:

```ts
type BuildCvDocxInput = {
  cv: CvJsonV1;
  options?: BuildCvDocxOptions;
};
```

Example:

```ts
await buildCvDocx({
  cv,
  options: {
    template: "auto",
    language: cv.document_language,
  },
});
```

---

## Supported Input Sources

All candidate data sources must be converted into `CvJsonV1` before reaching the DOCX Builder.

Supported sources:

* Manual Form Input
* PDF Resume Import
* Word Resume Import
* LinkedIn Profile Import

All import pipelines must map their extracted data into the official `CvJsonV1` schema.

The DOCX Builder must never depend on:

* Raw form payloads
* Raw PDF parsing output
* Raw DOCX parsing output
* Raw LinkedIn data
* Raw GPT output

The DOCX Builder accepts only validated and normalized `CvJsonV1`.

Pipeline:

```txt
Manual Form Input
PDF Resume Import
Word Resume Import
LinkedIn Profile Import
↓
Mapping Layer
↓
CvJsonV1
↓
Validation
↓
Normalization
↓
DOCX Builder
```

The mapping layer is responsible for converting each source into the approved schema.

The DOCX Builder is not responsible for fixing, guessing, or interpreting raw source data.

---

## CvJsonV1 Root Shape

```ts
type CvJsonV1 = {
  document_language: "en" | "ar";
  candidate_level:
    | "fresh_graduate"
    | "junior"
    | "mid"
    | "senior"
    | "executive";

  full_name: string;

  contact: {
    email: string;
    phone: string;
    linkedin: string;
    location: string;
  };

  contact_line: string;
  target_job: string;
  nationality: string;

  summary: string;

  core_competencies: {
    technical_skills: string[];
    industry_knowledge: string[];
    professional_skills: string[];
  };

  experience: ExperienceItem[];
  internships: ExperienceItem[];
  education: EducationItem[];
  certifications: CertificationItem[];
  projects: ProjectItem[];
  languages: LanguageItem[];
};
```

---

## Item Types

```ts
type ExperienceItem = {
  job_title: string;
  company: string;
  location: string;
  date_range: string;
  bullets: string[];
};
```

```ts
type EducationItem = {
  degree: string;
  major: string;
  institution: string;
  location: string;
  date_range: string;
  gpa: string;
};
```

```ts
type CertificationItem = {
  name: string;
  issuer: string;
  date: string;
};
```

```ts
type ProjectItem = {
  title: string;
  date: string;
  description: string;
  bullets: string[];
};
```

```ts
type LanguageItem = {
  language: string;
  level: string;
};
```

---

## Proposed Folder Structure

Recommended location inside the Supabase Edge Function or shared generation module:

```txt
supabase/functions/generate-cv/

  index.ts

  prompts/
    cv-json-en.ts
    cv-json-ar.ts
    cl-json-en.ts
    cl-json-ar.ts

  schemas/
    cv-json-v1.ts
    cover-letter-json-v1.ts

  validators/
    validate-cv-json.ts
    validate-cover-letter-json.ts

  normalizers/
    normalize-cv-json.ts
    normalize-cover-letter-json.ts

  mappers/
    map-form-to-cv-json.ts
    map-pdf-import-to-cv-json.ts
    map-word-import-to-cv-json.ts
    map-linkedin-import-to-cv-json.ts

  docx/
    builders/
      build-cv-docx.ts
      build-cover-letter-docx.ts

    templates/
      professional-template.ts
      fresh-graduate-template.ts
      arabic-professional-template.ts
      arabic-fresh-graduate-template.ts

    renderers/
      render-header.ts
      render-section-title.ts
      render-summary.ts
      render-core-competencies.ts
      render-experience.ts
      render-education.ts
      render-certifications.ts
      render-projects.ts
      render-languages.ts
      render-spacer.ts

    styles/
      cv-docx-styles.ts
      arabic-docx-styles.ts

    utils/
      docx-units.ts
      text-utils.ts
      section-utils.ts
      rtl-utils.ts
      bullet-utils.ts
      contact-utils.ts
```

Important:

Do not place the full builder inside `index.ts`.

`index.ts` should orchestrate the flow only.

Import mappers should remain separate from the DOCX Builder.

---

## High-Level Pipeline

```txt
Manual Form Input
PDF Resume Import
Word Resume Import
LinkedIn Profile Import
↓
Mapping Layer
↓
CvJsonV1
↓
validateCvJsonV1()
↓
normalizeCvJsonV1()
↓
selectCvTemplate()
↓
buildCvSections()
↓
renderDocxDocument()
↓
DOCX Buffer
↓
Upload to Supabase Storage
```

---

## Builder Responsibilities

The main builder function should:

1. Receive `CvJsonV1`.
2. Validate the input shape.
3. Stop immediately if validation fails.
4. Use normalized data returned by the validator.
5. Determine language direction.
6. Select the correct template strategy.
7. Render sections in the correct order.
8. Apply global DOCX styles.
9. Generate the DOCX buffer.
10. Return the buffer to the existing generation flow.

Example:

```ts
export async function buildCvDocx(
  cv: CvJsonV1
): Promise<Uint8Array> {
  const result = validateCvJsonV1(cv);

  if (!result.valid || !result.normalized) {
    throw new Error(
      `Invalid CvJsonV1: ${result.errors.join(", ")}`
    );
  }

  const normalized = result.normalized;

  const template = selectCvTemplate(normalized);

  const document = template.build(normalized);

  return await Packer.toBuffer(document);
}
```

The builder must never call `normalizeCvJsonV1()` directly on raw GPT output or raw import payloads.

Validation must happen first.

---

## Normalization Before Rendering

Normalization must not invent content.

Normalization may only generate safe derived values from existing structured fields.

Allowed normalization:

* Generate `contact_line` from existing `contact` fields if `contact_line` is empty.
* Trim extra whitespace.
* Remove empty separators.
* Ensure arrays exist when safe.
* Ensure text fields exist as empty strings when safe.

Not allowed:

* Inventing email
* Inventing phone
* Inventing LinkedIn
* Inventing location
* Inventing nationality
* Inventing job titles
* Inventing dates
* Inventing education
* Inventing employers
* Inventing responsibilities
* Inventing achievements
* Rewriting candidate content

Example:

```ts
function normalizeCvJsonV1(cv: CvJsonV1): CvJsonV1 {
  return {
    ...cv,
    contact_line:
      cv.contact_line ||
      buildContactLine(cv.contact),
  };
}
```

---

## Contact Line Fallback

`contact_line` is used by the Header Renderer.

If `contact_line` is empty, generate it only from:

```ts
cv.contact.email
cv.contact.phone
cv.contact.linkedin
cv.contact.location
```

Rules:

* Use only existing non-empty contact fields.
* Preserve original values.
* Do not invent missing values.
* Do not include empty separators.
* Do not include nationality automatically.
* Do not include birth information automatically.
* Recommended separator: `|`

Example:

```ts
function buildContactLine(contact: CvJsonV1["contact"]): string {
  return joinNonEmpty(
    [contact.email, contact.phone, contact.linkedin, contact.location],
    " | "
  );
}
```

This protects manual form input, PDF imports, Word imports, and LinkedIn imports where structured contact fields may exist but `contact_line` has not yet been generated.

`nationality` remains a separate schema field.

If a future template intentionally wants to display nationality, it must do so explicitly through a renderer decision, not through automatic contact line generation.

---

## Template Selection

Template selection must be based on:

* `document_language`
* `candidate_level`

Do not use `template_type`.

### Template Selection Logic

```ts
function selectCvTemplate(cv: CvJsonV1) {
  if (
    cv.document_language === "ar" &&
    cv.candidate_level === "fresh_graduate"
  ) {
    return ArabicFreshGraduateCvTemplate;
  }

  if (cv.document_language === "ar") {
    return ArabicProfessionalCvTemplate;
  }

  if (cv.candidate_level === "fresh_graduate") {
    return FreshGraduateCvTemplate;
  }

  return ProfessionalCvTemplate;
}
```

Reason:

Arabic CVs still need different section ordering depending on candidate level.

A fresh graduate Arabic CV should not use the same section order as a professional Arabic CV.

---

## Section Order

### Professional Template Order

Use for:

* junior
* mid
* senior
* executive

Order:

1. Header
2. Professional Summary
3. Core Competencies
4. Professional Experience
5. Education
6. Certifications
7. Projects
8. Languages

---

### Fresh Graduate Template Order

Use for:

* fresh_graduate

Order:

1. Header
2. Professional Summary
3. Education
4. Projects
5. Internships / Volunteer Experience
6. Core Competencies
7. Certifications
8. Languages

---

### Arabic Professional Template Order

Use for:

* Arabic junior
* Arabic mid
* Arabic senior
* Arabic executive

Order:

1. Header
2. Professional Summary
3. Core Competencies
4. Professional Experience
5. Education
6. Certifications
7. Projects
8. Languages

Arabic rendering rules:

* RTL paragraph direction
* Right alignment
* Arabic-compatible font fallback
* Arabic date text preserved
* Arabic section titles

---

### Arabic Fresh Graduate Template Order

Use for:

* Arabic fresh_graduate

Order:

1. Header
2. Professional Summary
3. Education
4. Projects
5. Internships / Volunteer Experience
6. Core Competencies
7. Certifications
8. Languages

Arabic rendering rules:

* RTL paragraph direction
* Right alignment
* Arabic-compatible font fallback
* Arabic date text preserved
* Arabic section titles

---

## Section Rendering Rules

A section should render only if it contains valid data.

Empty arrays must not render visible empty sections.

Empty strings must not render visible blank labels.

Example:

```ts
if (cv.certifications.length > 0) {
  sections.push(renderCertifications(cv.certifications));
}
```

---

## Global DOCX Design Spec

### Page

* Size: A4
* Orientation: Portrait
* Margins:

  * Top: 0.6 inch
  * Bottom: 0.6 inch
  * Left: 0.65 inch
  * Right: 0.65 inch

---

### Font

Primary English font:

* Calibri

Primary Arabic font:

* Arial
* Arial Unicode MS fallback if available

Do not use decorative fonts.

---

### Font Sizes

Name:

* 24pt
* Bold

Contact line:

* 10pt

Section headers:

* 11pt
* Bold

Body text:

* 10pt

Bullet text:

* 10pt

Dates:

* 10pt
* Italic for English
* Regular or italic-safe style for Arabic depending on DOCX output quality

---

### Color

Use black and dark gray only.

Recommended:

* Main text: black
* Secondary text: dark gray
* Borders: dark gray

No bright colors.

No decorative icons.

No graphics.

---

### Layout

* Single column
* ATS-safe
* No tables for the main content unless absolutely necessary
* No text boxes
* No floating elements
* No images
* No icons
* No multi-column layouts

---

## Header Renderer

Input:

```ts
full_name
contact
contact_line
target_job
nationality
```

Output:

* Candidate name
* Contact line

Rules:

* Render full name at the top.
* Render contact line under the name.
* If `contact_line` is empty, generate it from `contact`.
* Do not render empty contact values.
* Do not automatically add nationality to `contact_line`.
* Do not automatically add birth information to `contact_line`.
* Keep header simple and ATS-safe.

English alignment:

* Center or left aligned.

Arabic alignment:

* Right aligned.

Recommended initial decision:

* English: centered header
* Arabic: right-aligned header

Nationality rule:

`nationality` is available as a separate field for future template decisions.

The header renderer must not display nationality unless a specific template intentionally supports it.

---

## Section Title Renderer

All section titles should use real DOCX formatting, not text symbols.

Rules:

* Bold
* 11pt
* Uppercase for English section names if desired
* Arabic section names must not be forced uppercase
* Bottom border using DOCX paragraph border
* Spacing after title

English examples:

* PROFESSIONAL SUMMARY
* CORE COMPETENCIES
* PROFESSIONAL EXPERIENCE
* EDUCATION
* CERTIFICATIONS
* PROJECTS
* LANGUAGES

Arabic examples:

* الملخص المهني
* الكفاءات الأساسية
* الخبرات المهنية
* التعليم
* الشهادات
* المشاريع
* اللغات

---

## Summary Renderer

Input:

```ts
summary: string
```

Rules:

* Render only if summary is not empty.
* Body font size 10pt.
* Normal paragraph spacing.
* No bullets.
* No bold inside summary.

---

## Core Competencies Renderer

Input:

```ts
core_competencies: {
  technical_skills: string[];
  industry_knowledge: string[];
  professional_skills: string[];
}
```

Initial V1 rendering:

```txt
Technical Skills: item, item, item
Industry Knowledge: item, item, item
Professional Skills: item, item, item
```

Arabic rendering:

```txt
المهارات التقنية: عنصر، عنصر، عنصر
المعرفة بالمجال: عنصر، عنصر، عنصر
المهارات المهنية: عنصر، عنصر، عنصر
```

Rules:

* Render only groups with at least one item.
* Do not create empty labels.
* Keep as simple text lines for ATS safety.
* Do not use multi-column skill pills.

---

## Experience Renderer

Input:

```ts
experience: ExperienceItem[]
```

Each role should render:

1. Job title
2. Company
3. Location
4. Date range
5. Bullets

Recommended visual structure:

```txt
Job Title | Company
Location | Date Range
• Bullet
• Bullet
• Bullet
```

Rules:

* Preserve job title exactly from JSON.
* Preserve company name exactly from JSON.
* Dates should be visually distinct.
* Bullets must use real DOCX bullets.
* Do not render empty location/date separators.
* Keep each role compact but readable.

---

## Internships Renderer

Use the same renderer as experience.

Section title:

English:

```txt
INTERNSHIPS
```

Arabic:

```txt
التدريب
```

For fresh graduates, internships should appear before core competencies.

---

## Education Renderer

Input:

```ts
education: EducationItem[]
```

Each education item should render:

1. Degree
2. Major
3. Institution
4. Location
5. Date range
6. GPA if available

Recommended structure:

```txt
Degree in Major
Institution | Location | Date Range
GPA: value
```

Rules:

* Do not render `in Major` if major is empty.
* Do not render GPA if empty.
* Preserve institution name.
* Preserve degree and major.

Arabic labels:

* المعدل: value

---

## Certifications Renderer

Input:

```ts
certifications: CertificationItem[]
```

Each item should render:

```txt
Certification Name — Issuer — Date
```

Rules:

* Do not render empty separators.
* Preserve certification name exactly.
* Do not invent issuer or date.

---

## Projects Renderer

Input:

```ts
projects: ProjectItem[]
```

Each project should render:

1. Title
2. Date if available
3. Description if available
4. Bullets if available

Rules:

* Useful especially for fresh graduates.
* Do not render empty project descriptions.
* Use bullets only if bullets exist.

---

## Languages Renderer

Input:

```ts
languages: LanguageItem[]
```

Recommended rendering:

```txt
Arabic: Native
English: Fluent
```

Arabic rendering:

```txt
العربية: اللغة الأم
الإنجليزية: متقدم
```

Rules:

* Render only explicitly provided languages.
* Do not infer languages.
* Do not render empty language levels unless needed.

---

## Arabic RTL Strategy

Arabic DOCX rendering must be treated as a separate layout concern.

Rules:

* Use RTL paragraph direction.
* Use right alignment.
* Use Arabic-compatible font.
* Do not rely on browser CSS.
* Do not use HTML direction attributes.
* Use DOCX paragraph options only.

Expected helper:

```ts
function rtlParagraph(options) {
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    ...options,
  });
}
```

Arabic section titles must also be RTL and right-aligned.

---

## DOCX Style Helpers

Create reusable helpers for:

* Paragraph spacing
* Text runs
* Bold text
* Italic text
* Section borders
* Bullets
* RTL paragraphs
* Empty value filtering
* Safe separators
* Contact line generation

Example helpers:

```ts
createTextRun(text, options)
createParagraph(children, options)
createSectionTitle(title, language)
createBullet(text, language)
joinNonEmpty(values, separator)
buildContactLine(contact)
```

---

## Empty Value Handling

Never render:

* Empty strings
* Empty bullet lists
* Empty section titles
* Empty separators
* Placeholder text

Example:

```ts
joinNonEmpty([company, location, dateRange], " | ")
```

This prevents output like:

```txt
Company |  | Date
```

---

## Validation Before Rendering

Before calling the DOCX builder:

```ts
validateCvJsonV1(cv)
```

Validation must check:

* Required root keys exist
* `document_language` is valid
* `candidate_level` is valid
* `contact` object exists
* `contact.email` exists as a string
* `contact.phone` exists as a string
* `contact.linkedin` exists as a string
* `contact.location` exists as a string
* Arrays exist
* Core competency groups exist
* No HTML strings
* No CSS-like strings
* No HTML entities
* No markdown code fences
* No placeholder values
* Import-generated data has already been mapped to `CvJsonV1`
* Builder rejects raw import payloads
* Builder rejects raw GPT output that has not passed validation

Validation must return a structured result:

```ts
type ValidationResult = {
  valid: boolean;
  errors: string[];
  normalized?: CvJsonV1;
};
```

The builder must use `normalized` only when `valid === true`.

---

## First Static Test Data

Before connecting GPT, use static JSON files:

```txt
test-data/
  professional-cv.sample.json
  fresh-graduate-cv.sample.json
  arabic-professional-cv.sample.json
  arabic-fresh-graduate-cv.sample.json
```

Do not connect GPT until these static DOCX tests pass.

---

## Testing Checklist

The generated DOCX must be checked for:

* Opens in Microsoft Word
* Opens in Google Docs
* ATS-safe single-column structure
* Correct section order
* Proper spacing
* Header readability
* Section borders
* Bullet indentation
* No broken separators
* No empty sections
* No missing contact fields
* Arabic RTL correctness
* Arabic right alignment
* Download/upload flow compatibility
* Manual form input compatibility
* PDF import compatibility after mapping
* Word import compatibility after mapping
* LinkedIn import compatibility after mapping

---

## Integration Strategy

Initial integration should be feature-flagged.

Recommended flag:

```ts
USE_CV_ENGINE_V2=true
```

When disabled:

```txt
Existing HTML → html-to-docx flow remains active.
```

When enabled:

```txt
GPT → CvJsonV1 → Validation → Normalization → docx@8 builder → DOCX
```

This protects production while testing CV Engine 2.0.

---

## Migration Strategy

Step 1:

Build DOCX from static JSON.

Step 2:

Validate DOCX visual quality.

Step 3:

Connect GPT JSON prompt.

Step 4:

Validate generated JSON.

Step 5:

Generate DOCX from GPT JSON.

Step 6:

Compare output against current production output.

Step 7:

Enable behind feature flag.

Step 8:

Replace old HTML pipeline only after successful testing.

Import flows must be added only after the core CvJsonV1 builder is stable.

PDF, Word, and LinkedIn imports must map into CvJsonV1 before using the same validation, normalization, and DOCX builder pipeline.

---

## Cover Letter Compatibility

The same architecture should later be reused for Cover Letter Engine 2.0:

```txt
GPT
→ Structured Cover Letter JSON
→ Validation
→ Normalization
→ docx@8 Cover Letter Builder
→ DOCX
```

Do not mix CV builder and cover letter builder in the same file.

Use shared style helpers where appropriate.

Future cover letter systems may reuse:

* Validation patterns
* Normalization patterns
* DOCX style helpers
* Text utilities
* Language direction helpers

But the Cover Letter Builder must remain separate from the CV Builder.

---

## Future System Compatibility

The following future systems must map through or depend on `CvJsonV1`:

* ATS Analysis
* Career Score
* AI Job Match
* Cover Letter Engine
* PDF Resume Import
* Word Resume Import
* LinkedIn Profile Import

These systems must not create separate CV schemas unless a future version is explicitly approved.

`CvJsonV1` remains the shared foundation for CV content, imports, analysis, matching, and document generation.

---

## Final Decision

The DOCX Builder must be modular, testable, and independent from GPT.

The first implementation target is:

```txt
English Professional CV
```

Then:

```txt
Fresh Graduate CV
```

Then:

```txt
Arabic Professional CV with RTL support
```

Then:

```txt
Arabic Fresh Graduate CV with RTL support
```

Then:

```txt
Cover Letter DOCX Builder
```

Then future import pipelines:

```txt
PDF Import
Word Import
LinkedIn Import
```

Import pipelines must not bypass CvJsonV1 validation and normalization.

---

## Implementation Order

1. Create `CV_DOCX_TYPES_AND_VALIDATOR.md`.
2. Create TypeScript types for CvJsonV1.
3. Create validator for CvJsonV1.
4. Create normalizer for CvJsonV1.
5. Create static sample JSON files.
6. Create DOCX style helpers.
7. Create section title renderer.
8. Create header renderer.
9. Create summary renderer.
10. Create core competencies renderer.
11. Create experience renderer.
12. Create education renderer.
13. Create certifications renderer.
14. Create projects renderer.
15. Create languages renderer.
16. Create Professional template.
17. Test Professional template with static JSON.
18. Create Fresh Graduate section ordering.
19. Test Fresh Graduate template with static JSON.
20. Create Arabic RTL helpers.
21. Create Arabic Professional template.
22. Test Arabic Professional template with static JSON.
23. Create Arabic Fresh Graduate template.
24. Test Arabic Fresh Graduate template with static JSON.
25. Connect GPT JSON output.
26. Validate GPT JSON output before DOCX rendering.
27. Enable feature flag.
28. Replace old HTML pipeline after full QA.
29. Add PDF import mapping to CvJsonV1.
30. Add Word import mapping to CvJsonV1.
31. Add LinkedIn import mapping to CvJsonV1.
32. Test all import sources through the same CvJsonV1 pipeline.

---

## Status

DOCX Builder Architecture is ready for implementation planning.

Next file to update:

```txt
CV_JSON_SAMPLE_OUTPUTS.md
```

Purpose:

Fix invalid JSON samples and make sure all sample outputs follow the official CvJsonV1 schema before using them as static test data.

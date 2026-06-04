# DOCX Builder Architecture

Status: Approved

Version: 1.0

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
→ docx@8 Template Builder
→ DOCX
```

The purpose of this builder is to fully remove HTML/CSS responsibility from GPT and move all layout, spacing, borders, typography, and DOCX formatting into code.

---

## Architecture Decision

The DOCX Builder must be responsible for:

- Page layout
- Margins
- Fonts
- Font sizes
- Section spacing
- Section borders
- Header layout
- Bullet rendering
- Dates styling
- Section ordering
- Arabic RTL rendering
- DOCX export

The DOCX Builder must NOT be responsible for:

- Generating CV content
- Rewriting candidate experience
- Creating ATS keywords
- Translating text
- Classifying candidate level
- Inventing missing data

Content belongs to the GPT prompts.

Design and DOCX rendering belong to the DOCX Builder.

---

## Non-Goals

This phase must not change:

- Frontend flow
- Payment flow
- Supabase schema
- Storage logic
- Paymob logic
- WishMoney logic
- SuccessPage
- BuildingPage
- User authentication
- Existing production generation flow until the new builder is tested

---

## Source of Truth

The DOCX Builder must use:

```txt
CV_JSON_V1_SPEC.md
```

as the official schema source.

The builder must accept only validated `CvJsonV1` data.

The builder must not depend on GPT output directly without validation.

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

---

## High-Level Pipeline

```txt
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

1. Validate the input shape.
2. Normalize safe derived fields when needed.
3. Determine language direction.
4. Select the correct template strategy.
5. Render sections in the correct order.
6. Apply global DOCX styles.
7. Generate the DOCX buffer.
8. Return the buffer to the existing generation flow.

Example:

```ts
export async function buildCvDocx(cv: CvJsonV1): Promise<Uint8Array> {
  const validated = validateCvJsonV1(cv);
  const normalized = normalizeCvJsonV1(validated);
  const template = selectCvTemplate(normalized);
  const document = template.build(normalized);
  return await Packer.toBuffer(document);
}
```

---

## Normalization Before Rendering

Normalization must not invent content.

Normalization may only generate safe derived values from existing structured fields.

Allowed normalization:

- Generate `contact_line` from existing `contact` fields if `contact_line` is empty.
- Trim extra whitespace.
- Remove empty separators.
- Ensure arrays exist.
- Ensure text fields exist as empty strings when missing.

Not allowed:

- Inventing email
- Inventing phone
- Inventing LinkedIn
- Inventing location
- Inventing job titles
- Inventing dates
- Inventing education
- Inventing achievements

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

If `contact_line` is empty, generate it from:

```ts
cv.contact.email
cv.contact.phone
cv.contact.linkedin
cv.contact.location
```

Rules:

- Use only existing non-empty contact fields.
- Preserve original values.
- Do not invent missing values.
- Do not include empty separators.
- Recommended separator: ` | `

Example:

```ts
function buildContactLine(contact: CvJsonV1["contact"]): string {
  return joinNonEmpty(
    [contact.email, contact.phone, contact.linkedin, contact.location],
    " | "
  );
}
```

This protects PDF, Word, and LinkedIn imports where structured contact fields may exist but `contact_line` has not yet been generated.

---

## Template Selection

Template selection must be based on:

- `document_language`
- `candidate_level`

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

- junior
- mid
- senior
- executive

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

- fresh_graduate

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

- Arabic junior
- Arabic mid
- Arabic senior
- Arabic executive

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

- RTL paragraph direction
- Right alignment
- Arabic-compatible font fallback
- Arabic date text preserved
- Arabic section titles

---

### Arabic Fresh Graduate Template Order

Use for:

- Arabic fresh_graduate

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

- RTL paragraph direction
- Right alignment
- Arabic-compatible font fallback
- Arabic date text preserved
- Arabic section titles

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

- Size: A4
- Orientation: Portrait
- Margins:
  - Top: 0.6 inch
  - Bottom: 0.6 inch
  - Left: 0.65 inch
  - Right: 0.65 inch

---

### Font

Primary English font:

- Calibri

Primary Arabic font:

- Arial
- Arial Unicode MS fallback if available

Do not use decorative fonts.

---

### Font Sizes

Name:

- 24pt
- Bold

Contact line:

- 10pt

Section headers:

- 11pt
- Bold

Body text:

- 10pt

Bullet text:

- 10pt

Dates:

- 10pt
- Italic for English
- Regular or italic-safe style for Arabic depending on DOCX output quality

---

### Color

Use black and dark gray only.

Recommended:

- Main text: black
- Secondary text: dark gray
- Borders: dark gray

No bright colors.

No decorative icons.

No graphics.

---

### Layout

- Single column
- ATS-safe
- No tables for the main content unless absolutely necessary
- No text boxes
- No floating elements
- No images
- No icons
- No multi-column layouts

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

- Candidate name
- Contact line

Rules:

- Render full name at the top.
- Render contact line under the name.
- If `contact_line` is empty, generate it from `contact`.
- Do not render empty contact values.
- Do not render nationality unless intentionally included in `contact_line`.
- Keep header simple and ATS-safe.

English alignment:

- Center or left aligned.

Arabic alignment:

- Right aligned.

Recommended initial decision:

- English: centered header
- Arabic: right-aligned header

---

## Section Title Renderer

All section titles should use real DOCX formatting, not text symbols.

Rules:

- Bold
- 11pt
- Uppercase for English section names if desired
- Arabic section names must not be forced uppercase
- Bottom border using DOCX paragraph border
- Spacing after title

English examples:

- PROFESSIONAL SUMMARY
- CORE COMPETENCIES
- PROFESSIONAL EXPERIENCE
- EDUCATION
- CERTIFICATIONS
- PROJECTS
- LANGUAGES

Arabic examples:

- الملخص المهني
- الكفاءات الأساسية
- الخبرات المهنية
- التعليم
- الشهادات
- المشاريع
- اللغات

---

## Summary Renderer

Input:

```ts
summary: string
```

Rules:

- Render only if summary is not empty.
- Body font size 10pt.
- Normal paragraph spacing.
- No bullets.
- No bold inside summary.

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

- Render only groups with at least one item.
- Do not create empty labels.
- Keep as simple text lines for ATS safety.
- Do not use multi-column skill pills.

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

- Preserve job title exactly from JSON.
- Preserve company name exactly from JSON.
- Dates should be visually distinct.
- Bullets must use real DOCX bullets.
- Do not render empty location/date separators.
- Keep each role compact but readable.

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

- Do not render `in Major` if major is empty.
- Do not render GPA if empty.
- Preserve institution name.
- Preserve degree and major.

Arabic labels:

- المعدل: value

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

- Do not render empty separators.
- Preserve certification name exactly.
- Do not invent issuer or date.

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

- Useful especially for fresh graduates.
- Do not render empty project descriptions.
- Use bullets only if bullets exist.

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

- Render only explicitly provided languages.
- Do not infer languages.
- Do not render empty language levels unless needed.

---

## Arabic RTL Strategy

Arabic DOCX rendering must be treated as a separate layout concern.

Rules:

- Use RTL paragraph direction.
- Use right alignment.
- Use Arabic-compatible font.
- Do not rely on browser CSS.
- Do not use HTML direction attributes.
- Use DOCX paragraph options only.

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

- Paragraph spacing
- Text runs
- Bold text
- Italic text
- Section borders
- Bullets
- RTL paragraphs
- Empty value filtering
- Safe separators
- Contact line generation

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

- Empty strings
- Empty bullet lists
- Empty section titles
- Empty separators
- Placeholder text

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

- Required root keys exist
- `document_language` is valid
- `candidate_level` is valid
- `contact` object exists
- `contact.email` exists as a string
- `contact.phone` exists as a string
- `contact.linkedin` exists as a string
- `contact.location` exists as a string
- Arrays exist
- Core competency groups exist
- No HTML strings
- No placeholder values

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

- Opens in Microsoft Word
- Opens in Google Docs
- ATS-safe single-column structure
- Correct section order
- Proper spacing
- Header readability
- Section borders
- Bullet indentation
- No broken separators
- No empty sections
- No missing contact fields
- Arabic RTL correctness
- Arabic right alignment
- Download/upload flow compatibility

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
GPT → CvJsonV1 → docx@8 builder → DOCX
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

---

## Cover Letter Compatibility

The same architecture should later be reused for Cover Letter Engine 2.0:

```txt
GPT
→ Structured Cover Letter JSON
→ docx@8 Cover Letter Builder
→ DOCX
```

Do not mix CV builder and cover letter builder in the same file.

Use shared style helpers where appropriate.

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

---

## Implementation Order

1. Create `CV_DOCX_TYPES_AND_VALIDATOR.md`.
2. Create TypeScript types for CvJsonV1.
3. Create validator for CvJsonV1.
4. Create static sample JSON files.
5. Create DOCX style helpers.
6. Create section title renderer.
7. Create header renderer.
8. Create summary renderer.
9. Create core competencies renderer.
10. Create experience renderer.
11. Create education renderer.
12. Create certifications renderer.
13. Create projects renderer.
14. Create languages renderer.
15. Create Professional template.
16. Test Professional template with static JSON.
17. Create Fresh Graduate section ordering.
18. Test Fresh Graduate template with static JSON.
19. Create Arabic RTL helpers.
20. Create Arabic Professional template.
21. Test Arabic Professional template with static JSON.
22. Create Arabic Fresh Graduate template.
23. Test Arabic Fresh Graduate template with static JSON.
24. Connect GPT JSON output.
25. Enable feature flag.
26. Replace old HTML pipeline after full QA.

---

## Status

DOCX Builder Architecture is ready for implementation planning.

Next file to create:

```txt
CV_DOCX_TYPES_AND_VALIDATOR.md
```

Purpose:

Define TypeScript types, validation rules, static sample JSON requirements, and safety checks before writing the DOCX template code.

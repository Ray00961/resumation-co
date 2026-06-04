# CV Engine 2.0 Plan

## Status

Planning Phase

---

## Problem

Current architecture:

GPT
→ HTML
→ html-to-docx
→ DOCX

Issues:

- html-to-docx ignores some CSS properties
- spacing is inconsistent
- borders are unreliable
- typography is inconsistent
- DOCX quality is not premium enough

---

## Decision

New architecture:

GPT
→ Structured JSON
→ docx@8 Template Builder
→ DOCX

Goals:

- Stable formatting
- ATS-safe structure
- Better visual quality
- No HTML/CSS rendering issues
- Easier future template expansion

---

## Non-Goals

No frontend changes.

No payment flow changes.

No database schema changes.

No storage changes.

No changes to SuccessPage, BuildingPage, Paymob, or WishMoney.

---

## Final CV JSON Schema Decision

We will use `CvJsonV1`.

The CV prompt will not return HTML.

The CV prompt will return structured JSON only.

We will not use `template_type`.

Instead, we will use:

- `document_language`
- `candidate_level`

Allowed `document_language` values:

- `en`
- `ar`

Allowed `candidate_level` values:

- `fresh_graduate`
- `junior`
- `mid`
- `senior`
- `executive`

Reason:

`candidate_level` describes the candidate.
The DOCX builder decides which template or section order to use.

This keeps GPT responsible for content only.
The builder remains responsible for design and layout.

---

## Prompt Responsibilities

The CV prompt is responsible for:

- Content generation
- ATS optimization
- Human writing quality
- Translation
- Candidate classification
- Date normalization
- Section content generation

The CV prompt is NOT responsible for:

- HTML
- CSS
- Typography
- Font sizes
- Borders
- Margins
- Spacing
- Layout
- DOCX formatting
- Visual design

All design and formatting responsibilities belong to the DOCX Template Builder.

---

## Content Rules Migration

The following rules will be preserved from the current CV prompts:

### Data Integrity

- No hallucinations
- Preserve job titles exactly
- Preserve company names exactly
- Preserve education exactly
- Preserve certifications exactly
- Preserve dates exactly
- Omit missing sections
- No placeholder text

### Language Rules

- Arabic input can be translated to English output
- Proper nouns must be preserved
- Output language must be respected

### Candidate Classification

- Fresh Graduate logic
- Professional candidate logic
- Experience-based classification

### Date Rules

- Mon YYYY – Mon YYYY format
- Present for ongoing positions
- Newest to oldest ordering

### Experience Rules

- Realistic responsibilities
- No fake achievements
- No fake metrics
- Expand short descriptions naturally
- Match actual seniority level

### ATS Rules

- ATS keyword extraction
- ATS keyword placement
- ATS auto-fill optimization
- Linear ATS-safe structure

### Human Writing Rules

- Human writing style
- Natural sentence variation
- No AI clichés
- No corporate buzzwords
- No exaggerated language
- Realistic and credible writing

The following rules will be removed:

- HTML generation
- CSS generation
- Typography instructions
- Visual design instructions
- Layout instructions
- DOCX formatting instructions

---

## Development Order

Implementation order must be:

1. Freeze CV JSON Schema
2. Create CV_JSON_PROMPT_EN_V1
3. Create CV_JSON_PROMPT_AR_V1
4. Validate JSON outputs
5. Build Professional CV DOCX Template
6. Test Professional CV Template
7. Build Fresh Graduate Template Logic
8. Build Cover Letter JSON Prompt
9. Build Cover Letter DOCX Template
10. Integrate GPT with DOCX Builder
11. Replace HTML-to-DOCX pipeline

Important:

Do not connect GPT to the DOCX builder until the template output is fully tested using static JSON data.

---

## Current Status

Planning completed.

Next task:

Create CV_JSON_PROMPT_EN_V1.

Goal:

Generate structured JSON only.

The prompt must preserve all approved ATS, Human Writing, Translation, Date, Experience, and Data Integrity rules from the legacy CV prompt.

The prompt must not contain any HTML, CSS, layout, typography, DOCX, or visual design instructions.

## Form Audit Notes

Discovered during CV_JSON_PROMPT_EN_V1 testing:

1. Education major exists in the form but was not represented in CvJsonV1.
   Action:

   * Add education.major to CvJsonV1 schema.

2. TOEFL and IELTS are currently stored under certificates.
   Future review:

   * Consider separating:

     * Certifications
     * Exams / Language Tests

3. Review all current profile form fields against CvJsonV1 before implementation.

4. Evaluate adding:

   * target_job
   * GPA
   * Academic Projects
   * Internship Details

5. Future import planning:

   * PDF CV Import
   * LinkedIn Import

Goal:
Ensure every form field maps cleanly to CvJsonV1 and future ATS Analysis, Career Score, AI Job Match, and Cover Letter generation.

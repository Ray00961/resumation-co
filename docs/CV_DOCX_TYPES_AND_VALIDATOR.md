# CV DOCX Types And Validator

Status: Ready For Implementation

Version: 1.1

Purpose:

Defines the TypeScript contract, validation layer, normalization layer, and safety rules used before rendering CvJsonV1 into DOCX files.

This document must be implemented before any DOCX template code is written.

The DOCX Builder must never receive raw GPT output.

The DOCX Builder must never receive raw import payloads from PDF, Word, LinkedIn, or manual form sources.

The DOCX Builder must only receive validated and normalized CvJsonV1 data.

---

# Source Of Truth

This document depends on:

* CV_JSON_V1_SPEC.md
* DOCX_BUILDER_ARCHITECTURE.md

No type definitions may conflict with the official CvJsonV1 specification.

All future input sources must map into CvJsonV1 before validation, normalization, and DOCX rendering.

Supported future input sources:

* Manual form input
* PDF resume import
* Word resume import
* LinkedIn profile import

---

# Core TypeScript Types

## DocumentLanguage

```ts
export type DocumentLanguage = "en" | "ar";
```

---

## CandidateLevel

```ts
export type CandidateLevel =
  | "fresh_graduate"
  | "junior"
  | "mid"
  | "senior"
  | "executive";
```

---

## Allowed Values

```ts
export const allowedDocumentLanguages = ["en", "ar"] as const;

export const allowedCandidateLevels = [
  "fresh_graduate",
  "junior",
  "mid",
  "senior",
  "executive",
] as const;
```

---

## ContactInfo

```ts
export interface ContactInfo {
  email: string;
  phone: string;
  linkedin: string;
  location: string;
}
```

---

## CoreCompetencies

```ts
export interface CoreCompetencies {
  technical_skills: string[];
  industry_knowledge: string[];
  professional_skills: string[];
}
```

---

## ExperienceItem

```ts
export interface ExperienceItem {
  job_title: string;
  company: string;
  location: string;
  date_range: string;
  bullets: string[];
}
```

---

## EducationItem

```ts
export interface EducationItem {
  degree: string;
  major: string;
  institution: string;
  location: string;
  date_range: string;
  gpa: string;
}
```

---

## CertificationItem

```ts
export interface CertificationItem {
  name: string;
  issuer: string;
  date: string;
}
```

---

## ProjectItem

```ts
export interface ProjectItem {
  title: string;
  date: string;
  description: string;
  bullets: string[];
}
```

---

## LanguageItem

```ts
export interface LanguageItem {
  language: string;
  level: string;
}
```

---

## CvJsonV1

```ts
export interface CvJsonV1 {
  document_language: DocumentLanguage;

  candidate_level: CandidateLevel;

  full_name: string;

  contact: ContactInfo;

  contact_line: string;

  target_job: string;

  nationality: string;

  summary: string;

  core_competencies: CoreCompetencies;

  experience: ExperienceItem[];

  internships: ExperienceItem[];

  education: EducationItem[];

  certifications: CertificationItem[];

  projects: ProjectItem[];

  languages: LanguageItem[];
}
```

---

# Allowed Values

## document_language

Allowed:

```txt
en
ar
```

Reject anything else.

Examples:

```txt
english
arabic
EN
AR
```

must fail validation.

---

## candidate_level

Allowed:

```txt
fresh_graduate
junior
mid
senior
executive
```

Reject anything else.

---

# Validation Result

```ts
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  normalized?: CvJsonV1;
}
```

Rules:

* `valid` must be `true` only when all validation checks pass.
* `errors` must contain clear path-based validation messages.
* `normalized` must exist only when `valid === true`.
* The DOCX Builder must use `normalized` only after checking `valid === true`.

---

# Root Validator

Function:

```ts
validateCvJsonV1(input: unknown): ValidationResult
```

Responsibilities:

* Validate root object.
* Validate required keys.
* Validate allowed values.
* Validate contact object.
* Validate core competencies object.
* Validate array shapes.
* Validate item structures.
* Validate string safety rules.
* Reject raw import payloads that are not mapped to CvJsonV1.
* Reject raw GPT output that does not match CvJsonV1.
* Return normalized data when valid.

---

# Required Root Validation

Validator must verify:

```txt
document_language
candidate_level

full_name

contact
contact_line

target_job
nationality

summary

core_competencies

experience
internships
education
certifications
projects
languages
```

All keys must exist.

Missing keys must generate validation errors.

Null root fields are invalid.

Undefined root fields are invalid.

---

# document_language Validation

Valid values:

```txt
en
ar
```

Reject anything else.

Examples:

```txt
english
arabic
EN
AR
```

must fail validation.

---

# candidate_level Validation

Valid values:

```txt
fresh_graduate
junior
mid
senior
executive
```

Reject anything else.

---

# Root String Field Validation

The following root fields must exist and must be strings:

```txt
full_name
contact_line
target_job
nationality
summary
```

Rules:

* Empty string is allowed.
* Null is not allowed.
* Undefined is not allowed.
* Non-string values are invalid.
* Unsafe strings are invalid.

---

# Contact Validation

Required object:

```ts
contact
```

Required fields:

```txt
email
phone
linkedin
location
```

Validation rules:

* Must exist.
* Must be an object.
* Must not be null.
* All fields must exist.
* All fields must be strings.
* Empty string allowed.
* Null not allowed.
* Undefined not allowed.
* Unsafe strings are invalid.

---

# Core Competencies Validation

Required object:

```ts
core_competencies
```

Required groups:

```txt
technical_skills
industry_knowledge
professional_skills
```

Rules:

* Must exist.
* Must be an object.
* Must not be null.
* Groups must exist.
* Groups must be arrays.
* Empty arrays allowed.
* Null not allowed.
* Undefined not allowed.
* Array items must be strings.
* Unsafe strings are invalid.
* Duplicate prevention is preferred but not required in V1.

---

# Array Validation

The following must always be arrays:

```txt
experience
internships
education
certifications
projects
languages
```

Rules:

* Empty arrays are allowed.
* Null is invalid.
* Undefined is invalid.
* Non-array values are invalid.
* Items must match their required item structure.

---

# Item Validators

## validateExperienceItem

Required shape:

```ts
{
  job_title: string;
  company: string;
  location: string;
  date_range: string;
  bullets: string[];
}
```

Rules:

* All keys must exist.
* String fields may be empty strings.
* Null is invalid.
* Undefined is invalid.
* `bullets` must be an array.
* Bullet items must be strings.
* Unsafe strings are invalid.

---

## validateEducationItem

Required shape:

```ts
{
  degree: string;
  major: string;
  institution: string;
  location: string;
  date_range: string;
  gpa: string;
}
```

Rules:

* All keys must exist.
* String fields may be empty strings.
* Null is invalid.
* Undefined is invalid.
* Unsafe strings are invalid.

---

## validateCertificationItem

Required shape:

```ts
{
  name: string;
  issuer: string;
  date: string;
}
```

Rules:

* All keys must exist.
* String fields may be empty strings.
* Null is invalid.
* Undefined is invalid.
* Unsafe strings are invalid.

---

## validateProjectItem

Required shape:

```ts
{
  title: string;
  date: string;
  description: string;
  bullets: string[];
}
```

Rules:

* All keys must exist.
* String fields may be empty strings.
* Null is invalid.
* Undefined is invalid.
* `bullets` must be an array.
* Bullet items must be strings.
* Unsafe strings are invalid.

---

## validateLanguageItem

Required shape:

```ts
{
  language: string;
  level: string;
}
```

Rules:

* All keys must exist.
* String fields may be empty strings.
* Null is invalid.
* Undefined is invalid.
* Unsafe strings are invalid.

---

# Safety Validation

The validator must reject unsafe content anywhere inside strings.

This includes root strings, contact strings, competency items, item fields, and bullet text.

---

## HTML

Reject HTML tags.

Examples:

```html
<div>
<p>
<span>
<br>
<table>
```

---

## CSS

Reject CSS-like strings.

Examples:

```css
color:red;
font-size:12px;
text-transform: uppercase;
font-weight: bold;
line-height: 1.4;
letter-spacing: 1px;
text-align: center;
margin-top: 10px;
padding: 12px;
border-bottom: 1px solid black;
display: flex;
position: absolute;
width: 100%;
height: auto;
```

CSS-like detection should include at least:

```txt
color
font-size
font-weight
font-family
text-transform
text-align
line-height
letter-spacing
margin
margin-top
margin-bottom
margin-left
margin-right
padding
padding-top
padding-bottom
padding-left
padding-right
background
background-color
border
border-top
border-bottom
border-left
border-right
display
position
width
height
white-space
```

---

## HTML Entities

Reject HTML entities.

Examples:

```txt
&lt;
&gt;
&amp;
&quot;
&apos;
```

---

## Markdown Fences

Reject markdown code fences.

Examples:

````txt
```html
```

```css
```

```json
```
````

---

## Placeholder Values

Reject placeholder values.

Examples:

```txt
N/A
TBD
Lorem Ipsum
Coming Soon
Example Company
Example Name
Sample Company
Sample Name
Your Name
Your Email
your.email@example.com
example@example.com
```

Note:

Testing fixtures may intentionally use clearly fake sample data, but production validation should reject placeholder values.

If test fixtures need placeholder-like values, they must be realistic enough to avoid matching the placeholder list.

---

## Null Root Fields

Example:

```json
{
  "full_name": null
}
```

Invalid.

---

## Undefined Root Fields

Invalid.

---

# Normalization Layer

Function:

```ts
normalizeCvJsonV1(cv: CvJsonV1): CvJsonV1
```

Purpose:

Produce safe builder-ready data without inventing information.

Normalization must happen only after validation succeeds.

The normalizer must not be used directly on raw GPT output.

The normalizer must not be used directly on raw PDF, Word, LinkedIn, or form payloads.

---

# Allowed Normalization

## Trim Strings

Example:

```txt
" Ahmed Hassan "
```

becomes:

```txt
"Ahmed Hassan"
```

---

## Trim String Arrays

Example:

```txt
[" React ", " SQL "]
```

becomes:

```txt
["React", "SQL"]
```

---

## Remove Empty String Array Items

Example:

```txt
["React", "", "SQL"]
```

becomes:

```txt
["React", "SQL"]
```

---

## Ensure Arrays Exist

Example:

```txt
undefined
```

becomes:

```txt
[]
```

only when safe and only after validation rules allow that behavior.

For strict CvJsonV1 validation, missing required root arrays should still produce validation errors.

---

## Ensure Optional Strings Exist

Example:

```txt
undefined
```

becomes:

```txt
""
```

only when safe and only inside controlled normalization after validation.

For strict CvJsonV1 validation, missing required root string keys should still produce validation errors.

---

## Generate contact_line

Allowed only when:

```txt
contact_line === ""
```

Generate only from:

```txt
contact.email
contact.phone
contact.linkedin
contact.location
```

Do not generate contact_line from:

```txt
nationality
date of birth
target_job
summary
any inferred value
```

---

## Remove Empty Separators

Example:

```txt
email | | location
```

becomes:

```txt
email | location
```

---

# Forbidden Normalization

The normalizer must never:

* Invent contact details.
* Invent dates.
* Invent locations.
* Invent nationality.
* Invent education.
* Invent employers.
* Invent responsibilities.
* Invent achievements.
* Invent certifications.
* Invent skills.
* Rewrite candidate content.
* Translate candidate content.
* Classify candidate level.
* Add ATS keywords.
* Parse raw PDF content.
* Parse raw Word content.
* Parse raw LinkedIn content.

Content generation belongs to GPT.

Import interpretation belongs to import mapping layers.

DOCX rendering belongs to the DOCX Builder.

---

# Contact Utilities

Function:

```ts
buildContactLine(contact: ContactInfo): string
```

Input:

```ts
ContactInfo
```

Output:

```txt
email | phone | linkedin | location
```

Rules:

* Preserve original values.
* Trim extra whitespace.
* Skip empty values.
* Use:

```txt
 | 
```

as separator.

* No duplicate separators.
* No leading separators.
* No trailing separators.
* Do not include nationality automatically.
* Do not include birth information automatically.

---

# Contact Line Examples

Example 1

Input:

```json
{
  "email": "ahmed@example.com",
  "phone": "+20 1000000000",
  "linkedin": "",
  "location": ""
}
```

Output:

```txt
ahmed@example.com | +20 1000000000
```

---

Example 2

Input:

```json
{
  "email": "ahmed@example.com",
  "phone": "+20 1000000000",
  "linkedin": "",
  "location": "Cairo, Egypt"
}
```

Output:

```txt
ahmed@example.com | +20 1000000000 | Cairo, Egypt
```

---

Example 3

Input:

```json
{
  "email": "ahmed@example.com",
  "phone": "+20 1000000000",
  "linkedin": "linkedin.com/in/ahmed",
  "location": "Cairo, Egypt"
}
```

Output:

```txt
ahmed@example.com | +20 1000000000 | linkedin.com/in/ahmed | Cairo, Egypt
```

---

# Import Source Compatibility

Future input sources must map into CvJsonV1 before reaching the validator and builder.

Supported sources:

* Manual form input
* PDF resume import
* Word resume import
* LinkedIn profile import

Allowed import pipeline:

```txt
Raw Source Data
↓
Import Mapping Layer
↓
CvJsonV1
↓
validateCvJsonV1()
↓
normalizeCvJsonV1()
↓
DOCX Builder
```

The validator must reject raw payloads that do not match the CvJsonV1 shape.

The DOCX Builder must never receive:

* Raw form payloads
* Raw PDF extraction output
* Raw Word extraction output
* Raw LinkedIn profile payloads
* Raw GPT responses

---

# Validation Flow

```txt
Raw GPT JSON
Raw Form Mapping Output
Raw PDF Mapping Output
Raw Word Mapping Output
Raw LinkedIn Mapping Output
↓
CvJsonV1
↓
validateCvJsonV1()
↓
normalizeCvJsonV1()
↓
Validated + Normalized CvJsonV1
↓
DOCX Builder
```

No renderer should run before validation succeeds.

No template should receive unvalidated data.

No builder should normalize raw data without validation first.

---

# Test Fixtures

Create:

```txt
test-data/

professional-cv.sample.json

fresh-graduate-cv.sample.json

arabic-professional-cv.sample.json

arabic-fresh-graduate-cv.sample.json
```

Validator must pass all fixtures before DOCX rendering begins.

Fixtures must include:

* Professional English candidate
* Fresh graduate English candidate
* Professional Arabic candidate
* Fresh graduate Arabic candidate
* Empty optional fields
* Empty arrays
* Contact line generated from contact fields
* Location present in `contact.location`
* Nationality separate from `contact_line`
* No invalid JSON
* No placeholder values that production validation would reject

---

# Required Tests

## Type Tests

Confirm that:

* CvJsonV1 accepts only approved `document_language` values.
* CvJsonV1 accepts only approved `candidate_level` values.
* Education requires `major`.
* Education requires `gpa`.
* Contact requires `location`.
* All root arrays exist.

---

## Validator Tests

Validator must reject:

* Missing root keys
* Invalid `document_language`
* Invalid `candidate_level`
* Null root fields
* Undefined root fields
* Missing contact object
* Missing contact fields
* Missing core competency groups
* Non-array section fields
* Invalid item structures
* HTML strings
* CSS-like strings
* HTML entities
* Markdown fences
* Placeholder values
* Raw import payloads that are not CvJsonV1

Validator must accept:

* Empty strings for missing text values
* Empty arrays for missing sections
* Empty contact fields as strings
* Valid English CvJsonV1
* Valid Arabic CvJsonV1

---

## Normalizer Tests

Normalizer must:

* Trim root strings.
* Trim contact strings.
* Trim item strings.
* Trim string array items.
* Remove empty string array items.
* Generate `contact_line` from contact fields when empty.
* Remove empty contact separators.
* Preserve existing `contact_line` when non-empty.
* Preserve all candidate content without rewriting.

Normalizer must not:

* Invent missing values.
* Add nationality to `contact_line`.
* Add birth information to `contact_line`.
* Translate text.
* Rewrite bullets.
* Add skills.
* Add achievements.

---

# Implementation Order

1. Create cv-json-v1.ts
2. Create contact-utils.ts
3. Create validate-cv-json.ts
4. Create normalize-cv-json.ts
5. Create sample JSON fixtures
6. Test validator
7. Test normalizer
8. Connect DOCX Builder
9. Build Header Renderer
10. Build Section Renderers

---

# Final Decision

The DOCX Builder must never receive:

* Raw GPT output
* Raw form payloads
* Raw PDF extraction output
* Raw Word extraction output
* Raw LinkedIn profile payloads
* Invalid JSON
* Partially validated JSON
* Null root fields

The DOCX Builder must only receive:

```ts
CvJsonV1
```

that has successfully passed:

```txt
validateCvJsonV1()
normalizeCvJsonV1()
```

Status:

Ready For Implementation.

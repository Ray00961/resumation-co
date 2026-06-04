# CV DOCX Types And Validator

Status: Ready For Implementation

Version: 1.0

Purpose:

Defines the TypeScript contract, validation layer, normalization layer, and safety rules used before rendering CvJsonV1 into DOCX files.

This document must be implemented before any DOCX template code is written.

The DOCX Builder must never receive raw GPT output.

The DOCX Builder must only receive validated and normalized CvJsonV1 data.

---

# Source Of Truth

This document depends on:

* CV_JSON_V1_SPEC.md
* DOCX_BUILDER_ARCHITECTURE.md

No type definitions may conflict with the official CvJsonV1 specification.

---

# Core TypeScript Types

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
  document_language: "en" | "ar";

  candidate_level:
    | "fresh_graduate"
    | "junior"
    | "mid"
    | "senior"
    | "executive";

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

---

# Validation Result

```ts
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  normalized?: CvJsonV1;
}
```

---

# Root Validator

Function:

```ts
validateCvJsonV1(cv)
```

Responsibilities:

* Validate structure.
* Validate required keys.
* Validate allowed values.
* Validate array shapes.
* Validate item structures.
* Validate safety rules.
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
* Must be strings.
* Empty string allowed.
* Null not allowed.
* Undefined not allowed.

---

# Core Competencies Validation

Required groups:

```txt
technical_skills
industry_knowledge
professional_skills
```

Rules:

* Must exist.
* Must be arrays.
* Empty arrays allowed.
* Null not allowed.

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

Null is invalid.

Undefined is invalid.

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

---

## validateLanguageItem

Required shape:

```ts
{
  language: string;
  level: string;
}
```

---

# Safety Validation

The validator must reject:

## HTML

Examples:

```html
<div>
<p>
<span>
```

---

## CSS

Examples:

```css
color:red;
font-size:12px;
```

---

## HTML Entities

Examples:

```txt
&lt;
&gt;
```

---

## Markdown Fences

Examples:

````
```html
````

```css
```

````

---

## Placeholder Values

Examples:

```txt
N/A
TBD
Lorem Ipsum
Coming Soon
Example Company
Example Name
````

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
normalizeCvJsonV1(cv)
```

Purpose:

Produce safe builder-ready data without inventing information.

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

## Ensure Arrays Exist

Example:

```txt
undefined
```

becomes:

```txt
[]
```

when safe.

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

when safe.

---

## Generate contact_line

Allowed only when:

```txt
contact_line === ""
```

Generate from:

```txt
contact.email
contact.phone
contact.linkedin
contact.location
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
* Invent education.
* Invent employers.
* Invent responsibilities.
* Invent achievements.
* Invent certifications.
* Rewrite candidate content.

Content generation belongs to GPT.

---

# Contact Utilities

Function:

```ts
buildContactLine(contact)
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
* Skip empty values.
* Use:

```txt
 |
```

as separator.

* No duplicate separators.
* No trailing separators.

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

Output:

```txt
ahmed@example.com | +20 1000000000 | Cairo, Egypt
```

---

Example 3

Output:

```txt
ahmed@example.com | +20 1000000000 | linkedin.com/in/ahmed | Cairo, Egypt
```

---

# Validation Flow

```txt
Raw GPT JSON
↓
validateCvJsonV1()
↓
normalizeCvJsonV1()
↓
CvJsonV1
↓
DOCX Builder
```

No renderer should run before validation succeeds.

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
* Invalid JSON
* Partially validated JSON
* Null root fields

The DOCX Builder must only receive:

```ts
CvJsonV1
```

that has successfully passed:

```ts
validateCvJsonV1()
normalizeCvJsonV1()
```

Status:

Ready For Implementation.

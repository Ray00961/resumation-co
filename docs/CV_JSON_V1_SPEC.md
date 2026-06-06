# CV JSON V1 Specification

Status: Final

Version: 1.0

Purpose:

Defines the official JSON structure used by CV Engine 2.0.

This specification is independent from:

* GPT prompts
* DOCX templates
* ATS analysis
* Cover letter generation

All systems must use this specification as the single source of truth.

---

## Supported Languages

Allowed values:

* en
* ar

Field:

document_language

---

## Candidate Levels

Allowed values:

* fresh_graduate
* junior
* mid
* senior
* executive

Field:

candidate_level

---

## Root Schema

```json
{
  "document_language": "",
  "candidate_level": "",

  "full_name": "",
  "contact": {
    "email": "",
    "phone": "",
    "linkedin": "",
    "location": ""
  },
  "contact_line": "",
  "target_job": "",
  "nationality": "",

  "summary": "",

  "core_competencies": {
    "technical_skills": [],
    "industry_knowledge": [],
    "professional_skills": []
  },

  "experience": [],
  "internships": [],
  "education": [],
  "certifications": [],
  "projects": [],
  "languages": []
}
```

---

# Field Definitions

## document_language

Type:

string

Required:

Yes

Allowed Values:

* en
* ar

Purpose:

Defines the final CV language.

---

## candidate_level

Type:

string

Required:

Yes

Allowed Values:

* fresh_graduate
* junior
* mid
* senior
* executive

Purpose:

Determines candidate seniority.

Used by:

* CV Generation
* ATS Analysis
* Career Score
* AI Job Match
* Cover Letter Generation

---

## full_name

Type:

string

Required:

Yes

Purpose:

Candidate full legal/professional name.

---

## contact

Type:

object

Required:

Yes

Purpose:

Structured contact information used for CV generation, ATS parsing, imports, and future profile features.

Schema:

```json
{
  "email": "",
  "phone": "",
  "linkedin": "",
  "location": ""
}
```

Rules:

* Use empty strings for missing fields.
* Do not invent contact information.
* Preserve email exactly as provided.
* Preserve phone exactly as provided.
* Preserve LinkedIn URL exactly as provided.
* Preserve location exactly as provided.

Required Contact Fields:

* email
* phone
* linkedin
* location

---

## contact_line

Type:

string

Required:

Yes

Purpose:

Single-line contact information used by the CV header.

Examples:

* email | phone
* email | phone | city
* email | phone | linkedin | city

Rules:

* Generated only from available contact fields.
* Allowed source fields are:

  * contact.email
  * contact.phone
  * contact.linkedin
  * contact.location
* Do not invent contact information.
* Do not include empty values.
* Do not include nationality automatically.
* Do not include birth information automatically.
* Preserve the original email.
* Preserve the original phone number.
* Preserve LinkedIn when available.
* Preserve location when available.

---

## target_job

Type:

string

Required:

No

Purpose:

Target role selected by the candidate.

Examples:

* Pharmacist
* Software Engineer
* HR Specialist

---

## nationality

Type:

string

Required:

No

Purpose:

Candidate nationality.

Rules:

* Keep nationality separate from `contact_line`.
* Do not automatically render nationality in the header unless a future template explicitly supports it.
* Do not use nationality to generate contact information.

---

## summary

Type:

string

Required:

Yes

Purpose:

Professional summary section.

---

# Core Competencies

## technical_skills

Type:

string[]

Purpose:

Tools, technologies, software, platforms, systems.

Examples:

* Excel
* React
* AutoCAD
* SAP

---

## Core Competencies Schema

```json
{
  "technical_skills": ["string"],
  "industry_knowledge": ["string"],
  "professional_skills": ["string"]
}
```

---

## industry_knowledge

Type:

string[]

Purpose:

Industry knowledge and functional expertise.

Examples:

* Regulatory Compliance
* Hospital Pharmacy
* Recruitment

---

## professional_skills

Type:

string[]

Purpose:

Transferable professional skills.

Examples:

* Communication
* Organization
* Team Coordination

---

# Experience

Type:

array

Schema:

```json
{
  "job_title": "",
  "company": "",
  "location": "",
  "date_range": "",
  "bullets": []
}
```

Required:

No

Purpose:

Professional employment history.

Sort Order:

Most Recent → Oldest

---

# Internships

Type:

array

Schema:

```json
{
  "job_title": "",
  "company": "",
  "location": "",
  "date_range": "",
  "bullets": []
}
```

Required:

No

Purpose:

Internship experience.

Sort Order:

Most Recent → Oldest

---

# Education

Type:

array

Schema:

```json
{
  "degree": "",
  "major": "",
  "institution": "",
  "location": "",
  "date_range": "",
  "gpa": ""
}
```

Required:

No

Purpose:

Academic history.

Sort Order:

Most Recent → Oldest

---

# Certifications

Type:

array

Schema:

```json
{
  "name": "",
  "issuer": "",
  "date": ""
}
```

Required:

No

Purpose:

Professional certifications.

Sort Order:

Most Recent → Oldest

---

# Projects

Type:

array

Schema:

```json
{
  "title": "",
  "date": "",
  "description": "",
  "bullets": []
}
```

Required:

No

Purpose:

Academic, freelance, personal, or professional projects.

Sort Order:

Most Recent → Oldest

---

# Languages

Type:

array

Schema:

```json
{
  "language": "",
  "level": ""
}
```

Required:

No

Purpose:

Languages known by the candidate.

Examples:

* Arabic
* English
* French

---

# Empty Value Rules

If a section contains no valid data:

Use:

```json
[]
```

Never remove the section.

---

If a text field contains no valid data:

Use:

```json
""
```

Never remove the field.

---

# Required Root Keys

The following keys must always exist:

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

These keys must never be removed.

---

# Mapping Rules

Profile Form
→ CvJsonV1

GPT Output
→ CvJsonV1

PDF Import
→ CvJsonV1

Word Import
→ CvJsonV1

LinkedIn Import
→ CvJsonV1

Cover Letter Engine
→ CvJsonV1

ATS Analysis
→ CvJsonV1

Career Score
→ CvJsonV1

AI Job Match
→ CvJsonV1

All systems must map through CvJsonV1.

---

# Future Compatibility

CvJsonV1 is designed to support:

* CV Generation
* DOCX Builder
* ATS Analysis
* Career Score
* AI Job Match
* Cover Letter Generation
* PDF CV Import
* Word CV Import
* LinkedIn Import
* Future AI Career Features

---

# Freeze Rules

Version:

1.0

Status:

Frozen

No schema changes are allowed unless:

* A production bug is discovered.
* A required field is missing.
* A new platform feature requires schema expansion.

All future changes must create:

* CV_JSON_V1.1
* CV_JSON_V1.2
* CV_JSON_V2.0

Never modify a frozen version directly.

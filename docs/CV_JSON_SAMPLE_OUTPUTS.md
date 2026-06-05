# CV JSON Sample Outputs

Purpose:

Validate CvJsonV1 before GPT integration.

These examples are for testing the schema structure only.

No design decisions are represented here.

No DOCX formatting decisions are represented here.

All samples must be valid JSON and must pass `JSON.parse()` before being used as static test data.

---

## Sample 1

Professional Candidate

Status: Ready For Static Testing

### Input Scenario

Candidate:

Senior Pharmacist

Experience:

* Hospital Pharmacist
* Regulatory Inspector

Education:

* Bachelor of Pharmacy

Languages:

* Arabic
* English

Certifications:

* Good Clinical Practice

Nationality:

* Egyptian

Location:

* Born in Saudi Arabia

### Expected JSON

```json
{
  "document_language": "en",
  "candidate_level": "mid",
  "full_name": "Kholoud Gamal Abou Bakr Mousa",
  "contact": {
    "email": "khalladolla@gmail.com",
    "phone": "+20 1121304560",
    "linkedin": "",
    "location": "Saudi Arabia"
  },
  "contact_line": "khalladolla@gmail.com | +20 1121304560 | Saudi Arabia",
  "target_job": "",
  "nationality": "Egyptian",
  "summary": "Pharmacist with experience across hospital pharmacy operations and pharmaceutical regulatory inspection. Background includes reviewing licensing documentation, supporting compliance checks, and working directly with patients in hospital and emergency pharmacy settings. Comfortable handling both clinical responsibilities and administrative documentation in regulated healthcare environments. Fluent in Arabic and English, with practical experience using common office and collaboration tools.",
  "core_competencies": {
    "technical_skills": [
      "Microsoft Excel",
      "Microsoft Word",
      "Microsoft PowerPoint",
      "Microsoft Teams",
      "Google Sheets"
    ],
    "industry_knowledge": [
      "Pharmaceutical Regulations",
      "Hospital Pharmacy Operations",
      "Regulatory Compliance",
      "Inspection and Licensing"
    ],
    "professional_skills": [
      "Patient Care",
      "Documentation Review",
      "Communication",
      "Report Preparation"
    ]
  },
  "experience": [
    {
      "job_title": "Inspector",
      "company": "Egyptian Drug Authority",
      "location": "Dakahlia, Egypt",
      "date_range": "2024 – Present",
      "bullets": [
        "Conduct regulatory inspections for licensing compliance within the pharmaceutical sector.",
        "Review submitted documentation and assess whether requirements are being followed.",
        "Work with regulatory teams to support public safety and compliance procedures.",
        "Provide practical recommendations when documentation or process gaps are identified."
      ]
    },
    {
      "job_title": "Hospital and Emergency Pharmacist",
      "company": "Tibah Hospital",
      "location": "Egypt",
      "date_range": "",
      "bullets": [
        "Dispensed medications and supported day-to-day pharmacy operations in hospital and emergency settings.",
        "Worked with medical staff to support safe medication use for patients.",
        "Handled prescription review, medication preparation, and patient-facing pharmacy tasks.",
        "Maintained pharmacy records and followed internal procedures for regulated medication handling."
      ]
    }
  ],
  "internships": [],
  "education": [
    {
      "degree": "Bachelor of Pharmacy",
      "major": "",
      "institution": "",
      "location": "",
      "date_range": "",
      "gpa": ""
    }
  ],
  "certifications": [
    {
      "name": "Good Clinical Practice",
      "issuer": "",
      "date": ""
    }
  ],
  "projects": [],
  "languages": [
    {
      "language": "Arabic",
      "level": "Fluent"
    },
    {
      "language": "English",
      "level": "Fluent"
    }
  ]
}
```

---

## Sample 2

Fresh Graduate Candidate

Status: Ready For Static Testing

### Input Scenario

Candidate:

Fresh Graduate Software Engineering Student

Education:

* Bachelor of Software Engineering

GPA:

* 3.7 / 4.0

Projects:

* E-commerce Website
* Inventory Management System

Internships:

* Software Engineering Intern

Languages:

* Arabic
* English

Certifications:

* Google Data Analytics Certificate

Location:

* Cairo, Egypt

### Expected JSON

```json
{
  "document_language": "en",
  "candidate_level": "fresh_graduate",
  "full_name": "Ahmed Hassan",
  "contact": {
    "email": "ahmed@example.com",
    "phone": "+20 1000000000",
    "linkedin": "",
    "location": "Cairo, Egypt"
  },
  "contact_line": "ahmed@example.com | +20 1000000000 | Cairo, Egypt",
  "target_job": "",
  "nationality": "",
  "summary": "Recent Software Engineering graduate with academic experience in software development, database design, and web applications. Completed internship experience supporting software development projects and testing activities. Built practical university projects involving business systems and e-commerce workflows. Interested in applying technical skills within a professional development environment.",
  "core_competencies": {
    "technical_skills": [
      "JavaScript",
      "React",
      "HTML",
      "CSS",
      "SQL"
    ],
    "industry_knowledge": [
      "Software Development",
      "Database Design",
      "Web Applications"
    ],
    "professional_skills": [
      "Problem Solving",
      "Communication",
      "Team Collaboration",
      "Time Management"
    ]
  },
  "experience": [],
  "internships": [
    {
      "job_title": "Software Engineering Intern",
      "company": "ABC Technology",
      "location": "Cairo, Egypt",
      "date_range": "Jun 2024 – Aug 2024",
      "bullets": [
        "Supported software development tasks under the supervision of senior developers.",
        "Assisted with testing and debugging activities.",
        "Participated in team meetings and project discussions.",
        "Contributed to documentation and code reviews."
      ]
    }
  ],
  "education": [
    {
      "degree": "Bachelor of Software Engineering",
      "major": "Software Engineering",
      "institution": "Cairo University",
      "location": "Cairo, Egypt",
      "date_range": "2020 – 2024",
      "gpa": "3.7 / 4.0"
    }
  ],
  "certifications": [
    {
      "name": "Google Data Analytics Certificate",
      "issuer": "Google",
      "date": ""
    }
  ],
  "projects": [
    {
      "title": "E-commerce Website",
      "date": "",
      "description": "University project focused on online retail workflows.",
      "bullets": [
        "Developed product catalog functionality.",
        "Implemented user authentication features.",
        "Created responsive user interfaces."
      ]
    },
    {
      "title": "Inventory Management System",
      "date": "",
      "description": "Academic project for inventory tracking and reporting.",
      "bullets": [
        "Designed database structure.",
        "Implemented inventory tracking functions.",
        "Generated operational reports."
      ]
    }
  ],
  "languages": [
    {
      "language": "Arabic",
      "level": "Native"
    },
    {
      "language": "English",
      "level": "Professional"
    }
  ]
}
```

---

## Validation Notes

These sample outputs must pass the following checks:

* Valid JSON
* `JSON.parse()` succeeds
* All root CvJsonV1 keys exist
* `document_language` uses only `en` or `ar`
* `candidate_level` uses only approved values
* `contact.location` exists as a string
* `contact_line` is generated only from:

  * email
  * phone
  * linkedin
  * location
* `nationality` remains separate from `contact_line`
* Empty sections use `[]`
* Empty text fields use `""`
* No HTML
* No CSS
* No markdown inside JSON values
* No placeholder values
* No fake metrics
* No unsupported achievements
* No DOCX formatting decisions
* No template decisions

# CV JSON Sample Outputs

Purpose:

Validate CvJsonV1 before GPT integration.

These examples are for testing the schema structure only.

No design decisions are represented here.

No DOCX formatting decisions are represented here.

---

## Sample 1

Professional Candidate — EN

Status: Approved

### Input Scenario

Candidate: Junior Pharmacist / Licensing Inspector

### Expected JSON

{
  "document_language": "en",
  "candidate_level": "junior",

  "full_name": "Kholoud Gamal Abou Bakr Mousa",

  "contact": {
    "email": "Khallaodo@gmail.com",
    "phone": "+20 1121304560",
    "linkedin": "",
    "location": "Dakahlia, Egypt"
  },

  "contact_line": "Khallaodo@gmail.com | +20 1121304560 | Dakahlia, Egypt",

  "target_job": "Pharmacist",
  "nationality": "Egyptian - Born in Saudi Arabia",

  "summary": "Pharmacist with early-career experience in pharmaceutical regulatory inspection and hospital pharmacy. Currently serving as a Licensing Inspector at the Egyptian Drug Authority in Dakahlia, reviewing facility applications and supporting regulatory compliance procedures. Previous hospital experience covers prescription dispensing, patient-facing pharmacy tasks, and emergency pharmacy operations. Holds a Doctor of Pharmacy degree from Mansoura University.",

  "core_competencies": {
    "technical_skills": [
      "Microsoft Excel",
      "Microsoft Word",
      "Microsoft PowerPoint",
      "Microsoft Teams",
      "Google Sheets",
      "OneDrive"
    ],
    "industry_knowledge": [
      "Pharmaceutical Licensing",
      "Regulatory Compliance",
      "Hospital Pharmacy",
      "Emergency Pharmacy",
      "Clinical Research"
    ],
    "professional_skills": [
      "Documentation Review",
      "Report Preparation",
      "Patient Communication",
      "Attention to Detail"
    ]
  },

  "experience": [
    {
      "job_title": "Licensing Inspector",
      "company": "Egyptian Drug Authority",
      "location": "Dakahlia, Egypt",
      "date_range": "2024 – Present",
      "bullets": [
        "Reviews licensing applications submitted by pharmaceutical facilities and checks compliance with regulatory requirements.",
        "Conducts field inspections of pharmaceutical premises and documents findings.",
        "Follows up with facility owners on outstanding documentation and licensing conditions.",
        "Maintains inspection records and prepares reports in accordance with Egyptian Drug Authority procedures."
      ]
    },
    {
      "job_title": "Hospital and Emergency Pharmacist",
      "company": "Tibah Hospital",
      "location": "Mansoura, Egypt",
      "date_range": "2023",
      "bullets": [
        "Dispensed medications and managed prescription review in hospital and emergency pharmacy settings.",
        "Worked alongside medical staff to support safe and accurate medication use for patients.",
        "Handled medication preparation, labeling, and patient-facing pharmacy queries.",
        "Maintained pharmacy records and followed regulated procedures for controlled and standard medications."
      ]
    }
  ],

  "internships": [],

  "education": [
    {
      "degree": "Pharm D",
      "major": "Pharmacy",
      "institution": "Mansoura University",
      "location": "Mansoura, Egypt",
      "date_range": "2022 – 2025",
      "gpa": ""
    },
    {
      "degree": "Diploma",
      "major": "Toxicology and Forensic Chemical Analysis",
      "institution": "Mansoura University",
      "location": "Mansoura, Egypt",
      "date_range": "2021 – 2022",
      "gpa": ""
    },
    {
      "degree": "Bachelor's Degree",
      "major": "Pharmacy",
      "institution": "Faculty of Pharmacy and Pharmaceutical Manufacturing - Sinai University",
      "location": "Kantara, Egypt",
      "date_range": "2021",
      "gpa": ""
    }
  ],

  "certifications": [
    {
      "name": "TOEFL",
      "issuer": "",
      "date": ""
    },
    {
      "name": "IELTS",
      "issuer": "",
      "date": ""
    }
  ],

  "projects": [],

  "languages": [
    {
      "language": "Arabic",
      "level": "Native"
    },
    {
      "language": "English",
      "level": "Fluent"
    }
  ]
}

---

## Sample 2

Fresh Graduate Candidate — EN

Status: Approved

### Input Scenario

Candidate: Fresh Graduate Software Engineering Student

### Expected JSON

{
  "document_language": "en",
  "candidate_level": "fresh_graduate",

  "full_name": "Ahmed Hassan",

  "contact": {
    "email": "ahmed.hassan@example.com",
    "phone": "+20 1000000000",
    "linkedin": "linkedin.com/in/ahmedhassan",
    "location": "Cairo, Egypt"
  },

  "contact_line": "ahmed.hassan@example.com | +20 1000000000 | linkedin.com/in/ahmedhassan | Cairo, Egypt",

  "target_job": "Junior Software Engineer",
  "nationality": "Egyptian",

  "summary": "Recent Software Engineering graduate with academic exposure to frontend development, database design, and web application workflows. Built practical university projects involving e-commerce and inventory systems. Completed a summer internship supporting software development and testing tasks. Looking to apply technical skills in a professional development environment.",

  "core_competencies": {
    "technical_skills": [
      "JavaScript",
      "React",
      "HTML",
      "CSS",
      "SQL",
      "Python"
    ],
    "industry_knowledge": [
      "Software Development",
      "Database Design",
      "Web Applications",
      "Software Testing"
    ],
    "professional_skills": [
      "Problem Solving",
      "Team Collaboration",
      "Time Management",
      "Communication"
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
        "Assisted senior developers with feature development and bug fixes on an internal web application.",
        "Participated in daily stand-ups and sprint planning sessions.",
        "Wrote and ran basic test cases to validate application behavior.",
        "Contributed to internal documentation for new features."
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
      "date": "2024"
    }
  ],

  "projects": [
    {
      "title": "E-commerce Website",
      "date": "2023",
      "description": "University project for an online retail platform.",
      "bullets": [
        "Developed product catalog and shopping cart functionality.",
        "Implemented user authentication and session management.",
        "Designed responsive layouts compatible with mobile and desktop."
      ]
    },
    {
      "title": "Inventory Management System",
      "date": "2024",
      "description": "Academic project for stock tracking and reporting.",
      "bullets": [
        "Designed relational database schema for inventory records.",
        "Built inventory tracking, search, and update functions.",
        "Generated summary reports for stock levels and movements."
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
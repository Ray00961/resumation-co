# CV JSON Prompt Test Checklist

Purpose:

Validate CV_JSON_PROMPT_EN_V1 before implementation.

---

## Test Case 1

Professional Candidate

Expected:

- Valid JSON
- No HTML
- No Markdown
- candidate_level = junior / mid / senior / executive
- Experience section populated
- Education section populated
- Certifications populated when provided
- Languages populated when provided
- No hallucinations
- No fake metrics
- No fake achievements

PASS / FAIL

---

## Test Case 2

Fresh Graduate Candidate

Expected:

- Valid JSON
- candidate_level = fresh_graduate
- Education populated
- GPA populated when provided
- Projects populated
- Internships populated
- Experience may be empty
- No hallucinations
- No fake metrics

PASS / FAIL

---

## Test Case 3

Minimal Input Candidate

Example:

Name
Email
One Job

Expected:

- Valid JSON
- Empty arrays where data is missing
- Empty strings where fields are missing
- No invented content
- No placeholders
- No hallucinations

PASS / FAIL

---

## Global Validation

JSON Validation

- contact object exists
- contact_line generated correctly
- JSON.parse() succeeds
- All schema keys exist
- No missing root keys

Language Validation

- English output only
- Proper nouns preserved

Data Integrity Validation

- No fake companies
- No fake dates
- No fake certifications
- No fake skills
- No fake achievements
- No fake metrics

ATS Validation

- Keywords appear naturally
- No keyword stuffing
- Clean ATS-safe structure

Human Writing Validation

- Does not sound AI-generated
- Does not sound like marketing copy
- Does not use banned phrases
- Matches candidate seniority

Result:

PASS / FAIL
import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabase";
import { useLang } from "../context/LanguageContext";
import { Plus, Trash2, ChevronRight, ChevronLeft, ChevronDown, Loader2, Check, AlertCircle, Search, X, Sparkles } from "lucide-react";

interface WorkEntry {
  id: string;
  jobTitle: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  startMonth: string;
  startYear: string;
  endMonth: string;
  endYear: string;
  isCurrent: boolean;
  responsibilities: string;
}

interface EducationEntry {
  degree: string;
  major: string;
  university: string;
  location: string;
  graduationYear: string;
  gpa: string;
}

interface CertEntry {
  name: string;
  institution: string;
  year: string;
}

interface ProjectEntry {
  title: string;
  description: string;
  year: string;
}

interface FormState {
  fullName: string;
  phoneCode: string;
  phone: string;
  cvEmail: string;
  linkedin: string;
  nationality: string;
  location: string;
  targetJob: string;
  work: WorkEntry[];
  education: EducationEntry[];
  technicalSkills: string[];
  langArabic: string;
  langEnglish: string;
  langFrench: string;
  langOther: string;
  certificates: CertEntry[];
  projects: ProjectEntry[];
  agreedToTerms: boolean;
}

const defaultWork: WorkEntry = {
  id: "",
  jobTitle: "",
  company: "",
  location: "",
  startDate: "",
  endDate: "",
  startMonth: "",
  startYear: "",
  endMonth: "",
  endYear: "",
  isCurrent: false,
  responsibilities: "",
};
const defaultEdu: EducationEntry = { degree: "", major: "", university: "", location: "", graduationYear: "", gpa: "" };
const defaultCert: CertEntry     = { name: "", institution: "", year: "" };
const defaultProject: ProjectEntry = { title: "", description: "", year: "" };

const COUNTRY_CODES = [
  { code: "+93",  flag: "🇦🇫", name: "Afghanistan" },
  { code: "+355", flag: "🇦🇱", name: "Albania" },
  { code: "+213", flag: "🇩🇿", name: "Algeria" },
  { code: "+54",  flag: "🇦🇷", name: "Argentina" },
  { code: "+374", flag: "🇦🇲", name: "Armenia" },
  { code: "+61",  flag: "🇦🇺", name: "Australia" },
  { code: "+43",  flag: "🇦🇹", name: "Austria" },
  { code: "+994", flag: "🇦🇿", name: "Azerbaijan" },
  { code: "+973", flag: "🇧🇭", name: "Bahrain" },
  { code: "+880", flag: "🇧🇩", name: "Bangladesh" },
  { code: "+32",  flag: "🇧🇪", name: "Belgium" },
  { code: "+591", flag: "🇧🇴", name: "Bolivia" },
  { code: "+387", flag: "🇧🇦", name: "Bosnia" },
  { code: "+55",  flag: "🇧🇷", name: "Brazil" },
  { code: "+673", flag: "🇧🇳", name: "Brunei" },
  { code: "+359", flag: "🇧🇬", name: "Bulgaria" },
  { code: "+237", flag: "🇨🇲", name: "Cameroon" },
  { code: "+1",   flag: "🇨🇦", name: "Canada" },
  { code: "+56",  flag: "🇨🇱", name: "Chile" },
  { code: "+86",  flag: "🇨🇳", name: "China" },
  { code: "+57",  flag: "🇨🇴", name: "Colombia" },
  { code: "+243", flag: "🇨🇩", name: "Congo (DRC)" },
  { code: "+506", flag: "🇨🇷", name: "Costa Rica" },
  { code: "+385", flag: "🇭🇷", name: "Croatia" },
  { code: "+53",  flag: "🇨🇺", name: "Cuba" },
  { code: "+357", flag: "🇨🇾", name: "Cyprus" },
  { code: "+420", flag: "🇨🇿", name: "Czech Republic" },
  { code: "+45",  flag: "🇩🇰", name: "Denmark" },
  { code: "+253", flag: "🇩🇯", name: "Djibouti" },
  { code: "+20",  flag: "🇪🇬", name: "Egypt" },
  { code: "+372", flag: "🇪🇪", name: "Estonia" },
  { code: "+251", flag: "🇪🇹", name: "Ethiopia" },
  { code: "+358", flag: "🇫🇮", name: "Finland" },
  { code: "+33",  flag: "🇫🇷", name: "France" },
  { code: "+995", flag: "🇬🇪", name: "Georgia" },
  { code: "+49",  flag: "🇩🇪", name: "Germany" },
  { code: "+233", flag: "🇬🇭", name: "Ghana" },
  { code: "+30",  flag: "🇬🇷", name: "Greece" },
  { code: "+502", flag: "🇬🇹", name: "Guatemala" },
  { code: "+509", flag: "🇭🇹", name: "Haiti" },
  { code: "+504", flag: "🇭🇳", name: "Honduras" },
  { code: "+852", flag: "🇭🇰", name: "Hong Kong" },
  { code: "+36",  flag: "🇭🇺", name: "Hungary" },
  { code: "+354", flag: "🇮🇸", name: "Iceland" },
  { code: "+91",  flag: "🇮🇳", name: "India" },
  { code: "+62",  flag: "🇮🇩", name: "Indonesia" },
  { code: "+98",  flag: "🇮🇷", name: "Iran" },
  { code: "+964", flag: "🇮🇶", name: "Iraq" },
  { code: "+353", flag: "🇮🇪", name: "Ireland" },
  { code: "+972", flag: "🇮🇱", name: "Israel" },
  { code: "+39",  flag: "🇮🇹", name: "Italy" },
  { code: "+225", flag: "🇨🇮", name: "Ivory Coast" },
  { code: "+81",  flag: "🇯🇵", name: "Japan" },
  { code: "+962", flag: "🇯🇴", name: "Jordan" },
  { code: "+7",   flag: "🇰🇿", name: "Kazakhstan" },
  { code: "+254", flag: "🇰🇪", name: "Kenya" },
  { code: "+965", flag: "🇰🇼", name: "Kuwait" },
  { code: "+996", flag: "🇰🇬", name: "Kyrgyzstan" },
  { code: "+856", flag: "🇱🇦", name: "Laos" },
  { code: "+371", flag: "🇱🇻", name: "Latvia" },
  { code: "+961", flag: "🇱🇧", name: "Lebanon" },
  { code: "+231", flag: "🇱🇷", name: "Liberia" },
  { code: "+218", flag: "🇱🇾", name: "Libya" },
  { code: "+370", flag: "🇱🇹", name: "Lithuania" },
  { code: "+352", flag: "🇱🇺", name: "Luxembourg" },
  { code: "+60",  flag: "🇲🇾", name: "Malaysia" },
  { code: "+960", flag: "🇲🇻", name: "Maldives" },
  { code: "+223", flag: "🇲🇱", name: "Mali" },
  { code: "+356", flag: "🇲🇹", name: "Malta" },
  { code: "+222", flag: "🇲🇷", name: "Mauritania" },
  { code: "+52",  flag: "🇲🇽", name: "Mexico" },
  { code: "+373", flag: "🇲🇩", name: "Moldova" },
  { code: "+212", flag: "🇲🇦", name: "Morocco" },
  { code: "+258", flag: "🇲🇿", name: "Mozambique" },
  { code: "+95",  flag: "🇲🇲", name: "Myanmar" },
  { code: "+977", flag: "🇳🇵", name: "Nepal" },
  { code: "+31",  flag: "🇳🇱", name: "Netherlands" },
  { code: "+64",  flag: "🇳🇿", name: "New Zealand" },
  { code: "+234", flag: "🇳🇬", name: "Nigeria" },
  { code: "+47",  flag: "🇳🇴", name: "Norway" },
  { code: "+968", flag: "🇴🇲", name: "Oman" },
  { code: "+92",  flag: "🇵🇰", name: "Pakistan" },
  { code: "+507", flag: "🇵🇦", name: "Panama" },
  { code: "+595", flag: "🇵🇾", name: "Paraguay" },
  { code: "+51",  flag: "🇵🇪", name: "Peru" },
  { code: "+63",  flag: "🇵🇭", name: "Philippines" },
  { code: "+48",  flag: "🇵🇱", name: "Poland" },
  { code: "+351", flag: "🇵🇹", name: "Portugal" },
  { code: "+974", flag: "🇶🇦", name: "Qatar" },
  { code: "+40",  flag: "🇷🇴", name: "Romania" },
  { code: "+7",   flag: "🇷🇺", name: "Russia" },
  { code: "+250", flag: "🇷🇼", name: "Rwanda" },
  { code: "+966", flag: "🇸🇦", name: "Saudi Arabia" },
  { code: "+221", flag: "🇸🇳", name: "Senegal" },
  { code: "+381", flag: "🇷🇸", name: "Serbia" },
  { code: "+65",  flag: "🇸🇬", name: "Singapore" },
  { code: "+421", flag: "🇸🇰", name: "Slovakia" },
  { code: "+386", flag: "🇸🇮", name: "Slovenia" },
  { code: "+252", flag: "🇸🇴", name: "Somalia" },
  { code: "+27",  flag: "🇿🇦", name: "South Africa" },
  { code: "+82",  flag: "🇰🇷", name: "South Korea" },
  { code: "+211", flag: "🇸🇸", name: "South Sudan" },
  { code: "+34",  flag: "🇪🇸", name: "Spain" },
  { code: "+94",  flag: "🇱🇰", name: "Sri Lanka" },
  { code: "+249", flag: "🇸🇩", name: "Sudan" },
  { code: "+46",  flag: "🇸🇪", name: "Sweden" },
  { code: "+41",  flag: "🇨🇭", name: "Switzerland" },
  { code: "+963", flag: "🇸🇾", name: "Syria" },
  { code: "+886", flag: "🇹🇼", name: "Taiwan" },
  { code: "+255", flag: "🇹🇿", name: "Tanzania" },
  { code: "+66",  flag: "🇹🇭", name: "Thailand" },
  { code: "+216", flag: "🇹🇳", name: "Tunisia" },
  { code: "+90",  flag: "🇹🇷", name: "Turkey" },
  { code: "+993", flag: "🇹🇲", name: "Turkmenistan" },
  { code: "+256", flag: "🇺🇬", name: "Uganda" },
  { code: "+380", flag: "🇺🇦", name: "Ukraine" },
  { code: "+971", flag: "🇦🇪", name: "UAE" },
  { code: "+44",  flag: "🇬🇧", name: "United Kingdom" },
  { code: "+1",   flag: "🇺🇸", name: "USA" },
  { code: "+598", flag: "🇺🇾", name: "Uruguay" },
  { code: "+998", flag: "🇺🇿", name: "Uzbekistan" },
  { code: "+58",  flag: "🇻🇪", name: "Venezuela" },
  { code: "+84",  flag: "🇻🇳", name: "Vietnam" },
  { code: "+967", flag: "🇾🇪", name: "Yemen" },
  { code: "+260", flag: "🇿🇲", name: "Zambia" },
  { code: "+263", flag: "🇿🇼", name: "Zimbabwe" },
];

const SKILLS_CATEGORIES = [
  // ── PROGRAMMING ──
  { label: "Programming Languages",  skills: ["Python", "JavaScript", "TypeScript", "Java", "C", "C++", "C#", "PHP", "Ruby", "Swift", "Kotlin", "Go", "Rust", "R", "MATLAB", "Scala", "Dart", "Perl", "Bash/Shell", "Assembly", "Lua", "Haskell"] },
  { label: "Data & Query Languages", skills: ["SQL", "NoSQL", "JSON", "XML", "YAML", "GraphQL", "HQL", "T-SQL", "PL/SQL", "Cypher (Neo4j)"] },
  { label: "Web & Frontend",         skills: ["HTML5", "CSS3", "React", "Vue.js", "Angular", "Next.js", "Nuxt.js", "Svelte", "Tailwind CSS", "Bootstrap", "jQuery", "Redux", "Zustand", "SASS/SCSS", "Webpack", "Vite"] },
  { label: "Backend & Frameworks",   skills: ["Node.js", "Express.js", "Django", "Flask", "FastAPI", "Spring Boot", "Laravel", "ASP.NET", "Ruby on Rails", "NestJS", "Gin (Go)", "Fiber", "Microservices", "REST APIs", "WebSockets", "gRPC"] },
  { label: "Databases & Storage",    skills: ["MySQL", "PostgreSQL", "MongoDB", "Redis", "SQLite", "Oracle DB", "Microsoft SQL Server", "Firebase", "Supabase", "Elasticsearch", "DynamoDB", "Cassandra", "MariaDB", "Neo4j"] },
  { label: "Cloud & DevOps",         skills: ["AWS", "Google Cloud (GCP)", "Microsoft Azure", "Docker", "Kubernetes", "Terraform", "Ansible", "CI/CD", "GitHub Actions", "Jenkins", "Linux", "Nginx", "Apache", "Git", "GitHub", "GitLab", "Bitbucket"] },
  { label: "Data Science & AI",      skills: ["Machine Learning", "Deep Learning", "TensorFlow", "PyTorch", "Keras", "Scikit-learn", "Pandas", "NumPy", "OpenCV", "NLP", "LLMs", "Hugging Face", "Data Analysis", "Data Visualization", "Jupyter Notebook", "Tableau", "Power BI", "Looker"] },
  // ── MICROSOFT ──
  { label: "Microsoft Office Suite",    skills: ["Microsoft Excel", "Microsoft Word", "Microsoft PowerPoint", "Microsoft Access", "Microsoft Outlook", "Microsoft Teams", "Microsoft OneNote", "Microsoft Visio", "Microsoft Publisher", "SharePoint", "OneDrive"] },
  { label: "Microsoft Business Tools",  skills: ["Power BI", "Power Automate", "Power Apps", "Microsoft Dynamics 365", "Azure DevOps", "MS Project"] },
  // ── ADOBE ──
  { label: "Adobe Creative Suite", skills: ["Adobe Photoshop", "Adobe Illustrator", "Adobe InDesign", "Adobe XD", "Adobe After Effects", "Adobe Premiere Pro", "Adobe Lightroom", "Adobe Animate", "Adobe Audition", "Adobe Acrobat Pro", "Adobe Firefly"] },
  // ── DESIGN ──
  { label: "Design & UX Tools", skills: ["Figma", "Sketch", "Canva", "Canva Pro", "InVision", "Zeplin", "Framer", "Blender", "Cinema 4D", "DaVinci Resolve", "CapCut", "UI/UX Design", "Wireframing", "Prototyping"] },
  // ── GOOGLE ──
  { label: "Google Workspace", skills: ["Google Sheets", "Google Docs", "Google Slides", "Google Forms", "Google Meet", "Google Drive", "Google Looker Studio", "Google Sites"] },
  // ── PRODUCTIVITY ──
  { label: "Productivity & Collaboration", skills: ["Notion", "Trello", "Jira", "Asana", "Slack", "Zoom", "ClickUp", "Basecamp", "Monday.com", "Airtable", "Confluence", "Miro", "Linear"] },
  // ── BUSINESS ──
  { label: "ERP & CRM Systems",          skills: ["SAP ERP", "SAP S/4HANA", "Oracle ERP", "Salesforce", "HubSpot CRM", "Odoo", "NetSuite", "Microsoft Dynamics", "Zoho CRM"] },
  { label: "Finance & Accounting Tools", skills: ["QuickBooks", "Xero", "Sage", "FreshBooks", "Bloomberg Terminal", "Reuters Eikon", "Financial Modeling", "IFRS", "GAAP", "Bookkeeping", "Tax Preparation", "Auditing"] },
  // ── ENGINEERING ──
  { label: "Engineering & CAD",       skills: ["AutoCAD", "SolidWorks", "CATIA", "Revit", "ArchiCAD", "Civil 3D", "SketchUp", "ANSYS", "ETABS", "SAP2000", "STAAD.Pro", "Tekla Structures", "LabVIEW", "Proteus", "Altium Designer", "KiCad"] },
  { label: "Electronics & Embedded",  skills: ["Arduino", "Raspberry Pi", "PLC Programming", "SCADA", "Embedded Systems", "FPGA", "Microcontrollers (AVR/ARM)", "PCB Design", "Circuit Design", "IoT", "3D Printing", "CNC Machining", "VHDL/Verilog"] },
  // ── MARKETING ──
  { label: "Marketing & Analytics", skills: ["Google Analytics", "Google Ads", "Facebook/Meta Ads", "TikTok Ads", "SEO", "SEM", "Social Media Marketing", "Content Marketing", "Email Marketing", "Mailchimp", "Klaviyo", "HubSpot Marketing"] },
  { label: "E-Commerce & CMS",      skills: ["WordPress", "Shopify", "WooCommerce", "Webflow", "Wix", "Squarespace", "Magento", "PrestaShop", "Drupal"] },
  // ── OPERATIONS / CUSTOMER-FACING ──
  { label: "Sales & Business Development", skills: ["Sales Prospecting", "Lead Generation", "Account Management", "B2B Sales", "B2C Sales", "Cold Calling", "Negotiation", "Client Relationship Management", "Salesforce CRM", "HubSpot CRM", "Pipeline Management", "Sales Reporting", "Target Achievement", "Customer Retention"] },
  { label: "Customer Service & Support", skills: ["Customer Support", "Call Center Operations", "Complaint Resolution", "Zendesk", "Freshdesk", "Intercom", "Live Chat Support", "Email Support", "Phone Support", "Ticketing Systems", "CRM Documentation", "Customer Satisfaction", "Service Recovery"] },
  { label: "Hospitality & Tourism", skills: ["Hotel Operations", "Front Desk Operations", "Guest Relations", "Reservation Systems", "Housekeeping Coordination", "Food & Beverage Service", "Event Coordination", "Opera PMS", "Restaurant Management", "Travel Coordination", "Tour Operations"] },
  { label: "Retail & Store Operations", skills: ["POS Systems", "Inventory Control", "Visual Merchandising", "Cash Handling", "Store Operations", "Stock Replenishment", "Sales Floor Management", "Customer Assistance", "Loss Prevention", "Shift Supervision"] },
  { label: "Logistics & Supply Chain", skills: ["Logistics Coordination", "Supply Chain Management", "Warehouse Operations", "Procurement", "Vendor Management", "Shipping Documentation", "Fleet Coordination", "Inventory Planning", "Demand Forecasting", "ERP Systems", "Import/Export Documentation"] },
  { label: "Human Resources", skills: ["Recruitment", "Talent Acquisition", "Onboarding", "Employee Relations", "Payroll Coordination", "HRIS", "Performance Management", "Training Coordination", "Interview Scheduling", "Policy Administration"] },
  { label: "Administrative & Office", skills: ["Office Administration", "Data Entry", "Document Management", "Calendar Management", "Executive Assistance", "Records Management", "Scheduling", "Travel Arrangements", "Reporting", "Filing Systems"] },
  // ── OTHER ──
  { label: "Project Management",  skills: ["Agile", "Scrum", "Kanban", "PMP", "PRINCE2", "Risk Management", "Stakeholder Management", "Change Management", "OKRs"] },
  { label: "Healthcare & Medical", skills: ["EHR/EMR Systems", "Medical Coding (ICD-10)", "HIPAA Compliance", "Medical Billing", "Clinical Research", "Medical Imaging", "Laboratory Analysis", "Pharmacovigilance"] },
  { label: "Legal & Compliance",   skills: ["Legal Research", "Contract Drafting", "Regulatory Compliance", "Due Diligence", "Corporate Law", "Intellectual Property", "GDPR", "Anti-Money Laundering (AML)"] },
  { label: "Education & Training", skills: ["Curriculum Development", "E-Learning", "LMS (Moodle/Blackboard)", "Instructional Design", "Student Assessment", "Educational Technology", "Corporate Training"] },
  { label: "Communication & Media", skills: ["Technical Writing", "Copywriting", "Translation", "Interpretation", "Public Speaking", "Media Relations", "Content Creation", "Video Production", "Podcast Production"] },
];

const langOptions = [
  { value: "",                       label: "— Select —" },
  { value: "Native/Bilingual",       label: "Native / Bilingual — لغة الأم" },
  { value: "Fluent/Advanced",        label: "Fluent / Advanced — بطلاقة" },
  { value: "Proficient/Intermediate",label: "Proficient / Intermediate — محترف" },
  { value: "Conversational/Basic",   label: "Conversational / Basic — أساسيات" },
];

function generateId(len = 7) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function createDefaultWork(): WorkEntry {
  return { ...defaultWork, id: generateId(10) };
}

const MONTH_OPTIONS = [
  { value: "01", en: "January", ar: "يناير" },
  { value: "02", en: "February", ar: "فبراير" },
  { value: "03", en: "March", ar: "مارس" },
  { value: "04", en: "April", ar: "أبريل" },
  { value: "05", en: "May", ar: "مايو" },
  { value: "06", en: "June", ar: "يونيو" },
  { value: "07", en: "July", ar: "يوليو" },
  { value: "08", en: "August", ar: "أغسطس" },
  { value: "09", en: "September", ar: "سبتمبر" },
  { value: "10", en: "October", ar: "أكتوبر" },
  { value: "11", en: "November", ar: "نوفمبر" },
  { value: "12", en: "December", ar: "ديسمبر" },
];

const YEAR_OPTIONS = Array.from({ length: 70 }, (_, i) => String(new Date().getFullYear() + 1 - i));

function composeMonthYear(month: string, year: string) {
  if (!month && !year) return "";
  if (month && year) return `${month}/${year}`;
  return year || month;
}

function splitMonthYear(value?: string) {
  const raw = (value || "").trim();
  const match = raw.match(/^(0?[1-9]|1[0-2])[\/\-](\d{4})$/);
  if (match) return { month: match[1].padStart(2, "0"), year: match[2] };
  const yearOnly = raw.match(/^(\d{4})$/);
  if (yearOnly) return { month: "", year: yearOnly[1] };
  return { month: "", year: "" };
}

function normalizeWorkEntry(raw: Partial<WorkEntry> = {}): WorkEntry {
  const start = splitMonthYear(raw.startDate);
  const end = splitMonthYear(raw.endDate);
  const isCurrent = Boolean(raw.isCurrent || String(raw.endDate || "").toLowerCase() === "present");
  return {
    ...defaultWork,
    ...raw,
    id: raw.id || generateId(10),
    startMonth: raw.startMonth || start.month,
    startYear: raw.startYear || start.year,
    endMonth: raw.endMonth || (isCurrent ? "" : end.month),
    endYear: raw.endYear || (isCurrent ? "" : end.year),
    isCurrent,
  };
}

function normalizeEducationEntry(raw: Partial<EducationEntry> = {}): EducationEntry {
  return { ...defaultEdu, ...raw, gpa: raw.gpa || "" };
}

function buildSuggestions(rows: any[]): Record<string, string[]> {
  const map: Record<string, Set<string>> = {};
  const add = (key: string, val?: string) => {
    if (!val?.trim()) return;
    if (!map[key]) map[key] = new Set();
    map[key].add(val.trim());
  };
  rows.forEach(row => {
    const cv = row.cv_data ?? {};
    add("fullName",        cv.fullName);
    add("cvEmail",         cv.cvEmail);
    add("linkedin",        cv.linkedin);
    add("nationality",     cv.nationality);
    add("targetJob",       cv.targetJob);
    (cv.workExperience ?? []).forEach((w: any) => {
      add("jobTitle",      w.jobTitle);
      add("company",       w.company);
      add("workLocation",  w.location);
    });
    (cv.education ?? []).forEach((e: any) => {
      add("degree",        e.degree);
      add("major",         e.major);
      add("university",    e.university);
      add("eduLocation",   e.location);
    });
    (cv.certificates ?? []).forEach((c: any) => {
      add("certName",        c.name);
      add("certInstitution", c.institution);
    });
    (cv.projects ?? []).forEach((p: any) => {
      add("projectTitle",  p.title);
    });
  });
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, Array.from(v)]));
}

const TOTAL_STEPS = 6;

const stepTitles = [
  { en: "Personal Info",        ar: "المعلومات الشخصية" },
  { en: "Work Experience",      ar: "الخبرة العملية" },
  { en: "Education",            ar: "التعليم" },
  { en: "Skills & Languages",   ar: "المهارات واللغات" },
  { en: "Certificates & Projects", ar: "الشهادات والمشاريع" },
  { en: "Review & Submit",      ar: "المراجعة والإرسال" },
];

export default function ResumeForm() {
  const navigate    = useNavigate();
  const { id: archiveId } = useParams<{ id?: string }>();
  const isEditMode  = !!archiveId;
  const { lang, setLang, isRtl } = useLang();
  const [step, setStep]           = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId]       = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [phoneDropdownOpen, setPhoneDropdownOpen] = useState(false);
  const [phoneSearch, setPhoneSearch]             = useState("");
  const [phoneCountryName, setPhoneCountryName]   = useState("Lebanon");
  const [skillSearch, setSkillSearch]             = useState("");
  const [customSkill, setCustomSkill]             = useState("");
  const [aiLoading, setAiLoading]                 = useState<Record<string, boolean>>({});
  const [aiTips, setAiTips]                       = useState<Record<string, string>>({});
  const [aiErrors, setAiErrors]                   = useState<Record<string, string>>({});
  const phoneDropdownRef = useRef<HTMLDivElement>(null);

  // ── Save progress ──
  const [suggestions,  setSuggestions]  = useState<Record<string, string[]>>({});
  const [activeField,  setActiveField]  = useState<string | null>(null);
  const [draftLoaded,  setDraftLoaded]  = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Close phone dropdown on outside click ──
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (phoneDropdownRef.current && !phoneDropdownRef.current.contains(e.target as Node)) {
        setPhoneDropdownOpen(false);
        setPhoneSearch("");
      }
    };
    if (phoneDropdownOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [phoneDropdownOpen]);

  const [form, setForm] = useState<FormState>({
    fullName: "", phoneCode: "+961", phone: "", cvEmail: "",
    linkedin: "", nationality: "", location: "", targetJob: "",
    work: [createDefaultWork()],
    education: [{ ...defaultEdu }],
    technicalSkills: [],
    langArabic: "", langEnglish: "", langFrench: "", langOther: "",
    certificates: [], projects: [],
    agreedToTerms: false,
  });

  // ── Load user + form data (Direct Fetch — no SDK getSession() hanging) ──
  useEffect(() => {
    const init = async () => {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

      // 1. Read session from localStorage synchronously
      const lsKey = Object.keys(localStorage).find(
        k => k.startsWith("sb-") && k.endsWith("-auth-token")
      );
      let uid = "";
      let userEmail = "";
      let accessToken: string | null = null;

      if (lsKey) {
        try {
          const cached = JSON.parse(localStorage.getItem(lsKey) || "null");
          uid         = cached?.user?.id    ?? "";
          userEmail   = cached?.user?.email ?? "";
          accessToken = cached?.access_token ?? null;
        } catch {}
      }

      // 2. Fallback to SDK if localStorage empty
      if (!uid) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) { navigate("/login"); return; }
          uid         = session.user.id;
          userEmail   = session.user.email ?? "";
          accessToken = session.access_token;
        } catch { navigate("/login"); return; }
      }

      setUserId(uid);
      setLoginEmail(userEmail);

      const authHeader = accessToken ? `Bearer ${accessToken}` : `Bearer ${SUPABASE_KEY}`;

      // helper: parse phone string into code + number
      const parsePhone = (rawPhone: string) => {
        let phoneCode = "+961";
        let phoneNum  = rawPhone;
        if (rawPhone) {
          const matched = COUNTRY_CODES.find(c => rawPhone.startsWith(c.code + " "));
          if (matched) {
            phoneCode = matched.code;
            phoneNum  = rawPhone.slice(matched.code.length).trim();
            setPhoneCountryName(matched.name);
          }
        }
        return { phoneCode, phoneNum };
      };

      // ── EDIT MODE: load existing cv_archive row ──
      if (archiveId) {
        try {
          const res = await fetch(
            `${SUPABASE_URL}/rest/v1/cv_archive?form_id=eq.${archiveId}&user_id=eq.${uid}&select=*`,
            { headers: { "apikey": SUPABASE_KEY, "Authorization": authHeader } }
          );
          const rows = await res.json();
          const row  = Array.isArray(rows) ? rows[0] ?? null : null;

          if (!row) { navigate("/build"); return; } // row not found / not owner

          const cv = row.cv_data ?? {};
          const { phoneCode, phoneNum } = parsePhone(cv.phone || "");

          setForm(prev => ({
            ...prev,
            fullName:    cv.fullName    || "",
            phoneCode,
            phone:       phoneNum,
            cvEmail:     cv.cvEmail     || userEmail,
            linkedin:    cv.linkedin    || "",
            nationality: cv.nationality || "",
            location:    cv.location    || cv.currentLocation || "",
            targetJob:   cv.targetJob   || "",
            work:        cv.workExperience?.length ? cv.workExperience.map((w: Partial<WorkEntry>) => normalizeWorkEntry(w)) : [createDefaultWork()],
            education:   cv.education?.length      ? cv.education.map((e: Partial<EducationEntry>) => normalizeEducationEntry(e)) : [{ ...defaultEdu }],
            technicalSkills: Array.isArray(cv.technicalSkills)
              ? cv.technicalSkills
              : (cv.technicalSkills
                  ? String(cv.technicalSkills).split(",").map((s: string) => s.trim()).filter(Boolean)
                  : []),
            langArabic:  cv.languages?.arabic  || "",
            langEnglish: cv.languages?.english || "",
            langFrench:  cv.languages?.french  || "",
            langOther:   cv.languages?.other   || "",
            certificates: cv.certificates?.length ? cv.certificates : [],
            projects:     cv.projects?.length     ? cv.projects     : [],
            agreedToTerms: row.agreed_to_terms ?? false,
          }));
        } catch (err) {
          console.error("Edit-mode fetch error:", err);
        }
        return; // stop here in edit mode
      }

      // ── NEW MODE: load draft OR auto-fill from users table ──

      // 1. Fetch suggestions from previous cv_archive rows (non-blocking)
      fetch(
        `${SUPABASE_URL}/rest/v1/cv_archive?user_id=eq.${uid}&select=cv_data&order=created_at_utc.desc&limit=10`,
        { headers: { "apikey": SUPABASE_KEY, "Authorization": authHeader } }
      ).then(r => r.ok ? r.json() : []).then((rows: any[]) => {
        if (Array.isArray(rows) && rows.length > 0) setSuggestions(buildSuggestions(rows));
      }).catch(() => {});

      // 2. Check for saved draft
      const draftKey = `rsm_draft_${uid}`;
      const rawDraft = localStorage.getItem(draftKey);
      if (rawDraft) {
        try {
          const { form: savedForm, step: savedStep } = JSON.parse(rawDraft);
          setForm({
            ...savedForm,
            location: savedForm.location || "",
            work: Array.isArray(savedForm.work) && savedForm.work.length
              ? savedForm.work.map((w: Partial<WorkEntry>) => normalizeWorkEntry(w))
              : [createDefaultWork()],
            education: Array.isArray(savedForm.education) && savedForm.education.length
              ? savedForm.education.map((e: Partial<EducationEntry>) => normalizeEducationEntry(e))
              : [{ ...defaultEdu }],
          });
          if (savedStep) setStep(savedStep);
          setDraftLoaded(true);
          setDraftRestored(true);
          return; // skip auto-fill from users table
        } catch {}
      }
      setDraftLoaded(true);

      // 3. Fetch preferred_language only (no form pre-fill from users table)
      try {
        const uRes  = await fetch(
          `${SUPABASE_URL}/rest/v1/users?id=eq.${uid}&select=preferred_language`,
          { headers: { "apikey": SUPABASE_KEY, "Authorization": authHeader } }
        );
        const uRows = await uRes.json();
        const u     = Array.isArray(uRows) ? uRows[0] ?? null : null;
        if (u?.preferred_language === "ar" || u?.preferred_language === "en") {
          setLang(u.preferred_language as "ar" | "en");
        }
      } catch {
        // non-critical
      }
    };

    init();
  }, [navigate, archiveId]);

  // ── Auto-save draft to localStorage (new mode only, debounced 800ms) ──
  useEffect(() => {
    if (!userId || isEditMode || !draftLoaded) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      localStorage.setItem(`rsm_draft_${userId}`, JSON.stringify({ form, step }));
    }, 800);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [form, step, userId, isEditMode, draftLoaded]);

  // ── Validation ──
  const isStepValid = () => {
    switch (step) {
      case 1: return form.fullName.trim() !== "" && form.phone.trim() !== "" && form.cvEmail.trim() !== "" && form.nationality.trim() !== "" && form.location.trim() !== "" && form.targetJob.trim() !== "";
      case 2: return form.work.every(w => w.jobTitle.trim() !== "" && w.company.trim() !== "" && w.startMonth.trim() !== "" && w.startYear.trim() !== "" && (w.isCurrent || (w.endMonth.trim() !== "" && w.endYear.trim() !== "")) && w.responsibilities.trim() !== "");
      case 3: return form.education.every(e => e.degree.trim() !== "" && e.major.trim() !== "" && e.university.trim() !== "" && e.graduationYear.trim() !== "");
      case 4: return form.technicalSkills.length > 0;
      case 5: return true;
      case 6: return form.agreedToTerms;
      default: return true;
    }
  };

  const handleNext = () => {
    if (!isStepValid()) { setShowErrors(true); return; }
    setShowErrors(false);
    setStep(s => s + 1);
  };

  const set = (field: keyof FormState, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const setWork = (i: number, field: keyof WorkEntry, value: string) =>
    setForm(prev => { const work = [...prev.work]; work[i] = { ...work[i], [field]: value }; return { ...prev, work }; });

  const setEdu = (i: number, field: keyof EducationEntry, value: string) =>
    setForm(prev => { const education = [...prev.education]; education[i] = { ...education[i], [field]: value }; return { ...prev, education }; });

  const setCert = (i: number, field: keyof CertEntry, value: string) =>
    setForm(prev => { const certificates = [...prev.certificates]; certificates[i] = { ...certificates[i], [field]: value }; return { ...prev, certificates }; });

  const setProj = (i: number, field: keyof ProjectEntry, value: string) =>
    setForm(prev => { const projects = [...prev.projects]; projects[i] = { ...projects[i], [field]: value }; return { ...prev, projects }; });

  // ── AI Questions Engine ──
  const generateQuestions = async (workId: string, jobTitle: string, company: string) => {
    if (!jobTitle.trim()) return;

    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
    const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    const lsKey = Object.keys(localStorage).find(k => k.startsWith("sb-") && k.endsWith("-auth-token"));
    const accessToken = lsKey
      ? (JSON.parse(localStorage.getItem(lsKey) || "null")?.access_token ?? null)
      : null;

    setAiTips(prev => {
      const next = { ...prev };
      delete next[workId];
      return next;
    });
    setAiErrors(prev => {
      const next = { ...prev };
      delete next[workId];
      return next;
    });
    setAiLoading(prev => ({ ...prev, [workId]: true }));

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 25000);

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-cv-bullets`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${accessToken ?? SUPABASE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jobTitle, company, language: lang }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `AI request failed: ${res.status}`);
      }

      const data = await res.json();
      const content = String(data?.content || "").trim();

      if (!content) {
        throw new Error("No questions returned");
      }

      setAiTips(prev => ({ ...prev, [workId]: content }));
    } catch (err: any) {
      const message = err?.name === "AbortError"
        ? (isRtl ? "استغرق إنشاء الأسئلة وقتاً طويلاً. حاول مرة أخرى." : "Creating questions took too long. Please try again.")
        : (isRtl ? "لم نتمكن من إنشاء الأسئلة. حاول مرة أخرى." : "We could not create questions. Please try again.");
      setAiErrors(prev => ({ ...prev, [workId]: message }));
    } finally {
      window.clearTimeout(timeoutId);
      setAiLoading(prev => {
        const next = { ...prev };
        delete next[workId];
        return next;
      });
    }
  };

  // ── Submit (Direct Fetch — all cv_archive writes bypass SDK) ──
  const handleSubmit = async () => {
    if (!userId || !form.agreedToTerms) return;
    setSubmitting(true);

    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
    const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    const lsKey = Object.keys(localStorage).find(k => k.startsWith("sb-") && k.endsWith("-auth-token"));
    const accessToken = lsKey
      ? (JSON.parse(localStorage.getItem(lsKey) || "null")?.access_token ?? null)
      : null;
    const authHeader = `Bearer ${accessToken ?? SUPABASE_KEY}`;

    const fullPhone = `${form.phoneCode} ${form.phone}`.trim();
    const workExperience = form.work.map((w) => ({
      ...w,
      startDate: composeMonthYear(w.startMonth, w.startYear),
      endDate: w.isCurrent ? "Present" : composeMonthYear(w.endMonth, w.endYear),
    }));

    const cvData = {
      fullName:        form.fullName,
      phone:           fullPhone,
      cvEmail:         form.cvEmail,
      linkedin:        form.linkedin,
      nationality:     form.nationality,
      location:        form.location,
      targetJob:       form.targetJob,
      workExperience,
      education:       form.education,
      technicalSkills: form.technicalSkills,        // array — not joined
      languages: {
        arabic:  form.langArabic,
        english: form.langEnglish,
        french:  form.langFrench,
        other:   form.langOther,
      },
      certificates: form.certificates,
      projects:     form.projects,
    };

    try {
      // ── Fetch user profile from users table ──
      let userRow: Record<string, any> = {};
      try {
        const uRes = await fetch(
          `${SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=username,first_name,last_name,email,preferred_language,region`,
          { headers: { "apikey": SUPABASE_KEY, "Authorization": authHeader } }
        );
        if (uRes.ok) {
          const uRows = await uRes.json();
          if (Array.isArray(uRows) && uRows.length > 0) userRow = uRows[0];
        }
      } catch { /* non-critical — fallback to empty */ }

      // Shared user columns (from users table)
      const userColumns = {
        username:           userRow.username           || null,
        first_name:         userRow.first_name         || null,
        last_name:          userRow.last_name          || null,
        email:              userRow.email              || loginEmail || null,
        preferred_language: userRow.preferred_language || null,
        region:             userRow.region             || null,
      };

      if (isEditMode && archiveId) {
        // ── PATCH: update existing cv_archive row ──
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/cv_archive?form_id=eq.${archiveId}&user_id=eq.${userId}`,
          {
            method: "PATCH",
            headers: {
              "apikey": SUPABASE_KEY,
              "Authorization": authHeader,
              "Content-Type": "application/json",
              "Prefer": "return=minimal",
            },
            body: JSON.stringify({
              ...userColumns,
              user_id:           userId,
              cv_data:           cvData,
              cv_target_job:     form.targetJob,
              cv_first_name:     form.fullName.split(' ')[0] || form.fullName,
              cv_last_name:      form.fullName.split(' ').slice(1).join(' ') || '',
              cv_email:          form.cvEmail,
              phone_number:      fullPhone,
              cv_phone_number:   fullPhone,
              agreed_to_terms:   true,
            }),
          }
        );
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(errText);
        }
        navigate("/dashboard");

      } else {
        // ── POST: create new cv_archive row ──
        const submissionId = generateId();
        const res = await fetch(`${SUPABASE_URL}/rest/v1/cv_archive`, {
          method: "POST",
          headers: {
            "apikey": SUPABASE_KEY,
            "Authorization": authHeader,
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
          },
          body: JSON.stringify({
            ...userColumns,
            user_id:           userId,
            submission_id:     submissionId,
            cv_data:           cvData,
            cv_target_job:     form.targetJob,
            cv_first_name:     form.fullName.split(' ')[0] || form.fullName,
            cv_last_name:      form.fullName.split(' ').slice(1).join(' ') || '',
            cv_email:          form.cvEmail,
            phone_number:      fullPhone,
            cv_phone_number:   fullPhone,
            agreed_to_terms:   true,
            agreed_at:         new Date().toISOString(),
          }),
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(errText);
        }

        // Clear draft after successful submit
        if (userId) localStorage.removeItem(`rsm_draft_${userId}`);
        navigate(`/dashboard`);

        // Non-blocking: sync key fields to profiles (Direct Fetch — SDK banned for profiles)
        fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
          method: "POST",
          headers: {
            "apikey": SUPABASE_KEY,
            "Authorization": authHeader,
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify({
            id:          userId,
            phone:       fullPhone,
            target_jobs: form.targetJob ? [form.targetJob] : [],
            skills:      form.technicalSkills,
            headline:    form.targetJob || "",
            experience:  workExperience
              .filter(w => w.jobTitle || w.company)
              .map(w => ({
                title:       w.jobTitle,
                company:     w.company,
                duration:    `${w.startDate}${w.endDate ? " - " + w.endDate : ""}`.trim(),
                description: w.responsibilities,
              })),
            updated_at: new Date().toISOString(),
          }),
        }).catch(e => console.warn("Profile sync (non-critical):", e));

      }
    } catch (err: any) {
      console.error("Submit error:", err);
      alert(`Save failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Styles ──
  const base      = "w-full rounded-lg px-4 py-2.5 text-[#F5F0E9] text-sm focus:outline-none transition-colors";
  const inputCls  = `${base} bg-[rgba(86,108,158,0.14)] border border-[rgba(86,108,158,0.4)] placeholder-[#7A8FAA] focus:border-[rgba(18,178,193,0.65)] focus:bg-[rgba(86,108,158,0.18)]`;
  const selectCls = `${base} bg-[#172033] border border-[rgba(86,108,158,0.55)] text-[#F5F0E9] focus:border-[rgba(18,178,193,0.75)] focus:bg-[#1B2638]`;
  const errCls    = `${base} bg-[rgba(200,60,60,0.08)] border border-[rgba(220,80,80,0.55)] placeholder-[rgba(220,80,80,0.45)] focus:border-[rgba(220,80,80,0.75)]`;
  const selectErrCls = `${base} bg-[rgba(200,60,60,0.08)] border border-[rgba(220,80,80,0.55)] text-[#F5F0E9] focus:border-[rgba(220,80,80,0.75)]`;
  const inp       = (value: string, required = false) => showErrors && required && value.trim() === "" ? errCls : inputCls;
  const selectInp = (value: string, required = false) => showErrors && required && value.trim() === "" ? selectErrCls : selectCls;
  const labelCls  = "block text-[12px] font-semibold text-[#E0C58F] mb-1.5 uppercase tracking-wider";
  const sectionCls = "bg-[rgba(86,108,158,0.1)] border border-[rgba(86,108,158,0.28)] rounded-xl p-5 space-y-4";
  const cardCls   = "bg-[rgba(86,108,158,0.12)] border border-[rgba(86,108,158,0.28)] rounded-xl p-4 space-y-3";

  const errMsg = (value: string, msg: string) =>
    showErrors && value.trim() === "" ? (
      <p className="flex items-center gap-1 text-[12px] text-red-400 mt-1">
        <AlertCircle size={11} /> {msg}
      </p>
    ) : null;

  // ── Suggestion dropdown (fires onMouseDown to beat onBlur) ──
  // activeKey can be "fieldKey" or "fieldKey_index" — we match by prefix
  const SuggestBox = ({ fieldKey, onSelect }: { fieldKey: string; onSelect: (v: string) => void }) => {
    const items = suggestions[fieldKey];
    const isActive = activeField !== null && (activeField === fieldKey || activeField.startsWith(fieldKey + "_"));
    if (!items?.length || !isActive) return null;
    return (
      <div className="mt-1 rounded-lg border border-[rgba(18,178,193,0.2)] bg-[#090E18] overflow-hidden shadow-xl">
        {items.slice(0, 6).map((val, idx) => (
          <button
            key={idx}
            type="button"
            onMouseDown={e => { e.preventDefault(); onSelect(val); setActiveField(null); }}
            className="w-full text-left px-3 py-2 text-[12px] text-[#D9CBC2] hover:bg-[rgba(18,178,193,0.07)] flex items-center gap-2 border-b border-[rgba(86,108,158,0.12)] last:border-0 transition-colors"
          >
            <span className="text-[rgba(18,178,193,0.45)] flex-shrink-0">↩</span>
            <span className="truncate">{val}</span>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div
      className="min-h-screen bg-[#0D1117] text-[#D9CBC2] py-10 px-4"
      dir={isRtl ? "rtl" : "ltr"}
      style={{ fontFamily: isRtl ? "'Tajawal', sans-serif" : "'Plus Jakarta Sans', sans-serif" }}
    >
      <div className="max-w-2xl mx-auto">

        {/* ── Draft restored banner ── */}
        {draftRestored && !isEditMode && (
          <div className="flex items-center justify-between mb-4 px-4 py-2.5 bg-[rgba(18,178,193,0.06)] border border-[rgba(18,178,193,0.2)] rounded-xl text-[12px]">
            <span className="text-[rgba(18,178,193,0.9)] font-semibold flex items-center gap-1.5">
              ↩ {isRtl ? "تم استعادة المسودة المحفوظة" : "Draft restored — pick up where you left off"}
            </span>
            <button
              type="button"
              onClick={() => {
                if (userId) localStorage.removeItem(`rsm_draft_${userId}`);
                setDraftRestored(false);
                setForm({ fullName: "", phoneCode: "+961", phone: "", cvEmail: "", linkedin: "", nationality: "", location: "", targetJob: "", work: [createDefaultWork()], education: [{ ...defaultEdu }], technicalSkills: [], langArabic: "", langEnglish: "", langFrench: "", langOther: "", certificates: [], projects: [], agreedToTerms: false });
                setStep(1);
              }}
              className="text-[#7A8FAA] hover:text-red-400 font-semibold transition-colors uppercase tracking-wider text-[10px]"
            >
              {isRtl ? "مسح المسودة" : "Clear draft"}
            </button>
          </div>
        )}

        {/* ── Header ── */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-[#F5F0E9]">
              {isRtl ? "بناء السيرة الذاتية" : "Resume Builder"}
            </h1>
            {/* Language toggle */}
            <button
              type="button"
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] bg-[rgba(86,108,158,0.15)] border border-[rgba(86,108,158,0.35)] rounded-lg text-[#E0C58F] hover:border-[rgba(18,178,193,0.5)] transition-all font-bold uppercase tracking-wide"
            >
              {isRtl ? "EN" : "AR"}
            </button>
          </div>
          <p className="text-[#7A8FAA] text-xs">
            {isRtl ? `الخطوة ${step} من ${TOTAL_STEPS}` : `Step ${step} of ${TOTAL_STEPS}`}
            {" — "}
            <span className="text-[rgba(18,178,193,0.9)]">
              {isRtl ? stepTitles[step - 1].ar : stepTitles[step - 1].en}
            </span>
          </p>
        </div>

        {/* ── Progress bar ── */}
        <div className="flex gap-1 mb-8">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i + 1 < step  ? "bg-[rgba(18,178,193,0.5)]"
              : i + 1 === step ? "bg-[rgba(18,178,193,1)]"
              : "bg-[rgba(86,108,158,0.2)]"
            }`} />
          ))}
        </div>

        {/* ── Validation banner ── */}
        {showErrors && !isStepValid() && (
          <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-[rgba(200,60,60,0.1)] border border-[rgba(220,80,80,0.35)] rounded-lg text-red-400 text-xs font-medium">
            <AlertCircle size={14} className="flex-shrink-0" />
            {isRtl
              ? "يرجى تعبئة جميع الحقول الإلزامية (*) قبل المتابعة"
              : "Please fill in all required fields (*) before continuing"}
          </div>
        )}

        {/* ══════════════════════════════════════
            STEP 1 — Personal Info
        ══════════════════════════════════════ */}
        {step === 1 && (
          <div className={sectionCls}>
            <div>
              <label className={labelCls}>{isRtl ? "الاسم الكامل *" : "Full Name *"}</label>
              <input className={inp(form.fullName, true)} value={form.fullName} onChange={e => set("fullName", e.target.value)} placeholder={isRtl ? "مثال: أحمد خليل" : "e.g. Ahmad Khalil"} onFocus={() => setActiveField("fullName")} onBlur={() => setActiveField(null)} />
              <SuggestBox fieldKey="fullName" onSelect={v => set("fullName", v)} />
              {errMsg(form.fullName, isRtl ? "الاسم مطلوب" : "Full name is required")}
            </div>

            <div>
              <label className={labelCls}>{isRtl ? "رقم الهاتف *" : "Phone Number *"}</label>
              <div className="flex gap-2" dir="ltr">
                <div className="relative flex-shrink-0" ref={phoneDropdownRef}>
                  <button
                    type="button"
                    onClick={() => { setPhoneDropdownOpen(o => !o); setPhoneSearch(""); }}
                    className="h-full bg-[rgba(86,108,158,0.14)] border border-[rgba(86,108,158,0.4)] rounded-lg px-2 py-2.5 text-[#F5F0E9] text-sm focus:outline-none hover:border-[rgba(18,178,193,0.65)] w-[110px] flex items-center gap-1 transition-colors"
                  >
                    <span className="text-base leading-none">{COUNTRY_CODES.find(c => c.name === phoneCountryName)?.flag ?? "🌍"}</span>
                    <span className="flex-1 text-left text-xs">{form.phoneCode}</span>
                    <ChevronDown size={12} className={`text-[#7A8FAA] transition-transform ${phoneDropdownOpen ? "rotate-180" : ""}`} />
                  </button>

                  {phoneDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 w-[270px] bg-[#0D1117] border border-[rgba(86,108,158,0.45)] rounded-xl z-50 shadow-2xl overflow-hidden">
                      <div className="p-2 border-b border-[rgba(86,108,158,0.2)]">
                        <div className="flex items-center gap-2 bg-[rgba(86,108,158,0.14)] border border-[rgba(86,108,158,0.3)] rounded-lg px-2.5 py-1.5">
                          <Search size={12} className="text-[#7A8FAA] flex-shrink-0" />
                          <input
                            autoFocus
                            className="flex-1 bg-transparent text-[#F5F0E9] text-xs placeholder-[#7A8FAA] focus:outline-none"
                            placeholder="Search country..."
                            value={phoneSearch}
                            onChange={e => setPhoneSearch(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="max-h-52 overflow-y-auto">
                        {COUNTRY_CODES.filter(c =>
                          c.name.toLowerCase().includes(phoneSearch.toLowerCase()) || c.code.includes(phoneSearch)
                        ).map(c => (
                          <button key={c.name} type="button"
                            onClick={() => { set("phoneCode", c.code); setPhoneCountryName(c.name); setPhoneDropdownOpen(false); setPhoneSearch(""); }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors text-left hover:bg-[rgba(86,108,158,0.2)] ${phoneCountryName === c.name ? "bg-[rgba(18,178,193,0.08)] text-[#E0C58F]" : "text-[#F5F0E9]"}`}
                          >
                            <span className="text-base leading-none w-5">{c.flag}</span>
                            <span className="text-[#7A8FAA] w-[42px] flex-shrink-0 font-mono">{c.code}</span>
                            <span className="truncate">{c.name}</span>
                          </button>
                        ))}
                        {COUNTRY_CODES.filter(c =>
                          c.name.toLowerCase().includes(phoneSearch.toLowerCase()) || c.code.includes(phoneSearch)
                        ).length === 0 && (
                          <p className="text-center text-[#7A8FAA] text-xs py-4">No results found</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <input className={`${inp(form.phone, true)} flex-1`} value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="70 000 000" dir="ltr" />
              </div>
              {errMsg(form.phone, isRtl ? "رقم الهاتف مطلوب" : "Phone number is required")}
            </div>

            <div>
              <label className={labelCls}>{isRtl ? "البريد الإلكتروني للحساب" : "Account Email"}</label>
              <div className="relative">
                <input className={`${base} bg-[rgba(86,108,158,0.05)] border border-[rgba(86,108,158,0.18)] text-[#7A8FAA] cursor-not-allowed`} value={loginEmail} readOnly dir="ltr" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#e1ebed] bg-[rgba(86,108,158,0.25)] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider">
                  {isRtl ? "ثابت" : "Fixed"}
                </span>
              </div>
            </div>

            <div>
              <label className={labelCls}>{isRtl ? "بريد السيرة الذاتية *" : "CV Email *"}</label>
              <input className={inp(form.cvEmail, true)} value={form.cvEmail} onChange={e => set("cvEmail", e.target.value)} placeholder="email@example.com" dir="ltr" onFocus={() => setActiveField("cvEmail")} onBlur={() => setActiveField(null)} />
              <SuggestBox fieldKey="cvEmail" onSelect={v => set("cvEmail", v)} />
              {errMsg(form.cvEmail, isRtl ? "بريد السيرة الذاتية مطلوب" : "CV email is required")}
            </div>

            <div>
              <label className={labelCls}>LinkedIn URL</label>
              <input className={inputCls} value={form.linkedin} onChange={e => set("linkedin", e.target.value)} placeholder="https://linkedin.com/in/..." dir="ltr" onFocus={() => setActiveField("linkedin")} onBlur={() => setActiveField(null)} />
              <SuggestBox fieldKey="linkedin" onSelect={v => set("linkedin", v)} />
            </div>

            <div>
              <label className={labelCls}>{isRtl ? "الجنسية *" : "Nationality *"}</label>
              <input className={inp(form.nationality, true)} value={form.nationality} onChange={e => set("nationality", e.target.value)} placeholder={isRtl ? "مثال: لبناني" : "e.g. Lebanese"} onFocus={() => setActiveField("nationality")} onBlur={() => setActiveField(null)} />
              <SuggestBox fieldKey="nationality" onSelect={v => set("nationality", v)} />
              {errMsg(form.nationality, isRtl ? "الجنسية مطلوبة" : "Nationality is required")}
            </div>

            <div>
              <label className={labelCls}>{isRtl ? "مكان الإقامة الحالي *" : "Current Location *"}</label>
              <input className={inp(form.location, true)} value={form.location} onChange={e => set("location", e.target.value)} placeholder={isRtl ? "مثال: بيروت، لبنان" : "e.g. Beirut, Lebanon"} />
              {errMsg(form.location, isRtl ? "مكان الإقامة مطلوب" : "Current location is required")}
            </div>

            <div>
              <label className={labelCls}>{isRtl ? "المسمى الوظيفي المستهدف *" : "Target Job Title *"}</label>
              <input className={inp(form.targetJob, true)} value={form.targetJob} onChange={e => set("targetJob", e.target.value)} placeholder={isRtl ? "مثال: مدير تسويق أول" : "e.g. Senior Marketing Manager"} onFocus={() => setActiveField("targetJob")} onBlur={() => setActiveField(null)} />
              <SuggestBox fieldKey="targetJob" onSelect={v => set("targetJob", v)} />
              {errMsg(form.targetJob, isRtl ? "المسمى الوظيفي مطلوب" : "Target job title is required")}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            STEP 2 — Work Experience
        ══════════════════════════════════════ */}
        {step === 2 && (
          <div className="space-y-4">
            {form.work.map((w, i) => (
              <div key={w.id || i} className={cardCls}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] font-mono font-bold text-[#E0C58F]">
                    {isRtl ? `الوظيفة ${i + 1}` : `Job ${i + 1}`}
                  </span>
                  {form.work.length > 1 && (
                    <button onClick={() => set("work", form.work.filter((_, idx) => idx !== i))} className="text-[#7A8FAA] hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div>
                  <label className={labelCls}>{isRtl ? "المسمى الوظيفي *" : "Job Title *"}</label>
                  <input className={inp(w.jobTitle, true)} value={w.jobTitle} onChange={e => setWork(i, "jobTitle", e.target.value)} placeholder={isRtl ? "مثال: مدير تسويق" : "e.g. Marketing Manager"} onFocus={() => setActiveField(`jobTitle_${i}`)} onBlur={() => setActiveField(null)} />
                  <SuggestBox fieldKey="jobTitle" onSelect={v => { setWork(i, "jobTitle", v); setActiveField(null); }} />
                  {errMsg(w.jobTitle, isRtl ? "المسمى الوظيفي مطلوب" : "Job title is required")}
                </div>

                <div>
                  <label className={labelCls}>{isRtl ? "اسم الشركة *" : "Company Name *"}</label>
                  <input className={inp(w.company, true)} value={w.company} onChange={e => setWork(i, "company", e.target.value)} placeholder={isRtl ? "مثال: جوجل" : "e.g. Google"} onFocus={() => setActiveField(`company_${i}`)} onBlur={() => setActiveField(null)} />
                  <SuggestBox fieldKey="company" onSelect={v => { setWork(i, "company", v); setActiveField(null); }} />
                  {errMsg(w.company, isRtl ? "اسم الشركة مطلوب" : "Company name is required")}
                </div>

                <div>
                  <label className={labelCls}>{isRtl ? "موقع العمل" : "Work Location"}</label>
                  <input className={inputCls} value={w.location} onChange={e => setWork(i, "location", e.target.value)} placeholder={isRtl ? "مثال: بيروت، لبنان" : "e.g. Beirut, Lebanon"} onFocus={() => setActiveField(`workLocation_${i}`)} onBlur={() => setActiveField(null)} />
                  <SuggestBox fieldKey="workLocation" onSelect={v => { setWork(i, "location", v); setActiveField(null); }} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>{isRtl ? "شهر البداية *" : "Start Month *"}</label>
                    <select className={selectInp(w.startMonth, true)} value={w.startMonth} onChange={e => setWork(i, "startMonth", e.target.value)} dir={isRtl ? "rtl" : "ltr"}>
                      <option className="bg-[#172033] text-[#F5F0E9]" value="">{isRtl ? "اختر الشهر" : "Select month"}</option>
                      {MONTH_OPTIONS.map(m => <option className="bg-[#172033] text-[#F5F0E9]" key={m.value} value={m.value}>{`${m.value} - ${isRtl ? m.ar : m.en}`}</option>)}
                    </select>
                    {errMsg(w.startMonth, isRtl ? "شهر البداية مطلوب" : "Start month is required")}
                  </div>
                  <div>
                    <label className={labelCls}>{isRtl ? "سنة البداية *" : "Start Year *"}</label>
                    <select className={selectInp(w.startYear, true)} value={w.startYear} onChange={e => setWork(i, "startYear", e.target.value)} dir="ltr">
                      <option className="bg-[#172033] text-[#F5F0E9]" value="">{isRtl ? "اختر السنة" : "Select year"}</option>
                      {YEAR_OPTIONS.map(y => <option className="bg-[#172033] text-[#F5F0E9]" key={y} value={y}>{y}</option>)}
                    </select>
                    {errMsg(w.startYear, isRtl ? "سنة البداية مطلوبة" : "Start year is required")}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const next = !w.isCurrent;
                    setForm(prev => {
                      const work = [...prev.work];
                      work[i] = { ...work[i], isCurrent: next, endMonth: next ? "" : work[i].endMonth, endYear: next ? "" : work[i].endYear };
                      return { ...prev, work };
                    });
                  }}
                  className={`flex items-center gap-2 text-[12px] font-semibold transition-colors ${w.isCurrent ? "text-[#12B2C1]" : "text-[#7A8FAA] hover:text-[#D9CBC2]"}`}
                >
                  <span className={`w-4 h-4 rounded border flex items-center justify-center ${w.isCurrent ? "bg-[#12B2C1] border-[#12B2C1] text-[#0D1117]" : "border-[rgba(86,108,158,0.55)]"}`}>
                    {w.isCurrent && <Check size={11} strokeWidth={3} />}
                  </span>
                  {isRtl ? "ما زلت أعمل هنا" : "I currently work here"}
                </button>

                {!w.isCurrent && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>{isRtl ? "شهر النهاية *" : "End Month *"}</label>
                      <select className={selectInp(w.endMonth, true)} value={w.endMonth} onChange={e => setWork(i, "endMonth", e.target.value)} dir={isRtl ? "rtl" : "ltr"}>
                        <option className="bg-[#172033] text-[#F5F0E9]" value="">{isRtl ? "اختر الشهر" : "Select month"}</option>
                        {MONTH_OPTIONS.map(m => <option className="bg-[#172033] text-[#F5F0E9]" key={m.value} value={m.value}>{`${m.value} - ${isRtl ? m.ar : m.en}`}</option>)}
                      </select>
                      {errMsg(w.endMonth, isRtl ? "شهر النهاية مطلوب" : "End month is required")}
                    </div>
                    <div>
                      <label className={labelCls}>{isRtl ? "سنة النهاية *" : "End Year *"}</label>
                      <select className={selectInp(w.endYear, true)} value={w.endYear} onChange={e => setWork(i, "endYear", e.target.value)} dir="ltr">
                        <option className="bg-[#172033] text-[#F5F0E9]" value="">{isRtl ? "اختر السنة" : "Select year"}</option>
                        {YEAR_OPTIONS.map(y => <option className="bg-[#172033] text-[#F5F0E9]" key={y} value={y}>{y}</option>)}
                      </select>
                      {errMsg(w.endYear, isRtl ? "سنة النهاية مطلوبة" : "End year is required")}
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1.5 gap-3">
                    <label className={`${labelCls} mb-0`}>
                      {isRtl ? "المهام والإنجازات *" : "Responsibilities & Achievements *"}
                    </label>
                    <button
                      type="button"
                      disabled={!w.jobTitle.trim() || Boolean(aiLoading[w.id])}
                      onClick={() => generateQuestions(w.id, w.jobTitle, w.company)}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] bg-[rgba(18,178,193,0.08)] border border-[rgba(18,178,193,0.3)] rounded-lg text-[rgba(18,178,193,0.9)] hover:bg-[rgba(18,178,193,0.18)] transition-all disabled:opacity-40 disabled:cursor-not-allowed font-semibold tracking-wide whitespace-nowrap"
                    >
                      {aiLoading[w.id]
                        ? <><Loader2 size={10} className="animate-spin" /> {isRtl ? "جاري إنشاء الأسئلة..." : "Creating questions..."}</>
                        : <><Sparkles size={10} /> {isRtl ? "أسئلة AI" : "AI Questions"}</>
                      }
                    </button>
                  </div>
                  <textarea
                    className={`${inp(w.responsibilities, true)} h-32 resize-none`}
                    value={w.responsibilities}
                    onChange={e => setWork(i, "responsibilities", e.target.value)}
                    placeholder={isRtl ? "اكتب إجاباتك أو مهامك هنا. إذا لا تعرف ماذا تكتب، اضغط أسئلة AI." : "Write your answers or responsibilities here. If you do not know what to write, click AI Questions."}
                  />
                  {errMsg(w.responsibilities, isRtl ? "اكتب مهامك أو أجب على أسئلة AI" : "Add responsibilities or answer the AI questions")}

                  {aiErrors[w.id] && (
                    <p className="mt-2 flex items-center gap-1 text-[12px] text-red-400">
                      <AlertCircle size={11} /> {aiErrors[w.id]}
                    </p>
                  )}

                  {aiTips[w.id] && (
                    <div className="mt-2 p-3 bg-[rgba(18,178,193,0.05)] border border-[rgba(18,178,193,0.2)] rounded-lg relative" dir={isRtl ? "rtl" : "ltr"}>
                      <button
                        type="button"
                        onClick={() => setAiTips(prev => { const n = { ...prev }; delete n[w.id]; return n; })}
                        className={`absolute top-2 ${isRtl ? "left-2" : "right-2"} text-[#e1ebed] hover:text-[#F5F0E9] transition-colors`}
                      >
                        <X size={12} />
                      </button>
                      <p className="text-[11px] font-bold text-[rgba(18,178,193,0.8)] uppercase tracking-widest mb-2 flex items-center gap-1">
                        <Sparkles size={9} />
                        {isRtl ? "أجب على هذه الأسئلة لتقوية سيرتك الذاتية" : "Answer these questions to improve your CV"}
                      </p>
                      <div className={`space-y-2 ${isRtl ? "pl-2" : "pr-4"}`}>
                        {aiTips[w.id].split("\n").filter(l => l.trim()).map((question, qIdx) => (
                          <p key={qIdx} className="text-[12px] text-[#C8BFBA] leading-relaxed">
                            <span className="text-[#12B2C1] font-mono">{qIdx + 1}.</span> {question}
                          </p>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const questionsText = aiTips[w.id]
                            .split("\n")
                            .filter(l => l.trim())
                            .map(q => `${q}\n${isRtl ? "الإجابة: " : "Answer: "}`)
                            .join("\n\n");
                          const nextText = w.responsibilities.trim()
                            ? `${w.responsibilities.trim()}\n\n${questionsText}`
                            : questionsText;
                          setWork(i, "responsibilities", nextText);
                        }}
                        className="mt-3 w-full py-2 rounded-lg border border-[rgba(18,178,193,0.25)] text-[12px] text-[#12B2C1] hover:bg-[rgba(18,178,193,0.08)] transition-colors font-semibold"
                      >
                        {isRtl ? "إضافة الأسئلة إلى خانة الإجابات" : "Add questions to answer box"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {form.work.length < 7 && (
              <button onClick={() => set("work", [...form.work, createDefaultWork()])}
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-[rgba(86,108,158,0.4)] rounded-lg text-[#7A8FAA] hover:border-[rgba(18,178,193,0.5)] hover:text-[rgba(18,178,193,1)] transition-all text-xs font-medium">
                <Plus size={14} />
                {isRtl ? "إضافة وظيفة أخرى" : "Add Another Job"}
              </button>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════
            STEP 3 — Education
        ══════════════════════════════════════ */}
        {step === 3 && (
          <div className="space-y-4">
            {form.education.map((e, i) => (
              <div key={i} className={cardCls}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] font-mono font-bold text-[#E0C58F]">
                    {isRtl ? `الشهادة ${i + 1}` : `Degree ${i + 1}`}
                  </span>
                  {form.education.length > 1 && (
                    <button onClick={() => set("education", form.education.filter((_, idx) => idx !== i))} className="text-[#7A8FAA] hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div>
                  <label className={labelCls}>{isRtl ? "الشهادة *" : "Degree / Certificate *"}</label>
                  <input className={inp(e.degree, true)} value={e.degree} onChange={ev => setEdu(i, "degree", ev.target.value)} placeholder={isRtl ? "مثال: بكالوريوس" : "e.g. Bachelor's Degree"} onFocus={() => setActiveField(`degree_${i}`)} onBlur={() => setActiveField(null)} />
                  <SuggestBox fieldKey="degree" onSelect={v => { setEdu(i, "degree", v); setActiveField(null); }} />
                  {errMsg(e.degree, isRtl ? "الشهادة مطلوبة" : "Degree is required")}
                </div>
                <div>
                  <label className={labelCls}>{isRtl ? "التخصص *" : "Major / Field of Study *"}</label>
                  <input className={inp(e.major, true)} value={e.major} onChange={ev => setEdu(i, "major", ev.target.value)} placeholder={isRtl ? "مثال: إدارة الأعمال" : "e.g. Business Administration"} onFocus={() => setActiveField(`major_${i}`)} onBlur={() => setActiveField(null)} />
                  <SuggestBox fieldKey="major" onSelect={v => { setEdu(i, "major", v); setActiveField(null); }} />
                  {errMsg(e.major, isRtl ? "التخصص مطلوب" : "Major is required")}
                </div>
                <div>
                  <label className={labelCls}>{isRtl ? "الجامعة *" : "University / School *"}</label>
                  <input className={inp(e.university, true)} value={e.university} onChange={ev => setEdu(i, "university", ev.target.value)} placeholder={isRtl ? "مثال: الجامعة الأمريكية في بيروت" : "e.g. American University of Beirut"} onFocus={() => setActiveField(`university_${i}`)} onBlur={() => setActiveField(null)} />
                  <SuggestBox fieldKey="university" onSelect={v => { setEdu(i, "university", v); setActiveField(null); }} />
                  {errMsg(e.university, isRtl ? "اسم الجامعة مطلوب" : "University name is required")}
                </div>
                <div>
                  <label className={labelCls}>{isRtl ? "المدينة والدولة" : "City & Country"}</label>
                  <input className={inputCls} value={e.location} onChange={ev => setEdu(i, "location", ev.target.value)} placeholder={isRtl ? "مثال: بيروت، لبنان" : "e.g. Beirut, Lebanon"} onFocus={() => setActiveField(`eduLocation_${i}`)} onBlur={() => setActiveField(null)} />
                  <SuggestBox fieldKey="eduLocation" onSelect={v => { setEdu(i, "location", v); setActiveField(null); }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>{isRtl ? "سنة التخرج *" : "Graduation Year *"}</label>
                    <select className={selectInp(e.graduationYear, true)} value={e.graduationYear} onChange={ev => setEdu(i, "graduationYear", ev.target.value)} dir="ltr">
                      <option className="bg-[#172033] text-[#F5F0E9]" value="">{isRtl ? "اختر السنة" : "Select year"}</option>
                      {YEAR_OPTIONS.map(y => <option className="bg-[#172033] text-[#F5F0E9]" key={y} value={y}>{y}</option>)}
                    </select>
                    {errMsg(e.graduationYear, isRtl ? "سنة التخرج مطلوبة" : "Graduation year is required")}
                  </div>
                  <div>
                    <label className={labelCls}>{isRtl ? "المعدل GPA" : "GPA"}</label>
                    <input className={inputCls} value={e.gpa} onChange={ev => setEdu(i, "gpa", ev.target.value)} placeholder={isRtl ? "مثال: 3.6/4 أو جيد جداً" : "e.g. 3.6/4 or Very Good"} dir={isRtl ? "rtl" : "ltr"} />
                    <p className="text-[10px] text-[#7A8FAA] mt-1">{isRtl ? "مفيد خصوصاً للخريجين الجدد والمستوى junior" : "Helpful for fresh graduates and junior candidates"}</p>
                  </div>
                </div>
              </div>
            ))}
            {form.education.length < 4 && (
              <button onClick={() => set("education", [...form.education, { ...defaultEdu }])}
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-[rgba(86,108,158,0.4)] rounded-lg text-[#7A8FAA] hover:border-[rgba(18,178,193,0.5)] hover:text-[rgba(18,178,193,1)] transition-all text-xs font-medium">
                <Plus size={14} />
                {isRtl ? "إضافة شهادة أخرى" : "Add Another Degree"}
              </button>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════
            STEP 4 — Skills & Languages
        ══════════════════════════════════════ */}
        {step === 4 && (
          <div className={sectionCls}>
            <div>
              <label className={labelCls}>{isRtl ? "المهارات التقنية *" : "Technical Skills *"}</label>

              {/* Selected tags */}
              {form.technicalSkills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3 p-3 bg-[rgba(18,178,193,0.04)] border border-[rgba(18,178,193,0.15)] rounded-lg">
                  {form.technicalSkills.map(skill => (
                    <span key={skill} className="flex items-center gap-1 px-2.5 py-1 bg-[rgba(18,178,193,0.12)] border border-[rgba(18,178,193,0.35)] rounded-full text-[12px] text-[#E0C58F] font-medium">
                      {skill}
                      <button type="button" onClick={() => set("technicalSkills", form.technicalSkills.filter(s => s !== skill))} className="text-[#7A8FAA] hover:text-red-400 transition-colors">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Search */}
              <div className="relative mb-3">
                <Search size={13} className={`absolute ${isRtl ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 text-[#7A8FAA]`} />
                <input
                  className={`${inputCls} ${isRtl ? "pr-9" : "pl-9"}`}
                  placeholder={isRtl ? "ابحث عن مهارة..." : "Search skills..."}
                  value={skillSearch}
                  onChange={e => setSkillSearch(e.target.value)}
                  dir="ltr"
                />
              </div>

              {/* Categories */}
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1 mb-3">
                {SKILLS_CATEGORIES
                  .map(cat => ({
                    ...cat,
                    skills: skillSearch.trim()
                      ? cat.skills.filter(s => s.toLowerCase().includes(skillSearch.toLowerCase()))
                      : cat.skills,
                  }))
                  .filter(cat => cat.skills.length > 0)
                  .map(cat => (
                    <div key={cat.label}>
                      <p className="text-[10px] font-bold text-[#e1ebed] uppercase tracking-widest mb-1.5">{cat.label}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {cat.skills.map(skill => {
                          const selected = form.technicalSkills.includes(skill);
                          return (
                            <button key={skill} type="button"
                              onClick={() => set("technicalSkills", selected ? form.technicalSkills.filter(s => s !== skill) : [...form.technicalSkills, skill])}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-medium border transition-all ${
                                selected
                                  ? "bg-[rgba(18,178,193,0.15)] border-[rgba(18,178,193,0.5)] text-[#E0C58F]"
                                  : "bg-[rgba(86,108,158,0.08)] border-[rgba(86,108,158,0.28)] text-[#C8BFBA] hover:border-[rgba(18,178,193,0.4)] hover:text-[#F5F0E9]"
                              }`}
                            >
                              {selected && <Check size={9} />}
                              {skill}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                {skillSearch.trim() && SKILLS_CATEGORIES.every(cat => cat.skills.every(s => !s.toLowerCase().includes(skillSearch.toLowerCase()))) && (
                  <p className="text-center text-[#7A8FAA] text-xs py-3">
                    {isRtl ? "لا نتائج — أضف كمهارة مخصصة أدناه" : "No results — add as custom skill below"}
                  </p>
                )}
              </div>

              {/* Custom skill */}
              <div className="flex gap-2 pt-3 border-t border-[rgba(86,108,158,0.2)]">
                <input
                  className={`${inputCls} flex-1`}
                  placeholder={isRtl ? "أضف مهارة غير موجودة بالقائمة..." : "Add custom skill not in list..."}
                  value={customSkill}
                  onChange={e => setCustomSkill(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && customSkill.trim()) {
                      e.preventDefault();
                      if (!form.technicalSkills.includes(customSkill.trim()))
                        set("technicalSkills", [...form.technicalSkills, customSkill.trim()]);
                      setCustomSkill("");
                    }
                  }}
                />
                <button type="button"
                  onClick={() => {
                    if (customSkill.trim() && !form.technicalSkills.includes(customSkill.trim()))
                      set("technicalSkills", [...form.technicalSkills, customSkill.trim()]);
                    setCustomSkill("");
                  }}
                  className="px-3 py-2.5 bg-[rgba(86,108,158,0.15)] border border-[rgba(86,108,158,0.4)] rounded-lg text-[#E0C58F] hover:border-[rgba(18,178,193,0.5)] transition-all flex-shrink-0"
                >
                  <Plus size={14} />
                </button>
              </div>

              {showErrors && form.technicalSkills.length === 0 && (
                <p className="flex items-center gap-1 text-[12px] text-red-400 mt-1">
                  <AlertCircle size={11} />
                  {isRtl ? "يرجى إضافة مهارة واحدة على الأقل" : "Please add at least one skill"}
                </p>
              )}
            </div>

            {/* Languages */}
            <div className="pt-2 border-t border-[rgba(86,108,158,0.2)]">
              <p className="text-[12px] font-bold text-[#E0C58F] uppercase tracking-wider mb-3">
                {isRtl ? "مستوى اللغات" : "Language Proficiency"}
              </p>
              {[
                { key: "langArabic",  label: isRtl ? "العربية"    : "Arabic — العربية" },
                { key: "langEnglish", label: isRtl ? "الإنجليزية" : "English — الإنجليزية" },
                { key: "langFrench",  label: isRtl ? "الفرنسية"   : "French — الفرنسية" },
              ].map(({ key, label }) => (
                <div key={key} className="mb-3">
                  <label className={labelCls}>{label}</label>
                  <select
                    className={`${inputCls} cursor-pointer`}
                    value={form[key as keyof FormState] as string}
                    onChange={e => set(key as keyof FormState, e.target.value)}
                  >
                    {langOptions.map(o => (
                      <option key={o.value} value={o.value} className="bg-[#0D1117]">{o.label}</option>
                    ))}
                  </select>
                </div>
              ))}
              <div>
                <label className={labelCls}>{isRtl ? "لغات أخرى" : "Other Languages"}</label>
                <input className={inputCls} value={form.langOther} onChange={e => set("langOther", e.target.value)}
                  placeholder={isRtl ? "مثال: الإسبانية - متوسط" : "e.g. Spanish - Intermediate"} />
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            STEP 5 — Certificates & Projects
        ══════════════════════════════════════ */}
        {step === 5 && (
          <div className="space-y-6">
            <div>
              <p className="text-[12px] font-bold text-[#E0C58F] uppercase tracking-wider mb-3">
                {isRtl ? "الشهادات والدورات" : "Certificates & Courses"}
              </p>
              <div className="space-y-3">
                {form.certificates.map((c, i) => (
                  <div key={i} className={cardCls}>
                    <div className="flex justify-between items-center">
                      <span className="text-[12px] font-mono text-[#E0C58F]">{isRtl ? `شهادة ${i + 1}` : `Certificate ${i + 1}`}</span>
                      <button onClick={() => set("certificates", form.certificates.filter((_, idx) => idx !== i))} className="text-[#7A8FAA] hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                    </div>
                    <input className={inputCls} placeholder={isRtl ? "اسم الشهادة"    : "Certificate name"}    value={c.name}        onChange={e => setCert(i, "name", e.target.value)} />
                    <input className={inputCls} placeholder={isRtl ? "المؤسسة المصدرة" : "Issuing institution"} value={c.institution} onChange={e => setCert(i, "institution", e.target.value)} />
                    <input className={inputCls} placeholder={isRtl ? "سنة الحصول"     : "Year"}               value={c.year}        onChange={e => setCert(i, "year", e.target.value)} dir="ltr" />
                  </div>
                ))}
                {form.certificates.length < 3 && (
                  <button onClick={() => set("certificates", [...form.certificates, { ...defaultCert }])}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-[rgba(86,108,158,0.4)] rounded-lg text-[#7A8FAA] hover:border-[rgba(18,178,193,0.5)] hover:text-[rgba(18,178,193,1)] transition-all text-xs font-medium">
                    <Plus size={14} /> {isRtl ? "إضافة شهادة" : "Add Certificate"}
                  </button>
                )}
              </div>
            </div>

            <div>
              <p className="text-[12px] font-bold text-[#E0C58F] uppercase tracking-wider mb-3">
                {isRtl ? "المشاريع" : "Projects"}
              </p>
              <div className="space-y-3">
                {form.projects.map((p, i) => (
                  <div key={i} className={cardCls}>
                    <div className="flex justify-between items-center">
                      <span className="text-[12px] font-mono text-[#E0C58F]">{isRtl ? `مشروع ${i + 1}` : `Project ${i + 1}`}</span>
                      <button onClick={() => set("projects", form.projects.filter((_, idx) => idx !== i))} className="text-[#7A8FAA] hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                    </div>
                    <input className={inputCls} placeholder={isRtl ? "عنوان المشروع"  : "Project title"}       value={p.title}       onChange={e => setProj(i, "title", e.target.value)} />
                    <textarea className={`${inputCls} h-20 resize-none`} placeholder={isRtl ? "وصف المشروع..." : "Project description..."} value={p.description} onChange={e => setProj(i, "description", e.target.value)} />
                    <input className={inputCls} placeholder={isRtl ? "سنة الإنجاز"    : "Year"}               value={p.year}        onChange={e => setProj(i, "year", e.target.value)} dir="ltr" />
                  </div>
                ))}
                {form.projects.length < 3 && (
                  <button onClick={() => set("projects", [...form.projects, { ...defaultProject }])}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-[rgba(86,108,158,0.4)] rounded-lg text-[#7A8FAA] hover:border-[rgba(18,178,193,0.5)] hover:text-[rgba(18,178,193,1)] transition-all text-xs font-medium">
                    <Plus size={14} /> {isRtl ? "إضافة مشروع" : "Add Project"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════
            STEP 6 — Review & Submit
        ══════════════════════════════════════ */}
        {step === 6 && (
          <div className={sectionCls}>
            <div className="space-y-1">
              {[
                { label: isRtl ? "الاسم"                  : "Name",          value: form.fullName },
                { label: isRtl ? "الهاتف"                 : "Phone",         value: `${form.phoneCode} ${form.phone}`.trim() },
                { label: isRtl ? "بريد السيرة الذاتية"    : "CV Email",      value: form.cvEmail },
                { label: isRtl ? "الجنسية"                : "Nationality",   value: form.nationality },
                { label: isRtl ? "مكان الإقامة"           : "Location",      value: form.location },
                { label: isRtl ? "المسمى الوظيفي"         : "Target Job",    value: form.targetJob },
                { label: isRtl ? "عدد الوظائف"            : "Jobs Added",    value: `${form.work.length}` },
                { label: isRtl ? "عدد الشهادات الأكاديمية": "Degrees Added", value: `${form.education.length}` },
                { label: isRtl ? "عدد المهارات"           : "Skills Added",  value: `${form.technicalSkills.length}` },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center py-2.5 border-b border-[rgba(86,108,158,0.15)]">
                  <span className="text-[#E0C58F] text-xs">{label}</span>
                  <span className="text-[#F5F0E9] text-sm font-medium">{value || "—"}</span>
                </div>
              ))}
            </div>

            <label className="flex items-start gap-3 cursor-pointer mt-4 p-3 border border-[rgba(86,108,158,0.28)] rounded-lg hover:border-[rgba(18,178,193,0.4)] transition-colors">
              <div
                onClick={() => set("agreedToTerms", !form.agreedToTerms)}
                className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
                  form.agreedToTerms
                    ? "bg-[rgba(18,178,193,0.85)] border-[rgba(18,178,193,0.85)]"
                    : "border-[rgba(86,108,158,0.5)] bg-transparent"
                }`}
              >
                {form.agreedToTerms && <Check size={10} className="text-white" />}
              </div>
              <span className="text-[#C8BFBA] text-xs leading-relaxed">
                {isRtl ? (
                  <>
                    أوافق على{" "}
                    <a href="https://www.resumation.co/terms" target="_blank" rel="noopener noreferrer" className="text-[#E0C58F] underline hover:text-[rgba(18,178,193,1)] transition-colors">الشروط والأحكام</a>
                    {" "}و{" "}
                    <a href="https://www.resumation.co/privacy" target="_blank" rel="noopener noreferrer" className="text-[#E0C58F] underline hover:text-[rgba(18,178,193,1)] transition-colors">سياسة الخصوصية</a>
                    {" "}الخاصة بـ Resumation.co
                  </>
                ) : (
                  <>
                    I agree to the{" "}
                    <a href="https://www.resumation.co/terms" target="_blank" rel="noopener noreferrer" className="text-[#E0C58F] underline hover:text-[rgba(18,178,193,1)] transition-colors">Terms & Conditions</a>
                    {" "}and{" "}
                    <a href="https://www.resumation.co/privacy" target="_blank" rel="noopener noreferrer" className="text-[#E0C58F] underline hover:text-[rgba(18,178,193,1)] transition-colors">Privacy Policy</a>
                    {" "}of Resumation.co
                  </>
                )}
              </span>
            </label>

            {showErrors && !form.agreedToTerms && (
              <p className="flex items-center gap-1 text-[12px] text-red-400 mt-1">
                <AlertCircle size={11} />
                {isRtl ? "يجب الموافقة على الشروط للمتابعة" : "You must agree to the terms to continue"}
              </p>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════
            Navigation
        ══════════════════════════════════════ */}
        <div className="flex items-center justify-between mt-6 gap-3">
          {step > 1 ? (
            <button
              onClick={() => { setShowErrors(false); setStep(s => s - 1); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-[rgba(86,108,158,0.12)] border border-[rgba(86,108,158,0.3)] rounded-lg text-[#E0C58F] hover:bg-[rgba(86,108,158,0.22)] transition-all text-sm"
            >
              {isRtl ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              {isRtl ? "السابق" : "Back"}
            </button>
          ) : <div />}

          {step < TOTAL_STEPS ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#1a3070] to-[#142660] border border-[rgba(86,108,158,0.45)] hover:border-[rgba(18,178,193,0.6)] rounded-lg text-[#E0C58F] transition-all text-sm font-medium ml-auto"
            >
              {isRtl ? "التالي" : "Next"}
              {isRtl ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-[#1a3070] to-[#0e1e45] border border-[rgba(18,178,193,0.45)] hover:border-[rgba(18,178,193,0.75)] rounded-lg text-[#E0C58F] transition-all text-sm font-medium ml-auto disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting
                ? <><Loader2 size={15} className="animate-spin" /> {isRtl ? "جاري الحفظ..." : "Saving..."}</>
                : <><Check size={15} /> {isRtl ? "حفظ ومتابعة" : "Save & Continue"}</>
              }
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

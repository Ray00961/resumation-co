import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabase";
import { useLang } from "../context/LanguageContext";
import { Plus, Trash2, ChevronRight, ChevronLeft, ChevronDown, Loader2, Check, AlertCircle, Search, X, Sparkles } from "lucide-react";

interface WorkEntry {
  jobTitle: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  responsibilities: string;
}

interface EducationEntry {
  degree: string;
  major: string;
  university: string;
  location: string;
  graduationYear: string;
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

const defaultWork: WorkEntry    = { jobTitle: "", company: "", location: "", startDate: "", endDate: "", responsibilities: "" };
const defaultEdu: EducationEntry = { degree: "", major: "", university: "", location: "", graduationYear: "" };
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
  const [aiLoading, setAiLoading]                 = useState<number[]>([]);
  const [aiTips, setAiTips]                       = useState<Record<number, string>>({});
  const phoneDropdownRef = useRef<HTMLDivElement>(null);

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
    linkedin: "", nationality: "", targetJob: "",
    work: [{ ...defaultWork }],
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
            `${SUPABASE_URL}/rest/v1/cv_archive?id=eq.${archiveId}&user_id=eq.${uid}&select=*`,
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
            targetJob:   cv.targetJob   || "",
            work:        cv.workExperience?.length ? cv.workExperience : [{ ...defaultWork }],
            education:   cv.education?.length      ? cv.education      : [{ ...defaultEdu }],
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

      // ── NEW MODE: auto-fill basics from users table ──
      try {
        const uRes  = await fetch(
          `${SUPABASE_URL}/rest/v1/users?id=eq.${uid}&select=first_name,phone_number,cv_email,target_job,preferred_language`,
          { headers: { "apikey": SUPABASE_KEY, "Authorization": authHeader } }
        );
        const uRows = await uRes.json();
        const u     = Array.isArray(uRows) ? uRows[0] ?? null : null;

        if (u) {
          if (u.preferred_language === "ar" || u.preferred_language === "en") {
            setLang(u.preferred_language as "ar" | "en");
          }
          const { phoneCode, phoneNum } = parsePhone(u.phone_number || "");
          setForm(prev => ({
            ...prev,
            fullName:  u.first_name  || "",
            phoneCode,
            phone:     phoneNum,
            cvEmail:   u.cv_email    || userEmail,
            targetJob: u.target_job  || "",
          }));
        } else {
          setForm(prev => ({ ...prev, cvEmail: userEmail }));
        }
      } catch (err) {
        console.error("New-mode user fetch error:", err);
        setForm(prev => ({ ...prev, cvEmail: userEmail }));
      }
    };

    init();
  }, [navigate, archiveId]);

  // ── Validation ──
  const isStepValid = () => {
    switch (step) {
      case 1: return form.fullName.trim() !== "" && form.phone.trim() !== "" && form.cvEmail.trim() !== "" && form.nationality.trim() !== "" && form.targetJob.trim() !== "";
      case 2: return form.work.every(w => w.jobTitle.trim() !== "" && w.company.trim() !== "");
      case 3: return form.education.every(e => e.degree.trim() !== "" && e.university.trim() !== "");
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

  // ── AI Tips ──
  const generateTips = async (i: number, jobTitle: string, company: string) => {
    if (!jobTitle.trim()) return;
    setAiTips(prev => { const n = { ...prev }; delete n[i]; return n; });
    setAiLoading(prev => [...prev, i]);
    try {
      const { data, error } = await supabase.functions.invoke("generate-cv-bullets", {
        body: { jobTitle, company, language: lang },
      });
      if (error) throw error;
      if (data?.content) setAiTips(prev => ({ ...prev, [i]: data.content }));
    } catch {
      // silently ignore — user writes manually
    } finally {
      setAiLoading(prev => prev.filter(idx => idx !== i));
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

    const cvData = {
      fullName:        form.fullName,
      phone:           fullPhone,
      cvEmail:         form.cvEmail,
      linkedin:        form.linkedin,
      nationality:     form.nationality,
      targetJob:       form.targetJob,
      workExperience:  form.work,
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
      if (isEditMode && archiveId) {
        // ── PATCH: update existing cv_archive row ──
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/cv_archive?id=eq.${archiveId}&user_id=eq.${userId}`,
          {
            method: "PATCH",
            headers: {
              "apikey": SUPABASE_KEY,
              "Authorization": authHeader,
              "Content-Type": "application/json",
              "Prefer": "return=minimal",
            },
            body: JSON.stringify({
              user_id:          userId,
              cv_data:          cvData,
              cv_target_job:    form.targetJob,
              cv_first_name:    form.fullName.split(' ')[0] || form.fullName,
              cv_last_name:     form.fullName.split(' ').slice(1).join(' ') || '',
              email:            loginEmail,
              cv_email:         form.cvEmail,
              phone_number:     fullPhone,
              cv_phone_number:  fullPhone,
              agreed_to_terms:  true,
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
        const newRowId      = crypto.randomUUID();
        const submissionId  = generateId();
        const res = await fetch(`${SUPABASE_URL}/rest/v1/cv_archive`, {
          method: "POST",
          headers: {
            "apikey": SUPABASE_KEY,
            "Authorization": authHeader,
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
          },
          body: JSON.stringify({
            id:               newRowId,
            user_id:          userId,
            submission_id:    submissionId,
            cv_data:          cvData,
            cv_target_job:    form.targetJob,
            cv_first_name:    form.fullName.split(' ')[0] || form.fullName,
            cv_last_name:     form.fullName.split(' ').slice(1).join(' ') || '',
            email:            loginEmail,
            cv_email:         form.cvEmail,
            phone_number:     fullPhone,
            cv_phone_number:  fullPhone,
            agreed_to_terms:  true,
            agreed_at:        new Date().toISOString(),
            package_name:     "free",
          }),
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(errText);
        }

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
            experience:  form.work
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
  const errCls    = `${base} bg-[rgba(200,60,60,0.08)] border border-[rgba(220,80,80,0.55)] placeholder-[rgba(220,80,80,0.45)] focus:border-[rgba(220,80,80,0.75)]`;
  const inp       = (value: string, required = false) => showErrors && required && value.trim() === "" ? errCls : inputCls;
  const labelCls  = "block text-[12px] font-semibold text-[#E0C58F] mb-1.5 uppercase tracking-wider";
  const sectionCls = "bg-[rgba(86,108,158,0.1)] border border-[rgba(86,108,158,0.28)] rounded-xl p-5 space-y-4";
  const cardCls   = "bg-[rgba(86,108,158,0.12)] border border-[rgba(86,108,158,0.28)] rounded-xl p-4 space-y-3";

  const errMsg = (value: string, msg: string) =>
    showErrors && value.trim() === "" ? (
      <p className="flex items-center gap-1 text-[12px] text-red-400 mt-1">
        <AlertCircle size={11} /> {msg}
      </p>
    ) : null;

  return (
    <div
      className="min-h-screen bg-[#0D1117] text-[#D9CBC2] py-10 px-4"
      dir={isRtl ? "rtl" : "ltr"}
      style={{ fontFamily: isRtl ? "'Tajawal', sans-serif" : "'Plus Jakarta Sans', sans-serif" }}
    >
      <div className="max-w-2xl mx-auto">

        {/* ── Header ── */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-[#F5F0E9]">
              {isRtl ? "بناء السيرة الذاتية" : "Resume Builder"}
            </h1>
            {/* Language toggle */}
            <button
              type="button"
              onClick={() => setLang(l => l === "ar" ? "en" : "ar")}
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
              <input className={inp(form.fullName, true)} value={form.fullName} onChange={e => set("fullName", e.target.value)} placeholder={isRtl ? "مثال: أحمد خليل" : "e.g. Ahmad Khalil"} />
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
              <input className={inp(form.cvEmail, true)} value={form.cvEmail} onChange={e => set("cvEmail", e.target.value)} placeholder="email@example.com" dir="ltr" />
              {errMsg(form.cvEmail, isRtl ? "بريد السيرة الذاتية مطلوب" : "CV email is required")}
            </div>

            <div>
              <label className={labelCls}>LinkedIn URL</label>
              <input className={inputCls} value={form.linkedin} onChange={e => set("linkedin", e.target.value)} placeholder="https://linkedin.com/in/..." dir="ltr" />
            </div>

            <div>
              <label className={labelCls}>{isRtl ? "الجنسية *" : "Nationality *"}</label>
              <input className={inp(form.nationality, true)} value={form.nationality} onChange={e => set("nationality", e.target.value)} placeholder={isRtl ? "مثال: لبناني" : "e.g. Lebanese"} />
              {errMsg(form.nationality, isRtl ? "الجنسية مطلوبة" : "Nationality is required")}
            </div>

            <div>
              <label className={labelCls}>{isRtl ? "المسمى الوظيفي المستهدف *" : "Target Job Title *"}</label>
              <input className={inp(form.targetJob, true)} value={form.targetJob} onChange={e => set("targetJob", e.target.value)} placeholder={isRtl ? "مثال: مدير تسويق أول" : "e.g. Senior Marketing Manager"} />
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
              <div key={i} className={cardCls}>
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
                  <input className={inp(w.jobTitle, true)} value={w.jobTitle} onChange={e => setWork(i, "jobTitle", e.target.value)} placeholder={isRtl ? "مثال: مدير تسويق" : "e.g. Marketing Manager"} />
                  {errMsg(w.jobTitle, isRtl ? "المسمى الوظيفي مطلوب" : "Job title is required")}
                </div>

                <div>
                  <label className={labelCls}>{isRtl ? "اسم الشركة *" : "Company Name *"}</label>
                  <input className={inp(w.company, true)} value={w.company} onChange={e => setWork(i, "company", e.target.value)} placeholder={isRtl ? "مثال: جوجل" : "e.g. Google"} />
                  {errMsg(w.company, isRtl ? "اسم الشركة مطلوب" : "Company name is required")}
                </div>

                <div>
                  <label className={labelCls}>{isRtl ? "الموقع" : "Location"}</label>
                  <input className={inputCls} value={w.location} onChange={e => setWork(i, "location", e.target.value)} placeholder={isRtl ? "مثال: بيروت، لبنان" : "e.g. Beirut, Lebanon"} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>{isRtl ? "تاريخ البداية" : "Start Date"}</label>
                    <input className={inputCls} value={w.startDate} onChange={e => setWork(i, "startDate", e.target.value)} placeholder="01/2020" dir="ltr" />
                  </div>
                  <div>
                    <label className={labelCls}>{isRtl ? "تاريخ النهاية" : "End Date"}</label>
                    <input className={inputCls} value={w.endDate} onChange={e => setWork(i, "endDate", e.target.value)} placeholder={isRtl ? "حتى الآن" : "Present"} dir="ltr" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={`${labelCls} mb-0`}>
                      {isRtl ? "المهام والإنجازات" : "Responsibilities & Achievements"}
                    </label>
                    <button
                      type="button"
                      disabled={!w.jobTitle.trim() || aiLoading.includes(i)}
                      onClick={() => generateTips(i, w.jobTitle, w.company)}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] bg-[rgba(18,178,193,0.08)] border border-[rgba(18,178,193,0.3)] rounded-lg text-[rgba(18,178,193,0.9)] hover:bg-[rgba(18,178,193,0.18)] transition-all disabled:opacity-40 disabled:cursor-not-allowed font-semibold tracking-wide"
                    >
                      {aiLoading.includes(i)
                        ? <><Loader2 size={10} className="animate-spin" /> {isRtl ? "جاري التحليل..." : "Analyzing..."}</>
                        : <><Sparkles size={10} /> {isRtl ? "نصائح AI" : "AI Tips"}</>
                      }
                    </button>
                  </div>
                  <textarea
                    className={`${inputCls} h-24 resize-none`}
                    value={w.responsibilities}
                    onChange={e => setWork(i, "responsibilities", e.target.value)}
                    placeholder={isRtl ? "اكتب مهامك وإنجازاتك الرئيسية..." : "Describe your key responsibilities and achievements..."}
                  />

                  {/* AI Tips panel */}
                  {aiTips[i] && (
                    <div className="mt-2 p-3 bg-[rgba(18,178,193,0.05)] border border-[rgba(18,178,193,0.2)] rounded-lg relative" dir={isRtl ? "rtl" : "ltr"}>
                      <button
                        type="button"
                        onClick={() => setAiTips(prev => { const n = { ...prev }; delete n[i]; return n; })}
                        className={`absolute top-2 ${isRtl ? "left-2" : "right-2"} text-[#e1ebed] hover:text-[#F5F0E9] transition-colors`}
                      >
                        <X size={12} />
                      </button>
                      <p className="text-[11px] font-bold text-[rgba(18,178,193,0.8)] uppercase tracking-widest mb-2 flex items-center gap-1">
                        <Sparkles size={9} />
                        {isRtl ? "نصائح لتقوية السيرة الذاتية" : "Tips to strengthen your bullets"}
                      </p>
                      <div className={`space-y-1.5 ${isRtl ? "pl-2" : "pr-4"}`}>
                        {aiTips[i].split("\n").filter(l => l.trim()).map((tip, t) => (
                          <p key={t} className="text-[12px] text-[#C8BFBA] leading-relaxed">{tip}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {form.work.length < 7 && (
              <button onClick={() => set("work", [...form.work, { ...defaultWork }])}
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
                  <input className={inp(e.degree, true)} value={e.degree} onChange={ev => setEdu(i, "degree", ev.target.value)} placeholder={isRtl ? "مثال: بكالوريوس" : "e.g. Bachelor's Degree"} />
                  {errMsg(e.degree, isRtl ? "الشهادة مطلوبة" : "Degree is required")}
                </div>
                <div>
                  <label className={labelCls}>{isRtl ? "التخصص" : "Major / Field of Study"}</label>
                  <input className={inputCls} value={e.major} onChange={ev => setEdu(i, "major", ev.target.value)} placeholder={isRtl ? "مثال: إدارة الأعمال" : "e.g. Business Administration"} />
                </div>
                <div>
                  <label className={labelCls}>{isRtl ? "الجامعة *" : "University / School *"}</label>
                  <input className={inp(e.university, true)} value={e.university} onChange={ev => setEdu(i, "university", ev.target.value)} placeholder={isRtl ? "مثال: الجامعة الأمريكية في بيروت" : "e.g. American University of Beirut"} />
                  {errMsg(e.university, isRtl ? "اسم الجامعة مطلوب" : "University name is required")}
                </div>
                <div>
                  <label className={labelCls}>{isRtl ? "المدينة والدولة" : "City & Country"}</label>
                  <input className={inputCls} value={e.location} onChange={ev => setEdu(i, "location", ev.target.value)} placeholder={isRtl ? "مثال: بيروت، لبنان" : "e.g. Beirut, Lebanon"} />
                </div>
                <div>
                  <label className={labelCls}>{isRtl ? "سنة التخرج" : "Graduation Year"}</label>
                  <input className={inputCls} value={e.graduationYear} onChange={ev => setEdu(i, "graduationYear", ev.target.value)} placeholder="e.g. 2018" dir="ltr" />
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

export interface Employer {
  id: string;
  name: string;
  industry: string;
  locations: string[];
  careerPageUrl: string;
  logoColor: string;
}

export const employersList: Employer[] = [
  // --- شركات باقة Premium (أول 5 - موجودة عندك) ---
  {
    id: "1",
    name: "First Abu Dhabi Bank",
    industry: "Banking",
    locations: ["International", "UAE"],
    careerPageUrl: "https://careers.smartrecruiters.com/FirstAbuDhabiBank",
    logoColor: "from-slate-800 to-slate-950"
  },
  {
    id: "2",
    name: "WSP",
    industry: "Engineering",
    locations: ["International", "Global"],
    careerPageUrl: "https://www.wsp.com/en-gl/careers",
    logoColor: "from-red-600 to-red-700"
  },
  {
    id: "3",
    name: "Marriott",
    industry: "Hospitality",
    locations: ["International", "Global"],
    careerPageUrl: "https://careers.marriott.com/jobs",
    logoColor: "from-rose-700 to-rose-900"
  },
  {
    id: "4",
    name: "Alshaya Group",
    industry: "Retail-Business",
    locations: ["Global", "MENA", "Europe"],
    careerPageUrl: "https://www.alshaya.com/en/careers/vacancies",
    logoColor: "from-blue-600 to-blue-700"
  },
  {
    id: "5",
    name: "Via Medica",
    industry: "Healthcare",
    locations: ["International", "UAE", "USA"],
    careerPageUrl: "https://viamedicaintl.applytojob.com/",
    logoColor: "from-teal-500 to-teal-600"
  },

  // --- شركات باقة Gold الحصرية (5 شركات جديدة قوية) ---
  {
    id: "6",
    name: "Emirates Group",
    industry: "Aviation",
    locations: ["Dubai", "Global"],
    careerPageUrl: "https://www.emiratesgroupcareers.com/",
    logoColor: "from-red-500 to-red-600"
  },
  {
    id: "7",
    name: "Saudi Aramco",
    industry: "Energy",
    locations: ["Dhahran", "Global"],
    careerPageUrl: "https://www.aramco.com/en/careers",
    logoColor: "from-green-600 to-green-800"
  },
  {
    id: "8",
    name: "NEOM",
    industry: "Construction & Gov",
    locations: ["Tabuk", "Riyadh"],
    careerPageUrl: "https://www.neom.com/en-us/careers",
    logoColor: "from-amber-400 to-amber-600"
  },
  {
    id: "9",
    name: "Amazon MENA",
    industry: "Technology",
    locations: ["Cairo", "Dubai", "Riyadh"],
    careerPageUrl: "https://www.amazon.jobs/en/locations/dubai",
    logoColor: "from-orange-400 to-orange-600"
  },
  {
    id: "10",
    name: "Google",
    industry: "Technology",
    locations: ["Dubai", "Cairo", "Doha"],
    careerPageUrl: "https://careers.google.com/locations/dubai/",
    logoColor: "from-blue-500 to-blue-600"
  }
];
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  Briefcase,
  CheckCheck,
  Copy,
  Crown,
  ExternalLink,
  GraduationCap,
  Globe,
  Languages,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  QrCode,
  ShieldCheck,
  Sparkles,
  User,
  Zap,
} from "lucide-react";
import { useLang } from "../context/LanguageContext";

type ExpItem = {
  title?: string;
  company?: string;
  duration?: string;
  description?: string;
};

type EduItem = {
  degree?: string;
  institution?: string;
  major?: string;
  year?: string;
};

type OtherLink = {
  type?: string;
  url?: string;
};

type Stats = {
  documents?: number;
  cover_letters?: number;
  analyses?: number;
};

type PublicProfileData = {
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name_ar: string | null;
  gender: string | null;
  nationality: string | null;
  location: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  headline: string | null;
  target_job: string | null;
  career_level: string | null;
  ai_summary: string | null;
  qr_public_url: string | null;
  qr_enabled: boolean;
  created_at: string | null;
  is_paid: boolean;
  arabic_level: string | null;
  english_level: string | null;
  skills: string[];
  education: EduItem[];
  experience?: ExpItem[];
  other_links?: OtherLink[];
  languages?: Record<string, string>;
  stats?: Stats;
  cv_email?: string | null;
  phone?: string | null;
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeExternalUrl(value: unknown) {
  const raw = cleanText(value);
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^\/\//.test(raw)) return `https:${raw}`;
  return `https://${raw}`;
}

function getLinkHost(urlValue: unknown) {
  const url = normalizeExternalUrl(urlValue);
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return cleanText(urlValue)
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0];
  }
}

function inferOtherLinkType(link: OtherLink) {
  const explicit = cleanText(link.type).toLowerCase();
  const host = getLinkHost(link.url).toLowerCase();
  if (explicit.includes("linkedin") || host.includes("linkedin.com")) return "LinkedIn";
  if (explicit.includes("facebook") || host.includes("facebook.com") || host.includes("fb.com")) return "Facebook";
  if (explicit.includes("instagram") || host.includes("instagram.com")) return "Instagram";
  if (explicit.includes("tiktok") || host.includes("tiktok.com")) return "TikTok";
  if (explicit.includes("github") || host.includes("github.com")) return "GitHub";
  if (explicit.includes("portfolio")) return "Portfolio";
  if (explicit.includes("website") || explicit.includes("site")) return "Website";
  return cleanText(link.type) || "Website";
}

function getSocialProfileName(urlValue: unknown) {
  const url = normalizeExternalUrl(urlValue);
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const parts = parsed.pathname
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean);

    if (!parts.length) return parsed.hostname.replace(/^www\./i, "");

    if (host.includes("linkedin.com")) {
      const inIndex = parts.findIndex((part) =>
        ["in", "company", "school"].includes(part.toLowerCase()),
      );
      const profilePart = parts[inIndex >= 0 ? inIndex + 1 : 0] || parts[0] || "";
      return decodeURIComponent(profilePart).replace(/[-_]+/g, " ");
    }

    if (host.includes("tiktok.com")) {
      return decodeURIComponent(parts[0]).replace(/^@/, "@");
    }

    if (
      host.includes("facebook.com") ||
      host.includes("fb.com") ||
      host.includes("instagram.com") ||
      host.includes("github.com")
    ) {
      return decodeURIComponent(parts[0]).replace(/^@/, "");
    }

    return parsed.hostname.replace(/^www\./i, "");
  } catch {
    return cleanText(urlValue);
  }
}

function getOtherLinkDisplay(link: OtherLink) {
  const type = inferOtherLinkType(link);
  const url = normalizeExternalUrl(link.url);
  const host = getLinkHost(url);
  const profileName = getSocialProfileName(url);

  if (type === "Website") {
    return {
      type,
      title: host || "Website",
      subtitle: url.replace(/^https?:\/\//i, "").replace(/\/$/, ""),
      url,
    };
  }

  return {
    type,
    title: profileName || type,
    subtitle: type,
    url,
  };
}

function languageEntries(languages?: Record<string, string>) {
  if (!languages) return [];
  return Object.entries(languages)
    .map(([name, level]) => ({ name, level: cleanText(level) }))
    .filter((item) => item.level);
}

export default function PublicProfile() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { lang, isRtl } = useLang();

  const [profile, setProfile] = useState<PublicProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  const t = {
    en: {
      notFound: "Profile not found",
      notFoundSub: "This username doesn't exist on Resumation.co or the profile is private.",
      backHome: "Back to Home",
      member: "Resumation Career Profile",
      free: "Free Public Profile",
      paid: "Pro Public Profile",
      joinedOn: "Joined",
      copyLink: "Copy Profile Link",
      copied: "Copied!",
      buildWith: "Build your own AI career profile",
      poweredBy: "Powered by Resumation.co AI",
      summary: "Professional Summary",
      skills: "Skills",
      experience: "Experience",
      education: "Education",
      languages: "Languages",
      links: "Other Links",
      contact: "Contact",
      qrProfile: "Public Profile Link",
      stats: "Career Activity",
      documents: "CVs",
      coverLetters: "Cover Letters",
      analyses: "Analyses",
      lockedTitle: "Full profile locked",
      lockedText: "Experience, full education, links, QR features, and career activity are available on Pro profiles.",
      upgradeCta: "Create your profile",
      nationality: "Nationality",
      gender: "Gender",
      careerLevel: "Career Level",
    },
    ar: {
      notFound: "الملف الشخصي غير موجود",
      notFoundSub: "اسم المستخدم غير موجود أو أن الملف خاص.",
      backHome: "العودة للرئيسية",
      member: "ملف Resumation المهني",
      free: "ملف عام مجاني",
      paid: "ملف عام احترافي",
      joinedOn: "انضم في",
      copyLink: "نسخ رابط الملف",
      copied: "تم النسخ!",
      buildWith: "أنشئ ملفك المهني بالذكاء الاصطناعي",
      poweredBy: "مدعوم بذكاء Resumation.co",
      summary: "الملخص المهني",
      skills: "المهارات",
      experience: "الخبرات المهنية",
      education: "التعليم",
      languages: "اللغات",
      links: "روابط أخرى",
      contact: "التواصل",
      qrProfile: "رابط الملف العام",
      stats: "النشاط المهني",
      documents: "السير الذاتية",
      coverLetters: "خطابات التعريف",
      analyses: "التحليلات",
      lockedTitle: "الملف الكامل مقفول",
      lockedText: "الخبرات، التعليم الكامل، الروابط، ميزات QR، والنشاط المهني متاحة في الملفات المدفوعة.",
      upgradeCta: "أنشئ ملفك المهني",
      nationality: "الجنسية",
      gender: "الجنس",
      careerLevel: "المستوى المهني",
    },
  }[lang];

  useEffect(() => {
    if (!username) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    fetchProfile(username);
  }, [username]);

  const fetchProfile = async (publicUsername: string) => {
    setLoading(true);
    setNotFound(false);

    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_profile`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_username: publicUsername }),
      });

      if (!response.ok) {
        setNotFound(true);
        return;
      }

      const data = await response.json();
      if (!data || (Array.isArray(data) && data.length === 0)) {
        setNotFound(true);
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;
      setProfile({
        username: row.username ?? null,
        first_name: row.first_name ?? null,
        last_name: row.last_name ?? null,
        full_name_ar: row.full_name_ar ?? null,
        gender: row.gender ?? null,
        nationality: row.nationality ?? null,
        location: row.location ?? null,
        avatar_url: row.avatar_url ?? null,
        cover_url: row.cover_url ?? null,
        headline: row.headline ?? null,
        target_job: row.target_job ?? null,
        career_level: row.career_level ?? null,
        ai_summary: row.ai_summary ?? null,
        qr_public_url: row.qr_public_url ?? null,
        qr_enabled: Boolean(row.qr_enabled),
        created_at: row.created_at ?? null,
        is_paid: Boolean(row.is_paid),
        arabic_level: row.arabic_level ?? null,
        english_level: row.english_level ?? null,
        skills: Array.isArray(row.skills) ? row.skills : [],
        education: Array.isArray(row.education) ? row.education : [],
        experience: Array.isArray(row.experience) ? row.experience : [],
        other_links: Array.isArray(row.other_links) ? row.other_links : [],
        languages: row.languages && typeof row.languages === "object" ? row.languages : undefined,
        stats: row.stats && typeof row.stats === "object" ? row.stats : undefined,
        cv_email: row.cv_email ?? null,
        phone: row.phone ?? null,
      });
    } catch (err) {
      console.error("Public profile fetch error:", err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const publicUrl = profile?.qr_public_url || `https://resumation.co/u/${username}`;

  const copyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fullName = useMemo(() => {
    if (!profile) return "";
    const englishName = [profile.first_name, profile.last_name].map(cleanText).filter(Boolean).join(" ");
    return cleanText(profile.full_name_ar) || englishName || `@${profile.username}`;
  }, [profile]);

  const initials = profile
    ? [profile.first_name, profile.last_name]
        .map((part) => cleanText(part).charAt(0))
        .join("")
        .toUpperCase() || "R"
    : "R";

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", {
      year: "numeric",
      month: "long",
    });
  };

  const cardStyle = {
    background: "rgba(13,17,23,0.85)",
    backdropFilter: "blur(28px)",
    border: "1px solid rgba(60,80,125,0.2)",
  };

  const sectionTitle = (label: string) => (
    <h2 className="text-[12px] font-bold text-[#E0C58F] uppercase tracking-widest mb-5">{label}</h2>
  );

  const isPaid = Boolean(profile?.is_paid);
  const hasContact = Boolean(profile?.cv_email || profile?.phone);
  const hasEducation = Boolean(profile?.education?.length);
  const hasExperience = Boolean(profile?.experience?.length);
  const hasLinks = Boolean(profile?.other_links?.length);
  const paidLanguages = languageEntries(profile?.languages);
  const freeLanguages = [
    { name: "Arabic", level: profile?.arabic_level || "" },
    { name: "English", level: profile?.english_level || "" },
  ].filter((item) => item.level);
  const shownLanguages = isPaid && paidLanguages.length ? paidLanguages : freeLanguages;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D1117] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#12B2C1] animate-spin" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div
        className="min-h-screen bg-[#0D1117] flex flex-col items-center justify-center text-center px-6"
        dir={isRtl ? "rtl" : "ltr"}
        style={{ fontFamily: isRtl ? "'Tajawal', sans-serif" : "'Plus Jakarta Sans', sans-serif" }}
      >
        <AlertCircle className="w-12 h-12 text-[#e1ebed] mb-5" />
        <h1 className="text-2xl font-bold text-[#F5F0E9] mb-2">{t.notFound}</h1>
        <p className="text-sm text-[#A8B4CC] mb-8">@{username} — {t.notFoundSub}</p>
        <button
          onClick={() => navigate("/")}
          className="px-6 py-3 rounded-xl font-bold text-sm text-[#0D1117]"
          style={{ background: "linear-gradient(135deg, #12B2C1, #0E8F9C)" }}
        >
          {t.backHome}
        </button>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#0D1117] text-[#D9CBC2] relative overflow-hidden"
      dir={isRtl ? "rtl" : "ltr"}
      style={{ fontFamily: isRtl ? "'Tajawal', sans-serif" : "'Plus Jakarta Sans', sans-serif" }}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-5%] right-[20%] w-[500px] h-[500px] rounded-full bg-[rgba(18,178,193,0.04)] blur-[120px]" />
        <div className="absolute bottom-[-5%] left-[10%] w-[400px] h-[400px] rounded-full bg-[rgba(60,80,125,0.06)] blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-6 py-16 space-y-5">
        <div className="rounded-2xl overflow-hidden" style={cardStyle}>
          <div
            className="h-28 sm:h-36 w-full relative overflow-hidden"
            style={{ background: profile.cover_url ? undefined : "linear-gradient(135deg,#0D1826,#112250,#0A1628)" }}
          >
            {profile.cover_url ? (
              <img src={profile.cover_url} alt="cover" className="w-full h-full object-cover" />
            ) : (
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 25% 60%,rgba(18,178,193,0.18) 0%,transparent 55%),radial-gradient(circle at 80% 25%,rgba(224,197,143,0.1) 0%,transparent 50%)",
                }}
              />
            )}
          </div>

          <div className="px-6 pb-6">
            <div className="flex items-end justify-between -mt-10 mb-4 flex-wrap gap-3">
              <div className="relative">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={initials}
                    className="w-20 h-20 rounded-2xl object-cover"
                    style={{ border: "3px solid #0D1117", boxShadow: "0 0 0 1px rgba(18,178,193,0.3)" }}
                  />
                ) : (
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center text-xl font-black text-[#F5F0E9]"
                    style={{
                      background: "linear-gradient(135deg,#112250,#162A60)",
                      border: "3px solid #0D1117",
                      boxShadow: "0 0 0 1px rgba(18,178,193,0.3)",
                    }}
                  >
                    {initials}
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#0D1117]" />
              </div>

              <button
                onClick={copyLink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: "rgba(60,80,125,0.08)",
                  border: "1px solid rgba(60,80,125,0.2)",
                  color: copied ? "#34d399" : "#A8B4CC",
                }}
              >
                {copied ? (
                  <>
                    <CheckCheck className="w-3.5 h-3.5" /> {t.copied}
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> {t.copyLink}
                  </>
                )}
              </button>
            </div>

            <h1 className="text-xl font-black text-[#F5F0E9] mb-1">{fullName}</h1>

            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-sm text-[#e1ebed] font-mono">@{profile.username}</span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[rgba(18,178,193,0.08)] border border-[#12B2C1]/15 text-[#12B2C1]">
                <Sparkles className="w-2.5 h-2.5" /> {t.member}
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[rgba(224,197,143,0.08)] border border-[#E0C58F]/15 text-[#E0C58F]">
                {isPaid ? <Crown className="w-2.5 h-2.5" /> : <ShieldCheck className="w-2.5 h-2.5" />}
                {isPaid ? t.paid : t.free}
              </span>
            </div>

            {(profile.headline || profile.target_job) && (
              <p className="text-sm text-[#A8B4CC] mb-3">{profile.headline || profile.target_job}</p>
            )}

            <div className="flex flex-wrap gap-4 text-xs text-[#e1ebed] mb-4">
              {profile.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> {profile.location}
                </span>
              )}
              {profile.career_level && (
                <span className="flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5" /> {t.careerLevel}: {profile.career_level}
                </span>
              )}
              {profile.nationality && (
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> {t.nationality}: {profile.nationality}
                </span>
              )}
              {profile.gender && (
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> {t.gender}: {profile.gender}
                </span>
              )}
              {profile.created_at && <span>{t.joinedOn} {formatDate(profile.created_at)}</span>}
            </div>

            {profile.ai_summary && (
              <div className="border-t border-[rgba(60,80,125,0.1)] pt-4 mb-4">
                <p className="text-[11px] font-bold text-[#E0C58F] uppercase tracking-widest mb-2">{t.summary}</p>
                <p className="text-xs text-[#A8B4CC] leading-[1.9]">{profile.ai_summary}</p>
              </div>
            )}

            {profile.skills.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill) => (
                  <span
                    key={skill}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[12px] font-medium text-[#12B2C1]"
                    style={{ background: "rgba(18,178,193,0.07)", border: "1px solid rgba(18,178,193,0.15)" }}
                  >
                    <Zap className="w-2.5 h-2.5" /> {skill}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {shownLanguages.length > 0 && (
          <div className="rounded-2xl p-5 sm:p-6" style={cardStyle}>
            {sectionTitle(t.languages)}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {shownLanguages.map((item) => (
                <div key={item.name} className="flex items-center gap-3 rounded-xl p-3 bg-[rgba(60,80,125,0.08)] border border-[rgba(60,80,125,0.18)]">
                  <Languages className="w-4 h-4 text-[#12B2C1]" />
                  <div>
                    <p className="text-sm font-bold text-[#F5F0E9] capitalize">{item.name.replace(/_/g, " ")}</p>
                    <p className="text-xs text-[#A8B4CC]">{item.level}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {hasContact && (
          <div className="rounded-2xl p-5 sm:p-6" style={cardStyle}>
            {sectionTitle(t.contact)}
            <div className="space-y-3">
              {profile.cv_email && (
                <a href={`mailto:${profile.cv_email}`} className="flex items-center gap-3 group">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(18,178,193,0.07)", border: "1px solid rgba(18,178,193,0.15)" }}>
                    <Mail className="w-4 h-4 text-[#12B2C1]" />
                  </div>
                  <span className="text-sm text-[#A8B4CC] group-hover:text-[#12B2C1] transition-colors">{profile.cv_email}</span>
                </a>
              )}
              {profile.phone && (
                <a href={`tel:${profile.phone}`} className="flex items-center gap-3 group">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(224,197,143,0.07)", border: "1px solid rgba(224,197,143,0.15)" }}>
                    <Phone className="w-4 h-4 text-[#E0C58F]" />
                  </div>
                  <span className="text-sm text-[#A8B4CC] group-hover:text-[#E0C58F] transition-colors">{profile.phone}</span>
                </a>
              )}
            </div>
          </div>
        )}

        {hasEducation && (
          <div className="rounded-2xl p-5 sm:p-6" style={cardStyle}>
            {sectionTitle(t.education)}
            <div className="space-y-5">
              {profile.education.map((edu, i) => (
                <div key={`${edu.degree}-${i}`} className="flex gap-4 pb-5 border-b border-[rgba(60,80,125,0.1)] last:border-0 last:pb-0">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(60,80,125,0.1)", border: "1px solid rgba(60,80,125,0.2)" }}>
                    <GraduationCap className="w-4 h-4 text-[#e1ebed]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-[#F5F0E9]">{edu.degree || "Education"}</h3>
                    {edu.major && <p className="text-xs text-[#E0C58F] font-medium mt-0.5">{edu.major}</p>}
                    {edu.institution && <p className="text-xs text-[#12B2C1] font-medium mt-0.5">{edu.institution}</p>}
                    {edu.year && <p className="text-[12px] text-[#e1ebed] mt-0.5 font-mono">{edu.year}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isPaid && hasExperience && (
          <div className="rounded-2xl p-5 sm:p-6" style={cardStyle}>
            {sectionTitle(t.experience)}
            <div className="space-y-5">
              {profile.experience!.map((exp, i) => (
                <div key={`${exp.title}-${i}`} className="flex gap-4 pb-5 border-b border-[rgba(60,80,125,0.1)] last:border-0 last:pb-0">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(60,80,125,0.1)", border: "1px solid rgba(60,80,125,0.2)" }}>
                    <Briefcase className="w-4 h-4 text-[#e1ebed]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-[#F5F0E9]">{exp.title}</h3>
                    {exp.company && <p className="text-xs text-[#12B2C1] font-medium mt-0.5">{exp.company}</p>}
                    {exp.duration && <p className="text-[12px] text-[#e1ebed] mt-0.5 mb-2 font-mono">{exp.duration}</p>}
                    {exp.description && <p className="text-xs text-[#A8B4CC] leading-[1.8]">{exp.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isPaid && hasLinks && (
          <div className="rounded-2xl p-5 sm:p-6" style={cardStyle}>
            {sectionTitle(t.links)}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {profile.other_links!.map((link, i) => {
                const display = getOtherLinkDisplay(link);
                return (
                  <a
                    key={`${display.url}-${i}`}
                    href={display.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-xl p-3 bg-[rgba(60,80,125,0.08)] border border-[rgba(60,80,125,0.18)] hover:border-[#12B2C1]/30 transition-colors"
                  >
                    <Globe className="w-4 h-4 text-[#12B2C1]" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#F5F0E9] truncate">{display.title}</p>
                      <p className="text-xs text-[#A8B4CC] truncate">{display.subtitle}</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-[#A8B4CC] ms-auto" />
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {publicUrl && (
          <div className="rounded-2xl p-5 sm:p-6" style={cardStyle}>
            {sectionTitle(t.qrProfile)}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(18,178,193,0.07)", border: "1px solid rgba(18,178,193,0.15)" }}>
                {isPaid && profile.qr_enabled ? <QrCode className="w-5 h-5 text-[#12B2C1]" /> : <Globe className="w-5 h-5 text-[#12B2C1]" />}
              </div>
              <a href={publicUrl} target="_blank" rel="noreferrer" className="text-sm text-[#A8B4CC] hover:text-[#12B2C1] transition-colors break-all">
                {publicUrl}
              </a>
            </div>
          </div>
        )}

        {isPaid && profile.stats && (
          <div className="rounded-2xl p-5 sm:p-6" style={cardStyle}>
            {sectionTitle(t.stats)}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl p-3 bg-[rgba(60,80,125,0.08)] border border-[rgba(60,80,125,0.18)]">
                <p className="text-lg font-black text-[#F5F0E9]">{profile.stats.documents ?? 0}</p>
                <p className="text-[11px] text-[#A8B4CC]">{t.documents}</p>
              </div>
              <div className="rounded-xl p-3 bg-[rgba(60,80,125,0.08)] border border-[rgba(60,80,125,0.18)]">
                <p className="text-lg font-black text-[#F5F0E9]">{profile.stats.cover_letters ?? 0}</p>
                <p className="text-[11px] text-[#A8B4CC]">{t.coverLetters}</p>
              </div>
              <div className="rounded-xl p-3 bg-[rgba(60,80,125,0.08)] border border-[rgba(60,80,125,0.18)]">
                <p className="text-lg font-black text-[#F5F0E9]">{profile.stats.analyses ?? 0}</p>
                <p className="text-[11px] text-[#A8B4CC]">{t.analyses}</p>
              </div>
            </div>
          </div>
        )}

        {!isPaid && (
          <div className="rounded-2xl p-5 sm:p-6" style={{ ...cardStyle, border: "1px solid rgba(224,197,143,0.16)" }}>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(224,197,143,0.08)", border: "1px solid rgba(224,197,143,0.18)" }}>
                <Lock className="w-5 h-5 text-[#E0C58F]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#F5F0E9] mb-1">{t.lockedTitle}</h3>
                <p className="text-xs text-[#A8B4CC] leading-[1.8]">{t.lockedText}</p>
              </div>
            </div>
          </div>
        )}

        <div
          className="rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ background: "rgba(13,17,23,0.85)", backdropFilter: "blur(24px)", border: "1px solid rgba(224,197,143,0.1)" }}
        >
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-[#E0C58F] flex-shrink-0" />
            <span className="text-sm text-[#A8B4CC]">{t.buildWith}</span>
          </div>
          <a
            href="/login"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-[#0D1117] flex-shrink-0 hover:shadow-[0_0_20px_rgba(18,178,193,0.2)] transition-all"
            style={{ background: "linear-gradient(135deg, #12B2C1, #0E8F9C)" }}
          >
            {t.upgradeCta} <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        <p className="text-center text-[11px] text-[#3C507D] font-mono tracking-widest uppercase">
          {t.poweredBy}
        </p>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Sparkles, MapPin, Briefcase, GraduationCap,
  Loader2, AlertCircle, ExternalLink, Copy, CheckCheck,
  Globe, Zap, Mail, Phone,
} from "lucide-react";
import { useLang } from "../context/LanguageContext";

interface ExpItem { title: string; company: string; duration: string; description: string; }
interface EduItem { degree: string; institution: string; major: string; year: string; }

interface UserProfileData {
  id:           string;
  first_name:   string | null;
  last_name:    string | null;
  username:     string | null;
  region:       string | null;
  target_job:   string | null;
  created_at:   string | null;
  avatar_url:   string | null;
  cover_url:    string | null;
  headline:     string | null;
  about:        string | null;
  ai_summary:   string | null;
  skills:       string[]  | null;
  experience:   ExpItem[] | null;
  education:    EduItem[] | null;
  location:     string | null;
  website:      string | null;
  phone:        string | null;
  email:        string | null;
}

export default function UserProfile() {
  const { username } = useParams<{ username: string }>();
  const navigate     = useNavigate();
  const { lang, isRtl } = useLang();

  const [profile, setProfile]   = useState<UserProfileData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied]     = useState(false);

  const t = {
    en: {
      notFound:     "Profile not found",
      notFoundSub: "This username doesn't exist on Resumation.co",
      backHome:     "Back to Home",
      member:      "Resumation.co Member",
      joinedOn:    "Joined",
      regions:     { EG: "Egypt 🇪🇬", LB: "Lebanon 🇱🇧" },
      copyLink:    "Copy Profile Link",
      copied:      "Copied!",
      buildWith:   "Build your own AI CV",
      poweredBy:   "Powered by Resumation.co AI",
      experience:  "Experience",
      education:   "Education",
      contact:     "Contact",
    },
    ar: {
      notFound:     "الملف الشخصي غير موجود",
      notFoundSub: "اسم المستخدم هذا غير موجود على Resumation.co",
      backHome:     "العودة للرئيسية",
      member:      "عضو في Resumation.co",
      joinedOn:    "انضم في",
      regions:     { EG: "مصر 🇪🇬", LB: "لبنان 🇱🇧" },
      copyLink:    "نسخ رابط الملف",
      copied:      "تم النسخ!",
      buildWith:   "ابنِ سيرتك الذاتية بالذكاء الاصطناعي",
      poweredBy:   "مدعوم بذكاء Resumation.co",
      experience:  "الخبرات المهنية",
      education:   "الشهادات التعليمية",
      contact:     "التواصل",
    },
  }[lang];

  useEffect(() => {
    if (!username) { setNotFound(true); setLoading(false); return; }
    fetchProfile();
  }, [username]);

  const fetchProfile = async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

      // الـ RPC endpoint كـ Direct Fetch لعدم تعليق الـ session للزوار من برا
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_profile`, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_username: username }),
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

      const profileData = Array.isArray(data) ? data[0] : data;

      setProfile({
        id:          profileData.id,
        first_name:  profileData.first_name ?? null,
        last_name:   profileData.last_name  ?? null,
        username:    profileData.username   ?? null,
        region:      profileData.region     ?? null,
        target_job:  profileData.target_job ?? null,
        created_at:  profileData.created_at ?? null,
        avatar_url:  profileData.avatar_url ?? null,
        cover_url:   profileData.cover_url  ?? null,
        headline:    profileData.headline   ?? null,
        about:       profileData.about      ?? null,
        ai_summary:  profileData.ai_summary ?? null,
        skills:      Array.isArray(profileData.skills)     ? profileData.skills     : null,
        experience:  Array.isArray(profileData.experience) ? profileData.experience : null,
        education:   Array.isArray(profileData.education)  ? profileData.education  : null,
        location:    profileData.location   ?? null,
        website:     profileData.website    ?? null,
        phone:       profileData.phone      ?? null,
        email:       profileData.email      ?? null,
      });
    } catch (err) {
      console.error("Public profile fetch error:", err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`https://resumation.co/u/${username}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", {
      year: "numeric", month: "long",
    });
  };

  const initials = profile
    ? `${profile.first_name?.[0] ?? ""}${profile.last_name?.[0] ?? ""}`.toUpperCase()
    : "?";

  const cardStyle = {
    background:    "rgba(13,17,23,0.85)",
    backdropFilter:"blur(28px)",
    border:        "1px solid rgba(60,80,125,0.2)",
  };

  const sectionTitle = (label: string) => (
    <h2 className="text-[12px] font-bold text-[#E0C58F] uppercase tracking-widest mb-5">{label}</h2>
  );

  if (loading) return (
    <div className="min-h-screen bg-[#0D1117] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-[#12B2C1] animate-spin" />
    </div>
  );

  if (notFound) return (
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

  const hasContact   = !!(profile?.email || profile?.phone);
  const hasExp       = profile?.experience && profile.experience.length > 0;
  const hasEdu       = profile?.education  && profile.education.length  > 0;

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

        {/* ── بطاقة الهوية ── */}
        <div className="rounded-2xl overflow-hidden" style={cardStyle}>

          {/* غلاف */}
          <div className="h-28 sm:h-36 w-full relative overflow-hidden"
            style={{ background: profile?.cover_url ? undefined : "linear-gradient(135deg,#0D1826,#112250,#0A1628)" }}>
            {profile?.cover_url
              ? <img src={profile.cover_url} alt="cover" className="w-full h-full object-cover" />
              : <div className="absolute inset-0" style={{ backgroundImage:"radial-gradient(circle at 25% 60%,rgba(18,178,193,0.18) 0%,transparent 55%),radial-gradient(circle at 80% 25%,rgba(224,197,143,0.1) 0%,transparent 50%)" }} />
            }
          </div>

          <div className="px-6 pb-6">
            <div className="flex items-end justify-between -mt-10 mb-4 flex-wrap gap-3">

              {/* صورة البروفايل */}
              <div className="relative">
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt={initials}
                      className="w-20 h-20 rounded-2xl object-cover"
                      style={{ border:"3px solid #0D1117", boxShadow:"0 0 0 1px rgba(18,178,193,0.3)" }} />
                  : <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-xl font-black text-[#F5F0E9]"
                      style={{ background:"linear-gradient(135deg,#112250,#162A60)", border:"3px solid #0D1117", boxShadow:"0 0 0 1px rgba(18,178,193,0.3)" }}>
                      {initials}
                    </div>
                }
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#0D1117]" />
              </div>

              {/* زر نسخ الرابط */}
              <button onClick={copyLink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ background:"rgba(60,80,125,0.08)", border:"1px solid rgba(60,80,125,0.2)", color: copied ? "#34d399":"#A8B4CC" }}>
                {copied
                  ? <><CheckCheck className="w-3.5 h-3.5"/> {t.copied}</>
                  : <><Copy className="w-3.5 h-3.5"/> {t.copyLink}</>}
              </button>
            </div>

            {/* الاسم */}
            <h1 className="text-xl font-black text-[#F5F0E9] mb-1">
              {profile?.first_name} {profile?.last_name}
            </h1>

            {/* الـ username + شارة */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-sm text-[#e1ebed] font-mono">@{profile?.username}</span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[rgba(18,178,193,0.08)] border border-[#12B2C1]/15 text-[#12B2C1]">
                <Sparkles className="w-2.5 h-2.5" /> {t.member}
              </span>
            </div>

            {/* الـ headline */}
            {(profile?.headline || profile?.target_job) && (
              <p className="text-sm text-[#A8B4CC] mb-3">{profile.headline || profile.target_job}</p>
            )}

            {/* الموقع والموقع الإلكتروني وتاريخ الانضمام */}
            <div className="flex flex-wrap gap-4 text-xs text-[#e1ebed] mb-4">
              {profile?.location && (
                <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5"/>{profile.location}</span>
              )}
              {profile?.region && !profile?.location && (
                <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5"/>
                  {t.regions[profile.region as "EG"|"LB"] ?? profile.region}
                </span>
              )}
              {profile?.website && (
                <a href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                  target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 hover:text-[#12B2C1] transition-colors">
                  <Globe className="w-3.5 h-3.5"/>{profile.website}
                </a>
              )}
              {profile?.created_at && (
                <span>{t.joinedOn} {formatDate(profile.created_at)}</span>
              )}
            </div>

            {/* الملخص */}
            {(profile?.ai_summary || profile?.about) && (
              <p className="text-xs text-[#A8B4CC] leading-[1.9] mb-4 border-t border-[rgba(60,80,125,0.1)] pt-4">
                {profile.ai_summary || profile.about}
              </p>
            )}

            {/* المهارات */}
            {profile?.skills && profile.skills.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {profile.skills.slice(0, 12).map(s => (
                  <span key={s} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[12px] font-medium text-[#12B2C1]"
                    style={{ background:"rgba(18,178,193,0.07)", border:"1px solid rgba(18,178,193,0.15)" }}>
                    <Zap className="w-2.5 h-2.5"/>{s}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── التواصل ── */}
        {hasContact && (
          <div className="rounded-2xl p-5 sm:p-6" style={cardStyle}>
            {sectionTitle(t.contact)}
            <div className="space-y-3">
              {profile?.email && (
                <a href={`mailto:${profile.email}`}
                  className="flex items-center gap-3 group">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background:"rgba(18,178,193,0.07)", border:"1px solid rgba(18,178,193,0.15)" }}>
                    <Mail className="w-4 h-4 text-[#12B2C1]"/>
                  </div>
                  <span className="text-sm text-[#A8B4CC] group-hover:text-[#12B2C1] transition-colors">{profile.email}</span>
                </a>
              )}
              {profile?.phone && (
                <a href={`tel:${profile.phone}`}
                  className="flex items-center gap-3 group">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background:"rgba(224,197,143,0.07)", border:"1px solid rgba(224,197,143,0.15)" }}>
                    <Phone className="w-4 h-4 text-[#E0C58F]"/>
                  </div>
                  <span className="text-sm text-[#A8B4CC] group-hover:text-[#E0C58F] transition-colors">{profile.phone}</span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* ── الخبرات المهنية ── */}
        {hasExp && (
          <div className="rounded-2xl p-5 sm:p-6" style={cardStyle}>
            {sectionTitle(t.experience)}
            <div className="space-y-5">
              {profile!.experience!.map((exp, i) => (
                <div key={i} className="flex gap-4 pb-5 border-b border-[rgba(60,80,125,0.1)] last:border-0 last:pb-0">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background:"rgba(60,80,125,0.1)", border:"1px solid rgba(60,80,125,0.2)" }}>
                    <Briefcase className="w-4 h-4 text-[#e1ebed]"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-[#F5F0E9]">{exp.title}</h3>
                    <p className="text-xs text-[#12B2C1] font-medium mt-0.5">{exp.company}</p>
                    {exp.duration && <p className="text-[12px] text-[#e1ebed] mt-0.5 mb-2 font-mono">{exp.duration}</p>}
                    {exp.description && <p className="text-xs text-[#A8B4CC] leading-[1.8]">{exp.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── الشهادات التعليمية ── */}
        {hasEdu && (
          <div className="rounded-2xl p-5 sm:p-6" style={cardStyle}>
            {sectionTitle(t.education)}
            <div className="space-y-5">
              {profile!.education!.map((edu, i) => (
                <div key={i} className="flex gap-4 pb-5 border-b border-[rgba(60,80,125,0.1)] last:border-0 last:pb-0">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background:"rgba(60,80,125,0.1)", border:"1px solid rgba(60,80,125,0.2)" }}>
                    <GraduationCap className="w-4 h-4 text-[#e1ebed]"/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-[#F5F0E9]">{edu.degree}</h3>
                    {edu.major && <p className="text-xs text-[#E0C58F] font-medium mt-0.5">{edu.major}</p>}
                    <p className="text-xs text-[#12B2C1] font-medium mt-0.5">{edu.institution}</p>
                    {edu.year && <p className="text-[12px] text-[#e1ebed] mt-0.5 font-mono">{edu.year}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── زر بناء السيرة الذاتية ── */}
        <div className="rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ background:"rgba(13,17,23,0.85)", backdropFilter:"blur(24px)", border:"1px solid rgba(224,197,143,0.1)" }}>
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-[#E0C58F] flex-shrink-0" />
            <span className="text-sm text-[#A8B4CC]">{t.buildWith}</span>
          </div>
          <a href="/build"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-[#0D1117] flex-shrink-0 hover:shadow-[0_0_20px_rgba(18,178,193,0.2)] transition-all"
            style={{ background:"linear-gradient(135deg, #12B2C1, #0E8F9C)" }}>
            {t.buildWith} <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        <p className="text-center text-[11px] text-[#3C507D] font-mono tracking-widest uppercase">
          {t.poweredBy}
        </p>

      </div>
    </div>
  );
}
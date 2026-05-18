import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Sparkles, MapPin, FileText, BrainCircuit,
  Loader2, AlertCircle, ExternalLink, Copy, CheckCheck,
  Globe, Zap
} from "lucide-react";
import { supabase } from "../supabase";
import { useLang } from "../context/LanguageContext";

interface UserProfileData {
  id: string;
  first_name:  string | null;
  last_name:   string | null;
  username:    string | null;
  region:      string | null;
  language:    string | null;
  target_job:  string | null;
  created_at:  string | null;
  // joined from profiles
  avatar_url:  string | null;
  cover_url:   string | null;
  headline:    string | null;
  about:       string | null;
  ai_summary:  string | null;
  skills:      string[] | null;
  location:    string | null;
  website:     string | null;
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
      notFoundSub:  "This username doesn't exist on Resumation.co",
      backHome:     "Back to Home",
      member:       "Resumation.co Member",
      joinedOn:     "Joined",
      region:       "Region",
      regions:      { EG: "Egypt 🇪🇬", LB: "Lebanon 🇱🇧" },
      cvCount:      "CVs Generated",
      analysisCount:"Analyses Done",
      copyLink:     "Copy Profile Link",
      copied:       "Copied!",
      buildWith:    "Build your own AI CV",
      poweredBy:    "Powered by Resumation.co AI",
    },
    ar: {
      notFound:     "الملف الشخصي غير موجود",
      notFoundSub:  "اسم المستخدم هذا غير موجود على Resumation.co",
      backHome:     "العودة للرئيسية",
      member:       "عضو في Resumation.co",
      joinedOn:     "انضم في",
      region:       "المنطقة",
      regions:      { EG: "مصر 🇪🇬", LB: "لبنان 🇱🇧" },
      cvCount:      "سيرة ذاتية مُنشأة",
      analysisCount:"تحليل منجز",
      copyLink:     "نسخ رابط الملف",
      copied:       "تم النسخ!",
      buildWith:    "ابنِ سيرتك الذاتية بالذكاء الاصطناعي",
      poweredBy:    "مدعوم بذكاء Resumation.co",
    },
  }[lang];

  useEffect(() => {
    if (!username) { setNotFound(true); setLoading(false); return; }
    fetchProfile();
  }, [username]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      // Use SECURITY DEFINER RPC — never queries tables directly.
      // Only returns explicitly whitelisted public fields.
      // Phone, email, and all private data are excluded server-side.
      const { data, error } = await supabase
        .rpc("get_public_profile", { p_username: username });

      if (error || !data) {
        setNotFound(true);
        return;
      }

      setProfile({
        id:         data.id,
        first_name: data.first_name  ?? null,
        last_name:  data.last_name   ?? null,
        username:   data.username    ?? null,
        region:     data.region      ?? null,
        language:   null,
        target_job: data.target_job  ?? null,
        created_at: data.created_at  ?? null,
        avatar_url: data.avatar_url  ?? null,
        cover_url:  data.cover_url   ?? null,
        headline:   data.headline    ?? null,
        about:      data.about       ?? null,
        ai_summary: data.ai_summary  ?? null,
        skills:     Array.isArray(data.skills) ? data.skills : null,
        location:   data.location    ?? null,
        website:    data.website     ?? null,
      });
    } catch {
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

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D1117] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#12B2C1] animate-spin" />
      </div>
    );
  }

  // ── Not Found ──
  if (notFound) {
    return (
      <div
        className="min-h-screen bg-[#0D1117] flex flex-col items-center justify-center text-center px-6"
        dir={isRtl ? "rtl" : "ltr"}
        style={{ fontFamily: isRtl ? "'Tajawal', sans-serif" : "'Plus Jakarta Sans', sans-serif" }}
      >
        <AlertCircle className="w-12 h-12 text-[#566C9E] mb-5" />
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

  // ── Profile ──
  return (
    <div
      className="min-h-screen bg-[#0D1117] text-[#D9CBC2] relative overflow-hidden"
      dir={isRtl ? "rtl" : "ltr"}
      style={{ fontFamily: isRtl ? "'Tajawal', sans-serif" : "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* Glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-5%] right-[20%] w-[500px] h-[500px] rounded-full bg-[rgba(18,178,193,0.04)] blur-[120px]" />
        <div className="absolute bottom-[-5%] left-[10%] w-[400px] h-[400px] rounded-full bg-[rgba(60,80,125,0.06)] blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-6 py-16">

        {/* ── Header Card ── */}
        <div
          className="rounded-2xl overflow-hidden mb-6"
          style={{ background:"rgba(13,17,23,0.85)", backdropFilter:"blur(28px)", border:"1px solid rgba(60,80,125,0.2)" }}
        >
          {/* Cover */}
          <div className="h-28 sm:h-36 w-full relative overflow-hidden"
            style={{ background: profile?.cover_url ? undefined : "linear-gradient(135deg,#0D1826,#112250,#0A1628)" }}>
            {profile?.cover_url
              ? <img src={profile.cover_url} alt="cover" className="w-full h-full object-cover" />
              : <div className="absolute inset-0" style={{ backgroundImage:"radial-gradient(circle at 25% 60%,rgba(18,178,193,0.18) 0%,transparent 55%),radial-gradient(circle at 80% 25%,rgba(224,197,143,0.1) 0%,transparent 50%)" }} />
            }
          </div>

          <div className="px-6 pb-6">
            {/* Avatar row */}
            <div className="flex items-end justify-between -mt-10 mb-4 flex-wrap gap-3">
              {/* Avatar */}
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

              {/* Copy link */}
              <button onClick={copyLink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ background:"rgba(60,80,125,0.08)", border:"1px solid rgba(60,80,125,0.2)", color: copied ? "#34d399":"#A8B4CC" }}>
                {copied ? <><CheckCheck className="w-3.5 h-3.5"/> {t.copied}</> : <><Copy className="w-3.5 h-3.5"/> {t.copyLink}</>}
              </button>
            </div>

            {/* Name */}
            <h1 className="text-xl font-black text-[#F5F0E9] mb-1">
              {profile?.first_name} {profile?.last_name}
            </h1>

            {/* Username + badge */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-sm text-[#566C9E] font-mono">@{profile?.username}</span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[rgba(18,178,193,0.08)] border border-[#12B2C1]/15 text-[#12B2C1]">
                <Sparkles className="w-2.5 h-2.5" /> {t.member}
              </span>
            </div>

            {/* Headline */}
            {(profile?.headline || profile?.target_job) && (
              <p className="text-sm text-[#A8B4CC] mb-3">{profile.headline || profile.target_job}</p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap gap-4 text-xs text-[#566C9E] mb-4">
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

            {/* Summary */}
            {(profile?.ai_summary || profile?.about) && (
              <p className="text-xs text-[#A8B4CC] leading-[1.9] mb-4 border-t border-[rgba(60,80,125,0.1)] pt-4">
                {profile.ai_summary || profile.about}
              </p>
            )}

            {/* Skills */}
            {profile?.skills && profile.skills.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {profile.skills.slice(0, 10).map(s => (
                  <span key={s} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-[#12B2C1]"
                    style={{ background:"rgba(18,178,193,0.07)", border:"1px solid rgba(18,178,193,0.15)" }}>
                    <Zap className="w-2.5 h-2.5"/>{s}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Stats Cards ── */}
        <CvStats userId={profile!.id} t={t} isRtl={isRtl} />

        {/* ── CTA ── */}
        <div
          className="rounded-2xl p-6 mt-6 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{
            background: "rgba(13,17,23,0.85)",
            backdropFilter: "blur(24px)",
            border: "1px solid rgba(224,197,143,0.1)",
          }}
        >
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-[#E0C58F] flex-shrink-0" />
            <span className="text-sm text-[#A8B4CC]">{t.buildWith}</span>
          </div>
          <a
            href="/build"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-[#0D1117] flex-shrink-0 hover:shadow-[0_0_20px_rgba(18,178,193,0.2)] transition-all"
            style={{ background: "linear-gradient(135deg, #12B2C1, #0E8F9C)" }}
          >
            {t.buildWith} <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        {/* Powered by */}
        <p className="text-center text-[10px] text-[#3C507D] font-mono tracking-widest uppercase mt-8">
          {t.poweredBy}
        </p>

      </div>
    </div>
  );
}

// ── CV + Analysis stats subcomponent ──
function CvStats({ userId, t, isRtl }: { userId: string; t: any; isRtl: boolean }) {
  const [cvCount,       setCvCount]       = useState<number | null>(null);
  const [analysisCount, setAnalysisCount] = useState<number | null>(null);

  useEffect(() => {
    // Use secure RPC — never exposes cv_archive or cv_analysis_requests directly
    supabase
      .rpc("get_public_profile_stats", { profile_user_id: userId })
      .then(({ data }) => {
        if (data) {
          setCvCount(data.cv_count ?? 0);
          setAnalysisCount(data.analysis_count ?? 0);
        }
      });
  }, [userId]);

  return (
    <div className="grid grid-cols-2 gap-4">
      {[
        { icon: FileText,     value: cvCount,       label: t.cvCount,       color: "#12B2C1" },
        { icon: BrainCircuit, value: analysisCount, label: t.analysisCount, color: "#E0C58F" },
      ].map(({ icon: Icon, value, label, color }) => (
        <div
          key={label}
          className="rounded-2xl p-6 text-center"
          style={{
            background: "rgba(13,17,23,0.85)",
            backdropFilter: "blur(24px)",
            border: "1px solid rgba(60,80,125,0.15)",
          }}
        >
          <Icon className="w-6 h-6 mx-auto mb-3" style={{ color }} />
          <div className="text-2xl font-black font-mono mb-1" style={{ color }}>
            {value === null ? "—" : value}
          </div>
          <div className="text-[11px] text-[#A8B4CC]">{label}</div>
        </div>
      ))}
    </div>
  );
}

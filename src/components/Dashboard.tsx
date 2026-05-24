import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2, BrainCircuit, ChevronRight,
  LayoutDashboard, Zap, UserCircle2,
} from "lucide-react";
import { supabase } from "../supabase";
import { useLang } from "../context/LanguageContext";

interface UserData {
  first_name: string | null;
  last_name:  string | null;
  username:   string | null;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { lang, isRtl } = useLang();

  const [user, setUser]       = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const lsKey = Object.keys(localStorage).find(
      k => k.startsWith("sb-") && k.endsWith("-auth-token")
    );
    let cachedSession: any = null;
    if (lsKey) {
      try { cachedSession = JSON.parse(localStorage.getItem(lsKey) || "null"); } catch {}
    }

    if (!cachedSession?.user) {
      navigate("/login");
      setLoading(false);
      return;
    }

    const meta      = cachedSession.user.user_metadata ?? {};
    const nameParts = (meta.full_name || "").trim().split(" ");
    setUser({ first_name: nameParts[0] || null, last_name: nameParts.slice(1).join(" ") || null, username: null });
    setLoading(false);

    const uid = cachedSession.user.id;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate("/login"); return; }
      if (uid) {
        supabase
          .from("users")
          .select("first_name, last_name, username")
          .eq("id", uid)
          .maybeSingle()
          .then(({ data }) => { if (data) setUser(data); })
          .catch(() => {});
      }
    }).catch(() => {});
  }, [navigate]);

  const t = {
    en: {
      welcome:    "Welcome back,",
      sub:        "What would you like to do today?",

      // Card 1 — Analyze
      c1Title:    "Analyze My CV",
      c1Desc:     "Upload your CV and get an instant ATS score, keyword gap report, and recruiter-ready suggestions.",
      c1Btn:      "Start Analysis",

      // Card 2 — My Account
      c2Title:    "My Account",
      c2Desc:     "View your saved forms, download completed CVs, manage your plan, and update your information.",
      c2Btn:      "Go to Account",

      // Card 3 — Plans & Pricing
      c3Title:    "Plans & Pricing",
      c3Desc:     "Free, Premium, or Gold — pick the plan that fits your career ambitions and get your CV built fast.",
      c3Btn:      "View Plans",
    },
    ar: {
      welcome:    "أهلاً بك،",
      sub:        "ماذا تريد أن تفعل اليوم؟",

      // Card 1 — Analyze
      c1Title:    "حلّل سيرتي الذاتية",
      c1Desc:     "ارفع سيرتك واحصل على تقييم ATS فوري، تقرير الكلمات المفتاحية، واقتراحات جاهزة للمحركين.",
      c1Btn:      "ابدأ التحليل",

      // Card 2 — My Account
      c2Title:    "حسابي",
      c2Desc:     "اعرض نماذجك المحفوظة، حمّل السير الذاتية المكتملة، أدر باقتك، وحدّث معلوماتك.",
      c2Btn:      "فتح الحساب",

      // Card 3 — Plans & Pricing
      c3Title:    "الباقات والأسعار",
      c3Desc:     "مجاني، بريميوم، أو ذهبي — اختر الباقة المناسبة لطموحاتك واحصل على سيرتك بسرعة.",
      c3Btn:      "عرض الباقات",
    },
  }[lang];

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "—";
  const initials = [user?.first_name?.[0], user?.last_name?.[0]].filter(Boolean).join("").toUpperCase() || "?";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D1117]">
        <Loader2 className="animate-spin text-[#12B2C1] w-8 h-8" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#0D1117] text-[#D9CBC2]"
      dir={isRtl ? "rtl" : "ltr"}
      style={{ fontFamily: isRtl ? "'Tajawal', sans-serif" : "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* ── Ambient glows ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 w-[55vw] h-[55vw] bg-[rgba(60,80,125,0.07)] rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0  w-[40vw] h-[40vw] bg-[rgba(18,178,193,0.03)] rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-14">

        {/* ── Welcome header ── */}
        <div className="flex items-center gap-4 mb-12">

          {/* Avatar */}
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black text-[#F5F0E9] flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, #112250, #162A60)",
              border: "1.5px solid rgba(18,178,193,0.25)",
            }}
          >
            {initials}
          </div>

          {/* Text */}
          <div>
            <p className="text-[12px] text-[#e1ebed] font-semibold uppercase tracking-widest mb-0.5">
              {t.welcome}
            </p>
            <h1 className="text-2xl font-bold text-[#F5F0E9] leading-tight">{fullName}</h1>
            <p className="text-xs text-[#7A8FAA] mt-1">{t.sub}</p>
          </div>
        </div>

        {/* ── 3-Card grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">

          {/* Card 1 — Analyze My CV */}
          <ActionCard
            icon={<BrainCircuit className="w-5 h-5" strokeWidth={1.75} />}
            iconColor="#E0C58F"
            iconBg="rgba(224,197,143,0.09)"
            iconBorder="rgba(224,197,143,0.22)"
            accentColor="#E0C58F"
            title={t.c1Title}
            desc={t.c1Desc}
            btnLabel={t.c1Btn}
            isRtl={isRtl}
            onClick={() => navigate("/analyse")}
          />

          {/* Card 2 — My Account */}
          <ActionCard
            icon={<UserCircle2 className="w-5 h-5" strokeWidth={1.75} />}
            iconColor="#12B2C1"
            iconBg="rgba(18,178,193,0.09)"
            iconBorder="rgba(18,178,193,0.22)"
            accentColor="#12B2C1"
            title={t.c2Title}
            desc={t.c2Desc}
            btnLabel={t.c2Btn}
            isRtl={isRtl}
            onClick={() => navigate("/my-account")}
          />

          {/* Card 3 — Plans & Pricing  (sapphire.light — system token, avoids off-palette purple) */}
          <ActionCard
            icon={<Zap className="w-5 h-5" strokeWidth={1.75} />}
            iconColor="#566C9E"
            iconBg="rgba(86,108,158,0.09)"
            iconBorder="rgba(86,108,158,0.22)"
            accentColor="#566C9E"
            title={t.c3Title}
            desc={t.c3Desc}
            btnLabel={t.c3Btn}
            isRtl={isRtl}
            onClick={() => navigate("/my-account")}
          />

        </div>
      </div>
    </div>
  );
}

// ── Reusable card ──
interface ActionCardProps {
  icon:        React.ReactNode;
  iconColor:   string;
  iconBg:      string;
  iconBorder:  string;
  accentColor: string;
  title:       string;
  desc:        string;
  btnLabel:    string;
  isRtl:       boolean;
  onClick:     () => void;
}

function ActionCard({
  icon, iconColor, iconBg, iconBorder,
  accentColor, title, desc, btnLabel, isRtl, onClick,
}: ActionCardProps) {
  return (
    <button
      onClick={onClick}
      className="group text-start w-full rounded-2xl p-6 flex flex-col gap-5 transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.99]"
      style={{
        background:    "rgba(13,17,23,0.85)",
        backdropFilter: "blur(24px)",
        border:         "1px solid rgba(60,80,125,0.14)",
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = `${accentColor}38`)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(60,80,125,0.14)")}
    >
      {/* Icon badge */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: iconBg, border: `1px solid ${iconBorder}`, color: iconColor }}
      >
        {icon}
      </div>

      {/* Title + desc */}
      <div className="flex-1">
        <h3 className="text-[15px] font-bold text-[#F5F0E9] mb-2 leading-snug">{title}</h3>
        <p className="text-[12px] text-[#e1ebed] leading-[1.85] font-light">{desc}</p>
      </div>

      {/* CTA row */}
      <div
        className={`flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider transition-all duration-200 group-hover:gap-2.5 w-fit ${isRtl ? "flex-row-reverse" : ""}`}
        style={{ color: accentColor }}
      >
        {btnLabel}
        <ChevronRight
          className={`w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 ${isRtl ? "rotate-180 group-hover:-translate-x-0.5 group-hover:translate-x-0" : ""}`}
        />
      </div>
    </button>
  );
}

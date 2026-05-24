import { useEffect, useRef, useState } from "react";
import Typed from "typed.js";
import {
  Sparkles, Network, BrainCircuit,
  FileText, Users, Globe,
  ArrowLeft, ArrowRight, MapPin, Loader2,
  CheckCircle2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useLang } from "../context/LanguageContext";
import HeroCanvas from "./HeroCanvas";

/* ══════════════════════════════════════════════════════════════════════════
   CV MOCKUP — cinematic floating card overlaid on the canvas
   Shows a stylised AI-scored résumé to communicate the platform's purpose
   instantly without needing any image file.
══════════════════════════════════════════════════════════════════════════ */
function CVMockup({ compact = false }: { compact?: boolean }) {
  const skills = [
    { label: "ATS Keywords",  pct: 94, color: "#12B2C1" },
    { label: "Impact Score",  pct: 88, color: "#E0C58F" },
    { label: "Formatting",    pct: 97, color: "#566C9E" },
  ];

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl
        bg-[rgba(8,16,38,0.82)] backdrop-blur-2xl
        border border-[rgba(60,80,125,0.45)]
        shadow-[0_24px_64px_rgba(0,0,0,0.55),0_0_0_1px_rgba(18,178,193,0.08)_inset]
        animate-float
        ${compact ? "w-52 p-4" : "w-64 p-5"}
      `}
    >
      {/* Scan line */}
      <div className="absolute inset-x-0 top-0 h-[2px] animate-scan pointer-events-none">
        <div className="h-full bg-gradient-to-r from-transparent via-[rgba(18,178,193,0.8)] to-transparent" />
      </div>

      {/* Header row */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-full bg-[rgba(60,80,125,0.5)] border border-[rgba(18,178,193,0.35)] flex items-center justify-center flex-shrink-0">
          <span className="text-[#E0C58F] text-[10px] font-black font-mono">AI</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="h-2.5 w-24 bg-[rgba(245,240,233,0.18)] rounded-sm mb-1.5" />
          <div className="h-2 w-16 bg-[rgba(60,80,125,0.35)] rounded-sm" />
        </div>
        {/* Verified badge */}
        <CheckCircle2 className="w-4 h-4 text-[#12B2C1] flex-shrink-0" strokeWidth={2} />
      </div>

      {/* ATS score bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9px] font-mono tracking-wider text-[rgba(18,178,193,0.85)] uppercase">
            ATS Score
          </span>
          <span className="text-[#E0C58F] text-xs font-black font-mono">94%</span>
        </div>
        <div className="h-1.5 bg-[rgba(60,80,125,0.22)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#12B2C1] to-[rgba(60,80,125,0.7)]"
            style={{ width: "94%" }}
          />
        </div>
      </div>

      {/* Content skeleton lines */}
      {!compact && (
        <div className="space-y-2 mb-4">
          <div className="h-2 bg-[rgba(245,240,233,0.1)] rounded-sm w-full" />
          <div className="h-2 bg-[rgba(245,240,233,0.07)] rounded-sm w-4/5" />
          <div className="h-2 bg-[rgba(245,240,233,0.05)] rounded-sm w-3/5" />
        </div>
      )}

      {/* Skill bars */}
      <div className="space-y-2.5">
        {(compact ? skills.slice(0, 2) : skills).map(({ label, pct, color }) => (
          <div key={label}>
            <div className="flex justify-between mb-1">
              <span className="text-[8px] font-mono uppercase tracking-wide text-[rgba(217,203,194,0.55)]">
                {label}
              </span>
              <span className="text-[8px] font-mono font-bold" style={{ color }}>
                {pct}%
              </span>
            </div>
            <div className="h-[3px] bg-[rgba(60,80,125,0.2)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full opacity-75"
                style={{ width: `${pct}%`, background: color }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Bottom status */}
      <div className="mt-4 pt-3 border-t border-[rgba(60,80,125,0.2)] flex items-center justify-between">
        <span className="text-[8px] font-mono text-[rgba(18,178,193,0.7)] uppercase tracking-widest">
          AI Optimised
        </span>
        <div className="flex gap-1">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="w-1 h-1 rounded-full"
              style={{
                background: i === 0 ? "#12B2C1" : i === 1 ? "#E0C58F" : "rgba(60,80,125,0.6)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════════════════
   HERO — main export
══════════════════════════════════════════════════════════════════════════ */
export default function Hero() {
  const el       = useRef<HTMLSpanElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { lang: currentLang, setLang: setCurrentLang, isRtl } = useLang();
  const [isLoading,    setIsLoading]    = useState<string | null>(null);
  const [verifyingText,setVerifyingText]= useState<string>("");
  const [statsVisible, setStatsVisible] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [targetCounts, setTargetCounts] = useState({ resumes: 12400, users: 8500, companies: 340 });
  const [counts,       setCounts]       = useState({ resumes: 0, users: 0, companies: 0 });

  /* ── i18n ───────────────────────────────────────────────────────────── */
  const content = {
    ar: {
      badge:    "المنظومة التقنية الأولى لذكاء التوظيف الاستراتيجي",
      heading1: "مستقبلك المهني مُهندسٌ",
      heading2: "بالذكاء الاصطناعي.",
      sub:      "منصة رقمية متكاملة تمنحك الأدوات الذكية لبناء سيرة ذاتية احترافية تتوافق مع الأنظمة العالمية، مع تحليل فوري لمدى تطابق مهاراتك مع متطلبات سوق العمل، لتأمين وصولك المباشر إلى أصحاب القرار والشركات الكبرى دون وسيط.",
      start:       "ابدأ الآن",
      statsTitle:  "المعايير القياسية للمنصة",
      rBuilt:      "سير تنفيذية تم تصميمها",
      aAcc:        "ملف مهني نشط",
      hChan:       "شراكة توظيف مؤسسية",
      srvTitle:    "المنظومة التقنية الثلاثية",
      srvSub:      "محركات ذكية تعمل بالتوازي لتسريع انتشارك المهني وإنجاح مسيرتك",
      srv1Tag:     "٠١ // مهندس السير الذاتية بالذكاء الاصطناعي",
      srv1Title:   "تصميم السير الذاتية الذكية",
      srv1Desc:    "هندسة كاملة لبنية مستنداتك الاحترافية بصيغ مخصصة يفضلها الذكاء الاصطناعي المؤسسي لضمان أعلى مرونة قراءة وتجاوز الفلاتر الصارمة.",
      srv2Tag:     "٠٢ // محلل مصفوفة المتجهات",
      srv2Title:   "الفحص والمطابقة الفورية",
      srv2Desc:    "تحليل مباشر ومطابقة مهاراتك وخبراتك الحالية مع متطلبات الوظائف الشاغرة لاستخراج وتضمين أفضل المصطلحات والمهارات اللازمة.",
      srv3Tag:     "٠٣ // مراكز التوظيف المباشر",
      srv3Title:   "قنوات التوصيل والتوظيف",
      srv3Desc:    "توجيه فوري لملفاتك المنسقة للعبور المباشر نحو منصات التقديم الخاصة بكبرى الشركات والمجموعات الاستثمارية بالمنطقة بدون وسيط.",
      loading:     "جاري التهيئة...",
      verifying:   "جاري تهيئة بيئة الفحص الجغرافي...",
    },
    en: {
      badge:    "Next-Gen AI Career Infrastructure",
      heading1: "Your Career Future Engineered",
      heading2: "By Artificial Intelligence.",
      sub:      "An integrated digital ecosystem built to help you design an executive resume, instantly analyze your skill match against live market requirements, and deploy your profile directly to top regional enterprise hiring decision-makers.",
      start:       "Start Now",
      statsTitle:  "Platform Core Telemetry",
      rBuilt:      "Resumes Architected",
      aAcc:        "Active AI Profiles",
      hChan:       "Enterprise Channels",
      srvTitle:    "The Triple Engine Matrix",
      srvSub:      "Three native AI sub-systems working in perfect harmony to accelerate your deployment",
      srv1Tag:     "01 // AI RESUME ARCHITECT",
      srv1Title:   "AI Resume Architecting",
      srv1Desc:    "Full structural architecture of your professional documents tailored precisely for ATS optimization and seamless algorithmic parsing.",
      srv2Tag:     "02 // VECTOR MATRIX ANALYSER",
      srv2Title:   "Vector Matrix Analysis",
      srv2Desc:    "Instant semantic mapping and alignment of your core skills against live corporate job descriptions to bridge professional gaps.",
      srv3Tag:     "03 // DIRECT EMPLOYMENT HUBS",
      srv3Title:   "Direct Employment Hubs",
      srv3Desc:    "Automated direct routing pipelines targeting executive recruitment nodes and enterprise decision-makers across the region.",
      loading:     "Initializing...",
      verifying:   "Initializing core node geo-routing...",
    },
  };
  const c = content[currentLang];

  /* ── Typed.js — prefers-reduced-motion aware ────────────────────────── */
  useEffect(() => {
    if (!el.current) return;
    const strings = isRtl ? [
      "✓ صياغة احترافية تتخطى أنظمة فرز السير الذاتية (ATS) بنجاح.",
      "✓ مطابقة ذكية وفورية لمهاراتك مع الشواغر الوظيفية الحالية.",
      "✓ قنوات توصيل مباشرة تضع ملفك المهني أمام مدراء التوظيف.",
    ] : [
      "✓ Professional tailoring built to successfully clear strict corporate ATS filters.",
      "✓ Smart, instant mapping of your skills with live professional openings.",
      "✓ Direct delivery channels that place your profile right before hiring managers.",
    ];

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.current.textContent = strings[0];
      return;
    }
    const typed = new Typed(el.current, { strings, typeSpeed: 35, backSpeed: 20, loop: true });
    return () => typed.destroy();
  }, [currentLang, isRtl]);

  /* ── Stats fetch ────────────────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const [r, u] = await Promise.all([
          supabase.from("cv_archive").select("*", { count: "exact", head: true }),
          supabase.from("users").select("*",      { count: "exact", head: true }),
        ]);
        setTargetCounts({ resumes: r.count ?? 12400, users: u.count ?? 8500, companies: 340 });
      } catch { /* use defaults */ }
      finally { setStatsLoading(false); }
    })();
  }, []);

  /* ── IntersectionObserver ───────────────────────────────────────────── */
  useEffect(() => {
    const node = statsRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setStatsVisible(true); },
      { threshold: 0.25 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  /* ── Counter animation ──────────────────────────────────────────────── */
  useEffect(() => {
    if (!statsVisible || statsLoading) return;
    const dur = 1800, start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setCounts({
        resumes:   Math.floor(e * targetCounts.resumes),
        users:     Math.floor(e * targetCounts.users),
        companies: Math.floor(e * targetCounts.companies),
      });
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [statsVisible, statsLoading, targetCounts]);

  /* ── Navigation ─────────────────────────────────────────────────────── */
  const saveAndNavigate = (region: string, lang: string, coords?: { lat: number; lon: number }) => {
    localStorage.setItem("pending_user_data", JSON.stringify({
      region, language: lang,
      lat: coords?.lat || 0, lon: coords?.lon || 0,
      timestamp: new Date().toISOString(),
    }));
    setVerifyingText("");
    navigate("/login");
  };

  const handleStart = async (lang: "ar" | "en") => {
    setCurrentLang(lang);
    setIsLoading(lang);
    setVerifyingText(content[lang].verifying);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => saveAndNavigate(
        coords.latitude < 32.5 ? "EG" : "LB", lang,
        { lat: coords.latitude, lon: coords.longitude },
      ),
      async () => {
        try {
          const res  = await fetch("https://ipapi.co/json/");
          const data = await res.json();
          saveAndNavigate(data.country_code === "EG" ? "EG" : "LB", lang);
        } catch { saveAndNavigate("LB", lang); }
      },
      { enableHighAccuracy: true, timeout: 4000, maximumAge: 0 },
    );
  };

  /* ── Shared class tokens ─────────────────────────────────────────────── */
  const featureCardCls = `
    bg-[rgba(60,80,125,0.06)] border border-[rgba(60,80,125,0.18)] p-6 rounded
    hover:border-[rgba(18,178,193,0.35)] hover:bg-[rgba(60,80,125,0.13)]
    hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(18,178,193,0.08)]
    transition-all duration-200
  `;
  const iconWellCls =
    "w-9 h-9 bg-[#112250] border border-[rgba(60,80,125,0.22)] rounded flex items-center justify-center mb-5";

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    /**
     * Layout contract (v2 — no static images):
     *   App.tsx <main> has pt-20 (80px) to clear the fixed floating header.
     *   Hero compensates with -mt-20 so the canvas starts at viewport y=0.
     *
     *   Two-column grid on desktop:
     *     • LTR: text (col-1 left) | canvas (col-2 right)
     *     • RTL: dir="rtl" flips grid → text (col-1 right) | canvas (col-2 left)
     *   Single column on mobile: canvas strip → text stacked vertically.
     */
    <div
      className="flex flex-col bg-[#0D1117] relative overflow-x-hidden text-[#D9CBC2] select-none -mt-20"
      dir={isRtl ? "rtl" : "ltr"}
      style={{ fontFamily: isRtl ? "'Tajawal', sans-serif" : "'Plus Jakarta Sans', sans-serif" }}
    >

      {/* ── Ambient background glows ──────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-8%] left-[10%] w-[50vw] h-[50vw] bg-[rgba(60,80,125,0.09)] rounded-full blur-[160px]" />
        <div className="absolute top-[35%] right-[-5%] w-[38vw] h-[38vw] bg-[rgba(18,178,193,0.04)] rounded-full blur-[140px]" />
        <div className="absolute top-[20%] left-[40%] w-1.5 h-1.5 bg-[rgba(18,178,193,0.35)] rounded-full animate-float motion-reduce:animate-none" />
        <div className="absolute top-[62%] left-[22%] w-2 h-2 bg-[rgba(60,80,125,0.28)] rounded-full animate-pulse-slow motion-reduce:animate-none" />
        <div className="absolute top-[42%] right-[27%] w-1 h-1 bg-[rgba(224,197,143,0.22)] rounded-full animate-float motion-reduce:animate-none" />
      </div>

      {/* ── Full-section neural canvas — particles float across the whole page ── */}
      <HeroCanvas className="z-0" />

      {/* ── Cyber grid overlay ────────────────────────────────────────── */}
      <div className="absolute inset-0 cyber-grid opacity-[0.28] pointer-events-none z-0" />

      {/* ── Edge gradient fades (left + right only) ───────────────────── */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-[#0D1117]/60 to-transparent" />
        <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-[#0D1117]/60 to-transparent" />
      </div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/*  HERO SECTION                                                    */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 w-full">
        <div className="max-w-7xl mx-auto px-6 lg:px-16 xl:px-24">

          {/*
           * Two-column grid (desktop) / stacked (mobile)
           * sm:grid-cols-2 — equal columns
           * sm:min-h-screen — fills viewport height
           * sm:pt-20 — clears 80px floating header
           */}
          <div className="flex flex-col sm:grid sm:grid-cols-2 sm:gap-8 lg:gap-16 sm:items-center sm:min-h-screen sm:pt-20 sm:pb-16">

            {/* ── 2. Mobile mockup strip — rendered after text on mobile ── */}
            <div className="sm:hidden relative h-[270px] -mx-6 flex-shrink-0 flex items-center justify-center">
              <CVMockup compact />
            </div>

            {/* ── 2. Text content ────────────────────────────────────── */}
            {/*
             * sm:order-1 ensures text is in "start" column:
             *   LTR → left column   RTL → right column (grid respects dir)
             */}
            <div className={`
              flex flex-col order-first pt-28 pb-6 sm:py-0 sm:order-1
              ${isRtl ? "items-end text-right" : "items-start text-left"}
            `}>

              {/* Badge */}
              <div className="inline-flex items-center gap-2 bg-[rgba(60,80,125,0.15)] border border-[rgba(60,80,125,0.25)] text-[#F5F0E9] px-4 py-1.5 rounded-full text-xs font-medium tracking-wide mb-5 w-fit backdrop-blur-md">
                <Sparkles strokeWidth={1.5} className="w-3.5 h-3.5 text-[#E0C58F] flex-shrink-0" />
                <span>{c.badge}</span>
              </div>

              {/* Headline */}
              <h1 className={`
                text-[38px] sm:text-[44px] lg:text-[54px] font-bold tracking-tight mb-4
                text-[#F5F0E9] w-full pb-2
                ${isRtl ? "leading-[1.65]" : "leading-[1.35]"}
              `}>
                {c.heading1}{" "}
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#F5F0E9] via-[#e1ebed] to-[#E0C58F] mt-1 pb-2">
                  {c.heading2}
                </span>
              </h1>

              {/* Typed terminal */}
              <div className="min-h-[20px] h-auto text-[13px] font-mono tracking-wide mb-5 w-full text-[rgba(18,178,193,1)] overflow-hidden">
                <span>&gt; </span>
                <span ref={el} />
              </div>

              {/* Subtitle */}
              <p className="text-[#D9CBC2] text-[15px] sm:text-base font-light leading-[2] mb-8 opacity-95 w-full max-w-sm sm:max-w-none mx-auto sm:mx-0">
                {c.sub}
              </p>

              {/* ── CTA Block ─────────────────────────────────────── */}
              <div className="w-full max-w-xs sm:max-w-sm flex flex-col gap-3 relative z-20 items-center sm:items-start mx-auto sm:mx-0">

                {/* Language selector */}
                <div className="w-full grid grid-cols-2 gap-3">
                  {(["ar", "en"] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setCurrentLang(lang)}
                      className={`
                        group flex flex-col items-center justify-center gap-1
                        rounded p-4 transition-all duration-200 border cursor-pointer active:scale-[0.98]
                        ${currentLang === lang
                          ? "bg-gradient-to-b from-[#162A60] via-[#112250] to-[#081026] border-[rgba(18,178,193,0.5)] text-[#F5F0E9]"
                          : "bg-[rgba(60,80,125,0.08)] border-[rgba(60,80,125,0.2)] text-[#A8B4CC] hover:border-[rgba(60,80,125,0.4)] hover:text-[#F5F0E9]"
                        }
                      `}
                    >
                      <span className="text-sm font-bold">
                        {lang === "ar" ? "العربية" : "English"}
                      </span>
                      <div className="flex items-center gap-1 text-[11px] uppercase tracking-wider font-medium opacity-70">
                        {lang === "ar" ? (
                          <><ArrowLeft strokeWidth={1.5} className="w-3 h-3" /> عربي</>
                        ) : (
                          <>English <ArrowRight strokeWidth={1.5} className="w-3 h-3" /></>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Start / Verifying button */}
                {verifyingText ? (
                  <div className="w-full flex items-center justify-center gap-2 text-[rgba(18,178,193,1)] text-xs font-mono bg-[rgba(60,80,125,0.06)] backdrop-blur-md py-3.5 rounded border border-[rgba(60,80,125,0.25)]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                    <span className="truncate">{verifyingText}</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleStart(currentLang)}
                    disabled={isLoading !== null}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded font-bold text-sm text-[#0D1117] transition-all duration-200 disabled:opacity-50 hover:shadow-[0_0_28px_rgba(18,178,193,0.32)] cursor-pointer"
                    style={{ background: "linear-gradient(135deg, #12B2C1, #0E8F9C)" }}
                  >
                    {isLoading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /><span>{c.loading}</span></>
                    ) : (
                      <>
                        {c.start}
                        {isRtl
                          ? <ArrowLeft  strokeWidth={2} className="w-4 h-4" />
                          : <ArrowRight strokeWidth={2} className="w-4 h-4" />}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* ── 3. Desktop mockup column — canvas is global background ── */}
            {/*
             * sm:order-2 → "end" column:
             *   LTR → right column   RTL → left column
             */}
            <div className="hidden sm:flex relative self-stretch min-h-[480px] sm:order-2 items-center justify-center">
              <CVMockup />
            </div>

          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/*  STATS SECTION                                                   */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <section
        ref={statsRef}
        className="relative z-10 w-full px-6 lg:px-16 xl:px-24 py-16 border-t border-[rgba(60,80,125,0.18)]"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[10px] font-semibold text-[rgba(18,178,193,0.65)] uppercase tracking-[0.2em] mb-2.5">
              Live Intelligence
            </p>
            <h2 className="text-2xl lg:text-3xl font-bold text-[#F5F0E9] tracking-tight">
              {c.statsTitle}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: <FileText strokeWidth={1.5} className="w-4 h-4 text-[#E0C58F]" />,          count: counts.resumes,   label: c.rBuilt },
              { icon: <Users    strokeWidth={1.5} className="w-4 h-4 text-[rgba(18,178,193,1)]" />,count: counts.users,     label: c.aAcc },
              { icon: <Globe    strokeWidth={1.5} className="w-4 h-4 text-[#E0C58F]" />,          count: counts.companies, label: c.hChan },
            ].map(({ icon, count, label }, i) => (
              <div
                key={i}
                className="group relative overflow-hidden bg-[rgba(60,80,125,0.12)] backdrop-blur-xl border border-[rgba(60,80,125,0.28)] p-6 rounded-xl text-center cursor-default hover:border-[rgba(18,178,193,0.35)] hover:bg-[rgba(60,80,125,0.20)] hover:shadow-[0_0_40px_rgba(60,80,125,0.18)] transition-all duration-300"
              >
                {statsLoading ? (
                  <div className="flex flex-col items-center gap-3 animate-pulse">
                    <div className="w-10 h-10 bg-[rgba(60,80,125,0.40)] rounded-lg mx-auto" />
                    <div className="h-6 w-24 bg-[rgba(60,80,125,0.35)] rounded mx-auto" />
                    <div className="h-3.5 w-28 bg-[rgba(60,80,125,0.22)] rounded mx-auto" />
                  </div>
                ) : (
                  <>
                    <div className="w-10 h-10 bg-[#112250] border border-[rgba(60,80,125,0.38)] rounded-lg flex items-center justify-center mx-auto mb-4 group-hover:border-[rgba(18,178,193,0.35)] transition-colors duration-300">
                      {icon}
                    </div>
                    <div className="text-2xl font-bold text-[#F5F0E9] mb-1.5 font-mono tracking-tight">
                      {count.toLocaleString()}+
                    </div>
                    <p className="text-[#A8B4CC] font-medium text-[13px]">{label}</p>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/*  FEATURES SECTION                                                */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 w-full px-6 lg:px-16 xl:px-24 py-16">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-xs font-bold text-[#F5F0E9] tracking-wider uppercase">{c.srvTitle}</h2>
            <p className="text-[#e1ebed] text-[11px] mt-1.5 tracking-wider uppercase">{c.srvSub}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { icon: <FileText    strokeWidth={1.5} className="w-4 h-4 text-[rgba(18,178,193,1)]" />, tag: c.srv1Tag, title: c.srv1Title, desc: c.srv1Desc },
              { icon: <BrainCircuit strokeWidth={1.5} className="w-4 h-4 text-[#E0C58F]" />,          tag: c.srv2Tag, title: c.srv2Title, desc: c.srv2Desc },
              { icon: <Network     strokeWidth={1.5} className="w-4 h-4 text-[rgba(18,178,193,1)]" />, tag: c.srv3Tag, title: c.srv3Title, desc: c.srv3Desc },
            ].map(({ icon, tag, title, desc }, i) => (
              <div key={i} className={featureCardCls}>
                <div className={iconWellCls}>{icon}</div>
                <h3 className="text-[13px] font-mono font-bold text-[#e1ebed] mb-1.5">{tag}</h3>
                <h4 className="text-sm font-bold text-[#F5F0E9] mb-2.5">{title}</h4>
                <p className="text-[#D9CBC2] text-sm leading-[1.75] font-light">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}

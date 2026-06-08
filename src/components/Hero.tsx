import { useEffect, useRef, useState } from "react";
import Typed from "typed.js";
import {
  Sparkles,
  Network,
  BrainCircuit,
  FileText,
  Users,
  Globe,
  ArrowLeft,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Target,
  TrendingUp,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useLang } from "../context/LanguageContext";
import HeroCanvas from "./HeroCanvas";

/* ══════════════════════════════════════════════════════════════════════════
   CAREER DASHBOARD MOCKUP
══════════════════════════════════════════════════════════════════════════ */
function CareerDashboardMockup({ compact = false }: { compact?: boolean }) {
  const scores = [
    { label: "ATS Score", pct: 94, color: "#12B2C1" },
    { label: "Resume Strength", pct: 88, color: "#E0C58F" },
    { label: "Interview Readiness", pct: 81, color: "#566C9E" },
  ];

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl
        bg-[rgba(8,16,38,0.84)] backdrop-blur-2xl
        border border-[rgba(60,80,125,0.45)]
        shadow-[0_24px_64px_rgba(0,0,0,0.55),0_0_0_1px_rgba(18,178,193,0.08)_inset]
        animate-float
        ${compact ? "w-56 p-4" : "w-72 p-5"}
      `}
    >
      <div className="absolute inset-x-0 top-0 h-[2px] animate-scan pointer-events-none">
        <div className="h-full bg-gradient-to-r from-transparent via-[rgba(18,178,193,0.8)] to-transparent" />
      </div>

      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-[rgba(18,178,193,0.85)]">
            Career Intelligence
          </p>
          <h3 className="text-[#F5F0E9] text-sm font-bold mt-1">
            Application Health
          </h3>
        </div>

        <div className="w-10 h-10 rounded-full bg-[rgba(60,80,125,0.5)] border border-[rgba(18,178,193,0.35)] flex items-center justify-center">
          <span className="text-[#E0C58F] text-[10px] font-black font-mono">
            AI
          </span>
        </div>
      </div>

      <div className="mb-5 rounded-lg border border-[rgba(60,80,125,0.28)] bg-[rgba(60,80,125,0.10)] p-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] text-[#A8B4CC] font-medium">
              Career Score
            </p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-4xl font-black text-[#F5F0E9] font-mono">
                82
              </span>
              <span className="text-[#A8B4CC] text-sm font-mono">/100</span>
            </div>
          </div>

          <div className="inline-flex items-center gap-1 rounded-full bg-[rgba(18,178,193,0.10)] border border-[rgba(18,178,193,0.25)] px-2 py-1">
            <TrendingUp className="w-3 h-3 text-[#12B2C1]" />
            <span className="text-[10px] text-[#12B2C1] font-bold">Strong</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {(compact ? scores.slice(0, 2) : scores).map(({ label, pct, color }) => (
          <div key={label}>
            <div className="flex justify-between mb-1">
              <span className="text-[9px] font-mono uppercase tracking-wide text-[rgba(217,203,194,0.62)]">
                {label}
              </span>
              <span className="text-[9px] font-mono font-bold" style={{ color }}>
                {pct}%
              </span>
            </div>

            <div className="h-1.5 bg-[rgba(60,80,125,0.2)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full opacity-85"
                style={{ width: `${pct}%`, background: color }}
              />
            </div>
          </div>
        ))}
      </div>

      {!compact && (
        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-[rgba(18,178,193,0.08)] border border-[rgba(18,178,193,0.18)] p-3">
            <p className="text-[9px] text-[#A8B4CC]">Keyword Match</p>
            <p className="text-[#F5F0E9] font-mono font-bold mt-1">94%</p>
          </div>

          <div className="rounded-lg bg-[rgba(224,197,143,0.08)] border border-[rgba(224,197,143,0.18)] p-3">
            <p className="text-[9px] text-[#A8B4CC]">CV Ready</p>
            <p className="text-[#F5F0E9] font-mono font-bold mt-1">Yes</p>
          </div>
        </div>
      )}

      <div className="mt-5 pt-3 border-t border-[rgba(60,80,125,0.2)] flex items-center justify-between">
        <span className="text-[8px] font-mono text-[rgba(18,178,193,0.7)] uppercase tracking-widest">
          Optimized for ATS
        </span>
        <CheckCircle2 className="w-4 h-4 text-[#12B2C1]" strokeWidth={2} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   HERO
══════════════════════════════════════════════════════════════════════════ */
export default function Hero() {
  const el = useRef<HTMLSpanElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { lang: currentLang, setLang: setCurrentLang, isRtl } = useLang();

  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [verifyingText, setVerifyingText] = useState<string>("");
  const [statsVisible, setStatsVisible] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [targetCounts, setTargetCounts] = useState({
    resumes: 0,
    users: 0,
    companies: 0,
  });
  const [counts, setCounts] = useState({
    resumes: 0,
    users: 0,
    companies: 0,
  });

  const content = {
    ar: {
      badge: "منصة ذكاء اصطناعي للتطور المهني",
      heading1: "احصل على مقابلات عمل أكثر",
      heading2: "بالذكاء الاصطناعي",
      sub: "أنشئ سيرة ذاتية أقوى، حسّن توافقها مع أنظمة ATS، واكتشف نقاط ضعف ملفك المهني لتتقدم بثقة أكبر للوظائف.",
      start: "ابدأ مجاناً",
      example: "شاهد مثالاً",
      statsEyebrow: "ثقة المستخدمين",
      statsTitle: "نتائج حقيقية من المنصة",
      rBuilt: "سيرة ذاتية تم إنشاؤها",
      aAcc: "مستخدم على المنصة",
      hChan: "شركة ضمن قاعدة البيانات",
      srvTitle: "كيف يساعدك Resumation؟",
      srvSub: "ثلاث فوائد واضحة قبل أن ترسل طلبك القادم",
      srv1Tag: "01",
      srv1Title: "اجتز أنظمة ATS",
      srv1Desc: "حسّن بنية سيرتك الذاتية والكلمات المفتاحية حتى لا تضيع فرصتك بسبب الفلاتر الآلية.",
      srv2Tag: "02",
      srv2Title: "حسّن سيرتك الذاتية",
      srv2Desc: "اكتشف نقاط الضعف في ملفك المهني وحوّل خبراتك إلى محتوى أقوى وأكثر إقناعاً.",
      srv3Tag: "03",
      srv3Title: "زد فرص المقابلات",
      srv3Desc: "قدّم على الوظائف بثقة أكبر من خلال ملف مهني أوضح وأقرب لما يبحث عنه أصحاب العمل.",
      loading: "جاري التهيئة...",
      verifying: "جاري تجهيز تجربتك...",
      typed: [
        "✓ سيرة ذاتية أقوى ومتوافقة مع أنظمة ATS.",
        "✓ تحليل ذكي يكشف نقاط ضعف ملفك المهني.",
        "✓ تحسين فرصك للحصول على مقابلات عمل أكثر.",
      ],
    },
    en: {
      badge: "AI Career Platform",
      heading1: "Get More Interviews",
      heading2: "With AI",
      sub: "Build a stronger resume, improve your ATS score, and discover what is holding your applications back — so you can apply with more confidence.",
      start: "Get Started Free",
      example: "See Example",
      statsEyebrow: "Trusted by job seekers",
      statsTitle: "Real platform activity",
      rBuilt: "CVs Generated",
      aAcc: "Users Joined",
      hChan: "Companies in Database",
      srvTitle: "How Resumation Helps",
      srvSub: "Three clear advantages before your next job application",
      srv1Tag: "01",
      srv1Title: "Beat ATS Filters",
      srv1Desc: "Improve your resume structure and keywords so your application has a better chance of passing automated screening.",
      srv2Tag: "02",
      srv2Title: "Improve Your Resume",
      srv2Desc: "Find weak points in your professional profile and turn your experience into stronger, clearer career content.",
      srv3Tag: "03",
      srv3Title: "Get More Interviews",
      srv3Desc: "Apply with more confidence using a stronger professional profile aligned with what employers are looking for.",
      loading: "Initializing...",
      verifying: "Preparing your experience...",
      typed: [
        "✓ Stronger resumes built for ATS screening.",
        "✓ Smart analysis that finds weak points in your profile.",
        "✓ Better applications designed to win more interviews.",
      ],
    },
  };

  const c = content[currentLang];

  useEffect(() => {
    if (!el.current) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.current.textContent = c.typed[0];
      return;
    }

    const typed = new Typed(el.current, {
      strings: c.typed,
      typeSpeed: 35,
      backSpeed: 20,
      loop: true,
    });

    return () => typed.destroy();
  }, [currentLang, c.typed]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const res = await fetch(
          "https://nbbxtealrhrnadlzmkev.supabase.co/functions/v1/public-platform-stats",
        );

        if (!mounted) return;

        if (!res.ok) {
          throw new Error(`Stats request failed: ${res.status}`);
        }

        const data = await res.json();

        setTargetCounts({
          resumes: Number(data?.resumes ?? 0),
          users: Number(data?.users ?? 0),
          companies: Number(data?.companies ?? 0),
        });
      } catch (error) {
        console.error("Failed to load public platform stats:", error);

        if (!mounted) return;

        setTargetCounts({
          resumes: 0,
          users: 0,
          companies: 0,
        });
      } finally {
        if (mounted) {
          setStatsLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const node = statsRef.current;
    if (!node) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setStatsVisible(true);
      },
      { threshold: 0.25 },
    );

    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!statsVisible || statsLoading) return;

    const duration = 1800;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      setCounts({
        resumes: Math.floor(eased * targetCounts.resumes),
        users: Math.floor(eased * targetCounts.users),
        companies: Math.floor(eased * targetCounts.companies),
      });

      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, [statsVisible, statsLoading, targetCounts]);

  const saveAndNavigate = (
    region: string,
    lang: string,
    coords?: { lat: number; lon: number },
  ) => {
    localStorage.setItem(
      "pending_user_data",
      JSON.stringify({
        region,
        language: lang,
        lat: coords?.lat || 0,
        lon: coords?.lon || 0,
        timestamp: new Date().toISOString(),
      }),
    );

    setVerifyingText("");
    navigate("/login");
  };

  const handleStart = async (lang: "ar" | "en") => {
    setCurrentLang(lang);
    setIsLoading(lang);
    setVerifyingText(content[lang].verifying);

    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        saveAndNavigate(
          coords.latitude < 32.5 ? "EG" : "LB",
          lang,
          { lat: coords.latitude, lon: coords.longitude },
        ),
      async () => {
        try {
          const res = await fetch("https://ipapi.co/json/");
          const data = await res.json();
          saveAndNavigate(data.country_code === "EG" ? "EG" : "LB", lang);
        } catch {
          saveAndNavigate("LB", lang);
        }
      },
      { enableHighAccuracy: true, timeout: 4000, maximumAge: 0 },
    );
  };

  const scrollToFeatures = () => {
    document.getElementById("features")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const featureCardCls = `
    bg-[rgba(60,80,125,0.06)] border border-[rgba(60,80,125,0.18)] p-6 rounded
    hover:border-[rgba(18,178,193,0.35)] hover:bg-[rgba(60,80,125,0.13)]
    hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(18,178,193,0.08)]
    transition-all duration-200
  `;

  const iconWellCls =
    "w-9 h-9 bg-[#112250] border border-[rgba(60,80,125,0.22)] rounded flex items-center justify-center mb-5";

  return (
    <div
      className="flex flex-col bg-[#0D1117] relative overflow-x-hidden text-[#D9CBC2] select-none -mt-20"
      dir={isRtl ? "rtl" : "ltr"}
      style={{
        fontFamily: isRtl
          ? "'Tajawal', sans-serif"
          : "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-8%] left-[10%] w-[50vw] h-[50vw] bg-[rgba(60,80,125,0.09)] rounded-full blur-[160px]" />
        <div className="absolute top-[35%] right-[-5%] w-[38vw] h-[38vw] bg-[rgba(18,178,193,0.04)] rounded-full blur-[140px]" />
        <div className="absolute top-[20%] left-[40%] w-1.5 h-1.5 bg-[rgba(18,178,193,0.35)] rounded-full animate-float motion-reduce:animate-none" />
        <div className="absolute top-[62%] left-[22%] w-2 h-2 bg-[rgba(60,80,125,0.28)] rounded-full animate-pulse-slow motion-reduce:animate-none" />
        <div className="absolute top-[42%] right-[27%] w-1 h-1 bg-[rgba(224,197,143,0.22)] rounded-full animate-float motion-reduce:animate-none" />
      </div>

      <HeroCanvas className="z-0" />

      <div className="absolute inset-0 cyber-grid opacity-[0.28] pointer-events-none z-0" />

      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-[#0D1117]/60 to-transparent" />
        <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-[#0D1117]/60 to-transparent" />
      </div>

      <section className="relative z-10 w-full">
        <div className="max-w-7xl mx-auto px-6 lg:px-16 xl:px-24">
          <div className="flex flex-col sm:grid sm:grid-cols-2 sm:gap-8 lg:gap-16 sm:items-center sm:min-h-screen sm:pt-20 sm:pb-16">
            <div className="sm:hidden relative h-[270px] -mx-6 flex-shrink-0 flex items-center justify-center">
              <CareerDashboardMockup compact />
            </div>

            <div
              className={`
                flex flex-col order-first pt-28 pb-6 sm:py-0 sm:order-1
                ${isRtl ? "items-end text-right" : "items-start text-left"}
              `}
            >
              <div className="inline-flex items-center gap-2 bg-[rgba(60,80,125,0.15)] border border-[rgba(60,80,125,0.25)] text-[#F5F0E9] px-4 py-1.5 rounded-full text-xs font-medium tracking-wide mb-5 w-fit backdrop-blur-md">
                <Sparkles
                  strokeWidth={1.5}
                  className="w-3.5 h-3.5 text-[#E0C58F] flex-shrink-0"
                />
                <span>{c.badge}</span>
              </div>

              <h1
                className={`
                  text-[38px] sm:text-[44px] lg:text-[58px] font-bold tracking-tight mb-4
                  text-[#F5F0E9] w-full pb-2
                  ${isRtl ? "leading-[1.55]" : "leading-[1.15]"}
                `}
              >
                {c.heading1}
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#F5F0E9] via-[#e1ebed] to-[#E0C58F] mt-2 pb-2">
                  {c.heading2}
                </span>
              </h1>

              <div className="min-h-[20px] h-auto text-[13px] font-mono tracking-wide mb-5 w-full text-[rgba(18,178,193,1)] overflow-hidden">
                <span>&gt; </span>
                <span ref={el} />
              </div>

              <p className="text-[#D9CBC2] text-[15px] sm:text-base font-light leading-[2] mb-8 opacity-95 w-full max-w-xl mx-auto sm:mx-0">
                {c.sub}
              </p>

              <div className="w-full max-w-md flex flex-col gap-3 relative z-20 items-center sm:items-start mx-auto sm:mx-0">
                <div className="w-full grid grid-cols-2 gap-3">
                  {(["ar", "en"] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setCurrentLang(lang)}
                      className={`
                        group flex flex-col items-center justify-center gap-1
                        rounded p-4 transition-all duration-200 border cursor-pointer active:scale-[0.98]
                        ${
                          currentLang === lang
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
                          <>
                            <ArrowLeft strokeWidth={1.5} className="w-3 h-3" />
                            عربي
                          </>
                        ) : (
                          <>
                            English
                            <ArrowRight strokeWidth={1.5} className="w-3 h-3" />
                          </>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="w-full grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
                  {verifyingText ? (
                    <div className="w-full flex items-center justify-center gap-2 text-[rgba(18,178,193,1)] text-xs font-mono bg-[rgba(60,80,125,0.06)] backdrop-blur-md py-3.5 rounded border border-[rgba(60,80,125,0.25)]">
                      <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                      <span className="truncate">{verifyingText}</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleStart(currentLang)}
                      disabled={isLoading !== null}
                      className="w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded font-bold text-sm text-[#0D1117] transition-all duration-200 disabled:opacity-50 hover:shadow-[0_0_28px_rgba(18,178,193,0.32)] cursor-pointer"
                      style={{
                        background: "linear-gradient(135deg, #12B2C1, #0E8F9C)",
                      }}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{c.loading}</span>
                        </>
                      ) : (
                        <>
                          {c.start}
                          {isRtl ? (
                            <ArrowLeft strokeWidth={2} className="w-4 h-4" />
                          ) : (
                            <ArrowRight strokeWidth={2} className="w-4 h-4" />
                          )}
                        </>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={scrollToFeatures}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 py-3.5 px-5 rounded font-bold text-sm text-[#F5F0E9] bg-[rgba(60,80,125,0.10)] border border-[rgba(60,80,125,0.28)] hover:border-[rgba(18,178,193,0.38)] hover:bg-[rgba(60,80,125,0.18)] transition-all duration-200"
                  >
                    {c.example}
                  </button>
                </div>
              </div>
            </div>

            <div className="hidden sm:flex relative self-stretch min-h-[480px] sm:order-2 items-center justify-center">
              <CareerDashboardMockup />
            </div>
          </div>
        </div>
      </section>

      <section
        ref={statsRef}
        className="relative z-10 w-full px-6 lg:px-16 xl:px-24 py-16 border-t border-[rgba(60,80,125,0.18)]"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[10px] font-semibold text-[rgba(18,178,193,0.65)] uppercase tracking-[0.2em] mb-2.5">
              {c.statsEyebrow}
            </p>
            <h2 className="text-2xl lg:text-3xl font-bold text-[#F5F0E9] tracking-tight">
              {c.statsTitle}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: (
                  <FileText
                    strokeWidth={1.5}
                    className="w-4 h-4 text-[#E0C58F]"
                  />
                ),
                count: counts.resumes,
                label: c.rBuilt,
              },
              {
                icon: (
                  <Users
                    strokeWidth={1.5}
                    className="w-4 h-4 text-[rgba(18,178,193,1)]"
                  />
                ),
                count: counts.users,
                label: c.aAcc,
              },
              {
                icon: (
                  <Globe
                    strokeWidth={1.5}
                    className="w-4 h-4 text-[#E0C58F]"
                  />
                ),
                count: counts.companies,
                label: c.hChan,
              },
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
                    <p className="text-[#A8B4CC] font-medium text-[13px]">
                      {label}
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="features"
        className="relative z-10 w-full px-6 lg:px-16 xl:px-24 py-16"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-xs font-bold text-[#F5F0E9] tracking-wider uppercase">
              {c.srvTitle}
            </h2>
            <p className="text-[#e1ebed] text-[11px] mt-1.5 tracking-wider uppercase">
              {c.srvSub}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                icon: (
                  <Target
                    strokeWidth={1.5}
                    className="w-4 h-4 text-[rgba(18,178,193,1)]"
                  />
                ),
                tag: c.srv1Tag,
                title: c.srv1Title,
                desc: c.srv1Desc,
              },
              {
                icon: (
                  <BrainCircuit
                    strokeWidth={1.5}
                    className="w-4 h-4 text-[#E0C58F]"
                  />
                ),
                tag: c.srv2Tag,
                title: c.srv2Title,
                desc: c.srv2Desc,
              },
              {
                icon: (
                  <Network
                    strokeWidth={1.5}
                    className="w-4 h-4 text-[rgba(18,178,193,1)]"
                  />
                ),
                tag: c.srv3Tag,
                title: c.srv3Title,
                desc: c.srv3Desc,
              },
            ].map(({ icon, tag, title, desc }, i) => (
              <div key={i} className={featureCardCls}>
                <div className={iconWellCls}>{icon}</div>
                <h3 className="text-[13px] font-mono font-bold text-[#e1ebed] mb-1.5">
                  {tag}
                </h3>
                <h4 className="text-sm font-bold text-[#F5F0E9] mb-2.5">
                  {title}
                </h4>
                <p className="text-[#D9CBC2] text-sm leading-[1.75] font-light">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
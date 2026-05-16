import { useEffect, useRef, useState } from "react";
import Typed from "typed.js";
import {
  MapPin, ArrowLeft, ArrowRight, Sparkles, Globe,
  ShieldCheck, Network, BrainCircuit,
  FileText, Users,
  Target, TrendingUp, Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

export default function Hero() {
  const el       = useRef<HTMLSpanElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const [isLoading,     setIsLoading]     = useState<string | null>(null);
  const [verifyingText, setVerifyingText] = useState<string>("");
  const [statsVisible,  setStatsVisible]  = useState(false);
  const [statsLoading,  setStatsLoading]  = useState(true);
  const [targetCounts,  setTargetCounts]  = useState({ resumes: 12400, users: 8500, companies: 340 });
  const [counts,        setCounts]        = useState({ resumes: 0, users: 0, companies: 0 });

  /* ─── Typed.js ─── */
  useEffect(() => {
    if (!el.current) return;
    const typed = new Typed(el.current, {
      strings: [
        "سيرة ذاتية تتخطى أنظمة الـ ATS.",
        "AI-Powered Career Intelligence.",
        "نصيغ خبراتك بذكاء احترافي.",
        "Get Hired Faster.",
      ],
      typeSpeed: 40, backSpeed: 28, loop: true,
    });
    return () => typed.destroy();
  }, []);

  /* ─── Fetch real stats from Supabase ─── */
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [resumeRes, userRes] = await Promise.all([
          supabase.from("cv_archive").select("*", { count: "exact", head: true }),
          supabase.from("users").select("*", { count: "exact", head: true }),
        ]);
        setTargetCounts({
          resumes:   resumeRes.count  ?? 12400,
          users:     userRes.count    ?? 8500,
          companies: 340,
        });
      } catch {
        // Fallback values remain
      } finally {
        setStatsLoading(false);
      }
    };
    fetchStats();
  }, []);

  /* ─── IntersectionObserver for counters ─── */
  useEffect(() => {
    const node = statsRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setStatsVisible(true); },
      { threshold: 0.25 }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  /* ─── Counter animation ─── */
  useEffect(() => {
    if (!statsVisible || statsLoading) return;
    const duration = 2000;
    const start    = performance.now();
    const tick = (now: number) => {
      const p    = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setCounts({
        resumes:   Math.floor(ease * targetCounts.resumes),
        users:     Math.floor(ease * targetCounts.users),
        companies: Math.floor(ease * targetCounts.companies),
      });
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [statsVisible, statsLoading, targetCounts]);

  /* ─── Geo + navigate ─── */
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
    setIsLoading(lang);
    setVerifyingText(lang === "ar" ? "جاري تحديد منطقتك..." : "Detecting your region...");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const region = coords.latitude < 32.5 ? "EG" : "LB";
        saveAndNavigate(region, lang, { lat: coords.latitude, lon: coords.longitude });
      },
      async () => {
        try {
          const res  = await fetch("https://ipapi.co/json/");
          const data = await res.json();
          saveAndNavigate(data.country_code === "EG" ? "EG" : "LB", lang);
        } catch {
          saveAndNavigate("LB", lang);
        }
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  /* ─── Render ─── */
  return (
    <div
      className="min-h-[100dvh] flex flex-col font-sans bg-cyber-bg relative overflow-x-hidden text-cyber-text/90"
      dir="rtl"
    >
      {/* Inline keyframes */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes hero-scan {
          0%   { top: 0%;   opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .animate-hero-scan  { animation: hero-scan 3s linear infinite; }
        @keyframes hero-float {
          0%, 100% { transform: translateY(0px); }
          50%      { transform: translateY(-14px); }
        }
        .animate-hero-float { animation: hero-float 6s ease-in-out infinite; }
        @keyframes badge-pop {
          0%   { opacity: 0; transform: scale(0.85) translateY(8px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-badge-pop  { animation: badge-pop 0.5s ease-out forwards; }
      ` }} />

      {/* Gradient overlay */}
      <div className="fixed inset-0 bg-gradient-to-br from-cyber-teal/10 via-transparent to-cyber-cyan/8 pointer-events-none z-0" />

      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 -right-32 w-[68vw] h-[68vw] max-w-[860px] max-h-[860px] bg-cyber-teal/12 rounded-full blur-[160px]" />
        <div className="absolute bottom-0 -left-20 w-[54vw] h-[54vw] max-w-[680px] max-h-[680px] bg-cyber-teal/8 rounded-full blur-[140px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[35vw] h-[35vw] max-w-[450px] max-h-[450px] bg-cyber-teal/5 rounded-full blur-[120px]" />
      </div>

      {/* Dot grid */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: "radial-gradient(rgba(18,178,193,0.045) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* ══════════════════ HERO SECTION ══════════════════ */}
      <section className="relative z-10 w-full min-h-[92vh] flex flex-col lg:flex-row items-center justify-center px-6 lg:px-20 pt-16 lg:pt-0 gap-14 lg:gap-8">

        {/* ── Left: Text ── */}
        <div className="w-full lg:w-[52%] flex flex-col justify-center text-center lg:text-right">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-cyber-teal/10 border border-cyber-teal/20 text-cyber-cyan px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.25em] mb-7 mx-auto lg:mx-0 backdrop-blur-sm shadow-[0_0_20px_rgba(13,138,158,0.1)]">
            <Sparkles className="w-3.5 h-3.5 text-cyber-cyan" />
            AI Career Intelligence Platform
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-[4.2rem] font-black tracking-tight mb-4 leading-[1.07] text-white font-arabic">
            الهيكل الرقمي{" "}
            <span className="block text-transparent bg-clip-text bg-gradient-to-l from-white via-cyber-cyan to-cyber-teal">
              لمسارك المهني.
            </span>
          </h1>

          {/* Typed sub-headline */}
          <div className="h-7 text-base sm:text-lg text-cyber-muted font-medium mb-4 font-mono tracking-wide">
            <span ref={el} />
          </div>

          {/* Subtitle */}
          <p className="text-cyber-muted text-sm sm:text-[15px] leading-relaxed mb-10 max-w-lg mx-auto lg:mx-0 font-arabic">
            منصة ذكاء اصطناعي متكاملة تبني سيرتك الذاتية، تحلل مسارك المهني،
            وتوصلك بأكبر شبكة توظيف في منطقة الشرق الأوسط.
          </p>

          {/* CTA buttons */}
          <div className="w-full max-w-sm mx-auto lg:mx-0 flex flex-col gap-3.5 relative z-20">
            {verifyingText && (
              <div className="flex items-center justify-center gap-2 text-cyber-cyan text-sm font-semibold bg-cyber-teal/10 backdrop-blur-md py-3 rounded-2xl border border-cyber-teal/20 animate-pulse">
                <MapPin className="w-4 h-4" />
                <span>{verifyingText}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {/* Primary — teal gradient */}
              <button
                onClick={() => handleStart("ar")}
                disabled={isLoading !== null}
                className="group flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-cyber-teal to-cyber-cyan hover:from-cyber-teal/80 hover:to-cyber-cyan/80 rounded-2xl p-5 transition-all duration-300 active:scale-95 shadow-[0_4px_32px_rgba(13,138,158,0.4)] hover:shadow-[0_4px_48px_rgba(13,138,158,0.5)] disabled:opacity-50"
              >
                <span className="text-[15px] font-black text-white font-arabic">العربية</span>
                <div className="flex items-center gap-1 text-[10px] text-white/80 uppercase tracking-widest font-bold">
                  <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
                  ابدأ الآن
                </div>
              </button>

              {/* Secondary — ghost outline */}
              <button
                onClick={() => handleStart("en")}
                disabled={isLoading !== null}
                className="group flex flex-col items-center justify-center gap-2 bg-transparent border border-white/15 hover:border-cyber-teal/40 hover:bg-cyber-teal/8 rounded-2xl p-5 transition-all duration-300 active:scale-95 disabled:opacity-50"
                dir="ltr"
              >
                <span className="text-[15px] font-black text-white">English</span>
                <div className="flex items-center gap-1 text-[10px] text-cyber-muted group-hover:text-cyber-cyan uppercase tracking-widest font-bold transition-colors">
                  Start Now
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* ── Right: Illustration ── */}
        <div className="w-full lg:w-[48%] relative flex justify-center items-center h-[340px] lg:h-[460px] animate-hero-float">
          <div className="relative w-full max-w-[420px] h-full">

            {/* Main scene SVG */}
            <svg
              viewBox="0 0 460 400"
              className="w-full h-full"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <radialGradient id="hr-bgGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%"   stopColor="#0D8A9E" stopOpacity="0.13" />
                  <stop offset="100%" stopColor="#0D8A9E" stopOpacity="0"    />
                </radialGradient>
                <linearGradient id="hr-screen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#131F21" />
                  <stop offset="100%" stopColor="#142022" />
                </linearGradient>
                <linearGradient id="hr-violet" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%"   stopColor="#0D8A9E" />
                  <stop offset="100%" stopColor="#0A7890" />
                </linearGradient>
                <linearGradient id="hr-body" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#0E96A8" />
                  <stop offset="100%" stopColor="#0D8A9E" />
                </linearGradient>
                <filter id="hr-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Background glow blob */}
              <ellipse cx="220" cy="200" rx="185" ry="162" fill="url(#hr-bgGlow)" />

              {/* ── DESK ── */}
              <rect x="28"  y="328" width="364" height="10" rx="5"   fill="#16252A" opacity="0.9" />
              <rect x="50"  y="337" width="320" height="5"  rx="2.5" fill="#132020" opacity="0.5" />

              {/* Monitor stand */}
              <rect x="190" y="296" width="36"  height="33" rx="3" fill="#18282C" />
              <rect x="174" y="328" width="68"  height="4"  rx="2" fill="#16252A" />

              {/* Monitor outer frame */}
              <rect x="58"  y="78"  width="256" height="222" rx="14" fill="#111D1F" />
              <rect x="58"  y="78"  width="256" height="222" rx="14" stroke="#0D8A9E" strokeWidth="1.5" opacity="0.4" />

              {/* Camera dot */}
              <circle cx="186" cy="87" r="3" fill="#0D8A9E" opacity="0.45" />

              {/* Screen area */}
              <rect x="70"  y="92"  width="232" height="196" rx="6" fill="url(#hr-screen)" />

              {/* ── RESUME DOCUMENT (left panel) ── */}
              <rect x="82"  y="102" width="132" height="176" rx="4" fill="#152628" />
              <rect x="82"  y="102" width="132" height="176" rx="4" stroke="#0D8A9E" strokeWidth="0.6" opacity="0.22" />

              {/* Header block */}
              <rect x="92"  y="112" width="78"  height="6"   rx="3"   fill="#0E96A8" opacity="0.92" />
              <rect x="92"  y="122" width="54"  height="3"   rx="1.5" fill="#12B2C1" opacity="0.6"  />

              {/* Divider */}
              <rect x="92"  y="132" width="112" height="0.8" rx="0.4" fill="#0D8A9E" opacity="0.28" />

              {/* Content lines group 1 */}
              <rect x="92" y="138" width="112" height="2.5" rx="1.25" fill="white" opacity="0.10" />
              <rect x="92" y="144" width="88"  height="2.5" rx="1.25" fill="white" opacity="0.08" />
              <rect x="92" y="150" width="100" height="2.5" rx="1.25" fill="white" opacity="0.07" />

              <rect x="92" y="160" width="112" height="0.8" rx="0.4" fill="#0A7890" opacity="0.22" />

              {/* Content lines group 2 */}
              <rect x="92" y="166" width="112" height="2.5" rx="1.25" fill="white" opacity="0.09" />
              <rect x="92" y="172" width="82"  height="2.5" rx="1.25" fill="white" opacity="0.07" />
              <rect x="92" y="178" width="96"  height="2.5" rx="1.25" fill="white" opacity="0.08" />
              <rect x="92" y="184" width="112" height="2.5" rx="1.25" fill="white" opacity="0.07" />
              <rect x="92" y="190" width="74"  height="2.5" rx="1.25" fill="white" opacity="0.06" />

              <rect x="92" y="200" width="112" height="0.8" rx="0.4" fill="#0A7890" opacity="0.18" />

              {/* Content lines group 3 */}
              <rect x="92" y="206" width="112" height="2.5" rx="1.25" fill="white" opacity="0.08" />
              <rect x="92" y="212" width="70"  height="2.5" rx="1.25" fill="white" opacity="0.07" />
              <rect x="92" y="218" width="90"  height="2.5" rx="1.25" fill="white" opacity="0.06" />
              <rect x="92" y="224" width="100" height="2.5" rx="1.25" fill="white" opacity="0.07" />

              {/* Skill tags */}
              <rect x="92"  y="236" width="28" height="7" rx="3.5" fill="#0D8A9E" opacity="0.42" />
              <rect x="124" y="236" width="32" height="7" rx="3.5" fill="#0A7890" opacity="0.36" />
              <rect x="160" y="236" width="24" height="7" rx="3.5" fill="#12B2C1" opacity="0.28" />

              {/* ── METRICS PANEL (right panel) ── */}
              <rect x="222" y="102" width="68"  height="176" rx="4" fill="#0D1A1C"  />
              <rect x="222" y="102" width="68"  height="176" rx="4" stroke="#0A7890" strokeWidth="0.5" opacity="0.28" />

              {/* ATS Donut */}
              <circle cx="256" cy="140" r="23" stroke="#162A2E" strokeWidth="5"   fill="none" />
              <circle
                cx="256" cy="140" r="23"
                stroke="#0D8A9E" strokeWidth="5"
                fill="none"
                strokeDasharray="130" strokeDashoffset="12"
                strokeLinecap="round"
                transform="rotate(-90 256 140)"
                filter="url(#hr-glow)"
              />
              <rect x="247" y="136" width="18" height="4"   rx="2"   fill="#4DD4E0" opacity="0.85" />
              <rect x="250" y="143" width="12" height="3"   rx="1.5" fill="#0D8A9E" opacity="0.55" />

              {/* Bar chart */}
              <rect x="230" y="184" width="7"  height="24" rx="2" fill="#0D8A9E" opacity="0.22" />
              <rect x="241" y="191" width="7"  height="17" rx="2" fill="#12B2C1" opacity="0.42" />
              <rect x="252" y="178" width="7"  height="30" rx="2" fill="#0D8A9E" opacity="0.68" />
              <rect x="263" y="187" width="7"  height="21" rx="2" fill="#0A7890" opacity="0.52" />
              <rect x="274" y="182" width="7"  height="26" rx="2" fill="#0D8A9E" opacity="0.46" />

              {/* Green "live" indicator */}
              <circle cx="232" cy="232" r="4"  fill="#10b981" />
              <rect x="240" y="229" width="38" height="2.5" rx="1.25" fill="#10b981" opacity="0.52" />
              <rect x="240" y="236" width="28" height="2"   rx="1"   fill="#10b981" opacity="0.3"  />

              {/* Bottom label rows */}
              <rect x="230" y="254" width="48" height="2.5" rx="1.25" fill="#4DD4E0" opacity="0.33" />
              <rect x="234" y="261" width="36" height="2"   rx="1"   fill="#12B2C1" opacity="0.2"  />

              {/* ── PERSON ── */}
              {/* Chair back */}
              <rect x="358" y="192" width="72"  height="142" rx="12" fill="#162B2F" opacity="0.82" />
              <rect x="358" y="192" width="72"  height="142" rx="12" stroke="#0A7890" strokeWidth="0.75" opacity="0.22" />

              {/* Armrests */}
              <rect x="346" y="282" width="20" height="8" rx="4" fill="#16252A" opacity="0.8" />
              <rect x="422" y="282" width="20" height="8" rx="4" fill="#16252A" opacity="0.8" />

              {/* Body */}
              <rect x="365" y="252" width="58"  height="72"  rx="14" fill="url(#hr-body)" />

              {/* Collar detail */}
              <path
                d="M380 252 L388 266 L394 258 L400 266 L408 252 Q394 262 380 252Z"
                fill="#0A6E80"
              />

              {/* Head */}
              <circle cx="394" cy="224" r="27" fill="#fde8c8" />

              {/* Hair */}
              <path
                d="M368 218 Q370 196 394 192 Q418 196 420 218 Q414 202 394 200 Q374 202 368 218Z"
                fill="#18282C"
              />

              {/* Ear */}
              <ellipse cx="368" cy="225" rx="4" ry="6" fill="#fde8c8" />

              {/* Left arm to keyboard */}
              <path d="M368 270 Q342 284 328 312" stroke="#0A7890" strokeWidth="18" strokeLinecap="round" />
              <circle cx="324" cy="316" r="9" fill="#fde8c8" />

              {/* Right arm */}
              <path d="M420 270 Q442 284 442 312" stroke="#0D8A9E" strokeWidth="18" strokeLinecap="round" />
              <circle cx="444" cy="315" r="9" fill="#fde8c8" />

              {/* ── Decorative scatter dots ── */}
              <circle cx="42"  cy="138" r="3"   fill="#0D8A9E" opacity="0.48" />
              <circle cx="55"  cy="158" r="2"   fill="#12B2C1" opacity="0.38" />
              <circle cx="40"  cy="172" r="1.5" fill="#4DD4E0" opacity="0.58" />
              <circle cx="52"  cy="188" r="2.5" fill="#0D8A9E" opacity="0.33" />
              <circle cx="340" cy="86"  r="3"   fill="#0A7890" opacity="0.48" />
              <circle cx="356" cy="99"  r="2"   fill="#0D8A9E" opacity="0.38" />
              <circle cx="348" cy="113" r="2"   fill="#12B2C1" opacity="0.48" />

              {/* Sparkle stars */}
              <path d="M43 108 L45 102 L47 108 L53 110 L47 112 L45 118 L43 112 L37 110Z"  fill="#4DD4E0" opacity="0.52" />
              <path d="M348 68  L350 63 L352 68 L357 70 L352 72 L350 77 L348 72 L343 70Z"  fill="#0D8A9E" opacity="0.48" />
              <path d="M418 138 L419 135 L420 138 L423 139 L420 140 L419 143 L418 140 L415 139Z" fill="#4DD4E0" opacity="0.72" />
            </svg>

            {/* ── Floating achievement badges ── */}
            <div
              className="absolute top-4 right-0 lg:-right-5 flex flex-col gap-2.5 animate-badge-pop"
              style={{ animationDelay: "0.4s", opacity: 0 }}
            >
              <div className="bg-cyber-bg/80 backdrop-blur-xl border border-white/12 rounded-2xl px-4 py-2.5 shadow-xl flex items-center gap-2.5">
                <div className="w-7 h-7 bg-cyber-teal/20 border border-cyber-teal/25 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-cyber-cyan text-xs font-black">✓</span>
                </div>
                <div>
                  <p className="text-white text-[11px] font-black leading-tight">ATS Score: 98%</p>
                  <p className="text-cyber-dim text-[9px] leading-tight">Top 2% globally</p>
                </div>
              </div>
            </div>

            {/* Bottom badge */}
            <div
              className="absolute bottom-10 left-0 lg:-left-5 bg-cyber-bg/80 backdrop-blur-xl border border-white/12 rounded-2xl px-4 py-2.5 shadow-xl flex items-center gap-2.5 animate-badge-pop"
              style={{ animationDelay: "0.7s", opacity: 0 }}
            >
              <div className="w-7 h-7 bg-cyber-cyan/20 border border-cyber-cyan/25 rounded-lg flex items-center justify-center flex-shrink-0">
                <Globe className="w-3.5 h-3.5 text-cyber-cyan" />
              </div>
              <div>
                <p className="text-white text-[11px] font-black leading-tight">500+ Companies</p>
                <p className="text-cyber-dim text-[9px] leading-tight">Across MENA region</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════ PLATFORM IMPACT ══════════════════ */}
      <section ref={statsRef} className="relative z-10 w-full max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 text-cyber-cyan text-[10px] font-black uppercase tracking-[0.3em] mb-3">
            <div className="w-8 h-px bg-gradient-to-r from-transparent to-cyber-teal" />
            Platform Impact
            <div className="w-8 h-px bg-gradient-to-l from-transparent to-cyber-teal" />
          </div>
          <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight">
            Numbers That{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyber-cyan to-cyber-teal">
              Speak for Themselves
            </span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

          {/* Resumes Built */}
          <div className="group bg-white/5 border border-white/10 rounded-3xl p-8 text-center hover:border-cyber-teal/25 hover:bg-cyber-teal/4 transition-all duration-300 shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:shadow-[0_4px_32px_rgba(13,138,158,0.12)]">
            <div className="w-12 h-12 bg-cyber-teal/15 border border-cyber-teal/20 rounded-2xl flex items-center justify-center mx-auto mb-5 group-hover:scale-110 group-hover:shadow-[0_0_18px_rgba(13,138,158,0.3)] transition-all">
              <FileText className="w-5 h-5 text-cyber-cyan" />
            </div>
            {statsLoading ? (
              <div className="flex flex-col items-center gap-2.5 mb-3">
                <div className="h-12 w-32 bg-white/8 rounded-xl animate-pulse" />
                <div className="h-3.5 w-24 bg-white/5 rounded-lg animate-pulse" />
              </div>
            ) : (
              <>
                <div className="text-5xl font-black text-white mb-1 tracking-tight tabular-nums">
                  {counts.resumes.toLocaleString()}
                  <span className="text-cyber-cyan">+</span>
                </div>
                <p className="text-white font-semibold text-sm mb-1">Resumes Built</p>
              </>
            )}
            <p className="text-cyber-dim text-xs font-arabic">سيرة ذاتية مبنية</p>
          </div>

          {/* Active Users */}
          <div className="group bg-white/5 border border-white/10 rounded-3xl p-8 text-center hover:border-cyber-teal/25 hover:bg-cyber-teal/4 transition-all duration-300 shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:shadow-[0_4px_32px_rgba(13,138,158,0.12)]">
            <div className="w-12 h-12 bg-cyber-teal/15 border border-cyber-teal/20 rounded-2xl flex items-center justify-center mx-auto mb-5 group-hover:scale-110 group-hover:shadow-[0_0_18px_rgba(13,138,158,0.3)] transition-all">
              <Users className="w-5 h-5 text-cyber-teal" />
            </div>
            {statsLoading ? (
              <div className="flex flex-col items-center gap-2.5 mb-3">
                <div className="h-12 w-28 bg-white/8 rounded-xl animate-pulse" />
                <div className="h-3.5 w-24 bg-white/5 rounded-lg animate-pulse" />
              </div>
            ) : (
              <>
                <div className="text-5xl font-black text-white mb-1 tracking-tight tabular-nums">
                  {counts.users.toLocaleString()}
                  <span className="text-cyber-teal">+</span>
                </div>
                <p className="text-white font-semibold text-sm mb-1">Active Users</p>
              </>
            )}
            <p className="text-cyber-dim text-xs font-arabic">مستخدم نشط</p>
          </div>

          {/* Partner Companies */}
          <div className="group bg-white/5 border border-white/10 rounded-3xl p-8 text-center hover:border-cyber-cyan/25 hover:bg-cyber-cyan/4 transition-all duration-300 shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:shadow-[0_4px_32px_rgba(18,178,193,0.12)]">
            <div className="w-12 h-12 bg-cyber-cyan/15 border border-cyber-cyan/20 rounded-2xl flex items-center justify-center mx-auto mb-5 group-hover:scale-110 group-hover:shadow-[0_0_18px_rgba(18,178,193,0.3)] transition-all">
              <Globe className="w-5 h-5 text-cyber-cyan" />
            </div>
            <div className="text-5xl font-black text-white mb-1 tracking-tight tabular-nums">
              {counts.companies.toLocaleString()}
              <span className="text-cyber-cyan">+</span>
            </div>
            <p className="text-white font-semibold text-sm mb-1">Partner Companies</p>
            <p className="text-cyber-dim text-xs font-arabic">شركة شريكة</p>
          </div>

        </div>
      </section>

      {/* ══════════════════ CORE SERVICES ══════════════════ */}
      <section className="relative z-10 w-full max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-3 text-cyber-dim text-[10px] font-black uppercase tracking-[0.3em] mb-3">
            <div className="w-8 h-px bg-gradient-to-r from-transparent to-cyber-border" />
            What We Do
            <div className="w-8 h-px bg-gradient-to-l from-transparent to-cyber-border" />
          </div>
          <h2 className="text-3xl lg:text-4xl font-black text-white tracking-tight">
            Core Services
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyber-teal to-cyber-cyan"> .</span>
          </h2>
          <p className="text-cyber-dim text-sm mt-2">Three powerful tools. One career platform.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* ATS Optimization */}
          <div className="group bg-white/5 border border-white/10 hover:border-cyber-teal/28 rounded-3xl p-8 transition-all duration-300 hover:bg-cyber-teal/4 hover:shadow-[0_8px_36px_rgba(13,138,158,0.12)]">
            <div className="w-12 h-12 bg-cyber-teal/10 border border-cyber-teal/15 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:shadow-[0_0_22px_rgba(13,138,158,0.28)] transition-all">
              <ShieldCheck className="w-6 h-6 text-cyber-cyan" strokeWidth={1.5} />
            </div>
            <h3 className="text-[17px] font-black text-white mb-1 tracking-tight">ATS Optimization</h3>
            <h4 className="text-xs font-bold text-cyber-cyan mb-3 opacity-80 font-arabic">التوافق مع أنظمة الفرز</h4>
            <p className="text-cyber-muted text-sm leading-relaxed mb-4 font-arabic">
              نبني سيرتك الذاتية لتتجاوز فلاتر الفرز الآلي، مضموناً وصول ملفك لمتخذي القرار.
            </p>
            <p className="text-cyber-cyan/65 text-[11px] font-semibold">
              ✓ Guarantees your file reaches hiring managers
            </p>
          </div>

          {/* AI Skill Analysis */}
          <div className="group bg-white/5 border border-white/10 hover:border-cyber-teal/28 rounded-3xl p-8 transition-all duration-300 hover:bg-cyber-teal/4 hover:shadow-[0_8px_36px_rgba(13,138,158,0.12)]">
            <div className="w-12 h-12 bg-cyber-teal/10 border border-cyber-teal/15 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:shadow-[0_0_22px_rgba(13,138,158,0.28)] transition-all">
              <BrainCircuit className="w-6 h-6 text-cyber-teal" strokeWidth={1.5} />
            </div>
            <h3 className="text-[17px] font-black text-white mb-1 tracking-tight">AI Skill Analysis</h3>
            <h4 className="text-xs font-bold text-cyber-teal mb-3 opacity-80 font-arabic">التحليل الذكي للمهارات</h4>
            <p className="text-cyber-muted text-sm leading-relaxed mb-4 font-arabic">
              نظامنا يحلل مسارك المهني ويطابقه مع سوق العمل لاستخراج أفضل الكلمات المفتاحية.
            </p>
            <p className="text-cyber-teal/65 text-[11px] font-semibold">
              ✓ Matched against live job market data
            </p>
          </div>

          {/* Direct Career Links */}
          <div className="group bg-white/5 border border-white/10 hover:border-cyber-cyan/28 rounded-3xl p-8 transition-all duration-300 hover:bg-cyber-cyan/4 hover:shadow-[0_8px_36px_rgba(18,178,193,0.12)]">
            <div className="w-12 h-12 bg-cyber-cyan/10 border border-cyber-cyan/15 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:shadow-[0_0_22px_rgba(18,178,193,0.28)] transition-all">
              <Network className="w-6 h-6 text-cyber-cyan" strokeWidth={1.5} />
            </div>
            <h3 className="text-[17px] font-black text-white mb-1 tracking-tight">Direct Career Links</h3>
            <h4 className="text-xs font-bold text-cyber-cyan mb-3 opacity-80 font-arabic">الوصول لشبكة التوظيف</h4>
            <p className="text-cyber-muted text-sm leading-relaxed mb-4 font-arabic">
              مئات الروابط المباشرة لكبرى الشركات الإقليمية والعالمية في قاعدة بيانات مرتّبة.
            </p>
            <p className="text-cyber-cyan/65 text-[11px] font-semibold">
              ✓ Updated weekly with new opportunities
            </p>
          </div>

        </div>
      </section>

      {/* ══════════════════ ABOUT US ══════════════════ */}
      <section className="relative z-10 w-full max-w-5xl mx-auto px-6 py-16 pb-24">
        <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-10 lg:p-14 relative overflow-hidden">
          {/* Inner glows */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-cyber-teal/7 rounded-full blur-[90px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-cyber-teal/7 rounded-full blur-[90px] pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row items-center gap-12 lg:gap-16">

            {/* Text */}
            <div className="flex-1 text-center lg:text-right">
              <div className="inline-flex items-center gap-3 text-cyber-cyan text-[10px] font-black uppercase tracking-[0.3em] mb-4">
                <div className="w-6 h-px bg-cyber-teal/50" />
                About Us
                <div className="w-6 h-px bg-cyber-teal/50" />
              </div>
              <h2 className="text-3xl lg:text-4xl font-black text-white mb-5 tracking-tight leading-[1.1]">
                Bridging{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyber-cyan to-cyber-teal">
                  AI Intelligence
                </span>{" "}
                with Human Talent
              </h2>
              <p className="text-cyber-muted text-sm leading-relaxed mb-5 font-arabic">
                في Resumation.co، نؤمن بأن كل موهبة تستحق فرصة حقيقية. مهمتنا سد الفجوة بين الذكاء الاصطناعي والكفاءة
                البشرية — نحوّل خبراتك إلى سيرة ذاتية تُقرأ وتُقدَّر.
              </p>
              <p className="text-cyber-dim text-sm leading-relaxed">
                We built Resumation.co to level the playing field for talent across the MENA region. Our AI-driven
                platform transforms your professional history into a perfectly optimized resume.
              </p>

              {/* Value pillars */}
              <div className="grid grid-cols-2 gap-3 mt-8">
                <div className="bg-cyber-teal/10 border border-cyber-teal/15 hover:border-cyber-teal/30 rounded-2xl p-4 flex items-center gap-3 transition-colors">
                  <Target      className="w-4 h-4 text-cyber-cyan flex-shrink-0" />
                  <span className="text-[11px] font-black text-white uppercase tracking-wider">Precision</span>
                </div>
                <div className="bg-cyber-teal/10 border border-cyber-teal/15 hover:border-cyber-teal/30 rounded-2xl p-4 flex items-center gap-3 transition-colors">
                  <TrendingUp  className="w-4 h-4 text-cyber-teal flex-shrink-0" />
                  <span className="text-[11px] font-black text-white uppercase tracking-wider">Growth</span>
                </div>
                <div className="bg-cyber-cyan/10 border border-cyber-cyan/15 hover:border-cyber-cyan/30 rounded-2xl p-4 flex items-center gap-3 transition-colors">
                  <Zap         className="w-4 h-4 text-cyber-cyan flex-shrink-0" />
                  <span className="text-[11px] font-black text-white uppercase tracking-wider">Speed</span>
                </div>
                <div className="bg-cyber-teal/10 border border-cyber-teal/15 hover:border-cyber-teal/30 rounded-2xl p-4 flex items-center gap-3 transition-colors">
                  <ShieldCheck className="w-4 h-4 text-cyber-teal flex-shrink-0" />
                  <span className="text-[11px] font-black text-white uppercase tracking-wider">Trust</span>
                </div>
              </div>
            </div>

            {/* Mission SVG — network visual */}
            <div className="flex-shrink-0 w-full lg:w-[240px]">
              <svg viewBox="0 0 240 220" className="w-full opacity-90" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Outer dashed ring */}
                <circle cx="120" cy="110" r="88" stroke="#0D8A9E" strokeWidth="1" strokeDasharray="5 5" opacity="0.28" />

                {/* Middle ring */}
                <circle cx="120" cy="110" r="58" fill="#0D8A9E" opacity="0.06" />
                <circle cx="120" cy="110" r="58" stroke="#0A7890" strokeWidth="1" opacity="0.18" />

                {/* Center hub */}
                <circle cx="120" cy="110" r="28" fill="#0D8A9E" opacity="0.12" />
                <circle cx="120" cy="110" r="28" stroke="#0D8A9E" strokeWidth="1.5" opacity="0.35" />

                {/* Center icon lines */}
                <path d="M111 104 Q116 99 120 104 Q124 109 120 114 Q116 119 111 114 Q106 109 111 104Z"
                  stroke="#4DD4E0" strokeWidth="1.5" fill="none" />
                <path d="M120 104 L120 99 M120 119 L120 124 M112 110 L107 110 M128 110 L133 110"
                  stroke="#4DD4E0" strokeWidth="1.5" strokeLinecap="round" />

                {/* ── People nodes ── */}
                <circle cx="120" cy="20"  r="13" fill="#162A2E" stroke="#0D8A9E" strokeWidth="1.5" />
                <circle cx="120" cy="16"  r="5"  fill="#fde8c8" />
                <rect   x="114" y="22"   width="12" height="9" rx="3" fill="#0E96A8" />

                <circle cx="196" cy="65"  r="13" fill="#162A2E" stroke="#0A7890" strokeWidth="1.5" />
                <circle cx="196" cy="61"  r="5"  fill="#fde8c8" />
                <rect   x="190" y="67"   width="12" height="9" rx="3" fill="#0D8A9E" />

                <circle cx="168" cy="182" r="13" fill="#162A2E" stroke="#12B2C1" strokeWidth="1.5" />
                <circle cx="168" cy="178" r="5"  fill="#fde8c8" />
                <rect   x="162" y="184"  width="12" height="9" rx="3" fill="#0A7890" />

                <circle cx="72"  cy="182" r="13" fill="#162A2E" stroke="#0A7890" strokeWidth="1.5" />
                <circle cx="72"  cy="178" r="5"  fill="#fde8c8" />
                <rect   x="66"  y="184"  width="12" height="9" rx="3" fill="#0D8A9E" />

                <circle cx="44"  cy="65"  r="13" fill="#162A2E" stroke="#0D8A9E" strokeWidth="1.5" />
                <circle cx="44"  cy="61"  r="5"  fill="#fde8c8" />
                <rect   x="38"  y="67"   width="12" height="9" rx="3" fill="#0E96A8" />

                {/* Connector lines */}
                <line x1="120" y1="33"  x2="120" y2="82"  stroke="#0D8A9E" strokeWidth="1" strokeDasharray="3 3" opacity="0.45" />
                <line x1="184" y1="72"  x2="170" y2="96"  stroke="#0A7890" strokeWidth="1" strokeDasharray="3 3" opacity="0.45" />
                <line x1="160" y1="171" x2="148" y2="132" stroke="#12B2C1" strokeWidth="1" strokeDasharray="3 3" opacity="0.45" />
                <line x1="80"  y1="171" x2="96"  y2="130" stroke="#0A7890" strokeWidth="1" strokeDasharray="3 3" opacity="0.45" />
                <line x1="56"  y1="72"  x2="93"  y2="98"  stroke="#0D8A9E" strokeWidth="1" strokeDasharray="3 3" opacity="0.45" />

                {/* Accent dots */}
                <circle cx="148" cy="50"  r="2" fill="#4DD4E0" opacity="0.6" />
                <circle cx="200" cy="120" r="2" fill="#0D8A9E" opacity="0.5" />
                <circle cx="150" cy="195" r="2" fill="#12B2C1" opacity="0.6" />
                <circle cx="42"  cy="130" r="2" fill="#4DD4E0" opacity="0.5" />
                <circle cx="92"  cy="40"  r="1.5" fill="#0D8A9E" opacity="0.7" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 w-full text-center py-8 text-cyber-dim text-xs font-mono border-t border-white/5">
        © 2026 Resumation.co — All Rights Reserved • Powered by AI
      </footer>
    </div>
  );
}

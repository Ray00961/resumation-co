/**
 * PricingDescription — Public pricing page at /pricing
 *
 * Fully aligned with the platform design-token system:
 *   Background     #0D1117   (cyber-bg)
 *   Sapphire glass rgba(60,80,125,...)
 *   Cyan accent    #12B2C1
 *   Gold accent    #E0C58F
 *   Sapphire-lt    #566C9E
 *
 * Plans (2026 pricing):
 *   Premium  — $25 / 250 EGP  · CV + Cover Letter + 50 Coins
 *   Gold     — $40 / 400 EGP  · CV + Cover Letter + 100 Coins
 *   AI Hunter— $10 / 100 EGP  · 100 Coins (200 with referral)
 *
 * Coin economy:
 *   1 Coin  = AI Job Search
 *   3 Coins = Rewrite CV & Cover Letter
 *   6 Coins = JD Analysis + Full Rewrite
 */

import { useState, useEffect } from "react";
import {
  ShieldCheck, Crown, Zap, Check, Sparkles,
  Globe, Search, PenLine, BrainCircuit,
} from "lucide-react";
import Cookies from "js-cookie";
import { detectRegion } from "../utils/detectRegion";
import { useLang } from "../context/LanguageContext";

export default function PricingDescription() {
  const { lang, isRtl } = useLang();
  const [userRegion, setUserRegion] = useState<string>(Cookies.get("user_region") || "LB");
  const isEgypt = userRegion === "EG";

  useEffect(() => { detectRegion().then(r => setUserRegion(r)); }, []);

  const cur = isEgypt ? "EGP" : "USD";
  const sym = isEgypt ? "" : "$";

  /* ── Plan definitions ─────────────────────────────────────────────── */
  const plans = [
    {
      id: "premium",
      pill:  lang === "ar" ? "الأكثر طلباً"   : "Most Popular",
      name:  lang === "ar" ? "بريميوم"          : "Premium",
      sub:   lang === "ar" ? "بناء سيرة ذاتية متكاملة" : "Complete ATS Resume Build",
      price: isEgypt ? 250 : 25,
      features: lang === "ar"
        ? ["سيرة ذاتية محسّنة للـ ATS", "رسالة تغطية مشمولة", "50 كوين", "تصدير PDF + DOCX"]
        : ["Full ATS-optimized CV", "Cover Letter included", "50 Coins", "PDF + DOCX export"],
      Icon:       ShieldCheck,
      accent:     "#12B2C1",
      accentBg:   "rgba(18,178,193,0.08)",
      accentBdr:  "rgba(18,178,193,0.22)",
      isPopular:  true,
    },
    {
      id: "gold",
      pill:  lang === "ar" ? "الحزمة الكاملة" : "Full Suite",
      name:  lang === "ar" ? "باقة الذهب"     : "Gold",
      sub:   lang === "ar" ? "مجموعة تقديم متكاملة" : "Complete Application Suite",
      price: isEgypt ? 400 : 40,
      features: lang === "ar"
        ? ["كل مميزات بريميوم", "100 كوين", "روابط مباشرة لأصحاب العمل", "معالجة ذات أولوية"]
        : ["Everything in Premium", "100 Coins", "Direct employer links", "Priority processing"],
      Icon:       Crown,
      accent:     "#E0C58F",
      accentBg:   "rgba(224,197,143,0.08)",
      accentBdr:  "rgba(224,197,143,0.2)",
      isPopular:  false,
    },
    {
      id: "ai_hunter",
      pill:  lang === "ar" ? "شحن رصيد"      : "Coin Top-up",
      name:  "AI Hunter",
      sub:   lang === "ar" ? "كوينز فقط · بدون بناء CV" : "Coins only · No CV build",
      price: isEgypt ? 100 : 10,
      features: lang === "ar"
        ? ["100 كوين (200 مع إحالة)", "بحث وظيفي بالذكاء الاصطناعي", "إعادة كتابة CV والغلاف", "تحليل وصف الوظيفة"]
        : ["100 Coins (200 with referral)", "AI job search", "CV & Cover Letter rewrite", "JD analysis"],
      Icon:       Zap,
      accent:     "#566C9E",
      accentBg:   "rgba(86,108,158,0.08)",
      accentBdr:  "rgba(86,108,158,0.22)",
      isPopular:  false,
    },
  ];

  /* ── Coin economy rows ────────────────────────────────────────────── */
  const coinRows = lang === "ar"
    ? [
        { Icon: Search,      cost: "1 كوين",  action: "بحث وظيفي بالذكاء الاصطناعي",     desc: "يعيد وظيفتين متوافقتين مع نقاط التطابق" },
        { Icon: PenLine,     cost: "3 كوينز", action: "إعادة كتابة السيرة ورسالة التغطية", desc: "إعادة كتابة كاملة تتوافق مع دورك المستهدف" },
        { Icon: BrainCircuit,cost: "6 كوينز", action: "تحليل JD + إعادة كتابة CV والغلاف",desc: "الصق أي وصف وظيفي خارجي — يعيد الذكاء الاصطناعي كتابة سيرتك ورسالة التغطية وفقاً له" },
      ]
    : [
        { Icon: Search,      cost: "1 Coin",  action: "AI Job Search",              desc: "Returns 2 matching jobs + a compatibility Match Score" },
        { Icon: PenLine,     cost: "3 Coins", action: "Rewrite CV & Cover Letter",  desc: "Full AI rewrite of your CV and Cover Letter aligned to your target role" },
        { Icon: BrainCircuit,cost: "6 Coins", action: "JD Analysis + Full Rewrite", desc: "Paste any external job description — AI rewrites your CV & Cover Letter to match it perfectly" },
      ];

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <div
      className="min-h-screen bg-[#0D1117] text-[#D9CBC2] relative overflow-x-hidden"
      dir={isRtl ? "rtl" : "ltr"}
      style={{ fontFamily: isRtl ? "'Tajawal', sans-serif" : "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* ── Ambient glows ─────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[700px] h-[700px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(18,178,193,0.07) 0%, transparent 70%)" }} />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(86,108,158,0.08) 0%, transparent 70%)" }} />
        <div className="absolute top-[40%] left-[30%] w-[400px] h-[400px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(224,197,143,0.04) 0%, transparent 70%)" }} />
      </div>
      {/* ── Dot grid ──────────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none z-0"
        style={{ backgroundImage: "radial-gradient(rgba(18,178,193,0.035) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

      <div className="relative z-10 max-w-5xl mx-auto px-6 lg:px-12 py-20 text-center">

        {/* ── Page header ─────────────────────────────────────────── */}
        <div className="text-center mb-16">

          {/* Region pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[rgba(18,178,193,0.18)] bg-[rgba(18,178,193,0.05)] backdrop-blur-md mb-5">
            <Globe className="w-3 h-3 text-[rgba(18,178,193,0.7)]" />
            <span className="text-[10px] font-black text-[rgba(18,178,193,0.7)] uppercase tracking-[0.25em]">
              {isEgypt ? "🇪🇬 Egypt — Paymob · EGP" : "🇱🇧 Lebanon — Whish Money · USD"}
            </span>
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-[rgba(60,80,125,0.15)] border border-[rgba(60,80,125,0.25)] text-[#F5F0E9] px-4 py-1.5 rounded-full text-xs font-medium tracking-wide mb-6 backdrop-blur-md">
            <Sparkles strokeWidth={1.5} className="w-3.5 h-3.5 text-[#E0C58F] flex-shrink-0" />
            <span>{lang === "ar" ? "خطط التسعير" : "Career Plans"}</span>
          </div>

          <h1 className="text-5xl lg:text-6xl font-black text-white tracking-tight leading-none mb-4">
            {lang === "ar" ? "اختر " : "Choose Your "}
            <span style={{
              background: "linear-gradient(135deg, rgba(18,178,193,1) 0%, rgba(86,158,193,1) 50%, rgba(224,197,143,0.9) 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              {lang === "ar" ? "خطتك المهنية" : "Career Plan"}
            </span>
          </h1>
          <p className="text-[#e1ebed] text-sm font-medium max-w-md mx-auto leading-relaxed">
            {lang === "ar"
              ? "دفعة واحدة · تسليم فوري · بدون اشتراكات"
              : "One-time payment · Instant delivery · No subscriptions"}
          </p>
        </div>

        {/* ── Plan cards ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-center mb-20">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`group relative rounded-3xl flex flex-col transition-all duration-500 ${
                plan.isPopular
                  ? "md:-translate-y-5"
                  : ""
              }`}
              style={{
                background:    plan.isPopular ? "rgba(10,18,28,0.85)" : "rgba(13,17,23,0.70)",
                backdropFilter: "blur(32px)",
                border:        plan.isPopular
                  ? "1.5px solid rgba(18,178,193,0.40)"
                  : "1px solid rgba(60,80,125,0.25)",
                boxShadow: plan.isPopular
                  ? "0 0 80px rgba(18,178,193,0.15), 0 0 160px rgba(18,178,193,0.07)"
                  : "0 4px 24px rgba(0,0,0,0.35)",
              }}
            >
              {/* Popular badge */}
              {plan.isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                  <div
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-white whitespace-nowrap"
                    style={{ background: "linear-gradient(135deg,#12B2C1,#0E8F9C)", boxShadow: "0 4px 20px rgba(18,178,193,0.4)" }}
                  >
                    <Sparkles className="w-2.5 h-2.5" /> {plan.pill}
                  </div>
                </div>
              )}

              {/* Top accent line */}
              <div
                className="h-[2px] w-full"
                style={{ background: `linear-gradient(90deg,transparent,${plan.accent},transparent)` }}
              />

              <div className="p-7 flex flex-col flex-1">
                {/* Icon */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-5 transition-transform duration-200 group-hover:scale-105"
                  style={{ background: plan.accentBg, border: `1px solid ${plan.accentBdr}` }}
                >
                  <plan.Icon className="w-5 h-5" style={{ color: plan.accent }} strokeWidth={1.75} />
                </div>

                {/* Labels */}
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1"
                  style={{ color: plan.isPopular ? "rgba(18,178,193,0.6)" : `${plan.accent}70` }}
                >
                  {plan.pill}
                </p>
                <h3 className="text-xl font-black text-white mb-1 tracking-tight">{plan.name}</h3>
                <p className="text-[12px] text-[#7A8FAA] mb-6">{plan.sub}</p>

                {/* Price */}
                <div className="mb-6 flex items-baseline gap-1.5">
                  <span
                    className="text-4xl font-black leading-none"
                    style={plan.id === "gold"
                      ? { background: "linear-gradient(135deg,#E0C58F,#c9a85c)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }
                      : { color: "#F5F0E9" }
                    }
                  >
                    {sym}{plan.price}
                  </span>
                  <div className="flex flex-col leading-tight">
                    <span className="text-xs font-bold" style={{ color: `${plan.accent}90` }}>{cur}</span>
                    <span className="text-[10px] text-[#7A8FAA]">
                      {lang === "ar" ? "دفعة واحدة" : "one-time"}
                    </span>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-[13px] text-[#A8B4CC]">
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: plan.accentBg, border: `1px solid ${plan.accentBdr}` }}
                      >
                        <Check className="w-2.5 h-2.5" style={{ color: plan.accent }} />
                      </div>
                      {f}
                    </li>
                  ))}
                </ul>

              </div>
            </div>
          ))}
        </div>

        {/* ── Coin Economy Section ─────────────────────────────────── */}
        <div className="border-t border-[rgba(60,80,125,0.18)] pt-16">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/20 bg-amber-500/5 mb-5">
              <Zap className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-[0.25em]">Coin Economy</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight mb-3">
              {lang === "ar" ? "كيف تعمل الكوينز" : "How Coins Work"}
            </h2>
            <p className="text-[#A8B4CC] text-sm font-light max-w-md mx-auto leading-relaxed">
              {lang === "ar"
                ? "كل إجراء بالذكاء الاصطناعي يستهلك كوينز. اشترِ مرة واستخدمها متى شئت."
                : "Every AI-powered action costs Coins. Buy once, use whenever you need."}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {coinRows.map((row, i) => (
              <div
                key={i}
                className="group relative rounded-xl p-6 overflow-hidden transition-all duration-300 hover:-translate-y-0.5"
                style={{
                  background:    "rgba(60,80,125,0.08)",
                  border:        "1px solid rgba(60,80,125,0.22)",
                  backdropFilter:"blur(20px)",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(18,178,193,0.3)"; (e.currentTarget as HTMLDivElement).style.background = "rgba(60,80,125,0.12)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(60,80,125,0.22)"; (e.currentTarget as HTMLDivElement).style.background = "rgba(60,80,125,0.08)"; }}
              >
                {/* Top accent on hover */}
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[rgba(18,178,193,0.5)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="flex items-center justify-between mb-5">
                  {/* Cost badge */}
                  <div
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg"
                    style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}
                  >
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span className="text-[11px] font-black text-amber-400 uppercase tracking-wider">{row.cost}</span>
                  </div>
                  {/* Action icon */}
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(18,178,193,0.06)", border: "1px solid rgba(18,178,193,0.12)", color: "rgba(18,178,193,0.6)" }}
                  >
                    <row.Icon className="w-4 h-4" strokeWidth={1.75} />
                  </div>
                </div>

                <h3 className="text-[14px] font-bold text-[#F5F0E9] mb-2 leading-snug">{row.action}</h3>
                <p className="text-[12px] text-[#7A8FAA] leading-relaxed">{row.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Trust bar ───────────────────────────────────────────── */}
        <div className="mt-14 pt-8 border-t border-[rgba(60,80,125,0.15)] flex flex-wrap justify-center items-center gap-5 text-xs text-[#7A8FAA]">
          {[
            { Icon: ShieldCheck, label: lang === "ar" ? "دفع آمن"     : "Secure Checkout"     },
            { Icon: Zap,         label: lang === "ar" ? "تفعيل فوري"  : "Instant Activation"  },
            { Icon: Globe,       label: lang === "ar" ? "دفعة واحدة"  : "One-time Payment"    },
          ].map(({ Icon, label }, i) => (
            <div key={label} className="flex items-center gap-4">
              {i > 0 && <div className="w-px h-3 bg-[rgba(60,80,125,0.25)]" />}
              <div className="flex items-center gap-2">
                <Icon className="w-3.5 h-3.5 text-[rgba(60,80,125,0.5)]" />
                <span className="font-medium uppercase tracking-widest text-[10px]">{label}</span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

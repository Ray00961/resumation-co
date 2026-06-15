import { Fragment, useEffect, useState } from "react";
import {
  Copy,
  Check,
  Share2,
  MessageCircle,
  Zap,
  Crown,
  Gift,
} from "lucide-react";
import { useLang } from "../context/LanguageContext";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PromoCodeBannerProps {
  promoCode: string;
  promoExpiresAt: string; // ISO timestamp from DB
  isFounder: boolean;
  variant?: "banner" | "compact";
  className?: string;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: calculate remaining time
// ─────────────────────────────────────────────────────────────────────────────

function calcTimeLeft(expiryIso: string): TimeLeft | null {
  const diff = new Date(expiryIso).getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1_000),
    totalMs: diff,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function PromoCodeBanner({
  promoCode,
  promoExpiresAt,
  isFounder,
  variant = "banner",
  className = "",
}: PromoCodeBannerProps) {
  const { lang, isRtl } = useLang();

  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(() =>
    calcTimeLeft(promoExpiresAt),
  );
  const [copied, setCopied] = useState(false);

  // Live countdown — ticks every second
  useEffect(() => {
    const tick = () => setTimeLeft(calcTimeLeft(promoExpiresAt));
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [promoExpiresAt]);

  // Don't render if code has expired
  if (!timeLeft) return null;

  // ── Urgency thresholds ──
  const isUrgent = timeLeft.totalMs < 24 * 3_600_000; // < 24 h
  const isWarning = timeLeft.totalMs < 48 * 3_600_000; // < 48 h

  const urgency = isUrgent
    ? {
        text: "#f87171",
        border: "rgba(248,113,113,0.35)",
        glow: "rgba(248,113,113,0.08)",
        pulse: true,
      }
    : isWarning
      ? {
          text: "#fbbf24",
          border: "rgba(251,191,36,0.30)",
          glow: "rgba(251,191,36,0.07)",
          pulse: false,
        }
      : {
          text: "#E0C58F",
          border: "rgba(224,197,143,0.25)",
          glow: "rgba(224,197,143,0.06)",
          pulse: false,
        };

  // ── Share text ──
  const siteUrl = window.location.origin;
  const shareText =
    lang === "ar"
      ? `احصل على خصم 50% على سيرتك الذاتية المبنية بالذكاء الاصطناعي!\nكود الإحالة: ${promoCode}\n${siteUrl}`
      : `Get 50% off your AI-powered CV! Use my referral code: ${promoCode}\n${siteUrl}`;

  // ── Handlers ──
  const handleCopy = () => {
    navigator.clipboard.writeText(promoCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2_000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Resumation.co — 50% Off",
          text: shareText,
          url: siteUrl,
        });
        return;
      } catch {}
    }
    // Fallback → WhatsApp web
    window.open(
      `https://wa.me/?text=${encodeURIComponent(shareText)}`,
      "_blank",
    );
  };

  const handleWhatsApp = () =>
    window.open(
      `https://wa.me/?text=${encodeURIComponent(shareText)}`,
      "_blank",
    );

  // ── Translations ──
  const t = {
    en: {
      title: "Your Referral Code",
      copy: "Copy",
      copied: "Copied!",
      expiresIn: "Expires in",
      days: "d",
      hours: "h",
      mins: "m",
      secs: "s",
      shareBtn: "Share",
      whatsapp: "WhatsApp",
      rewardTitle: isFounder
        ? "Earn up to +75 Coins per friend!"
        : "Earn up to +50 Coins per friend!",
      rewardRows: isFounder
        ? [
            { plan: "AI Search Pack", coins: "+8 Coins" },
            { plan: "Premium", coins: "+15 Coins" },
            { plan: "Gold Package", coins: "+30 Coins" },
          ]
        : [
            { plan: "AI Search Pack", coins: "+5 Coins" },
            { plan: "Premium", coins: "+10 Coins" },
            { plan: "Gold Package", coins: "+20 Coins" },
          ],
      founderNote: "Founder 1.5× bonus applied to every referral reward.",
      urgentMsg: "Your code expires soon — share it now!",
      compactText: "Share your code and earn coins when friends upgrade.",
    },
    ar: {
      title: "كود الإحالة الخاص بك",
      copy: "نسخ",
      copied: "تم النسخ!",
      expiresIn: "ينتهي خلال",
      days: "ي",
      hours: "س",
      mins: "د",
      secs: "ث",
      shareBtn: "مشاركة",
      whatsapp: "واتساب",
      rewardTitle: isFounder
        ? "اربح حتى +75 كوين عن كل صديق!"
        : "اربح حتى +50 كوين عن كل صديق!",
      rewardRows: isFounder
        ? [
            { plan: "AI Search Pack", coins: "+8 كوين" },
            { plan: "بريميوم", coins: "+15 كوين" },
            { plan: "باقة الذهب", coins: "+30 كوين" },
          ]
        : [
            { plan: "AI Search Pack", coins: "+5 كوين" },
            { plan: "بريميوم", coins: "+10 كوين" },
            { plan: "باقة الذهب", coins: "+20 كوين" },
          ],
      founderNote: "مكافأة المؤسس 1.5× تُطبَّق على كل مكافأة إحالة.",
      urgentMsg: "كودك على وشك الانتهاء — شاركه الآن!",
      compactText: "شارك كودك واربح كوينز عندما يقوم أصدقاؤك بالترقية.",
    },
  }[lang];

  const countdownUnits = [
    { value: timeLeft.days, label: t.days },
    { value: timeLeft.hours, label: t.hours },
    { value: timeLeft.minutes, label: t.mins },
    { value: timeLeft.seconds, label: t.secs },
  ];

  if (variant === "compact") {
    return (
      <div
        dir={isRtl ? "rtl" : "ltr"}
        style={{
          fontFamily: isRtl
            ? "'Tajawal', sans-serif"
            : "'Plus Jakarta Sans', sans-serif",
        }}
        className={`relative overflow-hidden rounded-2xl p-4 ${className}`}
      >
        <div
          className="absolute inset-0 pointer-events-none rounded-2xl"
          style={{
            boxShadow: `0 0 35px ${urgency.glow}, 0 0 0 1px ${urgency.border}`,
          }}
        />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: urgency.glow,
                  border: `1px solid ${urgency.border}`,
                }}
              >
                <Gift className="w-4 h-4" style={{ color: urgency.text }} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#A8B4CC]">
                {t.title}
              </span>
              {isFounder && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest"
                  style={{
                    background: "rgba(224,197,143,0.10)",
                    border: "1px solid rgba(224,197,143,0.25)",
                    color: "#E0C58F",
                  }}
                >
                  <Crown className="w-3 h-3" /> Founder
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-xl font-black tracking-[0.25em] font-mono ${urgency.pulse ? "animate-pulse" : ""}`}
                style={{
                  color: urgency.text,
                  textShadow: `0 0 18px ${urgency.glow}`,
                }}
              >
                {promoCode}
              </span>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                style={{
                  background: copied
                    ? "rgba(16,185,129,0.12)"
                    : "rgba(224,197,143,0.07)",
                  border: `1px solid ${copied ? "rgba(16,185,129,0.3)" : "rgba(224,197,143,0.2)"}`,
                  color: copied ? "#10b981" : "#E0C58F",
                }}
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3" /> {t.copied}
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" /> {t.copy}
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-[#7A8FAA] mt-2 leading-relaxed">
              {t.compactText}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div
              className="px-3 py-2 rounded-xl"
              style={{
                background: "rgba(255,255,255,0.025)",
                border: `1px solid ${urgency.border}`,
              }}
            >
              <p className="text-[9px] font-black uppercase tracking-widest text-[#A8B4CC] mb-1">
                {t.expiresIn}
              </p>
              <p
                className="text-[12px] font-black tabular-nums"
                style={{ color: urgency.text }}
              >
                {timeLeft.days}
                {t.days} {String(timeLeft.hours).padStart(2, "0")}
                {t.hours}
              </p>
            </div>
            <button
              onClick={handleWhatsApp}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all"
              style={{
                background: "rgba(37,211,102,0.07)",
                border: "1px solid rgba(37,211,102,0.25)",
                color: "rgba(37,211,102,0.9)",
              }}
            >
              <MessageCircle className="w-3.5 h-3.5" /> {t.whatsapp}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────
  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      style={{
        fontFamily: isRtl
          ? "'Tajawal', sans-serif"
          : "'Plus Jakarta Sans', sans-serif",
      }}
      className={`relative rounded-[2rem] mb-8 overflow-hidden ${className}`}
    >
      {/* Outer glow ring */}
      <div
        className="absolute inset-0 rounded-[2rem] pointer-events-none"
        style={{
          boxShadow: `0 0 60px ${urgency.glow}, 0 0 0 1px ${urgency.border}`,
        }}
      />

      {/* Card body */}
      <div
        className="relative rounded-[2rem] p-7 lg:p-8"
        style={{
          background: "rgba(13,17,23,0.92)",
          backdropFilter: "blur(32px)",
          border: `1px solid ${urgency.border}`,
        }}
      >
        {/* Top gradient line */}
        <div
          className="absolute top-0 left-8 right-8 h-[1px]"
          style={{
            background: `linear-gradient(90deg, transparent, ${urgency.text}, transparent)`,
            opacity: 0.6,
          }}
        />

        {/* ── Content grid ── */}
        <div className="flex flex-col xl:flex-row xl:items-center gap-8">
          {/* ── Column 1: Code + Copy ── */}
          <div className="flex-1 min-w-0">
            {/* Header row */}
            <div className="flex items-center gap-2.5 mb-4 flex-wrap">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: `${urgency.glow}`,
                  border: `1px solid ${urgency.border}`,
                }}
              >
                <Gift className="w-4 h-4" style={{ color: urgency.text }} />
              </div>
              {isFounder && (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest"
                  style={{
                    background: "rgba(224,197,143,0.10)",
                    border: "1px solid rgba(224,197,143,0.25)",
                    color: "#E0C58F",
                  }}
                >
                  <Crown className="w-3 h-3" /> Founder
                </span>
              )}
              <span className="text-[11px] font-black uppercase tracking-[0.25em] text-[#A8B4CC]">
                {t.title}
              </span>
            </div>

            {/* Code + Copy button */}
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className={`text-2xl lg:text-3xl font-black tracking-[0.35em] font-mono ${urgency.pulse ? "animate-pulse" : ""}`}
                style={{
                  color: urgency.text,
                  textShadow: `0 0 24px ${urgency.glow}`,
                }}
              >
                {promoCode}
              </span>

              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all duration-300 flex-shrink-0"
                style={{
                  background: copied
                    ? "rgba(16,185,129,0.12)"
                    : "rgba(224,197,143,0.07)",
                  border: `1px solid ${copied ? "rgba(16,185,129,0.3)" : "rgba(224,197,143,0.2)"}`,
                  color: copied ? "#10b981" : "#E0C58F",
                }}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> {t.copied}
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> {t.copy}
                  </>
                )}
              </button>
            </div>

            {/* Urgent warning */}
            {isUrgent && (
              <p className="text-[11px] font-black text-red-400 mt-3 flex items-center gap-1.5 animate-pulse">
                <Zap className="w-3 h-3" /> {t.urgentMsg}
              </p>
            )}
          </div>

          {/* ── Column 2: Countdown Timer ── */}
          <div className="flex flex-col items-center gap-3 flex-shrink-0">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#A8B4CC]">
              {t.expiresIn}
            </p>

            <div className="flex items-end gap-1.5">
              {countdownUnits.map(({ value, label }, i) => (
                <Fragment key={i}>
                  {i > 0 && (
                    <span
                      className="text-xl font-black mb-5 leading-none"
                      style={{ color: "rgba(255,255,255,0.15)" }}
                    >
                      :
                    </span>
                  )}
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="w-[52px] h-[52px] rounded-2xl flex items-center justify-center"
                      style={{
                        background: isUrgent
                          ? "rgba(248,113,113,0.08)"
                          : isWarning
                            ? "rgba(251,191,36,0.07)"
                            : "rgba(224,197,143,0.06)",
                        border: `1px solid ${urgency.border}`,
                      }}
                    >
                      <span
                        className="text-xl font-black tabular-nums leading-none"
                        style={{ color: urgency.text }}
                      >
                        {String(value).padStart(2, "0")}
                      </span>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#A8B4CC]">
                      {label}
                    </span>
                  </div>
                </Fragment>
              ))}
            </div>
          </div>

          {/* ── Column 3: Share + Rewards ── */}
          <div className="flex flex-col gap-4 flex-shrink-0">
            {/* Share buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleShare}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all hover:scale-[1.03]"
                style={{
                  background: "rgba(18,178,193,0.08)",
                  border: "1px solid rgba(18,178,193,0.25)",
                  color: "rgba(18,178,193,0.9)",
                }}
              >
                <Share2 className="w-3.5 h-3.5" /> {t.shareBtn}
              </button>

              <button
                onClick={handleWhatsApp}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all hover:scale-[1.03]"
                style={{
                  background: "rgba(37,211,102,0.07)",
                  border: "1px solid rgba(37,211,102,0.25)",
                  color: "rgba(37,211,102,0.9)",
                }}
              >
                <MessageCircle className="w-3.5 h-3.5" /> {t.whatsapp}
              </button>
            </div>

            {/* Reward breakdown */}
            <div
              className="rounded-2xl p-4"
              style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <p className="text-[11px] font-black text-white mb-3 flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-amber-400 flex-shrink-0" />
                {t.rewardTitle}
              </p>

              <div className="space-y-1.5">
                {t.rewardRows.map((row) => (
                  <div
                    key={row.plan}
                    className="flex items-center justify-between gap-4"
                  >
                    <span className="text-[11px] text-[#7A8FAA] font-medium">
                      {row.plan}
                    </span>
                    <span className="text-[11px] font-black text-amber-400 flex-shrink-0">
                      {row.coins}
                    </span>
                  </div>
                ))}
              </div>

              {isFounder && (
                <p
                  className="text-[10px] font-medium mt-3 pt-2.5"
                  style={{
                    color: "rgba(224,197,143,0.55)",
                    borderTop: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  {t.founderNote}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

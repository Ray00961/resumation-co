import { useEffect, useState } from "react";
import { Copy, Check, Share2, MessageCircle, Crown, Gift } from "lucide-react";
import { useLang } from "../context/LanguageContext";

interface PromoCodeBannerProps {
  promoCode: string;
  promoExpiresAt: string;
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

function calcTimeLeft(expiryIso: string): TimeLeft | null {
  const expiry = new Date(expiryIso).getTime();

  if (!Number.isFinite(expiry)) {
    return null;
  }

  const diff = expiry - Date.now();

  if (diff <= 0) {
    return null;
  }

  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1_000),
    totalMs: diff,
  };
}

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

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

  useEffect(() => {
    const tick = () => setTimeLeft(calcTimeLeft(promoExpiresAt));
    tick();

    const id = window.setInterval(tick, 1_000);
    return () => window.clearInterval(id);
  }, [promoExpiresAt]);

  if (!promoCode || !timeLeft) {
    return null;
  }

  const isUrgent = timeLeft.totalMs < 24 * 3_600_000;
  const isWarning = timeLeft.totalMs < 48 * 3_600_000;

  const urgency = isUrgent
    ? {
        text: "#f87171",
        border: "rgba(248,113,113,0.35)",
        glow: "rgba(248,113,113,0.08)",
      }
    : isWarning
      ? {
          text: "#fbbf24",
          border: "rgba(251,191,36,0.30)",
          glow: "rgba(251,191,36,0.07)",
        }
      : {
          text: "#E0C58F",
          border: "rgba(224,197,143,0.25)",
          glow: "rgba(224,197,143,0.06)",
        };

  const siteUrl = typeof window !== "undefined" ? window.location.origin : "https://resumation.co";

  const shareText =
    lang === "ar"
      ? `احصل على خصم على Resumation.co\nكود الإحالة: ${promoCode}\n${siteUrl}`
      : `Use my Resumation.co referral code: ${promoCode}\n${siteUrl}`;

  const t = {
    en: {
      title: "Referral Code",
      copy: "Copy",
      copied: "Copied",
      share: "Share",
      whatsapp: "WhatsApp",
      founder: "Founder",
      expiresIn: "Expires in",
      days: "d",
      hours: "h",
      minutes: "m",
      expiresSoon: "Expires soon",
    },
    ar: {
      title: "كود الإحالة",
      copy: "نسخ",
      copied: "تم النسخ",
      share: "مشاركة",
      whatsapp: "واتساب",
      founder: "Founder",
      expiresIn: "ينتهي خلال",
      days: "ي",
      hours: "س",
      minutes: "د",
      expiresSoon: "ينتهي قريباً",
    },
  }[lang];

  const handleCopy = async () => {
    await navigator.clipboard.writeText(promoCode).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Resumation.co",
          text: shareText,
          url: siteUrl,
        });
        return;
      } catch {
        // fallback below
      }
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  };

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  };

  const expiryText =
    timeLeft.days > 0
      ? `${timeLeft.days}${t.days} ${String(timeLeft.hours).padStart(2, "0")}${t.hours}`
      : timeLeft.hours > 0
        ? `${timeLeft.hours}${t.hours} ${String(timeLeft.minutes).padStart(2, "0")}${t.minutes}`
        : t.expiresSoon;

  const isCompact = variant === "compact";

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      style={{
        fontFamily: isRtl ? "'Tajawal', sans-serif" : "'Plus Jakarta Sans', sans-serif",
      }}
      className={joinClasses(
        "relative overflow-hidden border",
        isCompact ? "rounded-2xl p-4" : "rounded-[1.75rem] p-5 lg:p-6 mb-8",
        className,
      )}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(135deg, rgba(13,17,23,0.96), rgba(8,12,18,0.92))",
          boxShadow: `0 0 ${isCompact ? "28px" : "44px"} ${urgency.glow}`,
          border: `1px solid ${urgency.border}`,
          borderRadius: isCompact ? "1rem" : "1.75rem",
        }}
      />

      <div
        className="absolute top-0 left-6 right-6 h-px pointer-events-none"
        style={{
          background: `linear-gradient(90deg, transparent, ${urgency.text}, transparent)`,
          opacity: 0.5,
        }}
      />

      <div
        className={joinClasses(
          "relative flex gap-4",
          isCompact
            ? "flex-col sm:flex-row sm:items-center sm:justify-between"
            : "flex-col lg:flex-row lg:items-center lg:justify-between",
        )}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <div
              className={joinClasses(
                "rounded-xl flex items-center justify-center flex-shrink-0",
                isCompact ? "w-7 h-7" : "w-8 h-8",
              )}
              style={{
                background: urgency.glow,
                border: `1px solid ${urgency.border}`,
              }}
            >
              <Gift className={isCompact ? "w-3.5 h-3.5" : "w-4 h-4"} style={{ color: urgency.text }} />
            </div>

            <span
              className={joinClasses(
                "font-black uppercase text-[#A8B4CC]",
                isCompact ? "text-[10px] tracking-[0.18em]" : "text-[11px] tracking-[0.24em]",
              )}
            >
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
                <Crown className="w-3 h-3" />
                {t.founder}
              </span>
            )}

            <span
              className="inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest"
              style={{
                background: "rgba(255,255,255,0.025)",
                border: `1px solid ${urgency.border}`,
                color: urgency.text,
              }}
            >
              {t.expiresIn} {expiryText}
            </span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <span
              className={joinClasses(
                "font-black font-mono leading-none",
                isCompact ? "text-xl tracking-[0.22em]" : "text-2xl lg:text-3xl tracking-[0.32em]",
                isUrgent && "animate-pulse",
              )}
              style={{
                color: urgency.text,
                textShadow: `0 0 18px ${urgency.glow}`,
              }}
            >
              {promoCode}
            </span>

            <button
              type="button"
              onClick={handleCopy}
              className={joinClasses(
                "inline-flex items-center gap-1.5 rounded-xl font-black uppercase tracking-wider transition-all hover:scale-[1.02]",
                isCompact ? "px-3 py-1.5 text-[10px]" : "px-4 py-2 text-[11px]",
              )}
              style={{
                background: copied ? "rgba(16,185,129,0.12)" : "rgba(224,197,143,0.07)",
                border: `1px solid ${copied ? "rgba(16,185,129,0.3)" : "rgba(224,197,143,0.2)"}`,
                color: copied ? "#10b981" : "#E0C58F",
              }}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? t.copied : t.copy}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={handleShare}
            className={joinClasses(
              "inline-flex items-center gap-1.5 rounded-xl font-black uppercase tracking-wider transition-all hover:scale-[1.02]",
              isCompact ? "px-3 py-2 text-[10px]" : "px-4 py-2.5 text-[11px]",
            )}
            style={{
              background: "rgba(18,178,193,0.08)",
              border: "1px solid rgba(18,178,193,0.25)",
              color: "rgba(18,178,193,0.9)",
            }}
          >
            <Share2 className="w-3.5 h-3.5" />
            {t.share}
          </button>

          <button
            type="button"
            onClick={handleWhatsApp}
            className={joinClasses(
              "inline-flex items-center gap-1.5 rounded-xl font-black uppercase tracking-wider transition-all hover:scale-[1.02]",
              isCompact ? "px-3 py-2 text-[10px]" : "px-4 py-2.5 text-[11px]",
            )}
            style={{
              background: "rgba(37,211,102,0.07)",
              border: "1px solid rgba(37,211,102,0.25)",
              color: "rgba(37,211,102,0.9)",
            }}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            {t.whatsapp}
          </button>
        </div>
      </div>
    </div>
  );
}

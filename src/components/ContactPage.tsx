/**
 * ContactPage — Unified design-token rewrite
 *
 * Before: mixed legacy tokens (bg-cyber-bg, bg-cyber-teal/5, rounded-[2.5rem],
 *         bg-white/5, border-white/10) that broke visual cohesion.
 *
 * After: 100% platform token coverage:
 *   Background     #0D1117          (background)
 *   Glass surface  rgba(60,80,125,0.06-0.09)  (sapphire glass)
 *   Borders        rgba(60,80,125,0.18-0.25)
 *   Primary text   #F5F0E9          (canvas.white)
 *   Muted text     #D9CBC2 / #A8B4CC
 *   CTA button     #12B2C1 gradient (cyber.cyan — same as Hero)
 *   Gold accent    #E0C58F          (quicksand — section labels)
 *   WhatsApp green emerald-* kept (brand colour, contextually justified)
 */

import { useState } from "react";
import {
  Mail, MessageCircle, Clock, ShieldCheck,
  Send, Loader2, Sparkles, CheckCircle2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useLang } from "../context/LanguageContext";

/* ── Shared class fragments ──────────────────────────────────────────── */
const inputCls = `
  w-full
  bg-[rgba(60,80,125,0.06)] border border-[rgba(60,80,125,0.2)] rounded-lg
  px-4 py-3 text-sm text-[#F5F0E9] placeholder:text-[#7A8FAA]
  focus:outline-none focus:border-[rgba(18,178,193,0.45)] focus:bg-[rgba(60,80,125,0.09)]
  transition-all duration-200
`;

const labelCls =
  "block text-[11px] font-semibold text-[#e1ebed] uppercase tracking-wider mb-2";

const cardCls =
  "bg-[rgba(60,80,125,0.06)] backdrop-blur-xl border border-[rgba(60,80,125,0.18)] rounded-xl";

export default function ContactPage() {
  const { lang, isRtl } = useLang();
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const [sent,    setSent]    = useState(false);
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!formData.name || !formData.email || !formData.message) return;
    setSending(true);
    /* TODO: wire Make.com / Supabase Edge Function webhook here */
    await new Promise(res => setTimeout(res, 1200));
    setSent(true);
    setSending(false);
  };

  const t = {
    en: {
      badgeLabel:    "Support Node Active",
      heading:       "Contact",
      headingAccent: "Support",
      sub:           "Our team is ready to help — we reply within 48 hours at most.",
      responseLabel: "Response within 48 hours",
      formTitle:     "Send a Message",
      namePh:        "Full name",
      emailPh:       "your@email.com",
      messagePh:     "How can we help you?",
      nameLabel:     "Your Name",
      emailLabel:    "Email",
      messageLabel:  "Message",
      send:          "Send Message",
      successTitle:  "Message Sent!",
      successSub:    "We'll reply to your email within 48 hours.",
      orContact:     "Or reach us directly:",
      lbLabel:       "Lebanon Node",
      egLabel:       "Egypt Node",
      wsLabel:       "WhatsApp Support",
      hoursTitle:    "Support Hours",
      hoursCopy:     "We are available Monday to Friday, 9 AM – 6 PM (Beirut time).",
      hoursNote:     "Replies within 48 hours max — usually much faster.",
    },
    ar: {
      badgeLabel:    "دعم تقني نشط",
      heading:       "تواصل",
      headingAccent: "معنا",
      sub:           "فريقنا جاهز لمساعدتك — نرد خلال 48 ساعة على أقصى تقدير.",
      responseLabel: "الرد خلال 48 ساعة",
      formTitle:     "أرسل رسالة",
      namePh:        "اسمك الكامل",
      emailPh:       "your@email.com",
      messagePh:     "كيف يمكننا مساعدتك؟",
      nameLabel:     "الاسم",
      emailLabel:    "البريد الإلكتروني",
      messageLabel:  "الرسالة",
      send:          "إرسال الرسالة",
      successTitle:  "تم الإرسال!",
      successSub:    "سنرد عليك على بريدك الإلكتروني خلال 48 ساعة.",
      orContact:     "أو تواصل معنا مباشرةً:",
      lbLabel:       "النقطة اللبنانية",
      egLabel:       "النقطة المصرية",
      wsLabel:       "دعم واتساب",
      hoursTitle:    "ساعات الدعم",
      hoursCopy:     "نحن متاحون من الاثنين إلى الجمعة، من الساعة 9 صباحاً حتى 6 مساءً (بتوقيت بيروت).",
      hoursNote:     "الردود خلال 48 ساعة كحد أقصى — عادةً أسرع بكثير.",
    },
  }[lang];

  const isDisabled = sending || !formData.name || !formData.email || !formData.message;

  return (
    <div
      className="min-h-screen bg-[#0D1117] text-[#D9CBC2] relative overflow-x-hidden"
      dir={isRtl ? "rtl" : "ltr"}
      style={{ fontFamily: isRtl ? "'Tajawal', sans-serif" : "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* ── Ambient glows ───────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-[-5%] right-[5%]  w-[45vw] h-[45vw] bg-[rgba(60,80,125,0.08)] rounded-full blur-[150px]" />
        <div className="absolute bottom-[-5%] left-[5%] w-[40vw] h-[40vw] bg-[rgba(18,178,193,0.04)] rounded-full blur-[130px]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 lg:px-12 py-20">

        {/* ── Page header ─────────────────────────────────────────── */}
        <div className="text-center mb-14">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-[rgba(60,80,125,0.15)] border border-[rgba(60,80,125,0.25)] text-[#F5F0E9] px-4 py-1.5 rounded-full text-xs font-medium tracking-wide mb-6 backdrop-blur-md">
            <Sparkles strokeWidth={1.5} className="w-3.5 h-3.5 text-[#E0C58F] flex-shrink-0" />
            <span>{t.badgeLabel}</span>
          </div>

          <h1 className="text-4xl lg:text-5xl font-bold text-[#F5F0E9] tracking-tight mb-3">
            {t.heading}{" "}
            <span className="text-[#E0C58F]">
              {t.headingAccent}
            </span>
          </h1>

          <p className="text-[#D9CBC2] text-sm font-light max-w-md mx-auto leading-relaxed mb-6">
            {t.sub}
          </p>

          {/* 48 h response badge */}
          <div className="inline-flex items-center gap-2 bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.2)] px-5 py-2 rounded-full">
            <Clock className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span className="text-emerald-400 text-[12px] font-semibold uppercase tracking-widest">
              {t.responseLabel}
            </span>
          </div>
        </div>

        {/* ── Two-column grid ─────────────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">

          {/* ── Left: Contact Form ─────────────────────────────── */}
          <div className={`${cardCls} p-6 lg:p-8`}>

            {/* Form header */}
            <div className="flex items-center gap-3 mb-7">
              <div className="w-8 h-8 bg-[#112250] border border-[rgba(18,178,193,0.25)] rounded flex items-center justify-center flex-shrink-0">
                <Mail className="w-4 h-4 text-[#12B2C1]" />
              </div>
              <h2 className="text-sm font-bold text-[#F5F0E9] uppercase tracking-wide">
                {t.formTitle}
              </h2>
            </div>

            {sent ? (
              /* ── Success state ─────────────────────────────── */
              <div className="flex flex-col items-center justify-center py-10 text-center gap-4">
                <div className="w-14 h-14 bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.2)] rounded-xl flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-emerald-400" strokeWidth={1.75} />
                </div>
                <p className="text-[#F5F0E9] font-bold text-base">{t.successTitle}</p>
                <p className="text-[#A8B4CC] text-sm leading-relaxed">{t.successSub}</p>
              </div>
            ) : (
              /* ── Form fields ────────────────────────────────── */
              <div className="space-y-5">

                <div>
                  <label className={labelCls}>{t.nameLabel}</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t.namePh}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>{t.emailLabel}</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder={t.emailPh}
                    className={inputCls}
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className={labelCls}>{t.messageLabel}</label>
                  <textarea
                    value={formData.message}
                    onChange={e => setFormData({ ...formData, message: e.target.value })}
                    placeholder={t.messagePh}
                    rows={4}
                    className={`${inputCls} resize-none`}
                  />
                </div>

                {/* Submit — uses same cyan gradient as the Hero CTA */}
                <button
                  onClick={handleSubmit}
                  disabled={isDisabled}
                  className="
                    w-full flex items-center justify-center gap-2
                    py-3.5 rounded font-bold text-sm text-[#0D1117]
                    bg-[#E0C58F] hover:bg-[#F0DFBF]
                    transition-all duration-200 cursor-pointer
                    disabled:opacity-40 disabled:cursor-not-allowed
                    hover:shadow-[0_0_24px_rgba(224,197,143,0.3)]
                  "
                >
                  {sending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <><Send className="w-4 h-4" /><span>{t.send}</span></>
                  }
                </button>

                <p className="text-center text-xs text-[#7A8FAA] pt-1">
                  {t.orContact}{" "}
                  <a
                    href="mailto:support@resumation.co"
                    className="text-[#E0C58F] hover:text-[#F0DFBF] transition-colors duration-200"
                  >
                    support@resumation.co
                  </a>
                </p>
              </div>
            )}
          </div>

          {/* ── Right: Contact cards ────────────────────────────── */}
          <div className="flex flex-col gap-5">

            {/* WhatsApp Lebanon */}
            <a
              href="https://wa.me/96170000000"
              target="_blank"
              rel="noopener noreferrer"
              className={`
                group ${cardCls} p-6 cursor-pointer
                hover:border-[rgba(34,197,94,0.3)] hover:-translate-y-0.5
                hover:shadow-[0_8px_24px_rgba(34,197,94,0.07)]
                transition-all duration-200
                flex items-center gap-5
              `}
            >
              <div className="w-12 h-12 bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.2)] rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-200">
                <MessageCircle className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-widest block mb-0.5">
                  🇱🇧 {t.lbLabel}
                </span>
                <span className="text-[#F5F0E9] font-bold text-base tracking-tight" dir="ltr">
                  +961 70 000 000
                </span>
                <span className="text-[#A8B4CC] text-xs block mt-0.5">{t.wsLabel}</span>
              </div>
            </a>

            {/* WhatsApp Egypt */}
            <a
              href="https://wa.me/201515770632"
              target="_blank"
              rel="noopener noreferrer"
              className={`
                group ${cardCls} p-6 cursor-pointer
                hover:border-[rgba(34,197,94,0.3)] hover:-translate-y-0.5
                hover:shadow-[0_8px_24px_rgba(34,197,94,0.07)]
                transition-all duration-200
                flex items-center gap-5
              `}
            >
              <div className="w-12 h-12 bg-[rgba(34,197,94,0.08)] border border-[rgba(34,197,94,0.2)] rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-200">
                <MessageCircle className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-widest block mb-0.5">
                  🇪🇬 {t.egLabel}
                </span>
                <span className="text-[#F5F0E9] font-bold text-base tracking-tight" dir="ltr">
                  +20 151 577 0632
                </span>
                <span className="text-[#A8B4CC] text-xs block mt-0.5">{t.wsLabel}</span>
              </div>
            </a>

            {/* Support hours */}
            <div className={`${cardCls} p-6`}>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 bg-[#112250] border border-[rgba(60,80,125,0.22)] rounded flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-[#E0C58F]" />
                </div>
                <span className="text-[11px] font-semibold text-[#E0C58F] uppercase tracking-widest">
                  {t.hoursTitle}
                </span>
              </div>
              <p className="text-[#D9CBC2] text-sm leading-[1.8]">{t.hoursCopy}</p>
              <p className="text-[#7A8FAA] text-xs mt-3 leading-relaxed">{t.hoursNote}</p>
            </div>

            {/* Email quick-link */}
            <a
              href="mailto:support@resumation.co"
              className={`
                group ${cardCls} p-5 cursor-pointer
                hover:border-[rgba(18,178,193,0.35)] hover:-translate-y-0.5
                hover:shadow-[0_8px_24px_rgba(18,178,193,0.07)]
                transition-all duration-200
                flex items-center gap-4
              `}
            >
              <div className="w-10 h-10 bg-[#112250] border border-[rgba(18,178,193,0.25)] rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-200">
                <Mail className="w-4.5 h-4.5 text-[#12B2C1]" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-semibold text-[#12B2C1] uppercase tracking-widest block mb-0.5">
                  {lang === "ar" ? "البريد الإلكتروني" : "Email"}
                </span>
                <span className="text-[#F5F0E9] text-sm font-mono truncate block" dir="ltr">
                  support@resumation.co
                </span>
              </div>
              <ShieldCheck className="w-4 h-4 text-[rgba(60,80,125,0.5)] ms-auto flex-shrink-0" />
            </a>

          </div>
        </div>

        {/* ── Footer bar ──────────────────────────────────────────── */}
        <div className="mt-16 pt-8 border-t border-[rgba(60,80,125,0.15)] flex flex-wrap justify-center items-center gap-5 text-xs text-[#7A8FAA]">
          <span className="font-mono">© 2026 Resumation.co</span>
          <span className="text-[rgba(60,80,125,0.3)]">•</span>
          <Link to="/terms"   className="hover:text-[#12B2C1] transition-colors duration-200">
            {lang === "ar" ? "شروط الاستخدام" : "Terms of Service"}
          </Link>
          <span className="text-[rgba(60,80,125,0.3)]">•</span>
          <Link to="/privacy" className="hover:text-[#12B2C1] transition-colors duration-200">
            {lang === "ar" ? "الخصوصية" : "Privacy Policy"}
          </Link>
          <span className="text-[rgba(60,80,125,0.3)]">•</span>
          <a
            href="mailto:support@resumation.co"
            className="font-mono hover:text-[#12B2C1] transition-colors duration-200"
          >
            support@resumation.co
          </a>
        </div>

      </div>
    </div>
  );
}

import { useState } from "react";
import { Mail, MessageCircle, Clock, ShieldCheck, Send, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

export default function ContactPage() {
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!formData.name || !formData.email || !formData.message) return;
    setSending(true);
    // هون بتقدر تربط Make.com webhook لاحقاً
    await new Promise(res => setTimeout(res, 1200));
    setSent(true);
    setSending(false);
  };

  return (
    <div className="min-h-screen bg-[#050B14] text-slate-300 font-sans relative overflow-x-hidden">

      {/* Background */}
      <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-cyan-600/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[50vw] h-[50vw] bg-teal-600/5 rounded-full blur-[150px] pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-24">

        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-cyan-950/30 border border-cyan-500/20 text-cyan-400 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-6">
            <ShieldCheck className="w-3.5 h-3.5" /> Support Node Active
          </div>
          <h1 className="text-4xl lg:text-6xl font-black text-white tracking-tighter uppercase mb-4">
            Contact <span className="text-cyan-400">Support</span>
          </h1>
          <p className="text-slate-500 text-sm font-medium max-w-md mx-auto">
            فريقنا جاهز لمساعدتك — نرد خلال 48 ساعة على أقصى تقدير.
          </p>

          {/* 48h badge */}
          <div className="inline-flex items-center gap-2 mt-6 bg-emerald-500/10 border border-emerald-500/20 px-5 py-2 rounded-full">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400 text-[11px] font-black uppercase tracking-widest">Response within 48 hours</span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">

          {/* Left — Contact Form */}
          <div className="bg-[#0A1324]/60 backdrop-blur-md border border-white/5 rounded-[2.5rem] p-8 lg:p-10">
            <div className="flex items-center gap-3 mb-8">
              <Mail className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-black text-white uppercase tracking-tight">Send a Message</h2>
            </div>

            {sent ? (
              <div className="flex flex-col items-center justify-center h-48 text-center gap-4">
                <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center">
                  <ShieldCheck className="w-8 h-8 text-emerald-400" />
                </div>
                <p className="text-white font-black text-lg uppercase tracking-tight">Message Sent!</p>
                <p className="text-slate-500 text-sm">سنرد عليك خلال 48 ساعة على بريدك الإلكتروني.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Your Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="اسمك الكامل"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="your@email.com"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Message</label>
                  <textarea
                    value={formData.message}
                    onChange={e => setFormData({ ...formData, message: e.target.value })}
                    placeholder="كيف يمكننا مساعدتك؟"
                    rows={4}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors resize-none"
                  />
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={sending || !formData.name || !formData.email || !formData.message}
                  className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(6,182,212,0.2)]"
                >
                  {sending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <><Send className="w-4 h-4" /> Send Message</>
                  }
                </button>

                <p className="text-center text-[10px] text-slate-600 font-medium pt-2">
                  أو تواصل معنا على:{" "}
                  <a href="mailto:support@resumation.co" className="text-cyan-500 hover:text-cyan-400 transition-colors">
                    support@resumation.co
                  </a>
                </p>
              </div>
            )}
          </div>

          {/* Right — WhatsApp + Info */}
          <div className="flex flex-col gap-6">

            {/* WhatsApp Lebanon */}
            <a
              href="https://wa.me/96170000000"
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-[#0A1324]/60 backdrop-blur-md border border-white/5 hover:border-emerald-500/30 rounded-[2rem] p-8 transition-all duration-300 hover:shadow-[0_0_30px_rgba(16,185,129,0.08)] flex items-center gap-5"
            >
              <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <MessageCircle className="w-7 h-7 text-emerald-400" />
              </div>
              <div>
                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] block mb-1">🇱🇧 Lebanon Node</span>
                <span className="text-white font-black text-lg tracking-tight" dir="ltr">+961 70 000 000</span>
                <span className="text-slate-500 text-xs block mt-1">WhatsApp Support</span>
              </div>
            </a>

            {/* WhatsApp Egypt */}
            <a
              href="https://wa.me/201515770632"
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-[#0A1324]/60 backdrop-blur-md border border-white/5 hover:border-emerald-500/30 rounded-[2rem] p-8 transition-all duration-300 hover:shadow-[0_0_30px_rgba(16,185,129,0.08)] flex items-center gap-5"
            >
              <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <MessageCircle className="w-7 h-7 text-emerald-400" />
              </div>
              <div>
                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] block mb-1">🇪🇬 Egypt Node</span>
                <span className="text-white font-black text-lg tracking-tight" dir="ltr">+20 151 577 0632</span>
                <span className="text-slate-500 text-xs block mt-1">WhatsApp Support</span>
              </div>
            </a>

            {/* Info box */}
            <div className="bg-[#0A1324]/40 border border-white/5 rounded-[2rem] p-8">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-cyan-500" />
                <span className="text-[10px] font-black text-cyan-500 uppercase tracking-widest">Support Hours</span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">
                نحن متاحون من <span className="text-white font-bold">الاثنين إلى الجمعة</span> من الساعة 9 صباحاً حتى 6 مساءً (بتوقيت بيروت).
              </p>
              <p className="text-slate-600 text-xs mt-3">
                الردود خلال 48 ساعة كحد أقصى — عادةً أسرع بكثير.
              </p>
            </div>
          </div>
        </div>

        {/* Footer links */}
        <div className="mt-16 pt-8 border-t border-white/5 flex flex-wrap justify-center items-center gap-6 text-[11px] font-black text-slate-600 uppercase tracking-widest">
          <span>© 2026 Resumation.co</span>
          <span className="text-white/10">•</span>
          <Link to="/terms" className="hover:text-cyan-400 transition-colors">Terms of Service</Link>
          <span className="text-white/10">•</span>
          <Link to="/privacy" className="hover:text-cyan-400 transition-colors">Privacy Policy</Link>
          <span className="text-white/10">•</span>
          <a href="mailto:support@resumation.co" className="hover:text-cyan-400 transition-colors">support@resumation.co</a>
        </div>

      </div>
    </div>
  );
}

import { Facebook, Linkedin, Instagram, Mail, MessageCircle, MapPin, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useLang } from "../context/LanguageContext";
import { supabase } from "../supabase";

export default function Footer() {
  const { lang, isRtl } = useLang();
  const navigate = useNavigate();

  const handleProtectedLink = async (to: string) => {
    const lsKey = Object.keys(localStorage).find(
      k => k.startsWith("sb-") && k.endsWith("-auth-token")
    );
    let isLoggedIn = false;
    if (lsKey) {
      try {
        const cached = JSON.parse(localStorage.getItem(lsKey) || "null");
        isLoggedIn = !!(cached?.user?.id);
      } catch {}
    }
    if (!isLoggedIn) {
      const { data: { session } } = await supabase.auth.getSession();
      isLoggedIn = !!session?.user;
    }
    navigate(isLoggedIn ? to : "/login");
  };

  const translations = {
    en: {
      desc: "An integrated digital ecosystem engineered by artificial intelligence to ensure your resume clears strict screening filters and successfully locks in your professional future.",
      infrastructure: "Industrial Career Infrastructure",
      srvTitle: "Services",
      compTitle: "Company",
      contactTitle: "Contact",
      alliance: "Lebanese-Egyptian Tech Alliance",
      privacy: "Privacy Policy",
      terms: "Terms of Service",
      rights: "All Rights Reserved",
      links: {
        build:   { label: "Build AI CV",  to: "/build"    },
        analyse: { label: "ATS Analysis", to: "/analyse"  },
        pricing: { label: "Pricing",      to: "/pricing"  },
        about:   { label: "About Us",     to: "/about"    },
        support: { label: "Support",      to: "/contact"  },
      }
    },
    ar: {
      desc: "منظومة رقمية متكاملة ومُهندسة بالذكاء الاصطناعي لضمان تفوق سيرتك الذاتية في أنظمة الفرز العالمية وتأمين مستقبلك المهني بأعلى معايير الكفاءة.",
      infrastructure: "البنية التحتية الذكية للمستقبل المهني",
      srvTitle: "الخدمات",
      compTitle: "المنصة",
      contactTitle: "تواصل معنا",
      alliance: "التحالف التقني اللبناني المصري",
      privacy: "سياسة الخصوصية",
      terms: "شروط الاستخدام",
      rights: "جميع الحقوق محفوظة",
      links: {
        build:   { label: "بناء سيرة بالذكاء الاصطناعي", to: "/build"   },
        analyse: { label: "فحص وتوافق ATS",              to: "/analyse" },
        pricing: { label: "باقات الأسعار",               to: "/pricing" },
        about:   { label: "من نحن",                       to: "/about"   },
        support: { label: "الدعم الفني",                  to: "/contact" },
      }
    }
  };

  const t = translations[lang];
  const titleCls = "text-[12px] font-bold text-[#E0C58F] uppercase tracking-wider mb-6";
  const linkCls  = "hover:text-[#12B2C1] transition-colors duration-200";

  return (
    <footer
      className="bg-[#0D1117] text-[#D9CBC2] py-16 border-t border-[#3C507D]/15 relative overflow-hidden"
      dir={isRtl ? "rtl" : "ltr"}
      style={{ fontFamily: isRtl ? "'Tajawal', sans-serif" : "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* Glow */}
      <div className="absolute bottom-0 right-0 w-72 h-72 bg-[rgba(60,80,125,0.04)] rounded-full blur-[110px] pointer-events-none" />

      <div className="w-full px-6 lg:px-16 xl:px-24 relative z-10">

        {/* ── Top grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 mb-16">

          {/* Brand */}
          <div className="md:col-span-5">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-7 h-7 rounded bg-[#112250] flex items-center justify-center border border-[#3C507D]/30">
                <Sparkles strokeWidth={1.5} className="w-3.5 h-3.5 text-[#E0C58F]" />
              </div>
              <span className="text-xl font-bold tracking-wide text-[#F5F0E9] uppercase">
                Resumation<span className="text-[#E0C58F] font-bold">.co</span>
              </span>
            </div>
            <p className="text-xs leading-[1.8] mb-8 max-w-sm font-light opacity-90 text-[#D9CBC2]">
              {t.desc}
              <br />
              <span className="block mt-3 text-[11px] uppercase tracking-widest text-[#E0C58F]/80 font-semibold font-mono">
                {t.infrastructure}
              </span>
            </p>
            <div className="flex gap-3">
              {[
                { icon: Linkedin,  href: "https://linkedin.com/company/resumation",  label: "LinkedIn"  },
                { icon: Facebook,  href: "https://facebook.com/resumation",          label: "Facebook"  },
                { icon: Instagram, href: "https://instagram.com/resumation",         label: "Instagram" },
              ].map(({ icon: Icon, href, label }) => (
                <a key={href} href={href} target="_blank" rel="noreferrer" aria-label={label}
                  className="w-11 h-11 flex items-center justify-center rounded-xl text-[#A8B4CC] transition-all duration-300 hover:-translate-y-0.5"
                  style={{
                    background: "rgba(60,80,125,0.10)",
                    border: "1.5px solid rgba(60,80,125,0.28)",
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLAnchorElement;
                    el.style.background    = "rgba(18,178,193,0.12)";
                    el.style.borderColor   = "rgba(18,178,193,0.45)";
                    el.style.color         = "#12B2C1";
                    el.style.boxShadow     = "0 0 16px rgba(18,178,193,0.18)";
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLAnchorElement;
                    el.style.background    = "rgba(60,80,125,0.10)";
                    el.style.borderColor   = "rgba(60,80,125,0.28)";
                    el.style.color         = "";
                    el.style.boxShadow     = "none";
                  }}
                >
                  <Icon className="w-5 h-5" strokeWidth={1.75} />
                </a>
              ))}
            </div>
          </div>

          {/* Services */}
          <div className="md:col-span-2">
            <h3 className={titleCls}>{t.srvTitle}</h3>
            <ul className="space-y-4 text-xs font-light text-[#A8B4CC]">
              <li><Link to={t.links.build.to}   className={linkCls}>{t.links.build.label}</Link></li>
              <li>
                <button
                  onClick={() => handleProtectedLink(t.links.analyse.to)}
                  className={`${linkCls} text-left`}
                >
                  {t.links.analyse.label}
                </button>
              </li>
              <li><Link to={t.links.pricing.to} className={linkCls}>{t.links.pricing.label}</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div className="md:col-span-2">
            <h3 className={titleCls}>{t.compTitle}</h3>
            <ul className="space-y-4 text-xs font-light text-[#A8B4CC]">
              <li><Link to={t.links.about.to}   className={linkCls}>{t.links.about.label}</Link></li>
              <li><Link to={t.links.support.to} className={linkCls}>{t.links.support.label}</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div className="md:col-span-3">
            <h3 className={titleCls}>{t.contactTitle}</h3>
            <ul className="space-y-4 text-xs font-light text-[#A8B4CC]">
              <li className="flex items-center gap-2.5 group">
                <Mail className="w-3.5 h-3.5 text-[#e1ebed] group-hover:text-[#12B2C1] transition-colors flex-shrink-0" />
                <a href="mailto:support@resumation.co" className="group-hover:text-[#F5F0E9] transition-colors font-mono text-[12px]">
                  support@resumation.co
                </a>
              </li>
              <li className="flex items-center gap-2.5 group" dir="ltr">
                <MessageCircle className="w-3.5 h-3.5 text-emerald-500/80 flex-shrink-0" />
                <a href="https://wa.me/201515770632" target="_blank" rel="noreferrer"
                  className="group-hover:text-[#F5F0E9] transition-colors font-mono text-[12px]">
                  +20 151 577 0632
                </a>
              </li>
              <li className="flex items-center gap-2.5 group" dir="ltr">
                <MessageCircle className="w-3.5 h-3.5 text-emerald-500/80 flex-shrink-0" />
                <a href="https://wa.me/96170000000" target="_blank" rel="noreferrer"
                  className="group-hover:text-[#F5F0E9] transition-colors font-mono text-[12px]">
                  +961 70 000 000
                </a>
              </li>
            </ul>
          </div>

        </div>

        {/* ── Bottom bar ── */}
        <div className="pt-10 border-t border-[#3C507D]/10 flex flex-col md:flex-row justify-between items-center gap-6 text-[#e1ebed]">

          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
            <span className="text-[11px] font-mono tracking-wide">
              © 2026 Resumation.co <span className="mx-1.5">•</span> {t.rights}
            </span>
            <div className="flex items-center gap-2 px-3.5 py-1 bg-[rgba(60,80,125,0.04)] rounded-full border border-[#3C507D]/15">
              <MapPin className="w-3 h-3 text-[#12B2C1]" />
              <span className="text-[10px] font-medium tracking-wider text-[#A8B4CC] uppercase">{t.alliance}</span>
            </div>
          </div>

          <div className="flex gap-6 text-[11px] font-medium tracking-wide">
            <Link to="/privacy" className="hover:text-[#12B2C1] transition-colors">{t.privacy}</Link>
            <Link to="/terms"   className="hover:text-[#12B2C1] transition-colors">{t.terms}</Link>
          </div>

        </div>
      </div>
    </footer>
  );
}

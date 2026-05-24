import {
  Sparkles, Zap, Globe, Shield, Users, FileText,
  TrendingUp, Award, MapPin, ChevronRight
} from "lucide-react";
import { useLang } from "../context/LanguageContext";

export default function AboutPage() {
  const { lang: currentLang, isRtl } = useLang();

  const t = {
    en: {
      badge: "Our Story",
      heroTitle: "Built for Every Professional Who Deserves a Shot",
      heroSub:
        "Resumation.co was born from a simple frustration — talented people losing jobs they were perfect for, because their resume never made it past the first filter. We set out to fix that.",

      missionTitle: "Mission",
      missionText:
        "To give every professional, regardless of language, background, or budget, an unfair advantage in the modern job market through AI-powered resume intelligence.",

      visionTitle: "Vision",
      visionText:
        "A world where opportunity is decided by merit, not by whether your resume keyword-matched a cold screening algorithm.",

      whyTitle: "Why We Built This",
      whyText:
        "Over 75% of resumes are rejected before a human ever reads them. Not because the candidates weren't qualified — but because Applicant Tracking Systems (ATS) silently filter them out. Our founders experienced this first-hand, both in Lebanon and Egypt, and decided to build a solution that understands both the Arabic-speaking world and the global job market.",

      allianceTitle: "Lebanese-Egyptian Tech Alliance",
      allianceText:
        "Resumation.co is the product of a cross-border collaboration between Lebanese and Egyptian engineers, designers, and career experts. We combine Beirut's startup culture with Cairo's scale to build tools that work for the Arab world and beyond.",

      statsTitle: "By the Numbers",
      stats: [
        { value: "10,000+", label: "Resumes Generated" },
        { value: "94%",     label: "ATS Pass Rate" },
        { value: "3",       label: "Languages Supported" },
        { value: "30+",     label: "Industries Covered" },
      ],

      valuesTitle: "What We Stand For",
      values: [
        { icon: Shield,    title: "Authenticity",  desc: "We coach — we don't fabricate. Every word on your CV should be genuinely yours." },
        { icon: Zap,       title: "Speed",         desc: "A professional resume in minutes, not days. Your next opportunity won't wait." },
        { icon: Globe,     title: "Accessibility", desc: "Bilingual by design. Arabic and English, with equal quality on both sides." },
        { icon: TrendingUp,title: "Results",       desc: "We measure success by callbacks received, not resumes downloaded." },
      ],

      teamTitle: "The Team Behind the Platform",
      teamText:
        "We're a lean, focused team of AI engineers, UX designers, and career consultants who have collectively reviewed thousands of resumes. We know what works — and we built the tool to reflect that.",

      closingTitle: "This is Just the Beginning",
      closingText:
        "We're expanding into cover letters, LinkedIn optimization, interview coaching, and career tracking. If you believe talent deserves to be seen — welcome aboard.",

      cta: "Start Building Your CV",
      location: "Lebanese-Egyptian Tech Alliance",
    },
    ar: {
      badge: "قصتنا",
      heroTitle: "بُنيت لكل محترف يستحق فرصة حقيقية",
      heroSub:
        "وُلدت Resumation.co من إحباط حقيقي — محترفون موهوبون يخسرون وظائف كانوا مثاليين لها، لأن سيرتهم الذاتية لم تتجاوز أول فلتر آلي. قررنا أن نغيّر هذا.",

      missionTitle: "المهمة",
      missionText:
        "منح كل محترف، بصرف النظر عن لغته أو خلفيته أو ميزانيته، ميزة غير عادلة في سوق العمل الحديث من خلال ذكاء اصطناعي متخصص في السيرة الذاتية.",

      visionTitle: "الرؤية",
      visionText:
        "عالم تُقرَّر فيه الفرص بالكفاءة، لا بمدى تطابق كلماتك مع خوارزمية فرز باردة.",

      whyTitle: "لماذا بنينا هذا؟",
      whyText:
        "أكثر من 75% من السير الذاتية تُرفض قبل أن تقرأها عينٌ بشرية. ليس لأن المرشحين غير مؤهلين — بل لأن أنظمة ATS تصفيهم بصمت. عاش مؤسسونا هذا الواقع بأنفسهم في لبنان ومصر، فقرروا بناء حل يفهم العالم العربي وسوق العمل العالمي في آنٍ واحد.",

      allianceTitle: "التحالف التقني اللبناني المصري",
      allianceText:
        "Resumation.co ثمرة تعاون عابر للحدود بين مهندسين ومصممين وخبراء مسار مهني لبنانيين ومصريين. نجمع ثقافة الشركات الناشئة في بيروت مع حجم السوق في القاهرة لبناء أدوات تخدم العالم العربي وما هو أبعد منه.",

      statsTitle: "بالأرقام",
      stats: [
        { value: "+10,000", label: "سيرة ذاتية مُنشأة" },
        { value: "94%",     label: "نسبة اجتياز ATS" },
        { value: "3",       label: "لغات مدعومة" },
        { value: "+30",     label: "قطاع مهني مغطّى" },
      ],

      valuesTitle: "ما نؤمن به",
      values: [
        { icon: Shield,     title: "الأصالة",     desc: "نحن نُرشد ولا نخترع. كل كلمة في سيرتك يجب أن تكون لك فعلاً." },
        { icon: Zap,        title: "السرعة",      desc: "سيرة ذاتية احترافية في دقائق لا أيام. فرصتك القادمة لن تنتظر." },
        { icon: Globe,      title: "الوصول",      desc: "ثنائية اللغة بالتصميم. عربي وإنجليزي بجودة متساوية على الجانبين." },
        { icon: TrendingUp, title: "النتائج",     desc: "نقيس نجاحنا بعدد المقابلات التي حصلت عليها، لا السير التي نُزِّلت." },
      ],

      teamTitle: "الفريق خلف المنصة",
      teamText:
        "نحن فريق صغير ومركّز من مهندسي الذكاء الاصطناعي ومصممي تجربة المستخدم ومستشاري المسار المهني راجعنا مجتمعين آلاف السير الذاتية. نعرف ما يجدي نفعاً — وبنينا الأداة لتعكس ذلك.",

      closingTitle: "هذا مجرد بداية",
      closingText:
        "نتوسع نحو خطابات التقديم وتحسين لينكدإن وتدريب المقابلات وتتبع المسار المهني. إن كنت تؤمن بأن الموهبة تستحق أن تُرى — أهلاً بك.",

      cta: "ابدأ بناء سيرتك الذاتية",
      location: "التحالف التقني اللبناني المصري",
    },
  }[currentLang];

  return (
    <div
      className="min-h-screen bg-[#0D1117] text-[#D9CBC2] relative overflow-hidden"
      dir={isRtl ? "rtl" : "ltr"}
      style={{ fontFamily: isRtl ? "'Tajawal', sans-serif" : "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* Background glow orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] rounded-full bg-[rgba(18,178,193,0.04)] blur-[120px]" />
        <div className="absolute top-[40%] right-[-5%] w-[400px] h-[400px] rounded-full bg-[rgba(60,80,125,0.06)] blur-[100px]" />
        <div className="absolute bottom-[10%] left-[-5%] w-[350px] h-[350px] rounded-full bg-[rgba(224,197,143,0.03)] blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-12 py-20">

        {/* ── Hero ── */}
        <div className="text-center mb-24">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#E0C58F]/20 bg-[rgba(224,197,143,0.05)] text-[#E0C58F] text-[12px] font-semibold tracking-widest uppercase mb-8">
            <Sparkles className="w-3 h-3" />
            {t.badge}
          </span>
          <h1 className="text-3xl md:text-5xl font-black text-[#F5F0E9] leading-tight mb-6 max-w-3xl mx-auto">
            {t.heroTitle}
          </h1>
          <p className="text-sm md:text-base text-[#A8B4CC] leading-[1.9] max-w-2xl mx-auto font-light">
            {t.heroSub}
          </p>
        </div>

        {/* ── Mission & Vision ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-20">
          {[
            { title: t.missionTitle, text: t.missionText, accent: "#12B2C1", icon: Zap },
            { title: t.visionTitle,  text: t.visionText,  accent: "#E0C58F", icon: Award },
          ].map(({ title, text, accent, icon: Icon }) => (
            <div
              key={title}
              className="rounded-2xl p-8 relative overflow-hidden"
              style={{
                background: "rgba(13,17,23,0.7)",
                backdropFilter: "blur(24px)",
                border: `1px solid ${accent}20`,
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                style={{ background: `${accent}15`, border: `1px solid ${accent}30` }}
              >
                <Icon className="w-5 h-5" style={{ color: accent }} />
              </div>
              <h3 className="text-[12px] font-bold uppercase tracking-widest mb-3" style={{ color: accent }}>
                {title}
              </h3>
              <p className="text-sm text-[#A8B4CC] leading-[1.9] font-light">{text}</p>
            </div>
          ))}
        </div>

        {/* ── Why We Built This ── */}
        <div
          className="rounded-2xl p-10 mb-20 relative overflow-hidden"
          style={{
            background: "rgba(13,17,23,0.7)",
            backdropFilter: "blur(24px)",
            border: "1px solid rgba(60,80,125,0.2)",
          }}
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-[rgba(18,178,193,0.03)] rounded-full blur-[80px] pointer-events-none" />
          <h2 className="text-[12px] font-bold text-[#E0C58F] uppercase tracking-widest mb-4">{t.whyTitle}</h2>
          <p className="text-sm md:text-base text-[#A8B4CC] leading-[2] font-light max-w-3xl">
            {t.whyText}
          </p>
        </div>

        {/* ── Stats ── */}
        <div className="mb-20">
          <h2 className="text-[12px] font-bold text-[#E0C58F] uppercase tracking-widest text-center mb-10">
            {t.statsTitle}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {t.stats.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl p-6 text-center"
                style={{
                  background: "rgba(13,17,23,0.7)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(60,80,125,0.15)",
                }}
              >
                <div className="text-3xl font-black text-[#12B2C1] mb-2 font-mono">{s.value}</div>
                <div className="text-[12px] text-[#A8B4CC] font-medium tracking-wide">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Values ── */}
        <div className="mb-20">
          <h2 className="text-[12px] font-bold text-[#E0C58F] uppercase tracking-widest text-center mb-10">
            {t.valuesTitle}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {t.values.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl p-7 flex gap-5 items-start group transition-all duration-300"
                style={{
                  background: "rgba(13,17,23,0.7)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(60,80,125,0.15)",
                }}
              >
                <div className="w-10 h-10 rounded-xl bg-[rgba(18,178,193,0.08)] border border-[#12B2C1]/20 flex items-center justify-center flex-shrink-0 group-hover:bg-[rgba(18,178,193,0.15)] transition-colors">
                  <Icon className="w-5 h-5 text-[#12B2C1]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#F5F0E9] mb-1.5">{title}</h4>
                  <p className="text-xs text-[#A8B4CC] leading-[1.8] font-light">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Alliance ── */}
        <div
          className="rounded-2xl p-10 mb-20 relative overflow-hidden"
          style={{
            background: "rgba(13,17,23,0.7)",
            backdropFilter: "blur(24px)",
            border: "1px solid rgba(224,197,143,0.15)",
          }}
        >
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[rgba(224,197,143,0.03)] rounded-full blur-[80px] pointer-events-none" />
          <div className="flex items-center gap-3 mb-4">
            <MapPin className="w-4 h-4 text-[#E0C58F]" />
            <h2 className="text-[12px] font-bold text-[#E0C58F] uppercase tracking-widest">
              {t.allianceTitle}
            </h2>
          </div>
          <p className="text-sm md:text-base text-[#A8B4CC] leading-[2] font-light max-w-3xl">
            {t.allianceText}
          </p>
        </div>

        {/* ── Team ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-20">
          {[
            { title: t.teamTitle, text: t.teamText, icon: Users, accent: "#12B2C1" },
            { title: t.closingTitle, text: t.closingText, icon: FileText, accent: "#E0C58F" },
          ].map(({ title, text, icon: Icon, accent }) => (
            <div
              key={title}
              className="rounded-2xl p-8"
              style={{
                background: "rgba(13,17,23,0.7)",
                backdropFilter: "blur(24px)",
                border: `1px solid ${accent}20`,
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                style={{ background: `${accent}15`, border: `1px solid ${accent}30` }}
              >
                <Icon className="w-5 h-5" style={{ color: accent }} />
              </div>
              <h3 className="text-[12px] font-bold uppercase tracking-widest mb-3" style={{ color: accent }}>
                {title}
              </h3>
              <p className="text-sm text-[#A8B4CC] leading-[1.9] font-light">{text}</p>
            </div>
          ))}
        </div>

        {/* ── CTA ── */}
        <div className="text-center">
          <a
            href="/build"
            className="inline-flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-sm text-[#0D1117] transition-all duration-300 hover:gap-4 hover:shadow-[0_0_32px_rgba(18,178,193,0.25)]"
            style={{ background: "linear-gradient(135deg, #12B2C1, #0E8F9C)" }}
          >
            {t.cta}
            <ChevronRight className="w-4 h-4" />
          </a>
        </div>

      </div>
    </div>
  );
}

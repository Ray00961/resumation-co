import { useEffect, useState } from "react";
import { Loader2, Globe, Zap, ShieldCheck, Crown, Activity, ArrowRight, Check, Sparkles, Search, PenLine, BrainCircuit, Gift, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import Cookies from "js-cookie";
import { detectRegion } from "../utils/detectRegion";
import { useLang } from "../context/LanguageContext";

type PlanType = "free" | "premium" | "gold" | "ai_search";

export default function PlansPage() {
  const navigate = useNavigate();
  const { lang, isRtl } = useLang();

  const [userEmail,       setUserEmail]       = useState<string | null>(null);
  const [userId,          setUserId]          = useState<string | null>(null);
  const [userName,        setUserName]        = useState<string | null>(null);
  const [submissionId,    setSubmissionId]    = useState<string | null>(null);
  const [formId,          setFormId]          = useState<string | null>(null);
  const [loading,         setLoading]         = useState<PlanType | null>(null);
  const [payError,        setPayError]        = useState<string | null>(null);
  const [isCheckingAuth,  setIsCheckingAuth]  = useState(true);
  const [userRegion,      setUserRegion]      = useState<string>(Cookies.get("user_region") || "LB");
  const [hasReferral,     setHasReferral]     = useState(false);

  // ── Derived ──
  const isEgypt = userRegion === "EG";

  // Paymob standalone links (Egypt)
  const PREMIUM_LINK_EGY   = "https://accept.paymobsolutions.com/standalone?ref=p_LRR2djFVeWg0SWhkQzY2dnM3WGQxOFl6Zz09X05IeWQra29pd29zUXRTRHF5QkpxMWc9PQ";
  const GOLD_LINK_EGY      = "https://accept.paymobsolutions.com/standalone?ref=p_LRR2U0d0ZklEUlIxZUwweWZhUVRGdDVqZz09X1hhTCtGYWhhK1pOSmVyb0pZVFE1dXc9PQ";
  const AI_SEARCH_LINK_EGY = (import.meta.env.VITE_PAYMOB_AI_SEARCH_LINK as string) || "";

  // ── Pricing logic ──
  const BASE = isEgypt
    ? { premium: 250, gold: 400, ai_search: 100 }
    : { premium: 25,  gold: 40,  ai_search: 10  };

  const finalPrice = (plan: "premium" | "gold" | "ai_search"): number =>
    hasReferral && plan !== "ai_search" ? BASE[plan] / 2 : BASE[plan];

  const finalCoins = (plan: "premium" | "gold" | "ai_search"): number => {
    if (plan === "premium") return 50;
    if (plan === "gold")    return 100;
    return hasReferral ? 200 : 100;
  };

  useEffect(() => {
    const params        = new URLSearchParams(window.location.search);
    const idFromUrl     = params.get("id");
    
    // Hard bailout — never leave user stuck on spinner
    const bailout = setTimeout(() => setIsCheckingAuth(false), 8000);

    const init = async () => {
      try {
        let uid: string | null = null;
        let email: string | null = null;

        // FIX: Always call getSession() first to properly initialize Supabase auth state
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          uid   = session.user.id;
          email = session.user.email ?? null;
        }

        // Fallback to localStorage ONLY if getSession() didn't find a user
        if (!uid) {
          const lsKey = Object.keys(localStorage).find(
            k => k.startsWith("sb-") && k.endsWith("-auth-token")
          );
          if (lsKey) {
            try {
              const cached = JSON.parse(localStorage.getItem(lsKey) || "null");
              uid   = cached?.user?.id   || null;
              email = cached?.user?.email || cached?.user?.user_metadata?.email || null;
            } catch { /* ignore parse errors */ }
          }
        }

        if (!uid) { navigate("/login"); return; }

        setUserId(uid);
        setUserEmail(email || "");

        detectRegion()
          .then(r => {
            setUserRegion(r);
            Cookies.set("user_region", r, { expires: 30 });
          })
          .catch(() => {
            setUserRegion("LB");
            Cookies.set("user_region", "LB", { expires: 30 });
          });

        const { data: userData } = await supabase
          .from("users")
          .select("first_name, referred_by")
          .eq("id", uid)
          .maybeSingle();

        setUserName(userData?.first_name || "User");

        let arcRow: { form_id: string; submission_id: string | null; user_id: string } | null = null;

        if (idFromUrl) {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idFromUrl);
          const baseQ = supabase.from("cv_archive").select("form_id, submission_id, user_id").eq("user_id", uid);
          const { data: matched } = isUuid
            ? await baseQ.eq("form_id", idFromUrl).maybeSingle()
            : await baseQ.eq("submission_id", idFromUrl).maybeSingle();
          arcRow = matched ?? null;
        }

        if (!arcRow) {
          const { data: latest } = await supabase
            .from("cv_archive")
            .select("form_id, submission_id, user_id")
            .eq("user_id", uid)
            .order("created_at_utc", { ascending: false })
            .limit(1)
            .maybeSingle();
          arcRow = latest ?? null;
        }

        if (!arcRow) { navigate("/build"); return; }

        setFormId(arcRow.form_id);
        setSubmissionId(arcRow.submission_id || "");
        setHasReferral(!!(userData?.referred_by));

      } catch (err) {
        console.error("Init error:", err);
      } finally {
        clearTimeout(bailout);
        setIsCheckingAuth(false);
      }
    };
    init();
  }, [navigate]);

  // ── Payment handler (premium / gold / ai_search) ──
  const handlePaidPlan = async (plan: "premium" | "gold" | "ai_search") => {
    setLoading(plan);
    setPayError(null);

    try {
      if (!userId) {
        setPayError("Session error — please refresh the page.");
        setLoading(null);
        return;
      }

      let safeFormId   = formId || "";
      let safeSid      = submissionId || "";

      if (!safeFormId) {
        const timeout20s = new Promise<{ data: null }>((resolve) =>
          setTimeout(() => resolve({ data: null }), 10_000)
        );

        let data: { form_id: string; submission_id: string | null } | null = null;

        if (safeSid) {
          const bySid = supabase
            .from("cv_archive")
            .select("form_id, submission_id")
            .eq("user_id", userId)
            .eq("submission_id", safeSid)
            .order("created_at_utc", { ascending: false })
            .limit(1)
            .maybeSingle();

          const result = await Promise.race([bySid, timeout20s]);
          data = result?.data ?? null;
        }

        if (!data) {
          const latest = await Promise.race([
            supabase
              .from("cv_archive")
              .select("form_id, submission_id")
              .eq("user_id", userId)
              .order("created_at_utc", { ascending: false })
              .limit(1)
              .maybeSingle(),
            timeout20s,
          ]);
          data = latest?.data ?? null;
        }

        if (data) {
          safeFormId = data.form_id;
          safeSid    = data.submission_id || safeSid;
          setFormId(safeFormId);
          setSubmissionId(safeSid);
        } else {
          setPayError("System Error: CV data not found. Please try again.");
          setLoading(null);
          return;
        }
      }

      const EF_URL = (import.meta.env.VITE_EF_CREATE_CV_ORDER as string) ||
        "https://nbbxtealrhrnadlzmkev.supabase.co/functions/v1/create-cv-order";

      let accessToken: string | undefined;

      try {
        const lsKey = Object.keys(localStorage).find(
          k => k.startsWith("sb-") && k.endsWith("-auth-token")
        );
        if (lsKey) {
          const cached = JSON.parse(localStorage.getItem(lsKey) || "null");
          accessToken = cached?.access_token || cached?.session?.access_token;
        }
      } catch { /* تجاهل الأخطاء */ }

      if (!accessToken) {
        try {
          const { data: { session: paySession } } = await supabase.auth.getSession();
          accessToken = paySession?.access_token;
        } catch { /* fall through */ }
      }

      if (!accessToken) {
        setPayError("Session expired — please reload the page.");
        setLoading(null);
        return;
      }

      const safeEmail    = userEmail || "";
      const safeName     = userName || "User";
      const safeRegion   = userRegion || "LB";

      const amt = finalPrice(plan);
      const cur = isEgypt ? "EGP" : "USD";

      const body = {
        user_id:       userId,
        email:         safeEmail,
        full_name:     safeName,
        form_id:       safeFormId,
        submission_id: safeSid,
        plan,
        region:        safeRegion,
        amount:        amt,
        currency:      cur,
        has_referral:  hasReferral,
        coins:         finalCoins(plan),
      };

      const authHeaders = {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${accessToken}`,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); 

      try {
        const res = await fetch(EF_URL, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ ...body, payment_method: isEgypt ? "paymob" : "whish" }),
          signal: controller.signal, 
        });
        
        clearTimeout(timeoutId);

        const result = await res.json().catch(() => ({}));

        if (!res.ok || result?.error) {
           setPayError(result?.error || result?.message || "Payment gateway error — please try again.");
           setLoading(null);
           return;
        }

        if (isEgypt) {
          const linkMap: Record<string, string> = {
            premium:   PREMIUM_LINK_EGY,
            gold:      GOLD_LINK_EGY,
            ai_search: AI_SEARCH_LINK_EGY,
          };
          const baseLink = result?.url || linkMap[plan];
          if (!baseLink) {
            setPayError("Payment link not available — please try again.");
            setLoading(null);
            return;
          }

          const resolvedFormId = result?.form_id || safeFormId;
          const cid = `${userId}---${resolvedFormId}`;

          sessionStorage.setItem("rsm_plan", plan);

          window.location.assign(
            baseLink
            + `&billing_data[first_name]=${encodeURIComponent(safeName)}`
            + `&billing_data[last_name]=Customer`
            + `&billing_data[email]=${encodeURIComponent(safeEmail)}`
            + `&billing_data[phone_number]=01111111111`
            + `&billing_data[street]=${encodeURIComponent(cid)}`
            + `&merchant_order_id=${encodeURIComponent(cid)}`
          );

        } else {
          const url = result?.url || result?.collectUrl || result?.data?.collectUrl || result?.paymentUrl;
          if (url) {
            let final = url.trim();
            if (!final.startsWith("http")) final = `https://${final}`;
            window.location.assign(final);
          } else {
            console.error("WishMoney no url:", result);
            setPayError(`Invalid gateway response. Please try again.`);
            setLoading(null);
          }
        }
      } catch (fetchErr: unknown) {
        clearTimeout(timeoutId);
        const e = fetchErr as { name?: string; message?: string };
        if (e?.name === "AbortError" || e?.name === "TimeoutError") {
           setPayError("Payment gateway timed out. The Edge Function took too long to respond.");
        } else {
           setPayError(`Network Error: ${e?.message || 'Could not reach Edge Function.'}`);
        }
        setLoading(null);
      }
    } catch (err: unknown) {
      console.warn("Unexpected Payment error:", err);
      setPayError("An unexpected error occurred — please try again.");
      setLoading(null);
    }
  };

  const handleFreePlan = async () => {
    setLoading("free");
    setPayError(null);

    let safeFormId = formId || "";
    let safeSid = submissionId || "";

    if (!safeFormId && userId) {
      const timeout20s = new Promise<{ data: null }>((resolve) =>
        setTimeout(() => resolve({ data: null }), 10_000)
      );
      const { data } = await Promise.race([
        supabase
          .from("cv_archive")
          .select("form_id, submission_id")
          .eq("user_id", userId)
          .order("created_at_utc", { ascending: false })
          .limit(1)
          .maybeSingle(),
        timeout20s,
      ]);

      if (data) {
        safeFormId = data.form_id;
        safeSid = data.submission_id || "";
        setFormId(safeFormId);
      }
    }

    if (!safeFormId) {
      setPayError("Could not find your CV. Please try reloading the page.");
      setLoading(null);
      return;
    }

    setTimeout(() => {
      navigate(`/building?sid=${encodeURIComponent(safeSid)}&fid=${encodeURIComponent(safeFormId)}`);
    }, 600);
  };

  // ── Translations ──
  const t = {
    en: {
      regionLb: "🇱🇧 Lebanon — Whish Money · USD",
      regionEg: "🇪🇬 Egypt — Paymob · EGP",
      h1: "Choose Your", h2: "Career Plan",
      sub: "One-time payment · Instant delivery · No subscriptions",
      loggedAs: "Logged in as",
      referralBadge: "Referral Discount Active — 50% Off",
      referralNote: "Prices slashed in half. AI Search Pack earns 2× Coins instead.",
      currency: isEgypt ? "EGP" : "USD",
      oneTime: "one-time",
      mostPopular: "Most Popular",
      aiPill: "Coin top-up", aiTitle: "AI Hunter", aiSub: "Coins only · No CV build",
      premPill: "Most popular", premTitle: "Premium",     premSub: "Complete ATS Resume Build",
      goldPill: "Full suite",   goldTitle: "Gold Package", goldSub: "Complete Application Suite",
      coinsLabel: "Coins",
      coinsDouble: "Coins (2× bonus!)",
      premFeatures: ["Full ATS-optimized CV", "Cover letter included", "50 Coins", "PDF + DOCX export"],
      goldFeatures: ["Everything in Premium", "100 Coins", "Direct employer links", "Priority processing"],
      aiFeatures:   ["AI job search", "CV & Cover rewrites", "JD analysis"],
      btnPrem: "Unlock Premium", btnGold: "Unlock Gold", btnAi: "Top Up Coins",
      freeLink: "No budget? Start with the Free plan",
      trustSecure: "Secure Checkout", trustInstant: "Instant Activation", trustOnce: "One-time Payment",
      coinTitle: "How Coins Work",
      coinSub: "Every AI-powered action costs Coins. Buy once, use whenever you need.",
      coinRows: [
        { icon: "search", cost: "1 Coin",   action: "AI Job Search",             desc: "Returns 2 matching jobs + a compatibility score" },
        { icon: "pen",    cost: "3 Coins",  action: "Rewrite CV & Cover Letter", desc: "Full AI rewrite aligned to your target role" },
        { icon: "brain",  cost: "6 Coins",  action: "JD Analysis + Full Rewrite", desc: "Paste any external job description — AI analyzes it then rewrites your CV & Cover Letter to match perfectly" },
      ],
    },
    ar: {
      regionLb: "🇱🇧 لبنان — Whish Money · USD",
      regionEg: "🇪🇬 مصر — Paymob · EGP",
      h1: "اختر", h2: "خطتك المهنية",
      sub: "دفعة واحدة · تسليم فوري · بدون اشتراكات",
      loggedAs: "مسجّل دخولك كـ",
      referralBadge: "خصم الإحالة مفعّل — 50% خصم",
      referralNote: "الأسعار انخفضت للنصف. باقة AI Search تعطيك ضعف الكوينز بدلاً من خصم السعر.",
      currency: isEgypt ? "EGP" : "USD",
      oneTime: "دفعة واحدة",
      mostPopular: "الأكثر شعبية",
      aiPill: "شحن رصيد", aiTitle: "AI Hunter", aiSub: "كوينز فقط · بدون بناء CV",
      premPill: "الأكثر طلباً", premTitle: "بريميوم",     premSub: "بناء سيرة ذاتية متكاملة",
      goldPill: "الحزمة الكاملة", goldTitle: "باقة الذهب", goldSub: "مجموعة تقديم متكاملة",
      coinsLabel: "كوين",
      coinsDouble: "كوين (مضاعف ×2!)",
      premFeatures: ["سيرة ذاتية محسّنة للـ ATS", "رسالة تغطية مشمولة", "50 كوين", "تصدير PDF + DOCX"],
      goldFeatures: ["كل مميزات بريميوم", "100 كوين", "روابط مباشرة لأصحاب العمل", "معالجة ذات أولوية"],
      aiFeatures:   ["بحث وظيفي ذكي", "إعادة كتابة CV والغلاف", "تحليل وصف الوظيفة"],
      btnPrem: "احصل على بريميوم", btnGold: "احصل على الذهب", btnAi: "اشحن الكوينز",
      freeLink: "لا ميزانية؟ جرّب الخطة المجانية",
      trustSecure: "دفع آمن", trustInstant: "تفعيل فوري", trustOnce: "دفعة واحدة",
      coinTitle: "كيف تعمل الكوينز",
      coinSub: "كل إجراء بالذكاء الاصطناعي يستهلك كوينز. اشترِ مرة واستخدمها متى شئت.",
      coinRows: [
        { icon: "search", cost: "1 كوين",   action: "بحث وظيفي بالذكاء الاصطناعي",       desc: "يعيد وظيفتين متوافقتين مع نقاط التطابق" },
        { icon: "pen",    cost: "3 كوينز",  action: "إعادة كتابة السيرة ورسالة التغطية",  desc: "إعادة كتابة كاملة تتوافق مع دورك المستهدف" },
        { icon: "brain",  cost: "6 كوينز",  action: "تحليل JD + إعادة كتابة CV والغلاف", desc: "الصق أي وصف وظيفي خارجي — يحلّله الذكاء الاصطناعي ويعيد كتابة سيرتك ورسالة التغطية بالكامل وفقاً له" },
      ],
    },
  }[lang];

  // ── Loading screen ──
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0D1117] gap-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border border-[rgba(18,178,193,0.2)] animate-ping absolute inset-0" />
          <Loader2 className="animate-spin w-12 h-12 text-[rgba(18,178,193,0.8)]" />
        </div>
        <p className="text-[#e1ebed] font-bold uppercase tracking-[0.3em] text-[11px] mt-2">
          Verifying your access...
        </p>
      </div>
    );
  }

  // ── JSX helpers ──
  const CheckBullet = ({ color }: { color: "teal" | "gold" }) => (
    <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
      style={{
        background:  color === "teal" ? "rgba(18,178,193,0.15)" : "rgba(224,197,143,0.08)",
        border: `1px solid ${color === "teal" ? "rgba(18,178,193,0.35)" : "rgba(224,197,143,0.2)"}`,
      }}>
      <Check className={`w-2.5 h-2.5 ${color === "teal" ? "text-[rgba(18,178,193,1)]" : "text-[#E0C58F]"}`} />
    </div>
  );

  const CoinsBadge = ({ coins, doubled = false }: { coins: number; doubled?: boolean }) => (
    <div className="flex items-center gap-2 mb-6 px-3 py-1.5 rounded-xl w-fit"
      style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
      <Zap className="w-3 h-3 text-amber-400" />
      <span className="text-[11px] font-black text-amber-400 uppercase tracking-wide">
        {doubled ? `${coins} ${t.coinsDouble}` : `${coins} ${t.coinsLabel}`}
      </span>
    </div>
  );

  const coinIcon = (type: string) => {
    if (type === "search") return <Search className="w-5 h-5" />;
    if (type === "pen")    return <PenLine className="w-5 h-5" />;
    return <BrainCircuit className="w-5 h-5" />;
  };

  return (
    <div
      className="min-h-screen bg-[#0D1117] font-sans relative overflow-hidden"
      dir={isRtl ? "rtl" : "ltr"}
      style={{ fontFamily: isRtl ? "'Tajawal', sans-serif" : "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* Background glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[700px] h-[700px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(18,178,193,0.07) 0%, transparent 70%)" }} />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(86,108,158,0.08) 0%, transparent 70%)" }} />
        <div className="absolute top-[40%] left-[30%] w-[400px] h-[400px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(224,197,143,0.04) 0%, transparent 70%)" }} />
      </div>
      <div className="fixed inset-0 pointer-events-none z-0"
        style={{ backgroundImage: "radial-gradient(rgba(18,178,193,0.035) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-20 text-center">

        {/* Region pill */}
        <div className="mb-8 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[rgba(18,178,193,0.15)] bg-[rgba(18,178,193,0.05)] backdrop-blur-md">
          <Globe className="w-3 h-3 text-[rgba(18,178,193,0.7)]" />
          <span className="text-[10px] font-black text-[rgba(18,178,193,0.7)] uppercase tracking-[0.25em]">
            {isEgypt ? t.regionEg : t.regionLb}
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl lg:text-6xl font-black text-white mb-4 tracking-tight leading-none">
          {t.h1}<br />
          <span style={{
            background: "linear-gradient(135deg, rgba(18,178,193,1) 0%, rgba(86,158,193,1) 50%, rgba(224,197,143,0.9) 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>{t.h2}</span>
        </h1>
        <p className="text-[#e1ebed] text-sm mb-2 font-medium">{t.sub}</p>

        {/* User pill */}
        <div className="inline-flex items-center gap-2 mt-3 px-3 py-1.5 rounded-full bg-[rgba(86,108,158,0.08)] border border-[rgba(86,108,158,0.18)]">
          <Activity className="w-3 h-3 text-[#e1ebed]" />
          <span className="text-[11px] text-[#e1ebed]">
            {t.loggedAs} <span className="text-[#E0C58F] font-semibold">{userEmail || "..."}</span>
          </span>
        </div>

        {/* ── Referral discount banner ── */}
        {hasReferral && (
          <div className="mt-6 mb-2 inline-flex items-center gap-3 px-6 py-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/5 backdrop-blur-sm">
            <Gift className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div className={isRtl ? "text-right" : "text-left"}>
              <p className="text-[12px] font-black text-amber-400 uppercase tracking-wider">{t.referralBadge}</p>
              <p className="text-[11px] text-amber-400/60 font-medium mt-0.5">{t.referralNote}</p>
            </div>
          </div>
        )}

        {/* ── Payment error banner ── */}
        {payError && (
          <div className="mt-6 mb-2 px-5 py-3.5 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 text-[12px] font-bold text-center">
            {payError}
          </div>
        )}

        {/* ══════════════════════════════════════
            Plan Cards  — AI Search | Premium | Gold
        ══════════════════════════════════════ */}
        <div className={`grid md:grid-cols-3 gap-5 items-center ${hasReferral ? "mt-8" : "mt-16"}`}>

          {/* ── AI Search Pack ── */}
          <div className="group relative rounded-3xl p-px transition-all duration-500 hover:-translate-y-1"
            style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))" }}>
            <div className="rounded-3xl p-7 flex flex-col min-h-[480px] justify-between text-left"
              style={{ background: "rgba(13,17,23,0.7)", backdropFilter: "blur(24px)" }}>
              <div>
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-5"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <Zap className="w-4.5 h-4.5 text-[#e1ebed]" />
                </div>
                <p className="text-[10px] font-black text-[#e1ebed] uppercase tracking-[0.2em] mb-1">{t.aiPill}</p>
                <h3 className="text-xl font-black text-white mb-1 tracking-tight">{t.aiTitle}</h3>
                <p className="text-[#e1ebed] text-[12px] mb-6">{t.aiSub}</p>

                {/* Price — fixed, no discount */}
                <div className="mb-4 flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white">{BASE.ai_search}</span>
                  <div className="flex flex-col items-start">
                    <span className="text-[rgba(18,178,193,0.7)] text-sm font-bold">{t.currency}</span>
                    <span className="text-[#e1ebed] text-[11px]">{t.oneTime}</span>
                  </div>
                </div>

                {/* Coins — doubled if referral */}
                <CoinsBadge coins={finalCoins("ai_search")} doubled={hasReferral} />

                <ul className="space-y-2.5">
                  {t.aiFeatures.map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-[#7A8FAA] text-[13px]">
                      <CheckBullet color="teal" /> {f}
                    </li>
                  ))}
                </ul>
              </div>

              <button onClick={() => handlePaidPlan("ai_search")} disabled={loading !== null}
                className="mt-7 w-full py-3 rounded-2xl text-[12px] font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#7A8FAA" }}
                onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "rgba(255,255,255,0.09)"; b.style.color = "#F5F0E9"; b.style.borderColor = "rgba(255,255,255,0.15)"; }}
                onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "rgba(255,255,255,0.04)"; b.style.color = "#7A8FAA"; b.style.borderColor = "rgba(255,255,255,0.08)"; }}
              >
                {loading === "ai_search" ? <Loader2 className="animate-spin w-4 h-4" /> : <>{t.btnAi} <ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>
          </div>

          {/* ── Premium (featured, center) ── */}
          <div className="group relative rounded-3xl p-px md:-translate-y-5 transition-all duration-500 hover:md:-translate-y-7"
            style={{ background: "linear-gradient(145deg, rgba(18,178,193,0.5), rgba(18,178,193,0.1), rgba(86,108,158,0.3))" }}>
            <div className="absolute inset-0 rounded-3xl pointer-events-none"
              style={{ boxShadow: "0 0 80px rgba(18,178,193,0.15), 0 0 160px rgba(18,178,193,0.07)" }} />

            <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
              <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-white whitespace-nowrap"
                style={{ background: "linear-gradient(135deg, rgba(18,178,193,1), rgba(13,110,130,1))", boxShadow: "0 4px 20px rgba(18,178,193,0.4)" }}>
                <Sparkles className="w-2.5 h-2.5" /> {t.mostPopular}
              </div>
            </div>

            <div className="rounded-3xl p-8 flex flex-col min-h-[540px] justify-between text-left"
              style={{ background: "rgba(10,18,28,0.85)", backdropFilter: "blur(32px)" }}>
              <div>
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-5"
                  style={{ background: "rgba(18,178,193,0.1)", border: "1px solid rgba(18,178,193,0.25)", boxShadow: "0 0 20px rgba(18,178,193,0.15)" }}>
                  <ShieldCheck className="w-5 h-5 text-[rgba(18,178,193,0.9)]" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-1" style={{ color: "rgba(18,178,193,0.6)" }}>{t.premPill}</p>
                <h3 className="text-2xl font-black text-white mb-1 tracking-tight">{t.premTitle}</h3>
                <p className="text-[12px] mb-6" style={{ color: "rgba(18,178,193,0.5)" }}>{t.premSub}</p>

                {/* Price — with optional strikethrough */}
                <div className="mb-4 flex items-baseline gap-2 flex-wrap">
                  {hasReferral && (
                    <span className="text-xl font-black line-through text-white/25">{BASE.premium}</span>
                  )}
                  <span className="text-5xl font-black text-white leading-none">{finalPrice("premium")}</span>
                  <div className="flex flex-col items-start">
                    <span className="text-[rgba(18,178,193,0.7)] text-sm font-bold">{t.currency}</span>
                    <span className="text-[#e1ebed] text-[11px]">{t.oneTime}</span>
                  </div>
                </div>

                <CoinsBadge coins={finalCoins("premium")} />

                <ul className="space-y-2.5">
                  {t.premFeatures.map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-[#C8BFBA] text-[13px]">
                      <CheckBullet color="teal" /> {f}
                    </li>
                  ))}
                </ul>
              </div>

              <button onClick={() => handlePaidPlan("premium")} disabled={loading !== null}
                className="mt-7 w-full py-3.5 rounded-2xl text-[12px] font-black uppercase tracking-widest text-white flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, rgba(18,178,193,1), rgba(13,130,150,1))", boxShadow: "0 4px 24px rgba(18,178,193,0.35)" }}
                onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.boxShadow = "0 6px 32px rgba(18,178,193,0.55)"; b.style.transform = "scale(1.01)"; }}
                onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.boxShadow = "0 4px 24px rgba(18,178,193,0.35)"; b.style.transform = "scale(1)"; }}
              >
                {loading === "premium" ? <Loader2 className="animate-spin w-5 h-5" /> : <>{t.btnPrem} <ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>
          </div>

          {/* ── Gold ── */}
          <div className="group relative rounded-3xl p-px transition-all duration-500 hover:-translate-y-1"
            style={{ background: "linear-gradient(145deg, rgba(224,197,143,0.25), rgba(224,197,143,0.05), rgba(255,255,255,0.03))" }}>
            <div className="absolute inset-0 rounded-3xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{ boxShadow: "0 0 60px rgba(224,197,143,0.08)" }} />

            <div className="rounded-3xl p-7 flex flex-col min-h-[480px] justify-between text-left"
              style={{ background: "rgba(13,17,23,0.75)", backdropFilter: "blur(24px)" }}>
              <div>
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-5"
                  style={{ background: "rgba(224,197,143,0.06)", border: "1px solid rgba(224,197,143,0.15)" }}>
                  <Crown className="w-4.5 h-4.5 text-[#E0C58F] group-hover:drop-shadow-[0_0_8px_rgba(224,197,143,0.6)] transition-all" />
                </div>
                <p className="text-[10px] font-black text-[#E0C58F]/50 uppercase tracking-[0.2em] mb-1">{t.goldPill}</p>
                <h3 className="text-xl font-black text-white mb-1 tracking-tight">{t.goldTitle}</h3>
                <p className="text-[#e1ebed] text-[12px] mb-6">{t.goldSub}</p>

                {/* Price — with optional strikethrough */}
                <div className="mb-4 flex items-baseline gap-2 flex-wrap">
                  {hasReferral && (
                    <span className="text-xl font-black line-through text-white/25">{BASE.gold}</span>
                  )}
                  <span className="text-4xl font-black leading-none"
                    style={{ background: "linear-gradient(135deg, #E0C58F, #c9a85c)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    {finalPrice("gold")}
                  </span>
                  <div className="flex flex-col items-start">
                    <span className="text-[#E0C58F]/60 text-sm font-bold">{t.currency}</span>
                    <span className="text-[#e1ebed] text-[11px]">{t.oneTime}</span>
                  </div>
                </div>

                <CoinsBadge coins={finalCoins("gold")} />

                <ul className="space-y-2.5">
                  {t.goldFeatures.map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-[#7A8FAA] text-[13px]">
                      <CheckBullet color="gold" /> {f}
                    </li>
                  ))}
                </ul>
              </div>

              <button onClick={() => handlePaidPlan("gold")} disabled={loading !== null}
                className="mt-7 w-full py-3 rounded-2xl text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-40"
                style={{ background: "rgba(224,197,143,0.07)", border: "1px solid rgba(224,197,143,0.2)", color: "#E0C58F" }}
                onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "rgba(224,197,143,0.14)"; b.style.borderColor = "rgba(224,197,143,0.4)"; b.style.boxShadow = "0 4px 20px rgba(224,197,143,0.1)"; }}
                onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "rgba(224,197,143,0.07)"; b.style.borderColor = "rgba(224,197,143,0.2)"; b.style.boxShadow = "none"; }}
              >
                {loading === "gold" ? <Loader2 className="animate-spin w-4 h-4" /> : <>{t.btnGold} <ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>
          </div>

        </div>

        {/* ── Free Plan Card ── */}
        <div className="mt-8 relative rounded-3xl p-px transition-all duration-500"
          style={{ background: "linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))" }}>
          <div className="rounded-3xl px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-6"
            style={{ background: "rgba(13,17,23,0.7)", backdropFilter: "blur(24px)" }}>

            {/* Left: label + features */}
            <div className="flex items-start gap-5">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <span className="text-lg">🎁</span>
              </div>
              <div className={isRtl ? "text-right" : "text-left"}>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <p className="text-[10px] font-black text-[#7A8FAA] uppercase tracking-[0.2em]">
                    {isRtl ? "مجاني تماماً" : "Completely Free"}
                  </p>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/5 text-[#7A8FAA] border border-white/10">
                    $0
                  </span>
                </div>
                <h3 className="text-base font-black text-white mb-2 tracking-tight">
                  {isRtl ? "الخطة المجانية" : "Free Plan"}
                </h3>
                <div className="flex flex-wrap gap-x-5 gap-y-1">
                  {(isRtl
                    ? ["ملخص مهني مخصص", "وظائف مقترحة", "7 نصائح bilingual", "وثيقة Career Strategy"]
                    : ["Personalized professional summary", "Recommended job roles", "7 bilingual ATS tips", "Career Strategy document"]
                  ).map(f => (
                    <span key={f} className="flex items-center gap-1.5 text-[12px] text-[#7A8FAA]">
                      <CheckCircle2 className="w-3 h-3 text-[#7A8FAA]/50 flex-shrink-0" /> {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: button */}
            <button
              onClick={handleFreePlan}
              disabled={loading !== null}
              className="flex-shrink-0 px-7 py-3 rounded-2xl font-black text-[12px] uppercase tracking-widest transition-all duration-300 flex items-center gap-2 disabled:opacity-40 whitespace-nowrap"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#7A8FAA" }}
              onMouseEnter={e => { const b = e.currentTarget; b.style.background = "rgba(255,255,255,0.09)"; b.style.color = "#F5F0E9"; b.style.borderColor = "rgba(255,255,255,0.15)"; }}
              onMouseLeave={e => { const b = e.currentTarget; b.style.background = "rgba(255,255,255,0.04)"; b.style.color = "#7A8FAA"; b.style.borderColor = "rgba(255,255,255,0.08)"; }}
            >
              {loading === "free"
                ? <Loader2 className="animate-spin w-4 h-4" />
                : <>{isRtl ? "ابدأ مجاناً" : "Start Free"} <ArrowRight className="w-4 h-4" /></>
              }
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════
            Coin Economy Section
        ══════════════════════════════════════ */}
        <div className="mt-28">

          {/* Section header */}
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/20 bg-amber-500/5 mb-5">
              <Zap className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-[0.25em]">Coin Economy</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight mb-3">{t.coinTitle}</h2>
            <p className="text-[#e1ebed] text-sm font-medium max-w-md mx-auto leading-relaxed">{t.coinSub}</p>
          </div>

          {/* Coin rows — 3 cards */}
          <div className="grid md:grid-cols-3 gap-4">
            {t.coinRows.map((row, i) => (
              <div key={i}
                className="group relative rounded-2xl p-6 text-left transition-all duration-300 hover:-translate-y-1 overflow-hidden"
                style={{ background: "rgba(13,17,23,0.7)", border: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(20px)" }}
              >
                {/* Top accent on hover */}
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[rgba(18,178,193,0.4)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="flex items-center justify-between mb-5">
                  {/* Cost badge */}
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg"
                    style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span className="text-[11px] font-black text-amber-400 uppercase tracking-wider">{row.cost}</span>
                  </div>
                  {/* Action icon */}
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[rgba(18,178,193,0.6)]"
                    style={{ background: "rgba(18,178,193,0.06)", border: "1px solid rgba(18,178,193,0.12)" }}>
                    {coinIcon(row.icon)}
                  </div>
                </div>

                <h3 className="text-[15px] font-black text-white mb-2 tracking-tight leading-snug">{row.action}</h3>
                <p className="text-[12px] text-[#7A8FAA] leading-relaxed font-medium">{row.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Trust bar ── */}
        <div className="mt-16 flex flex-wrap justify-center items-center gap-6">
          {[
            { icon: ShieldCheck, text: t.trustSecure },
            { icon: Zap,         text: t.trustInstant },
            { icon: Globe,       text: t.trustOnce },
          ].map(({ icon: Icon, text }, i) => (
            <div key={i} className="flex items-center gap-2">
              {i > 0 && <div className="w-px h-3 bg-[rgba(86,108,158,0.2)] mr-4" />}
              <Icon className="w-3 h-3 text-[#e1ebed]/50" />
              <span className="text-[10px] font-black uppercase tracking-widest text-[#e1ebed]/40">
                {text}
              </span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
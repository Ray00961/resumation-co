import { useEffect, useRef, useState } from "react";
import { ShieldCheck, Sparkles, AtSign, User, ChevronRight, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "../supabase";
import { useLang } from "../context/LanguageContext";

type Step = "login" | "setup";

const LoginPage = () => {
  const navigate = useNavigate();
  const { lang, isRtl } = useLang();

  const [step,      setStep]      = useState<Step>("login");
  const [userId,    setUserId]    = useState<string>("");
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [username,  setUsername]  = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle"|"checking"|"available"|"taken"|"invalid">("idle");
  const [saving,     setSaving]     = useState(false);
  const [processing, setProcessing] = useState(false);

  // Prevent handlePostLogin from running twice (INITIAL_SESSION + SIGNED_IN both fire)
  const handledRef = useRef(false);

  const t = {
    en: {
      tagline: "AI Secure Portal",
      welcome: "Welcome to Resumation.co",
      sub: "Sign in with Google to access your AI-powered career workspace.",
      loginBtn: "Continue with Google",
      security: "Enterprise-Grade Security",
      infra: "Resumation™ AI Infrastructure",
      setupTitle: "Complete Your Profile",
      setupSub: "Set up your account to get started. Your username is permanent.",
      firstName: "First Name", lastName: "Last Name",
      usernameLbl: "Username", usernamePh: "e.g. john_doe",
      usernameHint: "3–20 chars · lowercase · letters, numbers, underscores only",
      checking: "Checking...", available: "Available!", taken: "Already taken", invalid: "Invalid format",
      saveBtn: "Create My Account", saving: "Saving...",
    },
    ar: {
      tagline: "بوابة الذكاء الاصطناعي الآمنة",
      welcome: "أهلاً بك في Resumation.co",
      sub: "سجّل دخولك عبر Google للوصول إلى مساحة عملك المدعومة بالذكاء الاصطناعي.",
      loginBtn: "المتابعة عبر Google",
      security: "أمان على مستوى المؤسسات",
      infra: "البنية التحتية الذكية لـ Resumation™",
      setupTitle: "أكمل ملفك الشخصي",
      setupSub: "أنشئ حسابك للبدء. اسم المستخدم دائم ويُستخدم في ملفك الشخصي العام.",
      firstName: "الاسم الأول", lastName: "اسم العائلة",
      usernameLbl: "اسم المستخدم", usernamePh: "مثال: ahmad_ali",
      usernameHint: "3–20 حرفاً · أحرف إنجليزية صغيرة وأرقام وشرطة سفلية فقط",
      checking: "جاري الفحص...", available: "متاح!", taken: "مستخدم مسبقاً", invalid: "صيغة غير صحيحة",
      saveBtn: "إنشاء حسابي", saving: "جاري الحفظ...",
    },
  }[lang];

  // ── Detect OAuth error in URL (e.g. bad_oauth_state) ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorCode = params.get("error_code");
    const errorDesc = params.get("error_description");
    if (errorCode) {
      window.history.replaceState({}, "", "/login");
      toast.error(
        errorCode === "bad_oauth_state"
          ? (isRtl ? "انتهت الجلسة، حاول مجدداً" : "Session expired. Please try again.")
          : (errorDesc?.replace(/\+/g, " ") || "Authentication failed.")
      );
    }
  }, []);

  // ── Auth state listener ──
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) {
          if (handledRef.current) return; // prevent double-invoke
          handledRef.current = true;
          await handlePostLogin(session.user.id, session.user);
        }
        if (event === "SIGNED_OUT") {
          handledRef.current = false;
          setProcessing(false);
        }
      }
    );
    return () => {
      subscription.unsubscribe();
      handledRef.current = false;
    };
  }, []);

  const handlePostLogin = async (uid: string, user: any) => {
    setProcessing(true);
    setUserId(uid);

    // Sync to Make.com — fire and forget, never block login
    const MAKE_URL = import.meta.env.VITE_MAKE_LOGIN_SYNC;
    if (MAKE_URL) {
      const pending = localStorage.getItem("pending_user_data");
      const parsed  = pending ? JSON.parse(pending) : {};
      fetch(MAKE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: uid, email: user.email,
          region: parsed.region || "LB", language: parsed.language || lang,
          lat: parsed.lat || 0, lon: parsed.lon || 0,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {});
      if (pending) localStorage.removeItem("pending_user_data");
    }

    // Check if user already completed setup
    const { data: userData } = await supabase
      .from("users")
      .select("username, first_name")
      .eq("id", uid)
      .maybeSingle();

    if (userData?.username) {
      navigate("/dashboard");
    } else {
      const fullName: string = user.user_metadata?.full_name || "";
      const parts = fullName.trim().split(" ");
      setFirstName(parts[0] || "");
      setLastName(parts.slice(1).join(" ") || "");
      setProcessing(false);
      setStep("setup");
    }
  };

  // ── Google OAuth — simple, no localStorage manipulation ──
  const handleGoogleLogin = async () => {
    try {
      setProcessing(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/login`,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) throw error;
      // Page will redirect — processing stays true until redirect
    } catch (err: any) {
      setProcessing(false);
      toast.error(err.message);
    }
  };

  // ── Username check ──
  const usernameRegex = /^[a-z0-9_]{3,20}$/;
  const handleUsernameChange = async (val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setUsername(clean);
    if (!usernameRegex.test(clean)) {
      setUsernameStatus(clean.length > 0 ? "invalid" : "idle");
      return;
    }
    setUsernameStatus("checking");
    const { data } = await supabase.from("users").select("id").eq("username", clean).maybeSingle();
    setUsernameStatus(data ? "taken" : "available");
  };

  // ── Save profile (new user setup) ──
  const handleSaveProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error(isRtl ? "الرجاء ملء الاسم الأول والأخير" : "Please fill in your first and last name");
      return;
    }
    if (usernameStatus !== "available") {
      toast.error(isRtl ? "الرجاء اختيار اسم مستخدم صحيح ومتاح" : "Please choose a valid, available username");
      return;
    }
    setSaving(true);
    const profileData = { first_name: firstName.trim(), last_name: lastName.trim(), username: username.trim() };

    const { error: uErr } = await supabase.from("users").upsert({ id: userId, ...profileData }, { onConflict: "id" });
    if (uErr) {
      setSaving(false);
      if (uErr.code === "23505") { setUsernameStatus("taken"); toast.error(isRtl ? "اسم المستخدم محجوز" : "Username taken, try another"); }
      else toast.error(uErr.message);
      return;
    }
    const { error: pErr } = await supabase.from("profiles").upsert({ id: userId, ...profileData }, { onConflict: "id" });
    if (pErr) {
      setSaving(false);
      toast.error(pErr.message);
      return;
    }
    setSaving(false);
    toast.success(isRtl ? "تم إنشاء حسابك بنجاح!" : "Account created successfully!");
    navigate("/dashboard");
  };

  const canSave = firstName.trim() && lastName.trim() && usernameStatus === "available" && !saving;
  const inp = "w-full bg-[rgba(60,80,125,0.06)] border border-[rgba(60,80,125,0.2)] rounded-lg px-4 py-3 text-sm text-[#F5F0E9] outline-none focus:border-[#12B2C1]/50 transition-colors placeholder-[#566C9E]";

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-[#0D1117] px-4 py-16 relative overflow-hidden"
      dir={isRtl ? "rtl" : "ltr"}
      style={{ fontFamily: isRtl ? "'Tajawal', sans-serif" : "'Plus Jakarta Sans', sans-serif" }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-[-10%] right-[20%] w-[500px] h-[500px] rounded-full bg-[rgba(18,178,193,0.05)] blur-[130px]" />
        <div className="absolute bottom-[-10%] left-[15%] w-[400px] h-[400px] rounded-full bg-[rgba(60,80,125,0.07)] blur-[110px]" />
      </div>

      <div className="relative z-10 w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background:"rgba(13,17,23,0.85)", backdropFilter:"blur(28px)", border:"1px solid rgba(60,80,125,0.2)", boxShadow:"0 0 60px rgba(18,178,193,0.04), 0 24px 48px rgba(0,0,0,0.4)" }}>

        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#12B2C1]/40 to-transparent" />

        <div className="p-8 lg:p-10">

          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-xl bg-[rgba(17,34,80,0.8)] border border-[#3C507D]/30 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(18,178,193,0.08)]">
              <Sparkles strokeWidth={1.5} className="w-7 h-7 text-[#E0C58F]" />
            </div>
            <span className="text-lg font-bold tracking-widest text-[#F5F0E9] uppercase">
              Resumation<span className="text-[#E0C58F]">.co</span>
            </span>
            <span className="text-[9px] font-mono tracking-[0.3em] text-[#566C9E] uppercase mt-1">{t.tagline}</span>
          </div>

          {/* ── STEP: LOGIN ── */}
          {step === "login" && (
            <div className="flex flex-col items-center gap-6">
              <div className="text-center">
                <h2 className="text-xl font-bold text-[#F5F0E9] mb-2">{t.welcome}</h2>
                <p className="text-xs text-[#A8B4CC] leading-[1.8]">{t.sub}</p>
              </div>

              <button
                onClick={handleGoogleLogin}
                disabled={processing}
                className="w-full flex items-center justify-center gap-3 py-4 px-5 rounded-xl font-bold text-sm text-[#F5F0E9] transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed hover:shadow-[0_0_24px_rgba(18,178,193,0.12)]"
                style={{ background:"rgba(60,80,125,0.1)", border:"1px solid rgba(60,80,125,0.25)" }}
              >
                {processing ? (
                  <><Loader2 className="w-5 h-5 animate-spin text-[#12B2C1]"/><span>{isRtl ? "جاري تسجيل الدخول..." : "Signing in..."}</span></>
                ) : (
                  <>
                    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    <span>{t.loginBtn}</span>
                  </>
                )}
              </button>

              <div className="w-full pt-4 border-t border-[#3C507D]/10 flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[rgba(18,178,193,0.04)] border border-[#12B2C1]/10">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#12B2C1]"/>
                  <span className="text-[9px] font-mono text-[#12B2C1] uppercase tracking-widest">{t.security}</span>
                </div>
                <span className="text-[9px] text-[#3C507D] font-mono tracking-wider uppercase">{t.infra}</span>
              </div>
            </div>
          )}

          {/* ── STEP: SETUP ── */}
          {step === "setup" && (
            <div className="flex flex-col gap-5">
              <div className="text-center mb-1">
                <h2 className="text-lg font-bold text-[#F5F0E9] mb-1.5">{t.setupTitle}</h2>
                <p className="text-xs text-[#A8B4CC] leading-[1.8]">{t.setupSub}</p>
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-[11px] font-semibold text-[#E0C58F] uppercase tracking-wider">
                  <User className="w-3.5 h-3.5"/> {t.firstName}
                </label>
                <input value={firstName} onChange={e=>setFirstName(e.target.value)} className={inp} placeholder={isRtl?"أحمد":"John"}/>
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-[11px] font-semibold text-[#E0C58F] uppercase tracking-wider">
                  <User className="w-3.5 h-3.5"/> {t.lastName}
                </label>
                <input value={lastName} onChange={e=>setLastName(e.target.value)} className={inp} placeholder={isRtl?"علي":"Doe"}/>
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-[11px] font-semibold text-[#E0C58F] uppercase tracking-wider">
                  <AtSign className="w-3.5 h-3.5"/> {t.usernameLbl}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#566C9E] text-sm font-mono select-none">@</span>
                  <input value={username} onChange={e=>handleUsernameChange(e.target.value)} dir="ltr"
                    className={`${inp} pl-8 pr-10 font-mono`} placeholder={t.usernamePh} maxLength={20}/>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {usernameStatus==="checking"  && <Loader2 className="w-4 h-4 text-[#566C9E] animate-spin"/>}
                    {usernameStatus==="available" && <CheckCircle2 className="w-4 h-4 text-emerald-400"/>}
                    {(usernameStatus==="taken"||usernameStatus==="invalid") && <XCircle className="w-4 h-4 text-red-400"/>}
                  </div>
                </div>
                <div className="text-[10px] font-mono">
                  {usernameStatus==="idle"      && <span className="text-[#566C9E]">{t.usernameHint}</span>}
                  {usernameStatus==="checking"  && <span className="text-[#566C9E]">{t.checking}</span>}
                  {usernameStatus==="available" && <span className="text-emerald-400">{t.available}</span>}
                  {usernameStatus==="taken"     && <span className="text-red-400">{t.taken}</span>}
                  {usernameStatus==="invalid"   && <span className="text-amber-400">{t.usernameHint}</span>}
                </div>
              </div>

              <button onClick={handleSaveProfile} disabled={!canSave}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm text-[#0D1117] transition-all duration-300 mt-2 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: canSave ? "linear-gradient(135deg,#12B2C1,#0E8F9C)" : "rgba(60,80,125,0.3)" }}>
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin"/> {t.saving}</>
                  : <>{t.saveBtn} <ChevronRight className="w-4 h-4"/></>}
              </button>
            </div>
          )}

        </div>
        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[#E0C58F]/20 to-transparent" />
      </div>
    </div>
  );
};

export default LoginPage;

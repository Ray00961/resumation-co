import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Download, Loader2, FileText, FileType, Clock,
  CheckCircle2, ShieldCheck, AlertCircle,
  UserCircle, Activity, ArrowUpRight,
  Pencil, Star, Plus, ExternalLink, BrainCircuit,
  Zap, Crown,
} from "lucide-react";
import { supabase } from "../supabase";
import { RealtimeChannel } from "@supabase/supabase-js";
import { toast } from "sonner";
import { useLang } from "../context/LanguageContext";
import PromoCodeBanner from "./PromoCodeBanner";

interface ArchiveItem {
  id: string;
  created_at_utc: string;
  created_at?: string;        // backward compat
  created_at_beirut?: string;
  cv_pdf_url: string | null;
  cv_file_path?: string | null;
  submission_id?: string | null;
  cv_target_job?: string;     // renamed from target_job
  cv_first_name?: string;     // replaces user_name
  cv_last_name?: string;
  username?: string;
  package_name?: string;
  region?: string;
  agreed_to_terms?: boolean;
  cv_data?: Record<string, any> | null;
  computedType?: 'cv' | 'cover' | 'analysis';
}

const TRANSLATIONS = {
  en: {
    activeEntity:      "Active Entity",
    formsManagement:   "Forms Management",
    // Coin economy
    coinsAvailable:    "Coins Available",
    founderBadge:      "Founder",
    liveArchiveStatus: "Live Archive Status",
    cvForms:           "CV Forms",
    tracking:          "Tracking",
    newForm:           "New Form",
    thDate:            "Date",
    thTargetJob:       "Target Job",
    thSubmissionId:    "Submission ID",
    thPlan:            "Plan",
    thDefault:         "Default",
    thActions:         "Actions",
    noForms:           "No forms yet. Click",
    noFormsEnd:        "to build your first CV.",
    verified:          "Verified",
    setDefaultTitle:   "Set as default public CV",
    noDataTitle:       "No form data available",
    edit:              "Edit",
    buildMyCv:         "Build My CV",
    noRecords:         "No records detected in your encrypted archive.",
    document:          "Document",
    status:            "Status",
    ready:             "Ready",
    processing:        "Processing",
    download:          "Download",
    upgradePremium:    "Upgrade Premium",
    goldPlan:          "Gold Plan",
    analyzeCv:         "Analyze CV",
    editCv:            "Edit CV",
    defaultUpdated:    "Default CV updated! Public profile now reflects this submission. 🌟",
    noFormData:        "No form data found for this submission.",
    downloadFailed:    "Download failed. Please try again.",
    documentReady:     "Document Ready!",
    documentReadyDesc: "Your document is ready for download.",
  },
  ar: {
    activeEntity:      "المستخدم الحالي",
    formsManagement:   "إدارة النماذج",
    // Coin economy
    coinsAvailable:    "كوين متاحة",
    founderBadge:      "مؤسس",
    liveArchiveStatus: "حالة الأرشيف",
    cvForms:           "نماذجي",
    tracking:          "خدماتي",
    newForm:           "نموذج جديد",
    thDate:            "التاريخ",
    thTargetJob:       "الوظيفة المستهدفة",
    thSubmissionId:    "رقم الطلب",
    thPlan:            "الباقة",
    thDefault:         "الافتراضي",
    thActions:         "الإجراءات",
    noForms:           "لا توجد نماذج بعد. اضغط",
    noFormsEnd:        "لبناء أول سيرة ذاتية.",
    verified:          "موثّق",
    setDefaultTitle:   "تعيين كسيرة ذاتية عامة افتراضية",
    noDataTitle:       "لا توجد بيانات لهذا النموذج",
    edit:              "تعديل",
    buildMyCv:         "ابنِ سيرتي",
    noRecords:         "لا توجد سجلات في أرشيفك المشفر.",
    document:          "المستند",
    status:            "الحالة",
    ready:             "جاهز",
    processing:        "قيد المعالجة",
    download:          "تحميل",
    upgradePremium:    "ترقية Premium",
    goldPlan:          "باقة Gold",
    analyzeCv:         "تحليل السيرة",
    editCv:            "تعديل السيرة",
    defaultUpdated:    "تم تحديث السيرة الافتراضية! الملف الشخصي العام يعكس هذا الطلب الآن. 🌟",
    noFormData:        "لا توجد بيانات لهذا الطلب.",
    downloadFailed:    "فشل التحميل. يرجى المحاولة مجدداً.",
    documentReady:     "المستند جاهز!",
    documentReadyDesc: "سيرتك الذاتية جاهزة للتحميل.",
  },
} as const;

export default function MyAccount() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isDownloadsView = searchParams.get("view") === "downloads";

  const { lang, isRtl } = useLang();
  const t = TRANSLATIONS[lang];

  const [archive, setArchive]         = useState<ArchiveItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [userName, setUserName]       = useState("USER");
  const [userId, setUserId]           = useState<string>("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [defaultFormId, setDefaultFormId] = useState<string | null>(null);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);

  // ── Coin economy state ──
  const [coinBalance,    setCoinBalance]    = useState<number>(0);
  const [isFounder,      setIsFounder]      = useState<boolean>(false);
  const [promoCode,      setPromoCode]      = useState<string | null>(null);
  const [promoExpiresAt, setPromoExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let coinsChannel: RealtimeChannel | null = null;

    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
    const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

    // ── 1. Read session synchronously from localStorage ──
    const lsKey = Object.keys(localStorage).find(
      k => k.startsWith("sb-") && k.endsWith("-auth-token")
    );
    let uid         = "";
    let accessToken: string | null = null;

    if (lsKey) {
      try {
        const cached = JSON.parse(localStorage.getItem(lsKey) || "null");
        uid         = cached?.user?.id          ?? "";
        accessToken = cached?.access_token      ?? null;
        const meta  = cached?.user?.user_metadata ?? {};
        const email = cached?.user?.email        ?? "";

        if (uid) {
          setUserId(uid);
          if (meta.full_name) {
            setUserName(meta.full_name.split(" ")[0].toUpperCase());
          } else if (email) {
            setUserName(email.split("@")[0].toUpperCase());
          }
          // Restore persisted default form selection
          const saved = localStorage.getItem(`rsm_default_${uid}`);
          if (saved) setDefaultFormId(saved);
        }
      } catch {}
    }

    if (!uid) {
      navigate("/login");
      setLoading(false);
      return;
    }

    const authHeader = `Bearer ${accessToken ?? SUPABASE_KEY}`;

    // ── 2. Direct Fetch cv_archive — no supabase.from() ──
    const fetchArchives = async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/cv_archive?user_id=eq.${uid}&order=created_at_utc.desc&select=*`,
          { headers: { "apikey": SUPABASE_KEY, "Authorization": authHeader } }
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setArchive(processArchiveData(data));
        }
      } catch {}
      finally {
        setLoading(false);
      }
    };

    fetchArchives();

    // ── 2b. Fetch coin economy data from users table ──
    const fetchUserCoins = async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/users?id=eq.${uid}&select=search_coins,promo_code,promo_expires_at,is_founder`,
          { headers: { "apikey": SUPABASE_KEY, "Authorization": authHeader } }
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setCoinBalance(data[0].search_coins  ?? 0);
            setIsFounder(  data[0].is_founder    ?? false);
            setPromoCode(  data[0].promo_code    ?? null);
            setPromoExpiresAt(data[0].promo_expires_at ?? null);
          }
        }
      } catch {}
    };

    fetchUserCoins();

    // ── 3. Realtime listener ──
    channel = supabase.channel("my-account-updates").on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "cv_archive", filter: `user_id=eq.${uid}` },
      (payload) => {
        if (payload.new.cv_pdf_url) {
          toast.success(t.documentReady, { description: t.documentReadyDesc, icon: "🚀" });
        }
        fetchArchives();
      }
    ).subscribe();

    // ── Realtime: coin balance updates ──
    coinsChannel = supabase.channel(`user-coins-${uid}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "users", filter: `id=eq.${uid}` },
        (payload: any) => {
          // Defense-in-depth: verify row belongs to current user (RLS already enforces this server-side)
          if (payload.new?.id !== uid) return;
          if (payload.new?.search_coins !== undefined) {
            setCoinBalance(payload.new.search_coins ?? 0);
          }
        }
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
      if (coinsChannel) supabase.removeChannel(coinsChannel);
    };
  }, [navigate]);

  const processArchiveData = (data: ArchiveItem[]) => {
    return data.map(item => {
      const target = (item.cv_target_job || "").toLowerCase();
      let type: 'cv' | 'cover' | 'analysis' = 'cv';
      if (target.includes("analysis") || target.includes("review")) type = 'analysis';
      else if (target.includes("cover") || target.includes("cl"))   type = 'cover';
      return { ...item, computedType: type };
    });
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getDocDetails = (item: ArchiveItem) => {
    const rawName = (item.cv_first_name && item.cv_last_name)
      ? `${item.cv_first_name} ${item.cv_last_name}`
      : (item.cv_first_name || item.cv_data?.fullName || item.username || userName);
    const displayName = rawName.toUpperCase();
    if (item.computedType === 'analysis') return { name: `ATS ANALYSIS — ${displayName}`, icon: <AlertCircle className="w-4 h-4 text-amber-400" />, color: "bg-amber-500/10 border-amber-500/20" };
    if (item.computedType === 'cover')   return { name: `COVER LETTER — ${displayName}`, icon: <FileType className="w-4 h-4 text-cyber-cyan" />, color: "bg-cyber-teal/10 border-cyber-teal/20" };
    return { name: `PROFESSIONAL CV — ${displayName}`, icon: <FileText className="w-4 h-4 text-cyber-cyan" />, color: "bg-cyber-cyan/10 border-cyber-cyan/20" };
  };

  const handleDownload = async (item: ArchiveItem) => {
    setDownloadingId(item.id);
    try {
      if (item.cv_file_path) {
        const { data, error } = await supabase.storage.from('cv-files-download').createSignedUrl(item.cv_file_path, 300);
        if (!error && data?.signedUrl) { window.open(data.signedUrl, '_blank'); return; }
      }
      if (item.cv_pdf_url) {
        const docId = item.cv_pdf_url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1];
        if (docId) { window.open(`https://docs.google.com/document/d/${docId}/export?format=pdf`, '_blank'); return; }
        window.open(item.cv_pdf_url, '_blank');
      }
    } catch {
      toast.error(t.downloadFailed);
    } finally {
      setDownloadingId(null);
    }
  };

  const getUpgradeButtons = (item: ArchiveItem) => {
    const plan = (item.package_name || 'free').toLowerCase();
    const buttons: { label: string; color: string; target: string }[] = [];
    if (item.computedType === 'cv' || !item.computedType) {
      buttons.push({ label: t.editCv, color: 'cyan', target: 'edit' });
    }
    if (plan === 'free') {
      buttons.push({ label: t.upgradePremium, color: 'cyan',  target: 'premium'  });
      buttons.push({ label: t.goldPlan,       color: 'teal', target: 'gold'     });
      buttons.push({ label: t.analyzeCv,      color: 'teal', target: 'analysis' });
    } else if (plan === 'premium') {
      buttons.push({ label: t.goldPlan,  color: 'teal', target: 'gold'     });
      buttons.push({ label: t.analyzeCv, color: 'teal', target: 'analysis' });
    } else if (plan === 'gold') {
      buttons.push({ label: t.analyzeCv, color: 'teal', target: 'analysis' });
    }
    return buttons;
  };

  const handleUpgrade = (item: ArchiveItem, target: string) => {
    if (target === 'analysis') { navigate('/analyse'); return; }
    if (target === 'edit')     { navigate(`/build/${item.id}`); return; }
    const sid = item.submission_id || item.id;
    navigate(`/plans?id=${sid}`);
  };

  const handleSetDefault = async (item: ArchiveItem) => {
    if (!userId || !item.cv_data) { toast.error(t.noFormData); return; }
    setSettingDefault(item.id);
    try {
      const cv = item.cv_data;
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const lsKey = Object.keys(localStorage).find(k => k.startsWith("sb-") && k.endsWith("-auth-token"));
      const accessToken = lsKey ? (JSON.parse(localStorage.getItem(lsKey) || "null")?.access_token ?? null) : null;

      const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
        method: "POST",
        headers: {
          "apikey":        SUPABASE_KEY,
          "Authorization": `Bearer ${accessToken ?? SUPABASE_KEY}`,
          "Content-Type":  "application/json",
          "Prefer":        "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          id:          userId,
          phone:       cv.phone     || "",
          target_jobs: cv.targetJob ? [cv.targetJob] : [],
          skills:      Array.isArray(cv.technicalSkills) ? cv.technicalSkills : [],
          headline:    cv.targetJob || "",
          experience:  (cv.workExperience || [])
            .filter((w: any) => w.jobTitle || w.company)
            .map((w: any) => ({
              title:       w.jobTitle        || "",
              company:     w.company         || "",
              duration:    `${w.startDate || ""}${w.endDate ? " - " + w.endDate : ""}`.trim(),
              description: w.responsibilities || "",
            })),
          education: (cv.education || [])
            .filter((e: any) => e.degree || e.university)
            .map((e: any) => ({
              degree:      e.degree         || "",
              institution: e.university     || "",
              major:       e.major          || "",
              year:        e.graduationYear || "",
            })),
          updated_at: new Date().toISOString(),
        }),
      });

      if (res.ok) {
        setDefaultFormId(item.id);
        localStorage.setItem(`rsm_default_${userId}`, item.id);
        toast.success(t.defaultUpdated);
      } else {
        const err = await res.text();
        toast.error(`Failed to set default: ${err}`);
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setSettingDefault(null);
    }
  };

  const colorMap: Record<string, string> = {
    cyan: 'border-[rgba(224,197,143,0.30)] text-[#E0C58F] hover:bg-[#E0C58F] hover:text-[#0D1117]',
    teal: 'border-cyber-teal/30 text-cyber-teal hover:bg-cyber-teal hover:text-white',
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-cyber-bg">
      <Loader2 className="animate-spin text-[#E0C58F] w-10 h-10" />
    </div>
  );

  return (
    <div
      className="min-h-screen bg-cyber-bg text-cyber-text/90 font-sans relative overflow-hidden"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-cyber-teal/5 rounded-full blur-[120px] pointer-events-none" />

      <main className="relative z-10 p-6 md:p-12">
        <div className="max-w-7xl mx-auto">

          {/* ── Section header ── */}
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
            <div>
              <div className="flex items-center gap-2 text-[#E0C58F] mb-2 font-black text-[11px] uppercase tracking-[0.3em]">
                <Activity className="w-4 h-4 animate-pulse" />
                {isDownloadsView ? t.liveArchiveStatus : t.formsManagement}
              </div>
              <h2 className="text-2xl lg:text-3xl font-black text-white uppercase tracking-wide">
                {isDownloadsView
                  ? isRtl
                    ? <>{t.tracking}</>
                    : <>Your Services <span className="text-[#E0C58F]">Tracking</span></>
                  : isRtl
                    ? <>{t.cvForms}</>
                    : <><span className="text-[#E0C58F]">My</span> CV Forms</>
                }
              </h2>
            </div>
            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
              <UserCircle className="w-10 h-10 text-cyber-dim flex-shrink-0" />
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-black text-cyber-dim uppercase tracking-widest">{t.activeEntity}</span>
                <span className="text-sm font-black text-white">{userName}</span>

                {/* ── Coin balance + Founder badge ── */}
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                    style={{ background: "rgba(245,158,11,0.09)", border: "1px solid rgba(245,158,11,0.22)" }}
                  >
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span className="text-[11px] font-black text-amber-400 tabular-nums">
                      {coinBalance} {t.coinsAvailable}
                    </span>
                  </div>

                  {isFounder && (
                    <div
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg"
                      style={{ background: "rgba(224,197,143,0.09)", border: "1px solid rgba(224,197,143,0.25)" }}
                    >
                      <Crown className="w-3 h-3 text-[#E0C58F]" />
                      <span className="text-[11px] font-black text-[#E0C58F]">
                        {t.founderBadge} 👑
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── PromoCodeBanner — renders itself only if code is not expired ── */}
          {promoCode && promoExpiresAt && (
            <PromoCodeBanner
              promoCode={promoCode}
              promoExpiresAt={promoExpiresAt}
              isFounder={isFounder}
            />
          )}

          {/* ══════════════════════════════════════
              VIEW: FORMS MANAGEMENT (My Resumes)
          ══════════════════════════════════════ */}
          {!isDownloadsView && (
            <div className="space-y-5">

              {/* + New Form */}
              <div className="flex justify-end">
                <button
                  onClick={() => navigate('/build')}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest bg-[#E0C58F] text-[#0D1117] hover:bg-[#F0DFBF] transition-all shadow-lg shadow-[rgba(224,197,143,0.25)]"
                >
                  <Plus className="w-4 h-4" /> {t.newForm}
                </button>
              </div>

              <div className="bg-[rgba(35,113,123,0.1)] backdrop-blur-xl rounded-[2.5rem] shadow-2xl border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white/5 text-cyber-dim text-[11px] uppercase tracking-[0.2em] font-black border-b border-white/5">
                        <th className="px-6 py-5">{t.thDate}</th>
                        <th className="px-6 py-5">{t.thTargetJob}</th>
                        <th className="px-6 py-5">{t.thSubmissionId}</th>
                        <th className="px-6 py-5">{t.thPlan}</th>
                        <th className="px-6 py-5 text-center">{t.thDefault}</th>
                        <th className={`px-6 py-5 ${isRtl ? 'text-left' : 'text-right'}`}>{t.thActions}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {archive.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-20 text-center text-cyber-dim font-bold uppercase tracking-widest text-xs italic">
                            {t.noForms} <span className="text-[#E0C58F]">+ {t.newForm}</span> {t.noFormsEnd}
                          </td>
                        </tr>
                      ) : (
                        archive.map((item) => {
                          const isDefault = defaultFormId === item.id;
                          const isSetting = settingDefault === item.id;
                          const hasCvData = !!item.cv_data;
                          return (
                            <tr key={item.id} className="hover:bg-white/5 transition-all duration-300">

                              <td className="px-6 py-5">
                                <div className="flex flex-col gap-1">
                                  <span className="text-sm font-black text-white">{formatDate(item.created_at_utc || item.created_at)}</span>
                                  {item.agreed_to_terms && (
                                    <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-black uppercase tracking-widest">
                                      <ShieldCheck className="w-3 h-3" /> {t.verified}
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="px-6 py-5">
                                <span className="text-xs font-bold text-white truncate max-w-[180px] block">
                                  {item.cv_target_job || item.cv_first_name || '—'}
                                </span>
                              </td>

                              <td className="px-6 py-5">
                                <span className="font-mono text-[12px] text-cyber-muted bg-white/5 px-3 py-1 rounded-lg border border-white/5">
                                  {item.submission_id || item.id.slice(0, 8).toUpperCase()}
                                </span>
                              </td>

                              <td className="px-6 py-5">
                                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                                  (item.package_name || '').toLowerCase() === 'gold'
                                    ? 'bg-cyber-cyan/10 text-cyber-cyan border-cyber-cyan/20'
                                    : (item.package_name || '').toLowerCase() === 'premium'
                                    ? 'bg-cyber-teal/10 text-cyber-teal border-cyber-teal/20'
                                    : 'bg-white/5 text-cyber-dim border-white/10'
                                }`}>
                                  {item.package_name || 'Free'}
                                </span>
                              </td>

                              <td className="px-6 py-5 text-center">
                                <button
                                  title={hasCvData ? t.setDefaultTitle : t.noDataTitle}
                                  disabled={!hasCvData || isSetting}
                                  onClick={() => !isDefault && handleSetDefault(item)}
                                  className={`w-8 h-8 rounded-xl flex items-center justify-center mx-auto transition-all border ${
                                    isDefault
                                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                                      : hasCvData
                                      ? 'bg-white/5 border-white/10 text-cyber-dim hover:border-amber-500/40 hover:text-amber-400 cursor-pointer'
                                      : 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed'
                                  }`}
                                >
                                  {isSetting
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : <Star className={`w-3.5 h-3.5 ${isDefault ? 'fill-amber-400' : ''}`} />
                                  }
                                </button>
                              </td>

                              <td className="px-6 py-5">
                                <div className={`flex items-center ${isRtl ? 'justify-start' : 'justify-end'} gap-2 flex-wrap`}>
                                  <button
                                    onClick={() => navigate(`/build/${item.id}`)}
                                    className="border border-[rgba(224,197,143,0.30)] text-[#E0C58F] hover:bg-[#E0C58F] hover:text-[#0D1117] px-4 py-2 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all inline-flex items-center gap-1.5"
                                  >
                                    <Pencil className="w-3 h-3" /> {t.edit}
                                  </button>
                                  <button
                                    onClick={() => navigate(`/plans?id=${item.submission_id || item.id}`)}
                                    className="border border-cyber-teal/30 text-cyber-teal hover:bg-cyber-teal hover:text-white px-4 py-2 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all inline-flex items-center gap-1.5"
                                  >
                                    <ExternalLink className="w-3 h-3" /> {t.buildMyCv}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════
              VIEW: DOWNLOADS (Archive / PDFs)
          ══════════════════════════════════════ */}
          {isDownloadsView && (
            <div className="bg-[rgba(35,113,123,0.1)] backdrop-blur-xl rounded-[2.5rem] shadow-2xl border border-white/5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5 text-cyber-dim text-[11px] uppercase tracking-[0.2em] font-black border-b border-white/5">
                      <th className="px-6 py-5">{t.thDate}</th>
                      <th className="px-6 py-5">{t.document}</th>
                      <th className="px-6 py-5">{t.thSubmissionId}</th>
                      <th className="px-6 py-5">{t.thPlan}</th>
                      <th className="px-6 py-5 text-center">{t.status}</th>
                      <th className={`px-6 py-5 ${isRtl ? 'text-left' : 'text-right'}`}>{t.thActions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {archive.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-20 text-center text-cyber-dim font-bold uppercase tracking-widest text-xs italic">
                          {t.noRecords}
                        </td>
                      </tr>
                    ) : (
                      archive.map((item) => {
                        const docInfo        = getDocDetails(item);
                        const upgradeButtons = getUpgradeButtons(item);
                        const isDownloading  = downloadingId === item.id;
                        return (
                          <tr key={item.id} className="hover:bg-white/5 transition-all duration-300">
                            <td className="px-6 py-5">
                              <div className="flex flex-col gap-1">
                                <span className="text-sm font-black text-white">{formatDate(item.created_at_utc || item.created_at)}</span>
                                {item.agreed_to_terms && (
                                  <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-black uppercase tracking-widest">
                                    <ShieldCheck className="w-3 h-3" /> {t.verified}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${docInfo.color}`}>
                                  {docInfo.icon}
                                </div>
                                <span className="text-xs font-black text-white uppercase tracking-wide">{docInfo.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <span className="font-mono text-[12px] text-cyber-muted bg-white/5 px-3 py-1 rounded-lg border border-white/5">
                                {item.submission_id || item.id.slice(0, 8).toUpperCase()}
                              </span>
                            </td>
                            <td className="px-6 py-5">
                              <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                                (item.package_name || '').toLowerCase() === 'gold'
                                  ? 'bg-cyber-cyan/10 text-cyber-cyan border-cyber-cyan/20'
                                  : (item.package_name || '').toLowerCase() === 'premium'
                                  ? 'bg-cyber-teal/10 text-cyber-teal border-cyber-teal/20'
                                  : 'bg-white/5 text-cyber-dim border-white/10'
                              }`}>
                                {item.package_name || 'Free'}
                              </span>
                            </td>
                            <td className="px-6 py-5 text-center">
                              {item.cv_pdf_url || item.cv_file_path ? (
                                <span className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 inline-flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3 h-3" /> {t.ready}
                                </span>
                              ) : (
                                <span className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse inline-flex items-center gap-1.5">
                                  <Clock className="w-3 h-3" /> {t.processing}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-5">
                              <div className={`flex items-center ${isRtl ? 'justify-start' : 'justify-end'} gap-2 flex-wrap`}>
                                {(item.cv_pdf_url || item.cv_file_path) && (
                                  <button
                                    onClick={() => handleDownload(item)}
                                    disabled={isDownloading}
                                    className="bg-cyber-teal/10 text-cyber-teal border border-cyber-teal/20 px-4 py-2 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-cyber-teal hover:text-white transition-all inline-flex items-center gap-2 group shadow-lg"
                                  >
                                    {isDownloading
                                      ? <Loader2 className="w-3 h-3 animate-spin" />
                                      : <Download className="w-3 h-3 group-hover:translate-y-0.5 transition-transform" />
                                    }
                                    {t.download}
                                  </button>
                                )}
                                {/* ── Analyse CV — direct link with subid ── */}
                                {item.submission_id && (
                                  <button
                                    onClick={() => window.open(`/analyse?subid=${item.submission_id}`, '_blank')}
                                    className="bg-[rgba(224,197,143,0.10)] border border-[rgba(224,197,143,0.30)] text-[#E0C58F] hover:bg-[#E0C58F] hover:text-[#0D1117] px-4 py-2 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all inline-flex items-center gap-1.5 shadow-[0_0_12px_rgba(224,197,143,0.10)]"
                                  >
                                    <BrainCircuit className="w-3 h-3" /> {t.analyzeCv}
                                  </button>
                                )}
                                {upgradeButtons.map((btn) => (
                                  <button
                                    key={btn.target}
                                    onClick={() => handleUpgrade(item, btn.target)}
                                    className={`border px-4 py-2 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all inline-flex items-center gap-1.5 ${colorMap[btn.color]}`}
                                  >
                                    <ArrowUpRight className="w-3 h-3" />
                                    {btn.label}
                                  </button>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

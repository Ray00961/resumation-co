import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Download, Loader2, FileText, FileType, Clock,
  CheckCircle2, ShieldCheck, AlertCircle,
  UserCircle, Activity, ArrowUpRight,
  Pencil, Star, Plus, ExternalLink, BrainCircuit,
  Zap, Crown, Trash2, TriangleAlert,
} from "lucide-react";
import { supabase } from "../supabase";
import { RealtimeChannel } from "@supabase/supabase-js";
import { toast } from "sonner";
import { useLang } from "../context/LanguageContext";
import PromoCodeBanner from "./PromoCodeBanner";

interface ArchiveItem {
  form_id: string;
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
    edit:              "Edit Form",
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
    upgradePlan:       "Upgrade My Plan",
    upgradeError:      "Could not start payment — redirecting to Plans page.",
    documentReady:     "Document Ready!",
    documentReadyDesc: "Your document is ready for download.",
    deleteAccount:     "Delete Account",
    deleteModalTitle:  "Permanently Delete Account?",
    deleteModalDesc:   "This will erase ALL your data — CVs, documents, analysis results, coins, and your login. This cannot be undone.",
    deleteModalConfirmLabel: "Type DELETE to confirm",
    deleteModalConfirmPlaceholder: "DELETE",
    deleteModalCancel: "Cancel",
    deleteModalConfirm: "Delete Everything",
    deleteSuccess:     "Account deleted. Goodbye 👋",
    deleteFailed:      "Deletion failed. Please try again.",
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
    edit:              "تعديل النموذج",
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
    upgradePlan:       "ترقية باقتي",
    upgradeError:      "تعذّر بدء الدفع — سيتم توجيهك لصفحة الباقات.",
    documentReady:     "المستند جاهز!",
    documentReadyDesc: "سيرتك الذاتية جاهزة للتحميل.",
    deleteAccount:     "حذف الحساب",
    deleteModalTitle:  "حذف الحساب نهائياً؟",
    deleteModalDesc:   "سيُمحى كل شيء — السير الذاتية، المستندات، نتائج التحليل، الكوينز، وبيانات تسجيل الدخول. لا يمكن التراجع.",
    deleteModalConfirmLabel: "اكتب DELETE للتأكيد",
    deleteModalConfirmPlaceholder: "DELETE",
    deleteModalCancel: "إلغاء",
    deleteModalConfirm: "احذف كل شيء",
    deleteSuccess:     "تم حذف الحساب. وداعاً 👋",
    deleteFailed:      "فشل الحذف. حاول مجدداً.",
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
  const [upgradingId,   setUpgradingId]   = useState<string | null>(null);
  const [defaultFormId, setDefaultFormId] = useState<string | null>(null);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);

  // ── Delete account state ──
  const [showDeleteModal,   setShowDeleteModal]   = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting,          setDeleting]          = useState(false);

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

    // ── 2. Direct Fetch cv_archive + embed latest order_generation per form ──
    // package_name, cv_pdf_url, cv_file_path etc. now live in order_generations
    const fetchArchives = async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/cv_archive?user_id=eq.${uid}&order=created_at_utc.desc` +
          `&select=*,order_generations(generation_id,package_name,cv_pdf_url,cv_file_path,cl_pdf_url,cl_file_path,payment_method,submission_id,created_at_utc)`,
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

    // ── 3. Realtime listener — cv_archive (form edits) + order_generations (PDF ready, plan update) ──
    channel = supabase.channel("my-account-updates")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "cv_archive", filter: `user_id=eq.${uid}` },
        () => { fetchArchives(); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_generations", filter: `user_id=eq.${uid}` },
        (payload: any) => {
          if (payload.new?.cv_pdf_url) {
            toast.success(t.documentReady, { description: t.documentReadyDesc, icon: "🚀" });
          }
          fetchArchives();
        }
      )
      .subscribe();

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

  const processArchiveData = (data: any[]) => {
    return data.map(item => {
      // Merge latest order_generation fields (package_name, cv_pdf_url, etc.)
      const ogs: any[] = Array.isArray(item.order_generations) ? item.order_generations : [];
      const latestOG = ogs.sort((a: any, b: any) =>
        new Date(b.created_at_utc || 0).getTime() - new Date(a.created_at_utc || 0).getTime()
      )[0] ?? {};

      const merged = {
        ...item,
        package_name:   latestOG.package_name   ?? item.package_name,
        cv_pdf_url:     latestOG.cv_pdf_url      ?? item.cv_pdf_url,
        cv_file_path:   latestOG.cv_file_path    ?? item.cv_file_path,
        cl_pdf_url:     latestOG.cl_pdf_url      ?? item.cl_pdf_url,
        cl_file_path:   latestOG.cl_file_path    ?? item.cl_file_path,
        payment_method: latestOG.payment_method  ?? item.payment_method,
        generation_id:  latestOG.generation_id   ?? item.generation_id,
      };

      const target = (merged.cv_target_job || "").toLowerCase();
      let type: 'cv' | 'cover' | 'analysis' = 'cv';
      if (target.includes("analysis") || target.includes("review")) type = 'analysis';
      else if (target.includes("cover") || target.includes("cl"))   type = 'cover';
      return { ...merged, computedType: type };
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
    setDownloadingId(item.form_id);
    try {
      let downloadUrl: string | null = null;

      // cv_file_path for free plan = inline HTML string (starts with "<")
      // cv_file_path for paid plan = storage path (e.g. "uid/subid.docx")
      const isStoragePath = item.cv_file_path
        ? !item.cv_file_path.trimStart().startsWith('<')
        : false;
      const ext      = (isStoragePath && item.cv_file_path?.endsWith('.html')) ? 'html' : 'docx';
      const fileName = isStoragePath
        ? (item.cv_file_path?.split('/').pop() || `cv-document.${ext}`)
        : `resumation-cv.${ext}`;

      // 1. cv_pdf_url → preferred (signed URL already ready)
      if (item.cv_pdf_url) {
        downloadUrl = item.cv_pdf_url;
      }

      // 2. cv_file_path (storage path only) → generate fresh signed URL
      if (!downloadUrl && isStoragePath && item.cv_file_path) {
        const { data } = await supabase.storage
          .from('cv-documents')
          .createSignedUrl(item.cv_file_path, 300);
        if (data?.signedUrl) downloadUrl = data.signedUrl;
      }

      if (downloadUrl) {
        // Silent blob download — no new tab, no raw URL exposed
        const res     = await fetch(downloadUrl);
        const blob    = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a       = document.createElement('a');
        a.href        = blobUrl;
        a.download    = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      } else {
        toast.error(t.downloadFailed);
      }
    } catch (err) {
      console.error('Download error:', err);
      toast.error(t.downloadFailed);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleUpgrade = (item: ArchiveItem, target: string) => {
    if (target === 'analysis') { navigate('/analyse'); return; }
    if (target === 'edit')     { navigate(`/build/${item.form_id}`); return; }
    const sid = item.submission_id || item.form_id;
    navigate(`/plans?id=${sid}`);
  };

  // ── Upgrade My Plan — calls create-cv-order → WishMoney/Paymob redirect ──
  const handleUpgradePlan = async (item: ArchiveItem) => {
    setUpgradingId(item.form_id);
    const sid = item.submission_id || item.form_id;

    try {
      const EF_URL = import.meta.env.VITE_EF_CREATE_CV_ORDER as string;
      if (!EF_URL) throw new Error("no EF_URL");

      // Read auth token
      const lsKey = Object.keys(localStorage).find(k => k.startsWith("sb-") && k.endsWith("-auth-token"));
      const token = lsKey ? (JSON.parse(localStorage.getItem(lsKey) || "null")?.access_token ?? null) : null;

      // Read region from cookie
      const regionMatch = document.cookie.match(/(?:^|;\s*)user_region=([^;]+)/);
      const region      = regionMatch?.[1] ?? "LB";
      const isEgypt     = region === "EG";

      // 1. Send the correct Payload (submission_id instead of payment_id)
      const res = await fetch(EF_URL, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          user_id:        userId,
          submission_id:  sid, // <--- FIXED: Match the Edge Function expectation
          form_id:        item.form_id,
          plan:           "premium",
          amount:         isEgypt ? 250 : 25,
          currency:       isEgypt ? "EGP" : "USD",
          payment_method: isEgypt ? "paymob" : "whish",
          region,
        }),
      });

      const data = await res.json().catch(() => ({}));

      // 2. Check if the Edge Function returned an explicit error
      if (!res.ok || data.error) {
        console.error("Edge Function Error:", data.error || data);
        toast.error(`Payment Error: ${data.error || 'Failed to initialize payment'}`);
        setUpgradingId(null); // Stop loading immediately
        navigate(`/plans?id=${sid}`);
        return;
      }

      // 3. Handle Paymob (Egypt) Direct Redirect
      if (isEgypt) {
        const targetUrl = data.url || "https://accept.paymobsolutions.com/standalone?ref=p_LRR2djFVeWg0SWhkQzY2dnM3WGQxOFl6Zz09X05IeWQra29pd29zUXRTRHF5QkpxMWc9PQ";
        window.location.assign(targetUrl);
        return; 
      }

      // 4. Handle WishMoney (Lebanon) Dynamic Redirect
      const url = data?.collectUrl || data?.data?.collectUrl || data?.url || data?.paymentUrl;
      if (url) {
        window.location.assign(url.startsWith("http") ? url : `https://${url}`);
      } else {
        console.error("No valid payment URL found in response:", data);
        toast.error(t.upgradeError);
        setUpgradingId(null);
        navigate(`/plans?id=${sid}`);
      }

    } catch (error) {
      console.error("Network or execution error:", error);
      toast.error(t.upgradeError);
      setUpgradingId(null);
      navigate(`/plans?id=${sid}`);
    } 
    // We intentionally omit `finally { setUpgradingId(null) }` 
    // so the button stays spinning until the browser navigates away.
  };

  const handleSetDefault = async (item: ArchiveItem) => {
    if (!userId || !item.cv_data) { toast.error(t.noFormData); return; }
    setSettingDefault(item.form_id);
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
        setDefaultFormId(item.form_id);
        localStorage.setItem(`rsm_default_${userId}`, item.form_id);
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

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;
    setDeleting(true);
    try {
      const lsKey = Object.keys(localStorage).find(k => k.startsWith("sb-") && k.endsWith("-auth-token"));
      const accessToken = lsKey ? (JSON.parse(localStorage.getItem(lsKey) || "null")?.access_token ?? null) : null;
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Unknown error");
      }

      toast.success(t.deleteSuccess);
      // Manually wipe all Supabase auth tokens from localStorage
      // (signOut API call will fail since the user no longer exists in auth)
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
          localStorage.removeItem(key);
        }
      });
      sessionStorage.clear();
      // Hard redirect to goodbye page — bypasses ProtectedRoute entirely
      setTimeout(() => window.location.replace("/goodbye"), 800);
    } catch (err: any) {
      console.error("Delete account error:", err);
      toast.error(t.deleteFailed);
      setDeleting(false);
    }
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
                          const isDefault = defaultFormId === item.form_id;
                          const isSetting = settingDefault === item.form_id;
                          const hasCvData = !!item.cv_data;
                          return (
                            <tr key={item.form_id} className="hover:bg-white/5 transition-all duration-300">

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
                                  {item.submission_id || item.form_id.slice(0, 8).toUpperCase()}
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
                                    onClick={() => navigate(`/build/${item.form_id}`)}
                                    className="border border-[rgba(224,197,143,0.30)] text-[#E0C58F] hover:bg-[#E0C58F] hover:text-[#0D1117] px-4 py-2 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all inline-flex items-center gap-1.5"
                                  >
                                    <Pencil className="w-3 h-3" /> {t.edit}
                                  </button>
                                  <button
                                    onClick={() => navigate(`/plans?id=${item.submission_id || item.form_id}`)}
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
                        const docInfo       = getDocDetails(item);
                        const isDownloading = downloadingId === item.form_id;
                        const isUpgrading   = upgradingId   === item.form_id;
                        const isFreeRow     = (item.package_name || 'free').toLowerCase() === 'free';
                        return (
                          <tr key={item.form_id} className="hover:bg-white/5 transition-all duration-300">
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
                                {item.submission_id || item.form_id.slice(0, 8).toUpperCase()}
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

                                {/* ── AI Job Hunter — coming soon ── */}
                                <button
                                  disabled
                                  title="Coming Soon"
                                  className="relative opacity-60 cursor-not-allowed bg-[rgba(139,92,246,0.10)] border border-[rgba(139,92,246,0.30)] text-violet-400 px-4 py-2 rounded-xl font-black text-[11px] uppercase tracking-widest inline-flex items-center gap-1.5"
                                >
                                  <Zap className="w-3 h-3" />
                                  AI Job Hunter
                                  <span className="ml-1 text-[8px] bg-violet-500/20 text-violet-300 border border-violet-500/30 px-1.5 py-0.5 rounded-full font-black tracking-widest">SOON</span>
                                </button>
                                {/* ── Single upgrade CTA for free-plan rows ── */}
                                {isFreeRow && (
                                  <button
                                    onClick={() => handleUpgradePlan(item)}
                                    disabled={isUpgrading}
                                    className="relative overflow-hidden px-4 py-2 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all inline-flex items-center gap-1.5 disabled:opacity-50 text-white"
                                    style={{
                                      background: "linear-gradient(135deg, rgba(18,178,193,0.9), rgba(13,110,130,1))",
                                      boxShadow:  "0 2px 12px rgba(18,178,193,0.3)",
                                    }}
                                  >
                                    {isUpgrading
                                      ? <Loader2 className="w-3 h-3 animate-spin" />
                                      : <ArrowUpRight className="w-3 h-3" />
                                    }
                                    {t.upgradePlan}
                                  </button>
                                )}
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

        {/* ── Delete Account ── */}
        <div className="mt-16 pt-8 border-t border-white/5 flex justify-center">
          <button
            onClick={() => { setDeleteConfirmText(""); setShowDeleteModal(true); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-red-500/20 text-red-400/60 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/5 font-black text-[11px] uppercase tracking-widest transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t.deleteAccount}
          </button>
        </div>

      </main>

      {/* ══ DELETE ACCOUNT MODAL ══ */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0D1117] border border-red-500/20 rounded-[2rem] shadow-2xl w-full max-w-md p-8 flex flex-col gap-6">

            {/* Icon + title */}
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <TriangleAlert className="w-7 h-7 text-red-400" />
              </div>
              <h3 className="text-lg font-black text-white uppercase tracking-wide">
                {t.deleteModalTitle}
              </h3>
              <p className="text-sm text-cyber-dim leading-relaxed">
                {t.deleteModalDesc}
              </p>
            </div>

            {/* Confirm input */}
            <div className="flex flex-col gap-2">
              <label className="text-[11px] font-black text-red-400/80 uppercase tracking-widest">
                {t.deleteModalConfirmLabel}
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder={t.deleteModalConfirmPlaceholder}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm placeholder:text-white/20 focus:outline-none focus:border-red-500/40 transition-colors"
                autoComplete="off"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-cyber-dim hover:text-white hover:border-white/20 font-black text-[11px] uppercase tracking-widest transition-all"
              >
                {t.deleteModalCancel}
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== "DELETE" || deleting}
                className="flex-1 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-black text-[11px] uppercase tracking-widest transition-all inline-flex items-center justify-center gap-2
                  hover:bg-red-500/20 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {deleting
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Trash2 className="w-3.5 h-3.5" />
                }
                {t.deleteModalConfirm}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Loader2,
  Edit3,
  Save,
  X,
  MapPin,
  Briefcase,
  Zap,
  Phone,
  Mail,
  Lock,
  Sparkles,
  ExternalLink,
  Copy,
  CheckCheck,
  Camera,
  GraduationCap,
  UserCog,
  FileText,
  BrainCircuit,
  ShieldCheck,
  Languages,
  Link as LinkIcon,
  Crown,
  QrCode,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../supabase";
import { useLang } from "../context/LanguageContext";

type Visibility = "private" | "public";

type ExpItem = {
  title?: string;
  company?: string;
  duration?: string;
  description?: string;
};

type EduItem = {
  degree?: string;
  institution?: string;
  major?: string;
  year?: string;
};

type OtherLink = {
  type?: string;
  url?: string;
};

type LanguageItem = {
  name?: string;
  language?: string;
  level?: string;
};

type ProfileState = {
  id: string;
  user_id: string;
  username: string;
  career_form_id: string;
  career_submission_id: string;

  first_name: string;
  last_name: string;
  full_name_ar: string;
  profile_email: string;
  cv_email: string;
  phone: string;
  gender: string;
  nationality: string;
  location: string;

  avatar_url: string;
  cover_url: string;
  cover_public: boolean;
  avatar_position: string;
  cover_position: string;

  headline: string;
  target_job: string;
  career_level: string;
  ai_summary: string;
  ats_score: number | null;

  career_snapshot: Record<string, any> | null;
  snapshot_strengths: string[];
  snapshot_improvements: string[];
  snapshot_generated_at: string;

  skills: string[];
  education: EduItem[];
  experience: ExpItem[];
  other_links: OtherLink[];
  languages: LanguageItem[];

  profile_visibility: Visibility;
  public_profile_enabled: boolean;
  profile_locked_experience: boolean;
  qr_enabled: boolean;
  qr_public_url: string;

  active_plan: string;
  plan_unlocked_at: string;
  documents_generated_count: number;
  cover_letters_generated_count: number;
  analyses_used_count: number;

  profile_ai_assistant_enabled: boolean;
  profile_summary_rewrite_cost: number;
  profile_experience_ai_cost: number;
  profile_experience_edit_cost: number;

  created_at: string;
  updated_at: string;
};

const EMPTY: ProfileState = {
  id: "",
  user_id: "",
  username: "",
  career_form_id: "",
  career_submission_id: "",

  first_name: "",
  last_name: "",
  full_name_ar: "",
  profile_email: "",
  cv_email: "",
  phone: "",
  gender: "",
  nationality: "",
  location: "",

  avatar_url: "",
  cover_url: "",
  cover_public: true,
  avatar_position: "50% 50%",
  cover_position: "50% 50%",

  headline: "",
  target_job: "",
  career_level: "",
  ai_summary: "",
  ats_score: null,

  career_snapshot: null,
  snapshot_strengths: [],
  snapshot_improvements: [],
  snapshot_generated_at: "",

  skills: [],
  education: [],
  experience: [],
  other_links: [],
  languages: [],

  profile_visibility: "private",
  public_profile_enabled: false,
  profile_locked_experience: true,
  qr_enabled: false,
  qr_public_url: "",

  active_plan: "",
  plan_unlocked_at: "",
  documents_generated_count: 0,
  cover_letters_generated_count: 0,
  analyses_used_count: 0,

  profile_ai_assistant_enabled: false,
  profile_summary_rewrite_cost: 10,
  profile_experience_ai_cost: 20,
  profile_experience_edit_cost: 10,

  created_at: "",
  updated_at: "",
};

function arr<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function isPaidPlan(plan: unknown) {
  const value = cleanText(plan).toLowerCase();
  return Boolean(value && !["free", "starter", "none", "trial"].includes(value));
}

function getNestedArray<T = any>(obj: any, paths: string[][]): T[] {
  for (const path of paths) {
    let cur = obj;
    for (const key of path) cur = cur?.[key];
    if (Array.isArray(cur)) return cur as T[];
  }
  return [];
}

function extractLanguages(row: any): LanguageItem[] {
  const snapshot = row?.career_snapshot ?? {};
  return getNestedArray<LanguageItem>(row, [["languages"]]).length
    ? getNestedArray<LanguageItem>(row, [["languages"]])
    : getNestedArray<LanguageItem>(snapshot, [
        ["languages"],
        ["language_skills"],
        ["cv_data", "languages"],
        ["profile", "languages"],
      ]);
}

function languageName(item: LanguageItem) {
  return cleanText(item.name || item.language);
}

function languageLevel(item: LanguageItem) {
  return cleanText(item.level) || "—";
}

function pickFreeLanguages(languages: LanguageItem[]): LanguageItem[] {
  const findByNames = (names: string[]) =>
    languages.find((item) => {
      const n = languageName(item).toLowerCase();
      return names.some((name) => n.includes(name.toLowerCase()));
    });

  return [
    findByNames(["arabic", "عربي", "العربية"]) || { name: "Arabic", level: "—" },
    findByNames(["english", "انجليزي", "إنجليزي", "الإنجليزية"]) || { name: "English", level: "—" },
  ];
}

function profileFromRow(row: any, fallback: Partial<ProfileState> = {}): ProfileState {
  return {
    ...EMPTY,
    ...fallback,
    id: cleanText(row?.id || fallback.id),
    user_id: cleanText(row?.user_id || fallback.user_id),
    username: cleanText(row?.username || fallback.username),
    career_form_id: cleanText(row?.career_form_id || fallback.career_form_id),
    career_submission_id: cleanText(row?.career_submission_id || fallback.career_submission_id),

    first_name: cleanText(row?.first_name || fallback.first_name),
    last_name: cleanText(row?.last_name || fallback.last_name),
    full_name_ar: cleanText(row?.full_name_ar || fallback.full_name_ar),
    profile_email: cleanText(row?.profile_email || fallback.profile_email),
    cv_email: cleanText(row?.cv_email || fallback.cv_email),
    phone: cleanText(row?.phone || fallback.phone),
    gender: cleanText(row?.gender || fallback.gender),
    nationality: cleanText(row?.nationality || fallback.nationality),
    location: cleanText(row?.location || fallback.location),

    avatar_url: cleanText(row?.avatar_url || fallback.avatar_url),
    cover_url: cleanText(row?.cover_url || fallback.cover_url),
    cover_public: row?.cover_public ?? fallback.cover_public ?? true,
    avatar_position: cleanText(row?.avatar_position || fallback.avatar_position) || "50% 50%",
    cover_position: cleanText(row?.cover_position || fallback.cover_position) || "50% 50%",

    headline: cleanText(row?.headline || fallback.headline),
    target_job: cleanText(row?.target_job || fallback.target_job),
    career_level: cleanText(row?.career_level || fallback.career_level),
    ai_summary: cleanText(row?.ai_summary || fallback.ai_summary),
    ats_score: typeof row?.ats_score === "number" ? row.ats_score : fallback.ats_score ?? null,

    career_snapshot: row?.career_snapshot ?? fallback.career_snapshot ?? null,
    snapshot_strengths: arr<string>(row?.snapshot_strengths || fallback.snapshot_strengths).map(cleanText).filter(Boolean),
    snapshot_improvements: arr<string>(row?.snapshot_improvements || fallback.snapshot_improvements).map(cleanText).filter(Boolean),
    snapshot_generated_at: cleanText(row?.snapshot_generated_at || fallback.snapshot_generated_at),

    skills: arr<string>(row?.skills || fallback.skills).map(cleanText).filter(Boolean),
    education: arr<EduItem>(row?.education || fallback.education),
    experience: arr<ExpItem>(row?.experience || fallback.experience),
    other_links: arr<OtherLink>(row?.other_links || fallback.other_links),
    languages: extractLanguages(row).length ? extractLanguages(row) : arr<LanguageItem>(fallback.languages),

    profile_visibility: row?.profile_visibility === "public" ? "public" : fallback.profile_visibility || "private",
    public_profile_enabled: row?.public_profile_enabled ?? fallback.public_profile_enabled ?? false,
    profile_locked_experience: row?.profile_locked_experience ?? fallback.profile_locked_experience ?? true,
    qr_enabled: row?.qr_enabled ?? fallback.qr_enabled ?? false,
    qr_public_url: cleanText(row?.qr_public_url || fallback.qr_public_url),

    active_plan: cleanText(row?.active_plan || fallback.active_plan),
    plan_unlocked_at: cleanText(row?.plan_unlocked_at || fallback.plan_unlocked_at),
    documents_generated_count: Number(row?.documents_generated_count ?? fallback.documents_generated_count ?? 0),
    cover_letters_generated_count: Number(row?.cover_letters_generated_count ?? fallback.cover_letters_generated_count ?? 0),
    analyses_used_count: Number(row?.analyses_used_count ?? fallback.analyses_used_count ?? 0),

    profile_ai_assistant_enabled: row?.profile_ai_assistant_enabled ?? fallback.profile_ai_assistant_enabled ?? false,
    profile_summary_rewrite_cost: Number(row?.profile_summary_rewrite_cost ?? fallback.profile_summary_rewrite_cost ?? 10),
    profile_experience_ai_cost: Number(row?.profile_experience_ai_cost ?? fallback.profile_experience_ai_cost ?? 20),
    profile_experience_edit_cost: Number(row?.profile_experience_edit_cost ?? fallback.profile_experience_edit_cost ?? 10),

    created_at: cleanText(row?.created_at || fallback.created_at),
    updated_at: cleanText(row?.updated_at || fallback.updated_at),
  };
}

export default function PrivateProfileV2() {
  const navigate = useNavigate();
  const { lang, isRtl } = useLang();

  const [data, setData] = useState<ProfileState>(EMPTY);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoEditMode, setPhotoEditMode] = useState(false);
  const [copied, setCopied] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{
    active: boolean;
    field: "cover_position" | "avatar_position";
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
  } | null>(null);

  const t = {
    en: {
      myAccount: "My Account",
      editCareerForm: "Edit Career Form",
      customizePhotos: "Customize photos",
      savePhotos: "Save photos",
      cancel: "Cancel",
      saved: "Profile saved",
      error: "Something went wrong",
      photoUpdated: "Photo updated",
      uploadFail: "Upload failed",
      copy: "Copy link",
      copied: "Copied",
      viewPublic: "View public profile",
      member: "Resumation Career Profile",
      private: "Private",
      public: "Public",
      noPlan: "Free profile",
      identity: "Identity",
      formId: "Career Form ID",
      submissionId: "Submission ID",
      professionalSummary: "Professional Summary",
      careerSnapshot: "Career Snapshot",
      careerLevel: "Career Level",
      atsScore: "ATS Score",
      strengths: "Strengths",
      improvements: "Improvements",
      targetJob: "Target Job",
      location: "Location",
      phone: "Phone",
      email: "Email",
      nationality: "Nationality",
      gender: "Gender",
      skills: "Skills",
      education: "Education",
      experience: "Experience",
      otherLinks: "Other Links",
      publicPreview: "Free public profile preview",
      publicPreviewText: "Free public visitors see name, target job, summary, career level, top 3 skills, Arabic/English language levels, and latest education only. Paid profiles can unlock the full public profile.",
      languages: "Languages",
      latestEducation: "Latest Education",
      noSummary: "No summary yet. Complete your career profile first.",
      noSkills: "No skills added yet.",
      noEducation: "No education added yet.",
      noExperience: "No experience added yet.",
      noLinks: "No links added yet.",
      docs: "CVs",
      cls: "Cover Letters",
      analyses: "Analyses",
      upgrade: "Upgrade to unlock QR, public experience, and downloads",
      generatedAt: "Snapshot generated",
      aiCoins: "AI actions use coins",
      summaryCost: "Summary rewrite",
      expAiCost: "Experience AI rewrite",
      expEditCost: "Experience quick edit",
      qrProfile: "QR Profile",
      qrLocked: "QR profile is locked on the free plan.",
      qrReady: "QR profile link is ready.",
      qrSoon: "QR generation is prepared for paid profiles.",
      generateQr: "Generate QR",
      changeCover: "Change Cover",
      changeAvatar: "Change Avatar",
    },
    ar: {
      myAccount: "حسابي",
      editCareerForm: "تعديل الفورم المهني",
      customizePhotos: "تعديل الصور",
      savePhotos: "حفظ الصور",
      cancel: "إلغاء",
      saved: "تم حفظ الملف",
      error: "حدث خطأ ما",
      photoUpdated: "تم تحديث الصورة",
      uploadFail: "فشل الرفع",
      copy: "نسخ الرابط",
      copied: "تم النسخ",
      viewPublic: "عرض الملف العام",
      member: "ملف Resumation المهني",
      private: "خاص",
      public: "عام",
      noPlan: "ملف مجاني",
      identity: "هوية الملف",
      formId: "رقم فورم الملف المهني",
      submissionId: "رقم الإرسال",
      professionalSummary: "الملخص المهني",
      careerSnapshot: "التحليل المهني السريع",
      careerLevel: "المستوى المهني",
      atsScore: "درجة ATS",
      strengths: "نقاط القوة",
      improvements: "نقاط التحسين",
      targetJob: "الوظيفة المستهدفة",
      location: "الموقع",
      phone: "الهاتف",
      email: "البريد الإلكتروني",
      nationality: "الجنسية",
      gender: "الجنس",
      skills: "المهارات",
      education: "التعليم",
      experience: "الخبرات",
      otherLinks: "روابط أخرى",
      publicPreview: "معاينة الملف العام المجاني",
      publicPreviewText: "الزائر العام المجاني يرى الاسم، الوظيفة المستهدفة، الملخص، المستوى المهني، أهم 3 مهارات، مستوى العربية والإنجليزية، وآخر دراسة فقط. الملفات المدفوعة يمكنها فتح الملف العام الكامل.",
      languages: "اللغات",
      latestEducation: "آخر دراسة",
      noSummary: "لا يوجد ملخص بعد. أكمل ملفك المهني أولاً.",
      noSkills: "لا توجد مهارات بعد.",
      noEducation: "لا يوجد تعليم بعد.",
      noExperience: "لا توجد خبرات بعد.",
      noLinks: "لا توجد روابط بعد.",
      docs: "السير الذاتية",
      cls: "رسائل التغطية",
      analyses: "التحليلات",
      upgrade: "قم بالترقية لفتح QR والخبرة العامة والتنزيلات",
      generatedAt: "تم إنشاء التحليل",
      aiCoins: "إجراءات الذكاء الاصطناعي تستخدم Coins",
      summaryCost: "إعادة كتابة الملخص",
      expAiCost: "إعادة كتابة الخبرة",
      expEditCost: "تعديل سريع للخبرة",
      qrProfile: "QR الملف المهني",
      qrLocked: "QR مقفول على الخطة المجانية.",
      qrReady: "رابط QR جاهز.",
      qrSoon: "توليد QR مجهّز للملفات المدفوعة.",
      generateQr: "توليد QR",
      changeCover: "تغيير الغلاف",
      changeAvatar: "تغيير الصورة",
    },
  }[lang];

  const isPaid = isPaidPlan(data.active_plan);
  const fullName = [data.first_name, data.last_name].filter(Boolean).join(" ") || data.full_name_ar || "—";
  const initials = [data.first_name?.[0], data.last_name?.[0]].filter(Boolean).join("").toUpperCase() || "?";
  const publicSkills = isPaid ? data.skills : data.skills.slice(0, 3);
  const publicLanguages = isPaid ? data.languages : pickFreeLanguages(data.languages);
  const latestEdu = data.education[0] || null;

  const goToCareerForm = () => {
    const params = new URLSearchParams({ mode: "edit-profile" });
    if (data.career_form_id) params.set("form_id", data.career_form_id);
    if (data.career_submission_id) params.set("submission_id", data.career_submission_id);
    navigate(`/build?${params.toString()}`);
  };

  const parsePos = (pos: string) => {
    const [x, y] = pos.replace(/%/g, "").split(" ").map(Number);
    return { x: Number.isFinite(x) ? x : 50, y: Number.isFinite(y) ? y : 50 };
  };

  const startDrag = (e: React.MouseEvent | React.TouchEvent, field: "cover_position" | "avatar_position") => {
    if (!photoEditMode) return;
    e.preventDefault();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const pos = parsePos(data[field]);
    dragRef.current = { active: true, field, startX: clientX, startY: clientY, startPosX: pos.x, startPosY: pos.y };

    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (!dragRef.current?.active) return;
      const cx = "touches" in ev ? (ev as TouchEvent).touches[0].clientX : (ev as MouseEvent).clientX;
      const cy = "touches" in ev ? (ev as TouchEvent).touches[0].clientY : (ev as MouseEvent).clientY;
      const dx = ((cx - dragRef.current.startX) / window.innerWidth) * -120;
      const dy = ((cy - dragRef.current.startY) / window.innerHeight) * -120;
      const nx = Math.min(100, Math.max(0, dragRef.current.startPosX + dx));
      const ny = Math.min(100, Math.max(0, dragRef.current.startPosY + dy));
      setData((d) => ({ ...d, [dragRef.current!.field]: `${nx.toFixed(1)}% ${ny.toFixed(1)}%` }));
    };

    const onEnd = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
  };

  useEffect(() => {
    let cancelled = false;

    const getCachedSession = () => {
      const lsKey = Object.keys(localStorage).find(
        (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
      );

      if (!lsKey) return null;

      try {
        const cached = JSON.parse(localStorage.getItem(lsKey) || "null");
        if (!cached?.user?.id) return null;

        return {
          user: cached.user,
          access_token: cached.access_token || "",
        };
      } catch {
        return null;
      }
    };

    const getSafeSession = async () => {
      const cached = getCachedSession();
      if (cached?.user?.id) return cached;

      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise<null>((resolve) => {
        window.setTimeout(() => resolve(null), 6000);
      });

      const result = await Promise.race([sessionPromise, timeoutPromise]);
      if (!result || !("data" in result)) return null;

      const session = result.data.session;
      if (!session?.user?.id) return null;

      return {
        user: session.user,
        access_token: session.access_token || "",
      };
    };

    const init = async () => {
      try {
        const session = await getSafeSession();

        if (!session?.user?.id) {
          if (!cancelled) window.location.replace("/login");
          return;
        }

        const uid = session.user.id;
        if (!cancelled) setUserId(uid);

        const googleName = cleanText(session.user.user_metadata?.full_name);
        const nameParts = googleName.split(" ").filter(Boolean);
        const fallback: Partial<ProfileState> = {
          user_id: uid,
          profile_email: session.user.email ?? "",
          cv_email: session.user.email ?? "",
          first_name: nameParts[0] || "",
          last_name: nameParts.slice(1).join(" ") || "",
          avatar_url: session.user.user_metadata?.avatar_url ?? "",
        };

        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
        const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/profiles?user_id=eq.${encodeURIComponent(uid)}&select=*&limit=1`,
          {
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${session.access_token || SUPABASE_KEY}`,
            },
          },
        );

        if (!res.ok) throw new Error(await res.text());

        const rows = await res.json();
        const row = Array.isArray(rows) ? rows[0] ?? null : null;

        if (!row) {
          if (!cancelled) navigate("/build", { replace: true });
          return;
        }

        if (!cancelled) setData(profileFromRow(row, fallback));
      } catch (err) {
        console.error("PrivateProfileV2 load error", err);
        if (!cancelled) toast.error(t.error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [navigate, t.error]);

  const savePartial = async (partial: Record<string, any>) => {
    if (!userId) throw new Error("Missing user");
    const { error } = await supabase
      .from("profiles")
      .update({ ...partial, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) throw error;
  };

  const uploadPhoto = async (file: File, bucket: "avatars" | "covers", field: "avatar_url" | "cover_url") => {
    if (!userId) return toast.error("Not logged in");
    try {
      if (!file.type.startsWith("image/")) {
        toast.error(t.uploadFail);
        return;
      }
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
      const name = bucket === "avatars" ? "avatar" : "cover";
      const path = `${userId}/${name}-${Date.now()}.${safeExt}`;

      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;

      const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);
      const publicUrl = publicData.publicUrl;
      setData((d) => ({ ...d, [field]: publicUrl }));
      await savePartial({ [field]: publicUrl });
      toast.success(t.photoUpdated);
    } catch (err: any) {
      console.error("photo upload failed", err);
      toast.error(`${t.uploadFail}: ${err?.message ?? ""}`);
    }
  };

  const handleSavePhotos = async () => {
    setSaving(true);
    try {
      await savePartial({
        avatar_url: data.avatar_url || null,
        cover_url: data.cover_url || null,
        cover_public: data.cover_public,
        avatar_position: data.avatar_position,
        cover_position: data.cover_position,
        profile_visibility: data.profile_visibility,
        public_profile_enabled: data.profile_visibility === "public",
      });
      toast.success(t.saved);
      setPhotoEditMode(false);
    } catch (err: any) {
      console.error("profile save failed", err);
      toast.error(`${t.error}: ${err?.message ?? ""}`);
    } finally {
      setSaving(false);
    }
  };

  const copyPublicLink = () => {
    if (!data.username) return;
    navigator.clipboard.writeText(`https://resumation.co/u/${data.username}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const copyQrLink = () => {
    const url = data.qr_public_url || `https://resumation.co/u/${data.username}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D1117]">
        <Loader2 className="animate-spin text-[#12B2C1] w-8 h-8" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#0D1117] text-[#D9CBC2]"
      dir={isRtl ? "rtl" : "ltr"}
      style={{ fontFamily: isRtl ? "'Tajawal', sans-serif" : "'Plus Jakarta Sans', sans-serif" }}
    >
      <style>{`
        .btn-muted { display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.375rem 0.75rem; border-radius: 0.5rem; font-size: 12px; font-weight: 500; color: #A8B4CC; background: rgba(60,80,125,0.06); border: 1px solid rgba(60,80,125,0.15); transition: color 150ms ease, border-color 150ms ease, background 150ms ease; }
        .btn-muted:hover { color: #F5F0E9; background: rgba(60,80,125,0.1); }
        .btn-cyan { display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.375rem 0.75rem; border-radius: 0.5rem; font-size: 12px; font-weight: 500; color: #12B2C1; background: rgba(18,178,193,0.06); border: 1px solid rgba(18,178,193,0.15); transition: color 150ms ease; }
        .btn-cyan:hover { color: #F5F0E9; }
        .btn-primary { display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.5rem 1rem; border-radius: 0.5rem; font-size: 12px; font-weight: 700; color: #0D1117; background: linear-gradient(135deg,#12B2C1,#0E8F9C); }
      `}</style>
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0], "avatars", "avatar_url")}
      />
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0], "covers", "cover_url")}
      />

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-5%] right-[15%] w-[500px] h-[500px] rounded-full bg-[rgba(18,178,193,0.04)] blur-[130px]" />
        <div className="absolute bottom-[10%] left-[5%] w-[400px] h-[400px] rounded-full bg-[rgba(60,80,125,0.06)] blur-[110px]" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-5 py-8 sm:py-12 space-y-5">
        <Card>
          <div
            className="h-28 sm:h-36 w-full rounded-t-2xl relative overflow-hidden select-none"
            style={{
              background: data.cover_url ? undefined : "linear-gradient(135deg, #0D1826 0%, #112250 55%, #0A1628 100%)",
              cursor: photoEditMode && data.cover_url ? "grab" : "default",
            }}
            onMouseDown={photoEditMode && data.cover_url ? (e) => startDrag(e, "cover_position") : undefined}
            onTouchStart={photoEditMode && data.cover_url ? (e) => startDrag(e, "cover_position") : undefined}
          >
            {data.cover_url ? (
              <img src={data.cover_url} alt="cover" draggable={false} className="w-full h-full object-cover pointer-events-none" style={{ objectPosition: data.cover_position }} />
            ) : (
              <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 25% 60%, rgba(18,178,193,0.18) 0%, transparent 55%), radial-gradient(circle at 80% 25%, rgba(224,197,143,0.1) 0%, transparent 50%)" }} />
            )}
            {photoEditMode && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  coverInputRef.current?.click();
                }}
                className="absolute top-2 right-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white hover:bg-black/70 transition-colors"
                style={{ background: "rgba(0,0,0,0.50)", backdropFilter: "blur(6px)" }}
              >
                <Camera className="w-3.5 h-3.5" /> {t.changeCover}
              </button>
            )}
          </div>

          <div className="px-4 sm:px-6 pb-6">
            <div className="flex items-end justify-between -mt-10 mb-4 flex-wrap gap-3">
              <div
                className="relative select-none"
                style={{ cursor: photoEditMode && data.avatar_url ? "grab" : "default" }}
                onMouseDown={photoEditMode && data.avatar_url ? (e) => startDrag(e, "avatar_position") : undefined}
                onTouchStart={photoEditMode && data.avatar_url ? (e) => startDrag(e, "avatar_position") : undefined}
              >
                {data.avatar_url ? (
                  <img
                    src={data.avatar_url}
                    alt={fullName}
                    draggable={false}
                    className="w-20 h-20 rounded-2xl object-cover pointer-events-none"
                    style={{ border: "3px solid #0D1117", boxShadow: "0 0 0 1px rgba(18,178,193,0.3)", objectPosition: data.avatar_position }}
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-xl font-black text-[#F5F0E9]" style={{ background: "linear-gradient(135deg,#112250,#162A60)", border: "3px solid #0D1117", boxShadow: "0 0 0 1px rgba(18,178,193,0.3)" }}>
                    {initials}
                  </div>
                )}
                {photoEditMode && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      avatarInputRef.current?.click();
                    }}
                    className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center"
                    aria-label={t.changeAvatar}
                  >
                    <Camera className="w-5 h-5 text-white" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {!photoEditMode && data.username && (
                  <>
                    <button onClick={copyPublicLink} className="btn-muted" style={{ color: copied ? "#34d399" : "#A8B4CC" }}>
                      {copied ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied ? t.copied : t.copy}
                    </button>
                    <button onClick={() => navigate(`/u/${data.username}`)} className="btn-cyan">
                      <ExternalLink className="w-3 h-3" /> {t.viewPublic}
                    </button>
                  </>
                )}
                {!photoEditMode && (
                  <>
                    <Link to="/account" className="btn-muted">
                      <UserCog className="w-3 h-3" /> {t.myAccount}
                    </Link>
                    <button onClick={() => setPhotoEditMode(true)} className="btn-muted">
                      <Camera className="w-3 h-3" /> {t.customizePhotos}
                    </button>
                    <button onClick={goToCareerForm} className="btn-muted font-semibold">
                      <Edit3 className="w-3 h-3" /> {t.editCareerForm}
                    </button>
                  </>
                )}
                {photoEditMode && (
                  <div className="flex gap-2">
                    <button onClick={() => setPhotoEditMode(false)} className="btn-muted">
                      <X className="w-3 h-3" /> {t.cancel}
                    </button>
                    <button onClick={handleSavePhotos} disabled={saving} className="btn-primary disabled:opacity-60">
                      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      {saving ? "..." : t.savePhotos}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <h1 className="text-xl font-bold text-[#F5F0E9] mb-1">{fullName}</h1>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-sm text-[#e1ebed] font-mono">@{data.username || "—"}</span>
              <Badge>{t.member}</Badge>
              {data.profile_visibility === "public" ? <Badge tone="green">{t.public}</Badge> : <Badge tone="muted">{t.private}</Badge>}
            </div>
            {data.headline && <p className="text-sm text-[#A8B4CC] mb-2">{data.headline}</p>}

            <div className="flex flex-wrap gap-4 text-xs text-[#e1ebed] mt-3">
              {data.location && <Meta icon={MapPin}>{data.location}</Meta>}
              {data.career_level && <Meta icon={ShieldCheck}>{data.career_level}</Meta>}
              {isPaid ? <Meta icon={Crown} className="text-[#E0C58F]">{data.active_plan}</Meta> : <Meta icon={Lock}>{t.noPlan}</Meta>}
            </div>
          </div>
        </Card>

        <Card title={t.identity}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <LockedValue label="Profile ID" value={data.id || "—"} />
            <LockedValue label="User ID" value={data.user_id || "—"} />
            <LockedValue label="Username" value={data.username ? `@${data.username}` : "—"} />
            <LockedValue label={t.formId} value={data.career_form_id || "—"} />
            <LockedValue label={t.submissionId} value={data.career_submission_id || "—"} />
          </div>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard icon={ShieldCheck} label={t.careerLevel} value={data.career_level || "—"} color="#12B2C1" />
          <StatCard icon={BrainCircuit} label={t.atsScore} value={data.ats_score === null ? "—" : `${data.ats_score}/100`} color="#E0C58F" />
          <StatCard icon={Sparkles} label={t.generatedAt} value={data.snapshot_generated_at ? new Date(data.snapshot_generated_at).toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US") : "—"} color="#A8B4CC" />
        </div>

        <Card title={t.professionalSummary}>
          <p className="text-sm text-[#A8B4CC] leading-[1.9]">{data.ai_summary || <span className="italic text-[#e1ebed]">{t.noSummary}</span>}</p>
          <div className="mt-3 text-[11px] text-[#e1ebed] flex flex-wrap gap-2">
            <Badge tone="muted">{t.aiCoins}</Badge>
            <Badge tone="muted">{t.summaryCost}: {data.profile_summary_rewrite_cost}</Badge>
          </div>
          <InlineEditButton onClick={goToCareerForm} label={t.editCareerForm} />
        </Card>

        <Card title={t.careerSnapshot}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MiniList title={t.strengths} items={data.snapshot_strengths} tone="good" />
            <MiniList title={t.improvements} items={data.snapshot_improvements} tone="warn" />
          </div>
        </Card>

        <Card title={t.targetJob}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InfoRow icon={Briefcase} label={t.targetJob} value={data.target_job || "—"} />
            <InfoRow icon={MapPin} label={t.location} value={data.location || "—"} />
          </div>
          <InlineEditButton onClick={goToCareerForm} label={t.editCareerForm} />
        </Card>

        <Card title={t.email}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InfoRow icon={Mail} label={t.email} value={data.profile_email || data.cv_email || "—"} />
            <InfoRow icon={Phone} label={t.phone} value={data.phone || "—"} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
            <InfoText label={t.nationality} value={data.nationality || "—"} />
            <InfoText label={t.gender} value={data.gender || "—"} />
            <InfoText label="Arabic Name" value={data.full_name_ar || "—"} />
          </div>
          <InlineEditButton onClick={goToCareerForm} label={t.editCareerForm} />
        </Card>

        <Card title={t.skills}>
          <div className="flex flex-wrap gap-2">
            {data.skills.map((s, i) => <Chip key={`${s}-${i}`}><Zap className="w-3 h-3" />{s}</Chip>)}
            {!data.skills.length && <p className="text-xs text-[#e1ebed] italic">{t.noSkills}</p>}
          </div>
          <InlineEditButton onClick={goToCareerForm} label={t.editCareerForm} />
        </Card>

        <Card title={t.education}>
          <div className="space-y-5">
            {data.education.map((edu, i) => (
              <ItemRow key={i} icon={GraduationCap} title={edu.degree || "—"} subtitle={edu.institution || ""} meta={[edu.major, edu.year].filter(Boolean).join(" · ")} />
            ))}
            {!data.education.length && <p className="text-xs text-[#e1ebed] italic">{t.noEducation}</p>}
          </div>
          <InlineEditButton onClick={goToCareerForm} label={t.editCareerForm} />
        </Card>

        <Card title={t.experience}>
          <div className="space-y-5">
            {data.experience.map((exp, i) => (
              <ItemRow key={i} icon={Briefcase} title={exp.title || "—"} subtitle={exp.company || ""} meta={exp.duration || ""} description={exp.description || ""} />
            ))}
            {!data.experience.length && <p className="text-xs text-[#e1ebed] italic">{t.noExperience}</p>}
            {!isPaid && <p className="text-[11px] text-[#E0C58F]">{t.upgrade}</p>}
          </div>
          <div className="mt-3 text-[11px] text-[#e1ebed] flex flex-wrap gap-2">
            <Badge tone="muted">{t.expAiCost}: {data.profile_experience_ai_cost}</Badge>
            <Badge tone="muted">{t.expEditCost}: {data.profile_experience_edit_cost}</Badge>
          </div>
          <InlineEditButton onClick={goToCareerForm} label={t.editCareerForm} />
        </Card>

        <Card title={t.otherLinks}>
          <div className="space-y-3">
            {data.other_links.map((l, i) => (
              <a key={i} href={l.url?.startsWith("http") ? l.url : `https://${l.url}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl p-3 text-sm text-[#A8B4CC] hover:text-[#12B2C1]" style={{ background: "rgba(60,80,125,0.06)", border: "1px solid rgba(60,80,125,0.15)" }}>
                <LinkIcon className="w-4 h-4" /> {l.type || "link"}
              </a>
            ))}
            {!data.other_links.length && <p className="text-xs text-[#e1ebed] italic">{t.noLinks}</p>}
          </div>
          <InlineEditButton onClick={goToCareerForm} label={t.editCareerForm} />
        </Card>

        <Card title={t.qrProfile}>
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(18,178,193,0.07)", border: "1px solid rgba(18,178,193,0.15)" }}>
              <QrCode className="w-5 h-5 text-[#12B2C1]" />
            </div>
            <div className="flex-1">
              {!isPaid ? (
                <>
                  <p className="text-sm text-[#A8B4CC] leading-[1.8]">{t.qrLocked}</p>
                  <button onClick={() => navigate("/pricing")} className="btn-primary mt-3">{t.upgrade}</button>
                </>
              ) : data.qr_enabled && data.qr_public_url ? (
                <>
                  <p className="text-sm text-[#A8B4CC] leading-[1.8]">{t.qrReady}</p>
                  <button onClick={copyQrLink} className="btn-muted mt-3"><Copy className="w-3 h-3" /> {copied ? t.copied : t.copy}</button>
                </>
              ) : (
                <>
                  <p className="text-sm text-[#A8B4CC] leading-[1.8]">{t.qrSoon}</p>
                  <button disabled className="btn-muted mt-3 opacity-60 cursor-not-allowed"><QrCode className="w-3 h-3" /> {t.generateQr}</button>
                </>
              )}
            </div>
          </div>
        </Card>

        <Card title={t.publicPreview}>
          <p className="text-xs text-[#A8B4CC] leading-[1.8] mb-4">{t.publicPreviewText}</p>
          <div className="space-y-4 rounded-2xl p-4" style={{ background: "rgba(60,80,125,0.04)", border: "1px solid rgba(60,80,125,0.12)" }}>
            <div>
              <h3 className="font-bold text-[#F5F0E9]">{fullName}</h3>
              <p className="text-xs text-[#A8B4CC]">{data.target_job || data.headline || "—"}</p>
            </div>
            <p className="text-xs text-[#A8B4CC] leading-[1.8]">{data.ai_summary || "—"}</p>
            <InfoText label={t.careerLevel} value={data.career_level || "—"} />
            <div>
              <SectionLabel>{t.skills}</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {publicSkills.map((s) => <Chip key={s}>{s}</Chip>)}
                {!publicSkills.length && <span className="text-xs text-[#e1ebed]">—</span>}
              </div>
            </div>
            <div>
              <SectionLabel>{t.languages}</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {publicLanguages.map((item, i) => (
                  <Chip key={`${languageName(item)}-${i}`}><Languages className="w-3 h-3" />{languageName(item) || "—"}: {languageLevel(item)}</Chip>
                ))}
              </div>
            </div>
            <div>
              <SectionLabel>{t.latestEducation}</SectionLabel>
              {latestEdu ? <ItemRow icon={GraduationCap} title={latestEdu.degree || "—"} subtitle={latestEdu.institution || ""} meta={[latestEdu.major, latestEdu.year].filter(Boolean).join(" · ")} /> : <p className="text-xs text-[#e1ebed]">—</p>}
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-3 gap-4">
          <StatCard icon={FileText} label={t.docs} value={data.documents_generated_count} color="#12B2C1" />
          <StatCard icon={FileText} label={t.cls} value={data.cover_letters_generated_count} color="#E0C58F" />
          <StatCard icon={BrainCircuit} label={t.analyses} value={data.analyses_used_count} color="#A8B4CC" />
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5 sm:p-6" style={{ background: "rgba(13,17,23,0.85)", backdropFilter: "blur(24px)", border: "1px solid rgba(60,80,125,0.15)" }}>
      {title && <h2 className="text-[12px] font-bold text-[#E0C58F] uppercase tracking-widest mb-5">{title}</h2>}
      {children}
    </div>
  );
}

function Badge({ children, tone = "cyan" }: { children: React.ReactNode; tone?: "cyan" | "green" | "muted" }) {
  const color = tone === "green" ? "#34d399" : tone === "muted" ? "#A8B4CC" : "#12B2C1";
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ background: "rgba(60,80,125,0.08)", border: "1px solid rgba(60,80,125,0.18)", color }}>
      <Sparkles className="w-2.5 h-2.5" /> {children}
    </span>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#12B2C1]" style={{ background: "rgba(18,178,193,0.07)", border: "1px solid rgba(18,178,193,0.15)" }}>
      {children}
    </span>
  );
}

function LockedValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "rgba(60,80,125,0.05)", border: "1px solid rgba(60,80,125,0.14)" }}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[#E0C58F] mb-1"><Lock className="w-3 h-3" />{label}</div>
      <div className="font-mono text-[11px] text-[#A8B4CC] break-all">{value || "—"}</div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: React.ReactNode; color: string }) {
  return (
    <div className="rounded-2xl p-5 text-center" style={{ background: "rgba(13,17,23,0.85)", backdropFilter: "blur(24px)", border: "1px solid rgba(60,80,125,0.15)" }}>
      <Icon className="w-5 h-5 mx-auto mb-2" style={{ color }} />
      <div className="text-lg font-black font-mono mb-1" style={{ color }}>{value}</div>
      <div className="text-[11px] text-[#A8B4CC]">{label}</div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: "rgba(60,80,125,0.05)", border: "1px solid rgba(60,80,125,0.14)" }}>
      <Icon className="w-4 h-4 text-[#12B2C1] flex-shrink-0" />
      <div>
        <p className="text-[10px] text-[#E0C58F] uppercase tracking-widest">{label}</p>
        <p className="text-sm text-[#A8B4CC]">{value}</p>
      </div>
    </div>
  );
}

function InfoText({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "rgba(60,80,125,0.05)", border: "1px solid rgba(60,80,125,0.14)" }}>
      <p className="text-[10px] text-[#E0C58F] uppercase tracking-widest mb-1">{label}</p>
      <p className="text-sm text-[#A8B4CC]">{value}</p>
    </div>
  );
}

function MiniList({ title, items, tone }: { title: string; items: string[]; tone: "good" | "warn" }) {
  const color = tone === "good" ? "#12B2C1" : "#E0C58F";
  return (
    <div className="rounded-xl p-4" style={{ background: "rgba(60,80,125,0.05)", border: "1px solid rgba(60,80,125,0.14)" }}>
      <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color }}>{title}</h3>
      <ul className="space-y-2">
        {items.length ? items.map((item, i) => <li key={i} className="text-sm text-[#A8B4CC] leading-[1.7]">• {item}</li>) : <li className="text-sm text-[#e1ebed]">—</li>}
      </ul>
    </div>
  );
}

function ItemRow({ icon: Icon, title, subtitle, meta, description }: { icon: any; title: string; subtitle?: string; meta?: string; description?: string }) {
  return (
    <div className="flex gap-4 pb-4 border-b border-[rgba(60,80,125,0.1)] last:border-0 last:pb-0">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "rgba(60,80,125,0.1)", border: "1px solid rgba(60,80,125,0.2)" }}>
        <Icon className="w-4 h-4 text-[#e1ebed]" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold text-[#F5F0E9]">{title}</h3>
        {subtitle && <p className="text-xs text-[#12B2C1] font-medium mt-0.5">{subtitle}</p>}
        {meta && <p className="text-[12px] text-[#e1ebed] mt-0.5 mb-2 font-mono">{meta}</p>}
        {description && <p className="text-xs text-[#A8B4CC] leading-[1.8]">{description}</p>}
      </div>
    </div>
  );
}

function InlineEditButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-[#A8B4CC] hover:text-[#12B2C1]">
      <Edit3 className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-[#E0C58F] uppercase tracking-widest mb-2">{children}</p>;
}

function Meta({ icon: Icon, children, className = "" }: { icon: any; children: React.ReactNode; className?: string }) {
  return <span className={`flex items-center gap-1.5 ${className}`}><Icon className="w-3.5 h-3.5" />{children}</span>;
}

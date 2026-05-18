import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { useLang } from "../context/LanguageContext";
import {
  Loader2, Edit3, Save, X, MapPin, Globe, Briefcase,
  Zap, Phone, Mail, Lock, Eye, Plus, Sparkles,
  ExternalLink, Copy, CheckCheck, Lightbulb, RefreshCw,
  Camera, GraduationCap, UserCog, Move,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface ExpItem { title: string; company: string; duration: string; description: string; }
interface EduItem { degree: string; institution: string; major: string; year: string; }

interface ProfileState {
  // from users
  first_name:   string;
  last_name:    string;
  username:     string;
  region:       string;
  // from profiles
  headline:     string;
  location:     string;
  website:      string;
  phone:        string;
  phone_public: boolean;
  email_public: boolean;
  about:        string;
  ai_summary:   string;
  target_jobs:  string[];
  skills:       string[];
  experience:   ExpItem[];
  education:    EduItem[];
  avatar_url:      string;
  cover_url:       string;
  cover_position:  string;
  avatar_position: string;
}

const EMPTY: ProfileState = {
  first_name:"", last_name:"", username:"", region:"",
  headline:"", location:"", website:"", phone:"",
  phone_public: false, email_public: false,
  about:"", ai_summary:"", target_jobs:[], skills:[], experience:[], education:[],
  avatar_url:"", cover_url:"",
  cover_position:"50% 50%", avatar_position:"50% 50%",
};

export default function Profile() {
  const navigate = useNavigate();
  const { lang, isRtl } = useLang();

  const [data, setData]       = useState<ProfileState>(EMPTY);
  const [email, setEmail]     = useState("");
  const [userId, setUserId]   = useState("");
  const [editMode, setEdit]   = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [copied, setCopied]   = useState(false);
  const [aiLoading, setAiLoading] = useState<"summary"|"jobs"|null>(null);

  const [newSkill, setNewSkill] = useState("");
  const [newJob,   setNewJob]   = useState("");
  const [jobSuggestions, setJobSuggestions] = useState<string[]>([]);
  const [showExpForm, setShowExpForm] = useState(false);
  const [expForm, setExpForm]   = useState<ExpItem>({ title:"", company:"", duration:"", description:"" });
  const [showEduForm, setShowEduForm] = useState(false);
  const [eduForm, setEduForm]   = useState<EduItem>({ degree:"", institution:"", major:"", year:"" });

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef  = useRef<HTMLInputElement>(null);

  // ── Drag-to-reposition state ──
  const dragRef = useRef<{
    active: boolean;
    field: "cover_position" | "avatar_position";
    startX: number; startY: number;
    startPosX: number; startPosY: number;
  } | null>(null);

  const parsePos = (pos: string) => {
    const [x, y] = pos.replace(/%/g, "").split(" ").map(Number);
    return { x: isNaN(x) ? 50 : x, y: isNaN(y) ? 50 : y };
  };

  const startDrag = (
    e: React.MouseEvent | React.TouchEvent,
    field: "cover_position" | "avatar_position"
  ) => {
    if (!editMode) return;
    e.preventDefault();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    const pos = parsePos(data[field]);
    dragRef.current = { active: true, field, startX: clientX, startY: clientY, startPosX: pos.x, startPosY: pos.y };

    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (!dragRef.current?.active) return;
      const cx = "touches" in ev ? (ev as TouchEvent).touches[0].clientX : (ev as MouseEvent).clientX;
      const cy = "touches" in ev ? (ev as TouchEvent).touches[0].clientY : (ev as MouseEvent).clientY;
      const dx = ((cx - dragRef.current.startX) / window.innerWidth)  * -120;
      const dy = ((cy - dragRef.current.startY) / window.innerHeight) * -120;
      const nx = Math.min(100, Math.max(0, dragRef.current.startPosX + dx));
      const ny = Math.min(100, Math.max(0, dragRef.current.startPosY + dy));
      setData(d => ({ ...d, [dragRef.current!.field]: `${nx.toFixed(1)}% ${ny.toFixed(1)}%` }));
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

  const t = {
    en: {
      editBtn:"Edit Profile", saveBtn:"Save Changes", cancelBtn:"Cancel",
      contactTitle:"Contact & Privacy",
      emailLabel:"Email", phoneLabel:"Phone",
      publicLabel:"Public", privateLabel:"Private",
      summaryTitle:"Professional Summary",
      generateBtn:"Generate with AI", regenerateBtn:"Regenerate",
      jobsTitle:"Target Jobs",
      aiSuggestBtn:"AI Suggestions",
      skillsTitle:"Skills", addSkill:"Add skill...",
      expTitle:"Experience", addExpBtn:"+ Add Experience",
      expTitleLbl:"Job Title", expCompLbl:"Company", expDurLbl:"Duration", expDescLbl:"Description",
      eduTitle:"Education", addEduBtn:"+ Add Education",
      eduDegreeLbl:"Degree", eduMajorLbl:"Major / Field", eduInstLbl:"Institution", eduYearLbl:"Year",
      addBtn:"Add", removeBtn:"Remove",
      viewPublic:"View public profile", copyLink:"Copy link", copied:"Copied!",
      savingMsg:"Saving...", savedMsg:"Profile saved!", errorMsg:"Something went wrong.",
      noSummary:"No summary yet. Click Generate with AI to create one.",
      noJobs:"No target jobs added yet.",
      noSkills:"No skills added yet.",
      noExp:"No experience added yet.",
      noEdu:"No education added yet.",
      genSummaryHint:"Based on your skills, experience, and target jobs.",
      jobSuggestHint:"Suggested based on your profile:",
      myAccount:"My Account",
      uploadFail:"Upload failed",
      photoUpdated:"Photo updated!",
    },
    ar: {
      editBtn:"تعديل الملف", saveBtn:"حفظ التغييرات", cancelBtn:"إلغاء",
      contactTitle:"التواصل والخصوصية",
      emailLabel:"البريد الإلكتروني", phoneLabel:"الهاتف",
      publicLabel:"عام", privateLabel:"خاص",
      summaryTitle:"الملخص المهني",
      generateBtn:"توليد بالذكاء الاصطناعي", regenerateBtn:"إعادة التوليد",
      jobsTitle:"الوظائف المستهدفة",
      aiSuggestBtn:"اقتراحات الذكاء الاصطناعي",
      skillsTitle:"المهارات", addSkill:"أضف مهارة...",
      expTitle:"الخبرات المهنية", addExpBtn:"+ إضافة خبرة",
      expTitleLbl:"المسمى الوظيفي", expCompLbl:"الشركة", expDurLbl:"المدة", expDescLbl:"الوصف",
      eduTitle:"التعليم", addEduBtn:"+ إضافة شهادة",
      eduDegreeLbl:"الشهادة", eduMajorLbl:"التخصص", eduInstLbl:"المؤسسة التعليمية", eduYearLbl:"السنة",
      addBtn:"إضافة", removeBtn:"حذف",
      viewPublic:"عرض الملف العام", copyLink:"نسخ الرابط", copied:"تم النسخ!",
      savingMsg:"جاري الحفظ...", savedMsg:"تم حفظ الملف!", errorMsg:"حدث خطأ ما.",
      noSummary:"لا يوجد ملخص بعد. اضغط توليد بالذكاء الاصطناعي لإنشاء واحد.",
      noJobs:"لم تُضف وظائف مستهدفة بعد.",
      noSkills:"لم تُضف مهارات بعد.",
      noExp:"لم تُضف خبرات بعد.",
      noEdu:"لم تُضف شهادات بعد.",
      genSummaryHint:"بناءً على مهاراتك وخبراتك ووظائفك المستهدفة.",
      jobSuggestHint:"مقترحة بناءً على ملفك:",
      myAccount:"حسابي",
      uploadFail:"فشل الرفع",
      photoUpdated:"تم تحديث الصورة!",
    },
  }[lang];

  // ── Fetch ──
  useEffect(() => {
    // Safety net: never stay stuck on loading forever
    const safetyTimer = setTimeout(() => setLoading(false), 10000);

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { navigate("/login"); return; }
        setEmail(session.user.email ?? "");
        setUserId(session.user.id);

        // Fetch users and profiles in parallel, each with its own fallback
        const [uRes, pRes] = await Promise.all([
          supabase.from("users")
            .select("first_name,last_name,username,region")
            .eq("id", session.user.id)
            .maybeSingle(),
          supabase.from("profiles")
            .select("headline,location,website,phone,phone_public,email_public,about,ai_summary,target_jobs,skills,experience,education,avatar_url,cover_url,cover_position,avatar_position")
            .eq("id", session.user.id)
            .maybeSingle(),
        ]);

        const u = uRes.data;
        const p = pRes.data;

        // If no users row found → profile setup was never completed → redirect to login/setup
        if (!u) {
          navigate("/login");
          return;
        }

        setData({
          first_name:      u.first_name  ?? "",
          last_name:       u.last_name   ?? "",
          username:        u.username    ?? "",
          region:          u.region      ?? "",
          headline:        p?.headline    ?? "",
          location:        p?.location    ?? "",
          website:         p?.website     ?? "",
          phone:           p?.phone       ?? "",
          phone_public:    p?.phone_public ?? false,
          email_public:    p?.email_public ?? false,
          about:           p?.about       ?? "",
          ai_summary:      p?.ai_summary  ?? "",
          target_jobs:     Array.isArray(p?.target_jobs) ? p.target_jobs : [],
          skills:          Array.isArray(p?.skills)      ? p.skills      : [],
          experience:      Array.isArray(p?.experience)  ? p.experience  : [],
          education:       Array.isArray(p?.education)   ? p.education   : [],
          // avatar: prefer saved URL, fallback to Google profile photo
          avatar_url:      (p?.avatar_url && p.avatar_url !== "")
                             ? p.avatar_url
                             : (session.user.user_metadata?.avatar_url ?? ""),
          cover_url:       p?.cover_url       ?? "",
          cover_position:  p?.cover_position  ?? "50% 50%",
          avatar_position: p?.avatar_position ?? "50% 50%",
        });
      } catch (err) {
        console.error("Profile fetch error:", err);
      } finally {
        clearTimeout(safetyTimer);
        setLoading(false);
      }
    };

    init();
  }, [navigate]);

  // ── Photo upload ──
  const uploadPhoto = async (file: File, bucket: 'avatars' | 'covers', field: 'avatar_url' | 'cover_url') => {
    if (!userId) return;
    const ext = file.name.split('.').pop();
    const path = `${userId}/${bucket === 'avatars' ? 'avatar' : 'cover'}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) { toast.error(t.uploadFail); return; }
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
    setData(d => ({ ...d, [field]: publicUrl }));
    await supabase.from('profiles').upsert({ id: userId, [field]: publicUrl }, { onConflict: 'id' });
    toast.success(t.photoUpdated);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadPhoto(file, 'avatars', 'avatar_url');
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadPhoto(file, 'covers', 'cover_url');
  };

  // ── Save ──
  const handleSave = async () => {
    setSaving(true);
    const [uErr, pErr] = await Promise.all([
      supabase.from("users").upsert({
        id: userId, first_name: data.first_name, last_name: data.last_name,
        username: data.username,
      }, { onConflict: "id" }).then(r => r.error),
      supabase.from("profiles").upsert({
        id: userId,
        headline: data.headline, location: data.location, website: data.website,
        phone: data.phone, phone_public: data.phone_public, email_public: data.email_public,
        about: data.about, ai_summary: data.ai_summary,
        target_jobs: data.target_jobs, skills: data.skills, experience: data.experience,
        education: data.education,
        avatar_url: data.avatar_url, cover_url: data.cover_url,
        cover_position: data.cover_position, avatar_position: data.avatar_position,
        username: data.username, last_name: data.last_name,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" }).then(r => r.error),
    ]);
    setSaving(false);
    if (uErr || pErr) { toast.error(t.errorMsg); return; }
    toast.success(t.savedMsg);
    setEdit(false);
  };

  // ── AI: Generate Summary ──
  const generateSummary = async () => {
    setAiLoading("summary");
    try {
      const { data: res, error } = await supabase.functions.invoke("generate-profile-summary", {
        body: {
          firstName: data.first_name, lastName: data.last_name,
          headline: data.headline, skills: data.skills,
          experience: data.experience, targetJobs: data.target_jobs,
          location: data.location, language: lang,
        },
      });
      if (error) throw error;
      setData(d => ({ ...d, ai_summary: res.summary ?? "" }));
    } catch { toast.error(t.errorMsg); }
    setAiLoading(null);
  };

  // ── AI: Suggest Jobs ──
  const suggestJobs = async () => {
    setAiLoading("jobs");
    setJobSuggestions([]);
    try {
      const { data: res, error } = await supabase.functions.invoke("suggest-job-titles", {
        body: { skills: data.skills, experience: data.experience, language: lang },
      });
      if (error) throw error;
      setJobSuggestions(res.titles ?? []);
    } catch { toast.error(t.errorMsg); }
    setAiLoading(null);
  };

  // ── Chips helpers ──
  const addSkill = () => {
    const v = newSkill.trim();
    if (v && !data.skills.includes(v)) setData(d => ({ ...d, skills: [...d.skills, v] }));
    setNewSkill("");
  };
  const removeSkill = (s: string) => setData(d => ({ ...d, skills: d.skills.filter(x => x !== s) }));

  const addJob = (v = newJob.trim()) => {
    if (v && !data.target_jobs.includes(v)) setData(d => ({ ...d, target_jobs: [...d.target_jobs, v] }));
    setNewJob("");
  };
  const removeJob = (j: string) => setData(d => ({ ...d, target_jobs: d.target_jobs.filter(x => x !== j) }));

  const addExperience = () => {
    if (!expForm.title || !expForm.company) return;
    setData(d => ({ ...d, experience: [...d.experience, { ...expForm }] }));
    setExpForm({ title:"", company:"", duration:"", description:"" });
    setShowExpForm(false);
  };
  const removeExp = (i: number) => setData(d => ({ ...d, experience: d.experience.filter((_, idx) => idx !== i) }));

  const addEducation = () => {
    if (!eduForm.degree || !eduForm.institution) return;
    setData(d => ({ ...d, education: [...d.education, { ...eduForm }] }));
    setEduForm({ degree:"", institution:"", major:"", year:"" });
    setShowEduForm(false);
  };
  const removeEdu = (i: number) => setData(d => ({ ...d, education: d.education.filter((_, idx) => idx !== i) }));

  const copyLink = () => {
    navigator.clipboard.writeText(`https://resumation.co/u/${data.username}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const fullName = [data.first_name, data.last_name].filter(Boolean).join(" ") || "—";
  const initials = [data.first_name?.[0], data.last_name?.[0]].filter(Boolean).join("").toUpperCase() || "?";

  const inp = "w-full bg-[rgba(60,80,125,0.06)] border border-[rgba(60,80,125,0.2)] rounded-lg px-3 py-2.5 text-sm text-[#F5F0E9] outline-none focus:border-[#12B2C1]/50 transition-colors placeholder-[#566C9E]";

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D1117]">
      <Loader2 className="animate-spin text-[#12B2C1] w-8 h-8" />
    </div>
  );

  return (
    <div
      className="min-h-screen bg-[#0D1117] text-[#D9CBC2]"
      dir={isRtl ? "rtl" : "ltr"}
      style={{ fontFamily: isRtl ? "'Tajawal', sans-serif" : "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* Hidden file inputs */}
      <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
      <input ref={coverInputRef}  type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />

      {/* Glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-5%] right-[15%] w-[500px] h-[500px] rounded-full bg-[rgba(18,178,193,0.04)] blur-[130px]" />
        <div className="absolute bottom-[10%] left-[5%] w-[400px] h-[400px] rounded-full bg-[rgba(60,80,125,0.06)] blur-[110px]" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-5 py-8 sm:py-12 space-y-5">

        {/* ── HERO CARD ── */}
        <Card>
          {/* Cover */}
          <div
            className="h-28 sm:h-36 w-full rounded-t-2xl relative overflow-hidden select-none"
            style={{
              background: data.cover_url ? undefined : "linear-gradient(135deg, #0D1826 0%, #112250 55%, #0A1628 100%)",
              cursor: editMode && data.cover_url ? "grab" : "default",
            }}
            onMouseDown={editMode && data.cover_url ? (e) => startDrag(e, "cover_position") : undefined}
            onTouchStart={editMode && data.cover_url ? (e) => startDrag(e, "cover_position") : undefined}
          >
            {data.cover_url ? (
              <img
                src={data.cover_url}
                alt="cover"
                draggable={false}
                className="w-full h-full object-cover pointer-events-none"
                style={{ objectPosition: data.cover_position }}
              />
            ) : (
              <div className="absolute inset-0"
                style={{ backgroundImage: "radial-gradient(circle at 25% 60%, rgba(18,178,193,0.18) 0%, transparent 55%), radial-gradient(circle at 80% 25%, rgba(224,197,143,0.1) 0%, transparent 50%)" }} />
            )}

            {/* Edit mode: drag hint + change-photo button */}
            {editMode && (
              <>
                {data.cover_url && (
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full pointer-events-none"
                    style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}>
                    <Move className="w-3 h-3 text-white/80" />
                    <span className="text-[10px] text-white/80 font-medium whitespace-nowrap">
                      {isRtl ? "اسحب لإعادة التموضع" : "Drag to reposition"}
                    </span>
                  </div>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); coverInputRef.current?.click(); }}
                  className="absolute top-2 right-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-white hover:bg-black/70 transition-colors"
                  style={{ background: "rgba(0,0,0,0.50)", backdropFilter: "blur(6px)" }}
                >
                  <Camera className="w-3.5 h-3.5" />
                  {isRtl ? "تغيير الغلاف" : "Change Cover"}
                </button>
              </>
            )}
          </div>

          <div className="px-4 sm:px-6 pb-6">
            {/* Avatar row */}
            <div className="flex items-end justify-between -mt-10 mb-4 flex-wrap gap-3">
              {/* Avatar */}
              <div
                className="relative select-none"
                style={{ cursor: editMode && data.avatar_url ? "grab" : "default" }}
                onMouseDown={editMode && data.avatar_url ? (e) => startDrag(e, "avatar_position") : undefined}
                onTouchStart={editMode && data.avatar_url ? (e) => startDrag(e, "avatar_position") : undefined}
              >
                {data.avatar_url ? (
                  <img
                    src={data.avatar_url}
                    alt={fullName}
                    draggable={false}
                    className="w-20 h-20 rounded-2xl object-cover pointer-events-none"
                    style={{ border:"3px solid #0D1117", boxShadow:"0 0 0 1px rgba(18,178,193,0.3)", objectPosition: data.avatar_position }}
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-xl font-black text-[#F5F0E9]"
                    style={{ background:"linear-gradient(135deg,#112250,#162A60)", border:"3px solid #0D1117", boxShadow:"0 0 0 1px rgba(18,178,193,0.3)" }}>
                    {initials}
                  </div>
                )}
                {/* Camera button overlay for avatar */}
                {editMode && (
                  <button
                    onClick={(e) => { e.stopPropagation(); avatarInputRef.current?.click(); }}
                    className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    <Camera className="w-5 h-5 text-white" />
                  </button>
                )}
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#0D1117]" />
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {!editMode && data.username && (
                  <>
                    <button onClick={copyLink}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                      style={{ background:"rgba(60,80,125,0.08)", border:"1px solid rgba(60,80,125,0.2)", color: copied ? "#34d399":"#A8B4CC" }}>
                      {copied ? <CheckCheck className="w-3 h-3"/> : <Copy className="w-3 h-3"/>}
                      {copied ? t.copied : t.copyLink}
                    </button>
                    <button onClick={() => navigate(`/u/${data.username}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-[#12B2C1] transition-all hover:text-[#F5F0E9]"
                      style={{ background:"rgba(18,178,193,0.06)", border:"1px solid rgba(18,178,193,0.15)" }}>
                      <ExternalLink className="w-3 h-3"/> {t.viewPublic}
                    </button>
                  </>
                )}
                {/* My Account button */}
                {!editMode && (
                  <Link to="/account"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-[#A8B4CC] hover:text-[#F5F0E9] transition-all"
                    style={{ background:"rgba(60,80,125,0.06)", border:"1px solid rgba(60,80,125,0.15)" }}>
                    <UserCog className="w-3 h-3"/> {t.myAccount}
                  </Link>
                )}
                {!editMode ? (
                  <button onClick={() => setEdit(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[#A8B4CC] hover:text-[#F5F0E9] transition-all"
                    style={{ background:"rgba(60,80,125,0.08)", border:"1px solid rgba(60,80,125,0.2)" }}>
                    <Edit3 className="w-3 h-3"/> {t.editBtn}
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => setEdit(false)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-[#A8B4CC] transition-all"
                      style={{ background:"rgba(60,80,125,0.06)", border:"1px solid rgba(60,80,125,0.15)" }}>
                      <X className="w-3 h-3"/> {t.cancelBtn}
                    </button>
                    <button onClick={handleSave} disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11px] font-bold text-[#0D1117] transition-all disabled:opacity-60"
                      style={{ background:"linear-gradient(135deg,#12B2C1,#0E8F9C)" }}>
                      {saving ? <Loader2 className="w-3 h-3 animate-spin"/> : <Save className="w-3 h-3"/>}
                      {saving ? t.savingMsg : t.saveBtn}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Name */}
            {editMode ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <input value={data.first_name} onChange={e => setData(d=>({...d,first_name:e.target.value}))} className={inp} placeholder={isRtl?"الاسم الأول":"First name"} />
                <input value={data.last_name}  onChange={e => setData(d=>({...d,last_name:e.target.value}))}  className={inp} placeholder={isRtl?"اسم العائلة":"Last name"} />
              </div>
            ) : (
              <h1 className="text-xl font-bold text-[#F5F0E9] mb-1">{fullName}</h1>
            )}

            {/* Username */}
            {data.username && !editMode && (
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-sm text-[#566C9E] font-mono">@{data.username}</span>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[rgba(18,178,193,0.07)] border border-[#12B2C1]/15 text-[#12B2C1]">
                  <Sparkles className="w-2.5 h-2.5"/> Resumation Member
                </span>
              </div>
            )}

            {/* Headline */}
            {editMode ? (
              <input value={data.headline} onChange={e => setData(d=>({...d,headline:e.target.value}))}
                className={`${inp} mb-3`} placeholder={isRtl?"المسمى الوظيفي...":"Professional headline..."} />
            ) : data.headline ? (
              <p className="text-sm text-[#A8B4CC] mb-3">{data.headline}</p>
            ) : null}

            {/* Location + Website */}
            {editMode ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#566C9E]"/>
                  <input value={data.location} onChange={e => setData(d=>({...d,location:e.target.value}))}
                    className={`${inp} pl-8`} placeholder={isRtl?"المدينة، الدولة":"City, Country"} />
                </div>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#566C9E]"/>
                  <input value={data.website} onChange={e => setData(d=>({...d,website:e.target.value}))}
                    className={`${inp} pl-8`} placeholder="linkedin.com/in/..." />
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-4 text-xs text-[#566C9E]">
                {data.location && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5"/>{data.location}</span>}
                {data.website && (
                  <a href={data.website.startsWith("http")?data.website:`https://${data.website}`}
                    target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 hover:text-[#12B2C1] transition-colors">
                    <Globe className="w-3.5 h-3.5"/>{data.website}
                  </a>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* ── CONTACT & PRIVACY ── */}
        <Card title={t.contactTitle}>
          <div className="space-y-4">
            {/* Email */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background:"rgba(18,178,193,0.07)", border:"1px solid rgba(18,178,193,0.15)" }}>
                  <Mail className="w-4 h-4 text-[#12B2C1]"/>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-[#566C9E] uppercase tracking-wider mb-0.5">{t.emailLabel}</p>
                  <p className="text-sm text-[#F5F0E9] truncate">{email}</p>
                </div>
              </div>
              {editMode && (
                <PrivacyToggle
                  isPublic={data.email_public}
                  onChange={v => setData(d=>({...d,email_public:v}))}
                  publicLabel={t.publicLabel} privateLabel={t.privateLabel}
                />
              )}
              {!editMode && (
                <span className="flex items-center gap-1 text-[10px] text-[#566C9E]">
                  {data.email_public ? <Eye className="w-3.5 h-3.5"/> : <Lock className="w-3.5 h-3.5"/>}
                  {data.email_public ? t.publicLabel : t.privateLabel}
                </span>
              )}
            </div>

            {/* Phone */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background:"rgba(224,197,143,0.07)", border:"1px solid rgba(224,197,143,0.15)" }}>
                  <Phone className="w-4 h-4 text-[#E0C58F]"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-[#566C9E] uppercase tracking-wider mb-0.5">{t.phoneLabel}</p>
                  {editMode ? (
                    <input value={data.phone} onChange={e=>setData(d=>({...d,phone:e.target.value}))}
                      dir="ltr" className={inp} placeholder="+961 70 000 000"/>
                  ) : (
                    <p className="text-sm text-[#F5F0E9]">{data.phone || "—"}</p>
                  )}
                </div>
              </div>
              {editMode && (
                <PrivacyToggle
                  isPublic={data.phone_public}
                  onChange={v => setData(d=>({...d,phone_public:v}))}
                  publicLabel={t.publicLabel} privateLabel={t.privateLabel}
                />
              )}
              {!editMode && (
                <span className="flex items-center gap-1 text-[10px] text-[#566C9E]">
                  {data.phone_public ? <Eye className="w-3.5 h-3.5"/> : <Lock className="w-3.5 h-3.5"/>}
                  {data.phone_public ? t.publicLabel : t.privateLabel}
                </span>
              )}
            </div>
          </div>
        </Card>

        {/* ── AI SUMMARY ── */}
        <Card title={t.summaryTitle}>
          <div className="space-y-3">
            {editMode ? (
              <>
                <textarea
                  value={data.ai_summary || data.about}
                  onChange={e => setData(d=>({...d,ai_summary:e.target.value,about:e.target.value}))}
                  rows={4}
                  className={`${inp} resize-none`}
                  placeholder={t.noSummary}
                />
                <button onClick={generateSummary} disabled={aiLoading==="summary"}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                  style={{ background:"rgba(18,178,193,0.08)", border:"1px solid rgba(18,178,193,0.2)", color:"#12B2C1" }}>
                  {aiLoading==="summary"
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin"/>{isRtl?"جاري التوليد...":"Generating..."}</>
                    : <>{data.ai_summary ? <RefreshCw className="w-3.5 h-3.5"/> : <Sparkles className="w-3.5 h-3.5"/>}{data.ai_summary ? t.regenerateBtn : t.generateBtn}</>}
                </button>
                <p className="text-[10px] text-[#566C9E]">{t.genSummaryHint}</p>
              </>
            ) : (
              <p className="text-sm text-[#A8B4CC] leading-[1.9]">
                {data.ai_summary || data.about || <span className="italic text-[#566C9E]">{t.noSummary}</span>}
              </p>
            )}
          </div>
        </Card>

        {/* ── TARGET JOBS ── */}
        <Card title={t.jobsTitle}>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {data.target_jobs.map(j => (
                <span key={j} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#E0C58F]"
                  style={{ background:"rgba(224,197,143,0.07)", border:"1px solid rgba(224,197,143,0.15)" }}>
                  {j}
                  {editMode && <button onClick={()=>removeJob(j)}><X className="w-3 h-3 opacity-60 hover:opacity-100"/></button>}
                </span>
              ))}
              {!data.target_jobs.length && <p className="text-xs text-[#566C9E] italic">{t.noJobs}</p>}
            </div>

            {editMode && (
              <>
                <div className="flex gap-2">
                  <input value={newJob} onChange={e=>setNewJob(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&addJob()}
                    className={`${inp} flex-1`} placeholder={isRtl?"مثال: مطور واجهات...":"e.g. Frontend Developer..."}/>
                  <button onClick={()=>addJob()}
                    className="px-3 py-2 rounded-lg text-xs font-bold text-[#0D1117]"
                    style={{ background:"linear-gradient(135deg,#12B2C1,#0E8F9C)" }}>
                    <Plus className="w-4 h-4"/>
                  </button>
                </div>

                <button onClick={suggestJobs} disabled={aiLoading==="jobs"}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                  style={{ background:"rgba(224,197,143,0.07)", border:"1px solid rgba(224,197,143,0.15)", color:"#E0C58F" }}>
                  {aiLoading==="jobs"
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin"/>{isRtl?"جاري التحليل...":"Analyzing..."}</>
                    : <><Lightbulb className="w-3.5 h-3.5"/>{t.aiSuggestBtn}</>}
                </button>

                {jobSuggestions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-[#566C9E] uppercase tracking-wider">{t.jobSuggestHint}</p>
                    <div className="flex flex-wrap gap-2">
                      {jobSuggestions.map(s => (
                        <button key={s} onClick={()=>addJob(s)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#A8B4CC] hover:text-[#F5F0E9] transition-all"
                          style={{ background:"rgba(60,80,125,0.08)", border:"1px solid rgba(60,80,125,0.2)" }}>
                          <Plus className="w-3 h-3"/> {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>

        {/* ── SKILLS ── */}
        <Card title={t.skillsTitle}>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {data.skills.map(s => (
                <span key={s} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#12B2C1]"
                  style={{ background:"rgba(18,178,193,0.07)", border:"1px solid rgba(18,178,193,0.15)" }}>
                  <Zap className="w-3 h-3"/> {s}
                  {editMode && <button onClick={()=>removeSkill(s)}><X className="w-3 h-3 opacity-60 hover:opacity-100"/></button>}
                </span>
              ))}
              {!data.skills.length && <p className="text-xs text-[#566C9E] italic">{t.noSkills}</p>}
            </div>
            {editMode && (
              <div className="flex gap-2">
                <input value={newSkill} onChange={e=>setNewSkill(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&addSkill()}
                  className={`${inp} flex-1`} placeholder={t.addSkill}/>
                <button onClick={addSkill}
                  className="px-3 py-2 rounded-lg text-xs font-bold text-[#0D1117]"
                  style={{ background:"linear-gradient(135deg,#12B2C1,#0E8F9C)" }}>
                  <Plus className="w-4 h-4"/>
                </button>
              </div>
            )}
          </div>
        </Card>

        {/* ── EXPERIENCE ── */}
        <Card title={t.expTitle}>
          <div className="space-y-5">
            {data.experience.map((exp, i) => (
              <div key={i} className="flex gap-4 group pb-5 border-b border-[rgba(60,80,125,0.1)] last:border-0 last:pb-0">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background:"rgba(60,80,125,0.1)", border:"1px solid rgba(60,80,125,0.2)" }}>
                  <Briefcase className="w-4 h-4 text-[#566C9E]"/>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-[#F5F0E9]">{exp.title}</h3>
                  <p className="text-xs text-[#12B2C1] font-medium mt-0.5">{exp.company}</p>
                  <p className="text-[11px] text-[#566C9E] mt-0.5 mb-2 font-mono">{exp.duration}</p>
                  {exp.description && <p className="text-xs text-[#A8B4CC] leading-[1.8]">{exp.description}</p>}
                </div>
                {editMode && (
                  <button onClick={()=>removeExp(i)} className="text-[#566C9E] hover:text-red-400 transition-colors flex-shrink-0">
                    <X className="w-4 h-4"/>
                  </button>
                )}
              </div>
            ))}
            {!data.experience.length && <p className="text-xs text-[#566C9E] italic">{t.noExp}</p>}

            {editMode && (
              showExpForm ? (
                <div className="space-y-3 pt-3 border-t border-[rgba(60,80,125,0.1)]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input value={expForm.title} onChange={e=>setExpForm(f=>({...f,title:e.target.value}))}
                      className={inp} placeholder={t.expTitleLbl}/>
                    <input value={expForm.company} onChange={e=>setExpForm(f=>({...f,company:e.target.value}))}
                      className={inp} placeholder={t.expCompLbl}/>
                  </div>
                  <input value={expForm.duration} onChange={e=>setExpForm(f=>({...f,duration:e.target.value}))}
                    className={inp} placeholder={t.expDurLbl + " — e.g. 2022 - 2024"}/>
                  <textarea value={expForm.description} onChange={e=>setExpForm(f=>({...f,description:e.target.value}))}
                    className={`${inp} resize-none`} rows={3} placeholder={t.expDescLbl}/>
                  <div className="flex gap-2">
                    <button onClick={addExperience}
                      className="px-4 py-2 rounded-lg text-xs font-bold text-[#0D1117]"
                      style={{ background:"linear-gradient(135deg,#12B2C1,#0E8F9C)" }}>
                      {t.addBtn}
                    </button>
                    <button onClick={()=>setShowExpForm(false)}
                      className="px-4 py-2 rounded-lg text-xs font-medium text-[#A8B4CC]"
                      style={{ background:"rgba(60,80,125,0.06)", border:"1px solid rgba(60,80,125,0.15)" }}>
                      {t.cancelBtn}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={()=>setShowExpForm(true)}
                  className="flex items-center gap-2 text-xs font-medium text-[#A8B4CC] hover:text-[#12B2C1] transition-colors pt-1">
                  <Plus className="w-3.5 h-3.5"/> {t.addExpBtn}
                </button>
              )
            )}
          </div>
        </Card>

        {/* ── EDUCATION ── */}
        <Card title={t.eduTitle}>
          <div className="space-y-5">
            {data.education.map((edu, i) => (
              <div key={i} className="flex gap-4 group pb-5 border-b border-[rgba(60,80,125,0.1)] last:border-0 last:pb-0">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background:"rgba(60,80,125,0.1)", border:"1px solid rgba(60,80,125,0.2)" }}>
                  <GraduationCap className="w-4 h-4 text-[#566C9E]"/>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-[#F5F0E9]">{edu.degree}</h3>
                  {edu.major && <p className="text-xs text-[#E0C58F] font-medium mt-0.5">{edu.major}</p>}
                  <p className="text-xs text-[#12B2C1] font-medium mt-0.5">{edu.institution}</p>
                  {edu.year && <p className="text-[11px] text-[#566C9E] mt-0.5 font-mono">{edu.year}</p>}
                </div>
                {editMode && (
                  <button onClick={()=>removeEdu(i)} className="text-[#566C9E] hover:text-red-400 transition-colors flex-shrink-0">
                    <X className="w-4 h-4"/>
                  </button>
                )}
              </div>
            ))}
            {!data.education.length && <p className="text-xs text-[#566C9E] italic">{t.noEdu}</p>}

            {editMode && (
              showEduForm ? (
                <div className="space-y-3 pt-3 border-t border-[rgba(60,80,125,0.1)]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input value={eduForm.degree} onChange={e=>setEduForm(f=>({...f,degree:e.target.value}))}
                      className={inp} placeholder={t.eduDegreeLbl}/>
                    <input value={eduForm.major} onChange={e=>setEduForm(f=>({...f,major:e.target.value}))}
                      className={inp} placeholder={t.eduMajorLbl}/>
                  </div>
                  <input value={eduForm.institution} onChange={e=>setEduForm(f=>({...f,institution:e.target.value}))}
                    className={inp} placeholder={t.eduInstLbl}/>
                  <input value={eduForm.year} onChange={e=>setEduForm(f=>({...f,year:e.target.value}))}
                    className={inp} placeholder={t.eduYearLbl + " — e.g. 2020"} dir="ltr"/>
                  <div className="flex gap-2">
                    <button onClick={addEducation}
                      className="px-4 py-2 rounded-lg text-xs font-bold text-[#0D1117]"
                      style={{ background:"linear-gradient(135deg,#12B2C1,#0E8F9C)" }}>
                      {t.addBtn}
                    </button>
                    <button onClick={()=>setShowEduForm(false)}
                      className="px-4 py-2 rounded-lg text-xs font-medium text-[#A8B4CC]"
                      style={{ background:"rgba(60,80,125,0.06)", border:"1px solid rgba(60,80,125,0.15)" }}>
                      {t.cancelBtn}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={()=>setShowEduForm(true)}
                  className="flex items-center gap-2 text-xs font-medium text-[#A8B4CC] hover:text-[#12B2C1] transition-colors pt-1">
                  <Plus className="w-3.5 h-3.5"/> {t.addEduBtn}
                </button>
              )
            )}
          </div>
        </Card>

      </div>
    </div>
  );
}

// ── Card wrapper ──
function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5 sm:p-6" style={{ background:"rgba(13,17,23,0.85)", backdropFilter:"blur(24px)", border:"1px solid rgba(60,80,125,0.15)" }}>
      {title && <h2 className="text-[11px] font-bold text-[#E0C58F] uppercase tracking-widest mb-5">{title}</h2>}
      {children}
    </div>
  );
}

// ── Privacy toggle ──
function PrivacyToggle({ isPublic, onChange, publicLabel, privateLabel }:
  { isPublic: boolean; onChange: (v:boolean)=>void; publicLabel: string; privateLabel: string }) {
  return (
    <button onClick={() => onChange(!isPublic)}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium flex-shrink-0 transition-all"
      style={{
        background: isPublic ? "rgba(18,178,193,0.08)" : "rgba(60,80,125,0.06)",
        border: isPublic ? "1px solid rgba(18,178,193,0.2)" : "1px solid rgba(60,80,125,0.15)",
        color: isPublic ? "#12B2C1" : "#566C9E",
      }}>
      {isPublic ? <Eye className="w-3 h-3"/> : <Lock className="w-3 h-3"/>}
      {isPublic ? publicLabel : privateLabel}
    </button>
  );
}

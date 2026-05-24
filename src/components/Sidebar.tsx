import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, FileText, Download,
  BrainCircuit, ExternalLink, LogOut, X, UserCog,
} from "lucide-react";
import { useLang } from "../context/LanguageContext";
import { useSidebar } from "../context/SidebarContext";
import { supabase } from "../supabase";

export default function Sidebar() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const { lang, isRtl }    = useLang();
  const { isOpen, setIsOpen } = useSidebar();

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername]       = useState<string | null>(null);

  useEffect(() => {
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
    const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

    const lsKey = Object.keys(localStorage).find(
      k => k.startsWith("sb-") && k.endsWith("-auth-token")
    );
    if (!lsKey) return;

    let uid         = "";
    let accessToken: string | null = null;

    try {
      const cached = JSON.parse(localStorage.getItem(lsKey) || "null");
      uid         = cached?.user?.id          ?? "";
      accessToken = cached?.access_token      ?? null;
      const meta  = cached?.user?.user_metadata ?? {};
      const email = cached?.user?.email        ?? "";
      setDisplayName(meta.full_name?.split(" ")[0] || email.split("@")[0] || "");
    } catch {}

    if (!uid) return;

    fetch(
      `${SUPABASE_URL}/rest/v1/users?id=eq.${uid}&select=username,first_name`,
      { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${accessToken ?? SUPABASE_KEY}` } }
    )
      .then(r => r.json())
      .then(rows => {
        if (Array.isArray(rows) && rows[0]) {
          if (rows[0].username)   setUsername(rows[0].username);
          if (rows[0].first_name) setDisplayName(rows[0].first_name);
        }
      })
      .catch(() => {});
  }, []);

  // Close drawer on route change
  useEffect(() => { setIsOpen(false); }, [location.pathname, location.search]);

  const handleLogout = () => {
    try {
      Object.keys(localStorage).forEach(k => { if (k.startsWith("sb-")) localStorage.removeItem(k); });
      sessionStorage.clear();
    } catch {}
    window.location.replace("/login");
    supabase.auth.signOut().catch(() => {});
  };

  const t = lang === "ar" ? {
    greeting:       "مرحباً",
    dashboard:      "لوحة التحكم",
    myResumes:      "سيرتي الذاتية",
    downloads:      "التحميلات",
    aiAnalysis:     "تحليل CV vs JD",
    myProfile:      "ملفي الشخصي",
    viewProfile:    "ملفي العام",
    logout:         "تسجيل الخروج",
  } : {
    greeting:       "Hello",
    dashboard:      "Dashboard",
    myResumes:      "My Resumes",
    downloads:      "Downloads",
    aiAnalysis:     "AI Analysis: CV vs JD",
    myProfile:      "My Profile",
    viewProfile:    "View Profile",
    logout:      "Logout",
  };

  const { pathname, search } = location;
  const isDownloads = search.includes("view=downloads");

  const navItems = [
    {
      label:   t.dashboard,
      icon:    <LayoutDashboard className="w-4 h-4 flex-shrink-0" />,
      active:  pathname === "/dashboard",
      onClick: () => navigate("/dashboard"),
    },
    {
      label:   t.myResumes,
      icon:    <FileText className="w-4 h-4 flex-shrink-0" />,
      active:  (pathname === "/my-account" || pathname === "/account") && !isDownloads,
      onClick: () => navigate("/my-account"),
    },
    {
      label:   t.downloads,
      icon:    <Download className="w-4 h-4 flex-shrink-0" />,
      active:  isDownloads,
      onClick: () => navigate("/my-account?view=downloads"),
    },
    {
      label:   t.aiAnalysis,
      icon:    <BrainCircuit className="w-4 h-4 flex-shrink-0" />,
      active:  pathname === "/analyse" || pathname === "/career-analysis",
      onClick: () => navigate("/analyse"),
    },
    {
      label:   t.myProfile,
      icon:    <UserCog className="w-4 h-4 flex-shrink-0" />,
      active:  pathname === "/profile",
      onClick: () => navigate("/profile"),
    },
  ];

  const initials = displayName?.[0]?.toUpperCase() || "?";

  // Desktop: fixed panel. Mobile: slide-in drawer.
  const sideEdge   = isRtl ? "right-0 border-l" : "left-0 border-r";
  const closedSlide = isRtl ? "translate-x-full" : "-translate-x-full";

  return (
    <>
      {/* ── Mobile backdrop ── */}
      <div
        onClick={() => setIsOpen(false)}
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* ── Sidebar panel ── */}
      <aside
        className={`
          fixed ${sideEdge} z-50
          top-0 h-full w-72
          md:top-16 md:h-[calc(100vh-64px)] md:w-64 md:z-30
          flex flex-col
          transition-transform duration-300
          ${isOpen ? "translate-x-0" : closedSlide}
          md:translate-x-0
        `}
        style={{
          background:     "rgba(9,13,19,0.97)",
          backdropFilter: "blur(24px)",
          borderColor:    "rgba(60,80,125,0.18)",
        }}
        dir={isRtl ? "rtl" : "ltr"}
      >
        {/* ── Mobile close button ── */}
        <button
          onClick={() => setIsOpen(false)}
          className={`md:hidden absolute top-4 ${isRtl ? "left-4" : "right-4"} w-8 h-8 rounded-lg flex items-center justify-center text-[#7A8FAA] hover:text-[#F5F0E9] hover:bg-white/10 transition-all`}
        >
          <X className="w-4 h-4" />
        </button>

        {/* ── User badge ── */}
        <div className="p-5 border-b border-white/5 mt-10 md:mt-0">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white flex-shrink-0"
              style={{
                background: "linear-gradient(135deg, #2A1A05, #3D2A0A)",
                border:     "1.5px solid rgba(224,197,143,0.30)",
              }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-[#8A7A55] font-semibold uppercase tracking-widest leading-none mb-0.5">
                {t.greeting}
              </p>
              <p className="text-[13px] font-bold text-[#F5F0E9] truncate">{displayName || "—"}</p>
            </div>
          </div>
        </div>

        {/* ── Nav items ── */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(item => (
            <button
              key={item.label}
              onClick={item.onClick}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-semibold transition-all duration-200 text-start ${
                item.active
                  ? "bg-[rgba(224,197,143,0.12)] text-[#E0C58F] border border-[rgba(224,197,143,0.28)]"
                  : "text-[#7A8FAA] hover:bg-white/5 hover:text-[#E0D9D0] border border-transparent"
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* ── Bottom: Profile link + Logout ── */}
        <div className="p-3 border-t border-white/5 space-y-0.5">
          {username && (
            <button
              onClick={() => window.open(`/u/${username}`, "_blank")}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-semibold text-[#7A8FAA] hover:bg-white/5 hover:text-[#E0D9D0] border border-transparent transition-all duration-200 text-start"
            >
              <ExternalLink className="w-4 h-4 flex-shrink-0" />
              <span>{t.viewProfile}</span>
            </button>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-semibold text-red-500/70 hover:bg-red-500/10 hover:text-red-400 border border-transparent transition-all duration-200 text-start"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span>{t.logout}</span>
          </button>
        </div>
      </aside>
    </>
  );
}

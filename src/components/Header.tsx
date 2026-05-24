import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import {
  LogOut, LayoutDashboard, UserCircle, CreditCard,
  Headphones, Home, Sparkles, Menu,
} from "lucide-react";
import { useLang } from "../context/LanguageContext";
import { useSidebar } from "../context/SidebarContext";

const SIDEBAR_PATHS = ["/dashboard", "/my-account", "/account", "/analyse", "/career-analysis", "/profile"];

export default function Header() {
  const location   = useLocation();
  const { toggle } = useSidebar();
  const [isLoggedIn, setIsLoggedIn]   = useState(false);
  const [profileData, setProfileData] = useState<{
    username: string; avatar_url: string; first_name: string;
  } | null>(null);
  const { lang, isRtl } = useLang();

  const isSidebarPage = SIDEBAR_PATHS.includes(location.pathname);
  const isActive = (path: string) => location.pathname === path;

  // ── Auth listener (logic unchanged) ──────────────────────────────────────
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
      if (session?.user) {
        const { data: u } = await supabase.from("users").select("username, first_name").eq("id", session.user.id).maybeSingle();
        const { data: p } = await supabase.from("profiles").select("avatar_url, username, first_name").eq("id", session.user.id).maybeSingle();
        if (u || p) setProfileData({
          username:    u?.username    ?? p?.username    ?? "",
          first_name:  u?.first_name  ?? p?.first_name  ?? "",
          avatar_url:  p?.avatar_url  ?? "",
        });
      }
    };
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") { setIsLoggedIn(false); setProfileData(null); return; }
      if (event !== "SIGNED_IN" && event !== "INITIAL_SESSION") return;
      setIsLoggedIn(!!session);
      if (session?.user) {
        const { data: u } = await supabase.from("users").select("username, first_name").eq("id", session.user.id).maybeSingle();
        const { data: p } = await supabase.from("profiles").select("avatar_url, username, first_name").eq("id", session.user.id).maybeSingle();
        if (u || p) setProfileData({
          username:    u?.username    ?? p?.username    ?? "",
          first_name:  u?.first_name  ?? p?.first_name  ?? "",
          avatar_url:  p?.avatar_url  ?? "",
        });
      } else {
        setProfileData(null);
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  const handleLogout = () => {
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith("sb-")) localStorage.removeItem(key);
      });
      sessionStorage.clear();
    } catch { /* ignore */ }
    window.location.replace("/login");
    supabase.auth.signOut().catch(() => {});
  };

  // ── i18n ─────────────────────────────────────────────────────────────────
  const translations = {
    en: {
      home: "Home", pricing: "Pricing", support: "Support",
      dashboard: "Dashboard", account: "Account", logout: "Logout", login: "Login",
    },
    ar: {
      home: "الرئيسية", pricing: "الأسعار", support: "الدعم الفني",
      dashboard: "لوحة التحكم", account: "حسابي", logout: "تسجيل الخروج", login: "تسجيل الدخول",
    },
  };
  const t = translations[lang];

  // ── Shared class fragments ────────────────────────────────────────────────
  /** Cyan underline that appears on the active route */
  const ActiveBar = () => (
    <span className="absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r from-[#12B2C1] to-[#12B2C1]/40 rounded-full" />
  );

  const navBase =
    "relative text-xs font-medium tracking-wide flex items-center gap-2 group pb-1.5 transition-colors duration-200 cursor-pointer";

  return (
    /**
     * P2 — Floating header:
     *   fixed top-4 left-4 right-4 → 16px gutter on all sides
     *   max-w-[1400px] mx-auto     → centers on ultra-wide screens
     *   rounded-xl                 → premium pill shape
     * Shadow layered: outer depth + subtle inner top highlight
     */
    <header
      className="
        fixed top-4 left-4 right-4 z-[110] max-w-[1400px] mx-auto rounded-xl
        bg-[#0D1117]/88 backdrop-blur-2xl
        border border-[#3C507D]/25
        shadow-[0_8px_32px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(60,80,125,0.12)]
        transition-all duration-300 text-[#D9CBC2]
      "
      dir={isRtl ? "rtl" : "ltr"}
      style={{ fontFamily: isRtl ? "'Tajawal', sans-serif" : "'Plus Jakarta Sans', sans-serif" }}
    >
      <div className="w-full px-5 sm:px-6 h-16 flex items-center justify-between">

        {/* ── P1 Hamburger — 44×44px touch target ───────────────────────── */}
        {isSidebarPage && (
          <button
            onClick={toggle}
            className="
              md:hidden flex items-center justify-center
              w-11 h-11 rounded-lg cursor-pointer
              text-[#A8B4CC] hover:text-[#F5F0E9] hover:bg-white/[0.06]
              transition-all duration-200 flex-shrink-0 me-2
            "
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* ── Logo ─────────────────────────────────────────────────────── */}
        <Link to="/" className="flex items-center gap-3 group cursor-pointer">
          <div className="
            w-8 h-8 rounded flex items-center justify-center
            bg-gradient-to-br from-[#112250] to-[#0D1117]
            border border-[#3C507D]/40
            shadow-[0_0_15px_rgba(60,80,125,0.15)]
            group-hover:border-[#12B2C1]/50
            transition-all duration-300
          ">
            <Sparkles
              strokeWidth={1.75}
              className="w-4 h-4 text-[#E0C58F] group-hover:scale-105 transition-transform duration-300"
            />
          </div>
          <span className="text-sm font-semibold tracking-wide text-[#F5F0E9] uppercase">
            Resumation<span className="text-[#E0C58F] font-bold">.co</span>
          </span>
        </Link>

        {/* ── P2 Navigation — with active-route cyan indicator ─────────── */}
        <nav className="hidden md:flex items-center gap-6">

          <Link
            to="/"
            className={`${navBase} ${isActive("/") ? "text-[#F5F0E9]" : "text-[#A8B4CC] hover:text-[#F5F0E9]"}`}
          >
            <Home
              strokeWidth={1.75}
              className={`w-4 h-4 transition-colors duration-200 ${isActive("/") ? "text-[#12B2C1]" : "text-[#e1ebed] group-hover:text-[#12B2C1]"}`}
            />
            <span>{t.home}</span>
            {isActive("/") && <ActiveBar />}
          </Link>

          <Link
            to="/pricing"
            className={`${navBase} ${isActive("/pricing") ? "text-[#F5F0E9]" : "text-[#A8B4CC] hover:text-[#F5F0E9]"}`}
          >
            <CreditCard
              strokeWidth={1.75}
              className={`w-4 h-4 transition-colors duration-200 ${isActive("/pricing") ? "text-[#12B2C1]" : "text-[#e1ebed] group-hover:text-[#12B2C1]"}`}
            />
            <span>{t.pricing}</span>
            {isActive("/pricing") && <ActiveBar />}
          </Link>

          <Link
            to="/contact"
            className={`${navBase} ${isActive("/contact") ? "text-[#F5F0E9]" : "text-[#A8B4CC] hover:text-[#F5F0E9]"}`}
          >
            <Headphones
              strokeWidth={1.75}
              className={`w-4 h-4 transition-colors duration-200 ${isActive("/contact") ? "text-[#12B2C1]" : "text-[#e1ebed] group-hover:text-[#12B2C1]"}`}
            />
            <span>{t.support}</span>
            {isActive("/contact") && <ActiveBar />}
          </Link>

          {isLoggedIn && (
            <>
              <div className="h-4 w-px bg-[#3C507D]/25 mx-1" />

              <Link
                to="/dashboard"
                className={`${navBase} ${isActive("/dashboard") ? "text-[#F5F0E9]" : "text-[#12B2C1] hover:text-[#F5F0E9]"}`}
              >
                <LayoutDashboard
                  strokeWidth={1.75}
                  className="w-4 h-4 text-[#12B2C1] transition-colors duration-200"
                />
                <span>{t.dashboard}</span>
                {isActive("/dashboard") && <ActiveBar />}
              </Link>

              <Link
                to="/profile"
                className={`${navBase} ${isActive("/profile") ? "text-[#F5F0E9]" : "text-[#A8B4CC] hover:text-[#F5F0E9]"}`}
              >
                <UserCircle
                  strokeWidth={1.75}
                  className={`w-4 h-4 transition-colors duration-200 ${isActive("/profile") ? "text-[#12B2C1]" : "text-[#e1ebed] group-hover:text-[#12B2C1]"}`}
                />
                <span>{t.account}</span>
                {isActive("/profile") && <ActiveBar />}
              </Link>
            </>
          )}
        </nav>

        {/* ── Action Controls ───────────────────────────────────────────── */}
        <div className="flex items-center gap-3">

          {/* Avatar pill (desktop only) */}
          {isLoggedIn && profileData && (
            <Link
              to="/profile"
              className="
                hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer
                text-xs font-medium text-[#A8B4CC] hover:text-[#F5F0E9]
                bg-[rgba(60,80,125,0.06)] border border-[rgba(60,80,125,0.15)]
                hover:border-[rgba(60,80,125,0.35)]
                transition-all duration-200
              "
            >
              {profileData.avatar_url
                ? <img
                    src={profileData.avatar_url}
                    alt={profileData.first_name}
                    className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                  />
                : <div className="w-7 h-7 rounded-full bg-[#112250] border border-[#12B2C1]/30 flex items-center justify-center text-xs font-bold text-[#F5F0E9] flex-shrink-0">
                    {profileData.first_name?.[0]?.toUpperCase() ?? "?"}
                  </div>
              }
              {profileData.username && (
                <span className="text-[12px] text-[#A8B4CC] font-mono hidden lg:inline">
                  @{profileData.username}
                </span>
              )}
            </Link>
          )}

          {isLoggedIn ? (
            /* P1 — py-3 ensures 44px touch height */
            <button
              onClick={handleLogout}
              className="
                group flex items-center gap-2 px-4 py-3 rounded cursor-pointer
                text-xs font-medium tracking-wide
                text-[#A8B4CC] bg-[rgba(60,80,125,0.04)] border border-[#3C507D]/20
                hover:bg-[rgba(60,80,125,0.09)] hover:text-[#F5F0E9] hover:border-[#3C507D]/50
                transition-all duration-200
              "
            >
              <LogOut
                strokeWidth={1.75}
                className="w-4 h-4 text-[#e1ebed] group-hover:text-red-400 transition-colors duration-200"
              />
              <span className="hidden sm:inline">{t.logout}</span>
            </button>
          ) : (
            /* P1 — py-3 → 44px min height; hover uses quicksand.light not canvas.white */
            <Link
              to="/login"
              className="
                inline-flex items-center justify-center rounded cursor-pointer
                text-xs font-bold text-[#0D1117]
                bg-[#E0C58F] px-5 py-3
                shadow-[0_0_15px_rgba(224,197,143,0.12)]
                hover:bg-[#F0DFBF] hover:shadow-[0_0_24px_rgba(224,197,143,0.28)]
                transition-all duration-200
              "
            >
              {t.login}
            </Link>
          )}
        </div>

      </div>
    </header>
  );
}

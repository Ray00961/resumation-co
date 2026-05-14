import { useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { LogOut, LayoutDashboard, UserCircle, CreditCard, Headphones, Home, Shield } from "lucide-react";

export default function Header() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
    };
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setIsLoggedIn(!!session);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <header className="bg-[#050B14]/80 backdrop-blur-md border-b border-cyan-500/10 sticky top-0 z-[100] font-sans">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        
        {/* Logo - Matching Hero Style */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="bg-cyan-500/10 border border-cyan-500/30 p-2 rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.1)] group-hover:border-cyan-400 transition-all duration-300">
            <Shield className="w-6 h-6 text-cyan-400" />
          </div>
          <span className="text-2xl font-black tracking-tighter text-white">
            Resumation<span className="text-cyan-400">.co</span>
          </span>
        </Link>

        {/* Navigation Desktop - Cyber Style */}
        <nav className="hidden md:flex items-center gap-8">
          <Link to="/" className="text-[11px] uppercase tracking-[0.2em] font-black text-slate-400 hover:text-cyan-400 transition flex items-center gap-2 group">
            <Home className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" /> Home
          </Link>
          
          <Link to="/pricing" className="text-[11px] uppercase tracking-[0.2em] font-black text-slate-400 hover:text-cyan-400 transition flex items-center gap-2 group">
            <CreditCard className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" /> Pricing
          </Link>

          <Link to="/contact" className="text-[11px] uppercase tracking-[0.2em] font-black text-slate-400 hover:text-cyan-400 transition flex items-center gap-2 group">
            <Headphones className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" /> Support
          </Link>
          
          {isLoggedIn && (
            <>
              <div className="h-6 w-px bg-slate-800 mx-2"></div>
              <Link to="/dashboard" className="text-[11px] uppercase tracking-[0.2em] font-black text-cyan-400 hover:text-cyan-300 flex items-center gap-2 group">
                <LayoutDashboard className="w-3.5 h-3.5 group-hover:animate-pulse" /> Dashboard
              </Link>
              <Link to="/account" className="text-[11px] uppercase tracking-[0.2em] font-black text-slate-400 hover:text-cyan-400 transition flex items-center gap-2 group">
                <UserCircle className="w-3.5 h-3.5" /> Account
              </Link>
            </>
          )}
        </nav>

        {/* Auth Buttons */}
        <div className="flex items-center gap-4">
          {isLoggedIn ? (
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-5 py-2.5 text-[11px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500/10 border border-red-500/20 rounded-xl transition-all duration-300"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          ) : (
            <Link 
              to="/login" 
              className="relative group overflow-hidden bg-cyan-600 px-8 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white hover:bg-cyan-500 transition-all shadow-[0_0_20px_rgba(6,182,212,0.2)]"
            >
              <span className="relative z-10">Login</span>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
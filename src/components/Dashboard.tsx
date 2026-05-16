import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText, Settings2, LogOut, Loader2,
  BrainCircuit, Shield, Zap, Activity, Database, UserCircle2,
} from "lucide-react";
import { supabase } from "../supabase";

export default function Dashboard() {
  const navigate  = useNavigate();
  const [userName, setUserName] = useState("");
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { navigate("/login"); return; }

        const fullName = session.user.user_metadata?.full_name;
        if (fullName) {
          setUserName(fullName.split(" ")[0]);
        } else {
          const name = (session.user.email || "").split("@")[0];
          setUserName(name.charAt(0).toUpperCase() + name.slice(1));
        }
        setLoading(false);
      } catch (error) {
        console.error("Dashboard Auth Error:", error);
        setLoading(false);
      }
    };
    checkUser();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cyber-bg">
        <Loader2 className="animate-spin text-cyber-cyan w-10 h-10" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cyber-bg text-cyber-text/90 font-sans relative overflow-x-hidden flex flex-col">

      {/* Ambient glows */}
      <div className="absolute top-0 right-0 w-[65vw] h-[65vw] bg-cyber-teal/8 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[55vw] h-[55vw] bg-cyber-teal/5 rounded-full blur-[130px] pointer-events-none" />

      <div className="relative z-10 max-w-7xl w-full mx-auto px-6 py-12 flex-1">

        {/* ── Header bar ── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-14 gap-6 border-b border-white/5 pb-10">
          <div>
            <div className="flex items-center gap-2 text-cyber-cyan mb-3">
              <Activity className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em]">System Online</span>
            </div>
            <h1 className="text-4xl lg:text-6xl font-black text-white tracking-tight mb-1">
              Welcome,{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyber-cyan to-cyber-teal">
                {userName}
              </span>
            </h1>
            <p className="text-cyber-muted text-sm font-medium tracking-wide">
              Select a tool to accelerate your career.
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-5 py-3 bg-red-500/5 border border-red-500/20 rounded-2xl text-red-400 hover:bg-red-500/10 hover:border-red-500/35 transition-all duration-300 text-[10px] font-black uppercase tracking-widest"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* Build */}
          <div
            onClick={() => navigate("/builder")}
            className="group relative bg-white/5 backdrop-blur-xl border border-white/10 hover:border-cyber-teal/40 rounded-[2rem] p-10 transition-all duration-300 cursor-pointer flex flex-col items-center justify-center text-center min-h-[380px] hover:bg-cyber-teal/5 hover:shadow-[0_0_40px_rgba(13,138,158,0.15)]"
          >
            <div className="w-20 h-20 bg-cyber-teal/10 border border-cyber-teal/20 rounded-3xl flex items-center justify-center mb-7 group-hover:scale-110 group-hover:shadow-[0_0_24px_rgba(13,138,158,0.35)] transition-all duration-300">
              <FileText className="w-9 h-9 text-cyber-cyan" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-black text-white mb-2 tracking-tight">Resume Builder</h2>
            <p className="text-cyber-muted mb-8 text-sm leading-relaxed max-w-[200px]">
              Build an ATS-optimized resume powered by AI.
            </p>
            <div className="w-full bg-gradient-to-r from-cyber-teal to-cyber-cyan text-white py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest group-hover:from-cyber-teal/80 group-hover:to-cyber-cyan/80 transition-all shadow-[0_0_20px_rgba(13,138,158,0.3)]">
              Open Builder →
            </div>
          </div>

          {/* Analyze */}
          <div
            onClick={() => navigate("/career-analysis")}
            className="group relative bg-white/5 backdrop-blur-xl border border-white/10 hover:border-cyber-teal/40 rounded-[2rem] p-10 transition-all duration-300 cursor-pointer flex flex-col items-center justify-center text-center min-h-[380px] hover:bg-cyber-teal/5 hover:shadow-[0_0_40px_rgba(13,138,158,0.15)]"
          >
            <div className="w-20 h-20 bg-cyber-teal/10 border border-cyber-teal/20 rounded-3xl flex items-center justify-center mb-7 group-hover:scale-110 group-hover:shadow-[0_0_24px_rgba(13,138,158,0.35)] transition-all duration-300">
              <BrainCircuit className="w-9 h-9 text-cyber-teal" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-black text-white mb-2 tracking-tight">AI Analyzer</h2>
            <p className="text-cyber-muted mb-8 text-sm leading-relaxed max-w-[200px]">
              Deep-scan your career and extract top keywords.
            </p>
            <div className="w-full bg-gradient-to-r from-cyber-teal to-cyber-cyan text-white py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest group-hover:from-cyber-teal/80 group-hover:to-cyber-cyan/80 transition-all shadow-[0_0_20px_rgba(13,138,158,0.3)]">
              Start Scan →
            </div>
          </div>

          {/* Account */}
          <div
            onClick={() => navigate("/my-account")}
            className="group relative bg-white/5 backdrop-blur-xl border border-white/10 hover:border-white/20 rounded-[2rem] p-10 transition-all duration-300 cursor-pointer flex flex-col items-center justify-center text-center min-h-[380px] hover:bg-white/5"
          >
            <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center mb-7 group-hover:bg-white/10 transition-all duration-300">
              <Settings2 className="w-9 h-9 text-cyber-dim group-hover:text-white transition-colors" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-black text-white mb-2 tracking-tight">My Account</h2>
            <p className="text-cyber-muted mb-8 text-sm leading-relaxed max-w-[200px]">
              Manage your subscription, history, and settings.
            </p>
            <div className="w-full bg-white/5 border border-white/10 text-cyber-muted py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest group-hover:bg-white group-hover:text-black transition-all">
              Open Account →
            </div>
          </div>

          {/* Profile — full-width */}
          <div
            onClick={() => navigate("/profile")}
            className="group relative bg-white/5 backdrop-blur-xl border border-white/10 hover:border-cyber-cyan/40 rounded-[2rem] p-10 transition-all duration-300 cursor-pointer flex flex-col items-center justify-center text-center min-h-[280px] hover:bg-cyber-cyan/5 hover:shadow-[0_0_40px_rgba(18,178,193,0.12)] md:col-span-2 lg:col-span-3"
          >
            <div className="w-20 h-20 bg-cyber-cyan/10 border border-cyber-cyan/20 rounded-3xl flex items-center justify-center mb-7 group-hover:scale-110 group-hover:shadow-[0_0_24px_rgba(18,178,193,0.3)] transition-all duration-300">
              <UserCircle2 className="w-9 h-9 text-cyber-cyan" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-black text-white mb-2 tracking-tight">Professional Profile</h2>
            <p className="text-cyber-muted mb-8 text-sm leading-relaxed max-w-[320px]">
              Your public career profile — headline, experience, skills, and links.
            </p>
            <div className="bg-gradient-to-r from-cyber-cyan to-cyber-teal text-white px-10 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest group-hover:from-cyber-cyan/80 group-hover:to-cyber-teal/80 transition-all shadow-[0_0_20px_rgba(18,178,193,0.25)]">
              View Profile →
            </div>
          </div>
        </div>

        {/* ── System status bar ── */}
        <div className="mt-16 flex flex-wrap justify-center gap-10 opacity-25 pointer-events-none select-none">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5" />
            <span className="text-[9px] font-black uppercase tracking-widest">End-to-End Encrypted</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5" />
            <span className="text-[9px] font-black uppercase tracking-widest">Real-time Processing</span>
          </div>
          <div className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5" />
            <span className="text-[9px] font-black uppercase tracking-widest">Cloud Infrastructure</span>
          </div>
        </div>
      </div>
    </div>
  );
}

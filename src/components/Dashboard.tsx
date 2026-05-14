import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, LayoutDashboard, LogOut, Loader2, BrainCircuit, Shield, Zap, Activity, Database, UserCircle2 } from "lucide-react";
import { supabase } from "../supabase";

export default function Dashboard() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { 
          navigate("/login"); 
          return; 
        }
        
        const fullName = session.user.user_metadata?.full_name;
        if (fullName) {
          setUserName(fullName.split(' ')[0]);
        } else {
          const email = session.user.email || "";
          const name = email.split('@')[0];
          setUserName(name.charAt(0).toUpperCase() + name.slice(1));
        }
        setLoading(false);
      } catch (error) {
        console.error("Dashboard Auth Error:", error);
        setLoading(false);
      }
    }; // <--- KENET NA2SA HAYDE (Tsakir el checkUser)

    checkUser(); // <--- WA HAYDE (Kirmal el function teshteghil)
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050B14]">
        <Loader2 className="animate-spin text-cyan-500 w-12 h-12"/>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050B14] text-slate-300 font-sans relative overflow-x-hidden flex flex-col">
      
      {/* Background Cyber Lights */}
      <div className="absolute top-0 right-0 w-[70vw] h-[70vw] bg-cyan-600/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[60vw] h-[60vw] bg-fuchsia-600/5 rounded-full blur-[150px] pointer-events-none" />
      
      <div className="relative z-10 max-w-7xl w-full mx-auto px-6 py-12 flex-1">
        
        {/* Welcome Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-16 gap-6 border-b border-white/5 pb-12">
            <div>
                <div className="flex items-center gap-2 text-cyan-500 mb-3">
                    <Activity className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-[0.4em]">Node Online</span>
                </div>
                <h1 className="text-4xl lg:text-6xl font-black text-white tracking-tighter uppercase mb-2">
                    Welcome, <span className="text-cyan-400">{userName}</span>
                </h1>
                <p className="text-slate-500 font-medium tracking-wide">Select a protocol to initialize your career engine.</p>
            </div>
            
            <button 
                onClick={handleLogout} 
                className="flex items-center gap-3 px-6 py-3 bg-red-500/5 border border-red-500/20 rounded-2xl text-red-400 hover:bg-red-500/10 transition-all duration-300 text-[10px] font-black uppercase tracking-widest"
            >
                <LogOut className="w-4 h-4" /> Terminate Session
            </button>
        </div>

        {/* --- Cyber Grid Nodes --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">

            {/* Node 1: Build */}
            <div 
                onClick={() => navigate('/builder')}
                className="relative bg-[#0A1324]/60 backdrop-blur-md p-10 rounded-[2.5rem] border border-white/5 hover:border-cyan-500/40 transition-all duration-500 cursor-pointer group min-h-[400px] flex flex-col items-center justify-center text-center shadow-2xl"
            >
                <div className="w-24 h-24 bg-cyan-500/10 border border-cyan-500/20 rounded-3xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(6,182,212,0.1)]">
                    <FileText className="w-10 h-10 text-cyan-400"/>
                </div>
                <h2 className="text-2xl font-black text-white mb-3 uppercase">Build Protocol</h2>
                <p className="text-slate-500 mb-10 text-sm font-medium leading-relaxed max-w-[220px]">Industrial-grade ATS resume infrastructure.</p>
                <div className="w-full bg-cyan-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest group-hover:bg-cyan-500 transition-all shadow-lg">
                    Launch Builder &rarr;
                </div>
            </div>

            {/* Node 2: Analyze */}
            <div 
                onClick={() => navigate('/career-analysis')} 
                className="relative bg-[#0A1324]/60 backdrop-blur-md p-10 rounded-[2.5rem] border border-white/5 hover:border-fuchsia-500/40 transition-all duration-500 cursor-pointer group min-h-[400px] flex flex-col items-center justify-center text-center shadow-2xl"
            >
                <div className="w-24 h-24 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-3xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(217,70,239,0.1)]">
                    <BrainCircuit className="w-10 h-10 text-fuchsia-400"/> 
                </div>
                <h2 className="text-2xl font-black text-white mb-3 uppercase">AI Analyzer</h2>
                <p className="text-slate-500 mb-10 text-sm font-medium leading-relaxed max-w-[220px]">Neural network keyword optimization.</p>
                <div className="w-full bg-fuchsia-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest group-hover:bg-fuchsia-500 transition-all shadow-lg">
                    Start Scan &rarr;
                </div>
            </div>

            {/* Node 3: Account */}
            <div 
                onClick={() => navigate('/my-account')} 
                className="relative bg-[#0A1324]/40 backdrop-blur-md p-10 rounded-[2.5rem] border border-white/5 hover:border-white/20 transition-all duration-500 cursor-pointer group min-h-[400px] flex flex-col items-center justify-center text-center shadow-xl"
            >
                <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center mb-8 group-hover:bg-white/10 transition-colors">
                    <LayoutDashboard className="w-10 h-10 text-slate-500 group-hover:text-white transition-colors"/>
                </div>
                <h2 className="text-2xl font-black text-white mb-3 uppercase">Data Archive</h2>
                <p className="text-slate-500 mb-10 text-sm font-medium leading-relaxed max-w-[220px]">Manage encrypted history and tiers.</p>
                <div className="w-full bg-white/5 text-slate-500 border border-white/10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest group-hover:bg-white group-hover:text-black transition-all">
                    Access Data &rarr;
                </div>
            </div>


            {/* Node 4: Profile */}
            <div
                onClick={() => navigate('/profile')}
                className="relative bg-[#0A1324]/60 backdrop-blur-md p-10 rounded-[2.5rem] border border-white/5 hover:border-violet-500/40 transition-all duration-500 cursor-pointer group min-h-[400px] flex flex-col items-center justify-center text-center shadow-2xl md:col-span-2 lg:col-span-3"
            >
                <div className="w-24 h-24 bg-violet-500/10 border border-violet-500/20 rounded-3xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(139,92,246,0.1)]">
                    <UserCircle2 className="w-10 h-10 text-violet-400"/>
                </div>
                <h2 className="text-2xl font-black text-white mb-3 uppercase">Identity Node</h2>
                <p className="text-slate-500 mb-10 text-sm font-medium leading-relaxed max-w-[280px]">Your professional profile — headline, experience, and skills.</p>
                <div className="bg-violet-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest group-hover:bg-violet-500 transition-all shadow-lg">
                    View Profile &rarr;
                </div>
            </div>

        </div>

        {/* System Monitoring */}
        <div className="mt-20 flex flex-wrap justify-center gap-12 opacity-30 pointer-events-none">
             <div className="flex items-center gap-2"><Shield className="w-4 h-4"/> <span className="text-[10px] font-black uppercase tracking-widest">Encrypted</span></div>
             <div className="flex items-center gap-2"><Zap className="w-4 h-4"/> <span className="text-[10px] font-black uppercase tracking-widest">Real-time</span></div>
             <div className="flex items-center gap-2"><Database className="w-4 h-4" /> <span className="text-[10px] font-black uppercase tracking-widest">Cloud Node</span></div>
        </div>

      </div>
    </div>
  );
}
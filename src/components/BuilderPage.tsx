import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { Loader2, ArrowLeft, Cpu, ShieldCheck, Activity } from 'lucide-react';

export default function BuilderPage() {
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState<{ email: string; id: string } | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        navigate('/login');
        return;
      }

      setUserInfo({
        email: session.user.email ?? '',
        id: session.user.id
      });
    };
    getUser();
  }, [navigate]);

  if (!userInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cyber-bg">
        <Loader2 className="animate-spin w-10 h-10 text-cyber-cyan" />
      </div>
    );
  }

  const tallyUrl = `https://tally.so/r/7RLDQR?transparentBackground=1&email=${encodeURIComponent(userInfo.email)}&userId=${userInfo.id}`;

  return (
    <div className="h-screen w-full bg-cyber-bg flex flex-col overflow-hidden font-sans relative">

      <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-cyber-teal/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[50vw] h-[50vw] bg-cyber-teal/3 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEgMWgzOHYzOEgxVjF6IiBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHN0cm9rZT0icmdiYSgyNTUsIDI1NSwgMjU1LCAwLjAxKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9zdmc+')] opacity-20 pointer-events-none" />

      <div className="bg-[rgba(35,113,123,0.12)] backdrop-blur-md border-b border-cyber-teal/10 px-6 py-4 flex justify-between items-center z-50 relative">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-cyber-cyan mb-0.5">
            <Cpu className="w-4 h-4 animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-[0.3em]">Neural Builder Protocol</span>
          </div>
          <div className="font-black text-xl text-white flex items-center gap-2 tracking-tighter uppercase">
            CV <span className="text-cyber-cyan">Construction</span> Mode
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-cyber-teal/5 border border-cyber-teal/10 rounded-full">
            <Activity className="w-3 h-3 text-cyber-cyan" />
            <span className="text-[9px] font-black text-cyber-dim uppercase tracking-widest">Active Link: {userInfo.email}</span>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="group flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-cyber-muted hover:text-white transition-all bg-white/5 hover:bg-red-500/10 border border-white/5 hover:border-red-500/30 px-5 py-2.5 rounded-xl"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" /> Exit Builder
          </button>
        </div>
      </div>

      <div className="flex-1 w-full h-full relative z-10 overflow-auto scrollbar-hide">
        <div className="absolute inset-4 md:inset-8 bg-[rgba(35,113,123,0.08)] backdrop-blur-sm border border-white/5 rounded-[2rem] overflow-hidden shadow-2xl">
          <iframe
            src={tallyUrl}
            className="w-full h-full border-0 m-0"
            title="Resumation Builder"
          ></iframe>
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 opacity-30 pointer-events-none z-50">
        <ShieldCheck className="w-4 h-4 text-cyber-cyan" />
        <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">End-to-End Encrypted Data Stream</span>
      </div>

    </div>
  );
}

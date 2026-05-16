import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BrainCircuit,
  Loader2,
  CheckCircle,
  ExternalLink,
  Shield,
  Activity,
  Zap
} from "lucide-react";
import { supabase } from "../supabase";

interface ArchiveItem {
  id: string;
  cv_pdf_url: string | null;
  region?: string;
}

export default function PackageAccess() {
  const navigate = useNavigate();
  const [userPlan, setUserPlan] = useState<string>('free');
  const [latestCV, setLatestCV] = useState<ArchiveItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasNotifiedSuccess, setHasNotifiedSuccess] = useState(false);

  const fetchUserPlan = async (uid: string) => {
    const { data: userData, error } = await supabase
      .from('users')
      .select('selected_plan, email')
      .eq('id', uid)
      .single();

    if (!error && userData) {
      setUserPlan(userData.selected_plan || 'free');

      const SUCCESS_WEBHOOK = import.meta.env.VITE_MAKE_SUCCESS_UPGRADE;
      if (SUCCESS_WEBHOOK && (userData.selected_plan === 'premium' || userData.selected_plan === 'gold') && !hasNotifiedSuccess) {
        try {
          await fetch(SUCCESS_WEBHOOK, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: uid,
              email: userData.email,
              plan: userData.selected_plan,
              status: "success_access",
              timestamp: new Date().toISOString()
            })
          });
          setHasNotifiedSuccess(true);
        } catch (e) {
          console.warn("Success webhook notification failed", e);
        }
      }
    }
  };

  useEffect(() => {
    const initPage = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }

      const uid = session.user.id;

      await fetchUserPlan(uid);
      await fetchLatestCV(uid);

      const userChannel = supabase
        .channel(`user-plan-realtime-${uid}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${uid}` },
          (payload) => {
            if (payload.new.selected_plan) {
              setUserPlan(payload.new.selected_plan);
            }
          }
        )
        .subscribe();

      return () => { supabase.removeChannel(userChannel); };
    };
    initPage();
  }, [navigate]);

  const fetchLatestCV = async (uid: string) => {
    const { data, error } = await supabase
      .from('cv_archive')
      .select('id, cv_pdf_url, region')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!error && data) setLatestCV(data);
    setLoading(false);
  };

  const getPlanLinks = () => {
    if (userPlan === 'premium') {
      return {
        count: 20,
        path: '/premium-links',
        name: 'PREMIUM LINKS',
        desc: latestCV?.region === 'EG' ? 'بوابات توظيف عالمية متميزة (20)' : '20 Premium employment portals WORLDWIDE.'
      };
    }

    if (userPlan === 'gold') {
      return {
        count: 50,
        path: '/gold-links',
        name: 'GOLD DATABASE',
        desc: latestCV?.region === 'EG' ? 'قاعدة بيانات كبار أصحاب العمل (50)' : '50 High-tier employer nodes WORLDWIDE.'
      };
    }

    return {
      count: 2,
      path: '/free-links',
      name: 'FREE LINKS',
      desc: latestCV?.region === 'EG' ? 'روابط تجريبية للمحترفين (2)' : '2 Beta employment portals WORLDWIDE.'
    };
  };

  const planLinks = getPlanLinks();
  const isCvReady = !!latestCV?.cv_pdf_url;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-cyber-bg">
      <Loader2 className="animate-spin w-10 h-10 text-cyber-cyan" />
    </div>
  );

  return (
    <div className="min-h-screen bg-cyber-bg font-sans p-6 md:p-12 relative overflow-hidden flex flex-col items-center justify-center">

      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(13,138,158,0.03)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-cyber-teal/5 rounded-full blur-[100px]" />

      <div className="max-w-6xl w-full relative z-10">

        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-cyber-teal/5 border border-cyber-teal/10 rounded-full mb-4 shadow-[0_0_15px_rgba(13,138,158,0.05)]">
            <Activity className="w-3.5 h-3.5 text-cyber-cyan animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyber-cyan">Access Node Authorized</span>
          </div>
          <h1 className="text-4xl lg:text-6xl font-black text-white tracking-tighter uppercase">
            {latestCV?.region === 'EG' ? "مجموعة أدواتك المهنية" : <>Career <span className="text-cyber-cyan">Toolkit</span> 🔓</>}
          </h1>
          <p className="text-cyber-dim mt-4 font-medium uppercase tracking-[0.2em] text-[10px]">Initialize your professional deployment protocols.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          <div
            onClick={() => isCvReady && navigate('/account')}
            className={`group relative overflow-hidden bg-[rgba(35,113,123,0.12)] backdrop-blur-xl p-10 rounded-[2.5rem] border transition-all duration-500 cursor-pointer min-h-[380px] flex flex-col justify-between shadow-2xl ${isCvReady ? "border-emerald-500/30 hover:border-emerald-500/50" : "border-white/5 opacity-60"}`}
          >
            <div className="absolute top-0 right-0 p-8">
              <Zap className={`w-5 h-5 ${isCvReady ? 'text-emerald-500' : 'text-cyber-dim'}`} />
            </div>
            <div>
              <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-8 border transition-all ${isCvReady ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'bg-white/5 border-white/5 text-cyber-dim'}`}>
                {isCvReady ? <CheckCircle className="w-8 h-8" /> : <Loader2 className="w-8 h-8 animate-spin" />}
              </div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-3">
                {isCvReady ? "Download CV" : "Generating..."}
              </h3>
              <p className="text-cyber-dim text-xs font-bold uppercase tracking-widest leading-relaxed">
                {isCvReady ? "Your neural resume is ready for deployment." : "The AI engine is synthesizing your data."}
              </p>
            </div>
            {isCvReady && <span className="text-emerald-500 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">Initialize Download &rarr;</span>}
          </div>

          <div
            onClick={() => navigate(planLinks.path)}
            className="group relative overflow-hidden bg-[rgba(35,113,123,0.12)] backdrop-blur-xl p-10 rounded-[2.5rem] border border-cyber-border/30 hover:border-cyber-teal/40 transition-all duration-500 cursor-pointer min-h-[380px] flex flex-col justify-between shadow-2xl"
          >
            <div className="absolute top-0 right-0 p-8">
              <div className="bg-cyber-teal text-white text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest">
                {planLinks.count} Nodes
              </div>
            </div>
            <div>
              <div className="w-16 h-16 bg-cyber-teal/10 border border-cyber-teal/20 text-cyber-cyan rounded-3xl flex items-center justify-center mb-8 shadow-[0_0_20px_rgba(13,138,158,0.1)] group-hover:shadow-[0_0_30px_rgba(13,138,158,0.2)] transition-all">
                <ExternalLink className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-3 leading-tight">{planLinks.name}</h3>
              <p className="text-cyber-dim text-xs font-bold uppercase tracking-widest leading-relaxed">{planLinks.desc}</p>
            </div>
            <span className="text-cyber-cyan text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">Scan Employer Nodes &rarr;</span>
          </div>

          <div
            onClick={() => navigate('/career-analysis')}
            className="group relative overflow-hidden bg-[rgba(35,113,123,0.12)] backdrop-blur-xl p-10 rounded-[2.5rem] border border-cyber-border/30 hover:border-cyber-teal/40 transition-all duration-500 cursor-pointer min-h-[380px] flex flex-col justify-between shadow-2xl"
          >
            <div className="absolute top-0 right-0 p-8">
              <Shield className="w-5 h-5 text-cyber-muted/40" />
            </div>
            <div>
              <div className="w-16 h-16 bg-cyber-teal/10 border border-cyber-teal/20 text-cyber-cyan rounded-3xl flex items-center justify-center mb-8 shadow-[0_0_20px_rgba(13,138,158,0.1)] group-hover:shadow-[0_0_30px_rgba(13,138,158,0.2)] transition-all">
                <BrainCircuit className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-3">Neural Analysis</h3>
              <p className="text-cyber-dim text-xs font-bold uppercase tracking-widest leading-relaxed">Cross-reference your CV with job requirements via AI scan.</p>
            </div>
            <span className="text-cyber-cyan text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">Initialize Scan &rarr;</span>
          </div>

        </div>

        <div className="mt-16 flex flex-wrap justify-center gap-12 opacity-30 pointer-events-none grayscale">
          <div className="flex items-center gap-2 text-white"><Shield className="w-4 h-4" /> <span className="text-[10px] font-black uppercase tracking-[0.2em]">Secure Data Node</span></div>
          <div className="flex items-center gap-2 text-white"><Zap className="w-4 h-4" /> <span className="text-[10px] font-black uppercase tracking-[0.2em]">Latency: 12ms</span></div>
        </div>

      </div>
    </div>
  );
}

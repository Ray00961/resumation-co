import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Download, 
  Loader2, 
  LogOut, 
  FileText,
  FileType,
  Clock,
  Hash,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Database,
  CreditCard,
  Zap,
  UserCircle,
  Activity
} from "lucide-react";
import { supabase } from "../supabase";
import { RealtimeChannel } from "@supabase/supabase-js";
// FIXED: استبدال react-hot-toast بـ sonner
import { toast } from "sonner";

interface ArchiveItem {
  id: string;
  created_at: string;
  created_at_beirut?: string;
  cv_pdf_url: string | null;
  target_job?: string;
  user_name?: string; 
  package_name?: string; 
  status?: string;
  agreed_to_terms?: boolean;
  computedType?: 'cv' | 'cover' | 'analysis'; 
}

export default function MyAccount() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'downloads' | 'payments' | 'plan'>('downloads');
  const [archive, setArchive] = useState<ArchiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("USER");

  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    const initPage = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }

      // تحسين أخذ الاسم (نقطة ذكرها كلوود بالتحسينات المقترحة)
      if (user.user_metadata?.full_name) {
        setUserName(user.user_metadata.full_name.split(' ')[0].toUpperCase());
      } else {
        setUserName(user.email?.split('@')[0].toUpperCase() || "USER");
      }

      const fetchArchives = async () => {
        const { data, error } = await supabase
          .from('cv_archive')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!error && data) {
          setArchive(processArchiveData(data));
        }
        setLoading(false);
      };

      await fetchArchives();

      channel = supabase.channel('my-account-updates').on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'cv_archive', filter: `user_id=eq.${user.id}` }, 
        (payload) => {
          if (payload.new.cv_pdf_url) {
            // FIXED: استخدام sonner toast
            toast.success("Document Ready!", {
              description: "Great news! Your document is ready for download.",
              icon: '🚀',
            });
          }
          fetchArchives();
        }
      ).subscribe();
    };

    initPage();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [navigate]);

  const processArchiveData = (data: ArchiveItem[]) => {
    return data.map(item => {
      const target = (item.target_job || "").toLowerCase();
      let type: 'cv' | 'cover' | 'analysis' = 'cv';
      
      if (target.includes("analysis") || target.includes("review")) type = 'analysis';
      else if (target.includes("cover") || target.includes("cl")) type = 'cover';
      
      return { ...item, computedType: type };
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getDocDetails = (item: ArchiveItem) => {
    const displayName = item.user_name ? item.user_name.toUpperCase() : userName;
    if (item.computedType === 'analysis') return { name: `ATS ANALYSIS - ${displayName}`, icon: <AlertCircle className="w-4 h-4 text-orange-400" />, color: "bg-orange-500/10 border-orange-500/20" };
    if (item.computedType === 'cover') return { name: `COVER LETTER - ${displayName}`, icon: <FileType className="w-4 h-4 text-fuchsia-400" />, color: "bg-fuchsia-500/10 border-fuchsia-500/20" };
    return { name: `PROFESSIONAL CV - ${displayName}`, icon: <FileText className="w-4 h-4 text-cyan-400" />, color: "bg-cyan-500/10 border-cyan-500/20" };
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#050B14]">
      <Loader2 className="animate-spin text-cyan-500 w-10 h-10"/>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050B14] text-slate-300 font-sans flex flex-col md:flex-row relative overflow-hidden">
      {/* FIXED: شلنا الـ Toaster من هون لانو صار بملف App.tsx */}
      
      <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-cyan-600/5 rounded-full blur-[120px] pointer-events-none" />

      <aside className="w-full md:w-72 bg-[#0A1324]/60 backdrop-blur-2xl border-r border-white/5 flex-shrink-0 z-20">
        <div className="p-8 border-b border-white/5">
            <div className="flex items-center gap-3 mb-2">
               <Database className="w-5 h-5 text-cyan-500" />
               <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500">Data Node</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tighter uppercase">My Account</h1>
        </div>
        
        <nav className="p-6 space-y-3">
          <button onClick={() => setActiveTab('downloads')} className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'downloads' ? "bg-cyan-600 text-white shadow-lg shadow-cyan-900/20" : "text-slate-500 hover:bg-white/5 hover:text-white"}`}>
            <Download className="w-4 h-4" /> Submissions
          </button>
          <button onClick={() => setActiveTab('payments')} className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'payments' ? "bg-cyan-600 text-white" : "text-slate-500 hover:bg-white/5 hover:text-white"}`}>
            <CreditCard className="w-4 h-4" /> Billing Nodes
          </button>
          <button onClick={() => setActiveTab('plan')} className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === 'plan' ? "bg-cyan-600 text-white" : "text-slate-500 hover:bg-white/5 hover:text-white"}`}>
            <Zap className="w-4 h-4" /> Active Tiers
          </button>
        </nav>

        <div className="mt-auto p-6 border-t border-white/5">
           <button onClick={handleLogout} className="w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-red-500 hover:bg-red-500/10 transition-all">
             <LogOut className="w-4 h-4" /> Terminate Session
           </button>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-16 relative z-10 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
            <div>
              <div className="flex items-center gap-2 text-cyan-500 mb-2 font-black text-[10px] uppercase tracking-[0.3em]">
                <Activity className="w-4 h-4 animate-pulse" /> Live Archive Status
              </div>
              <h2 className="text-3xl lg:text-4xl font-black text-white uppercase tracking-tighter">Your Services <span className="text-cyan-400">Tracking</span></h2>
            </div>
            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
               <UserCircle className="w-10 h-10 text-slate-500" />
               <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Entity</span>
                  <span className="text-sm font-black text-white">{userName}</span>
               </div>
            </div>
          </div>

          <div className="bg-[#0A1324]/40 backdrop-blur-xl rounded-[2.5rem] shadow-2xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 text-slate-500 text-[10px] uppercase tracking-[0.2em] font-black border-b border-white/5">
                    <th className="px-8 py-6 tracking-[0.3em]">Timestamp</th>
                    <th className="px-8 py-6 tracking-[0.3em]">Protocol Details</th>
                    <th className="px-8 py-6 tracking-[0.3em]">Trace ID</th>
                    <th className="px-8 py-6 text-center tracking-[0.3em]">Status</th>
                    <th className="px-8 py-6 text-right tracking-[0.3em]">Data Access</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {archive.length === 0 ? (
                    <tr><td colSpan={5} className="p-20 text-center text-slate-600 font-bold uppercase tracking-widest text-xs italic">No records detected in your encrypted archive.</td></tr>
                  ) : (
                    archive.map((item) => {
                      const docInfo = getDocDetails(item);
                      return (
                        <tr key={item.id} className="hover:bg-white/5 transition-all duration-300">
                          <td className="px-8 py-6">
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-white">{formatDate(item.created_at)}</span>
                              {item.agreed_to_terms && (
                                <span className="flex items-center gap-1 text-[9px] text-emerald-500 font-black mt-1 uppercase tracking-widest">
                                  <ShieldCheck className="w-3 h-3" /> Encrypted Consent
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${docInfo.color} shadow-lg`}>
                                {docInfo.icon}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-black text-white uppercase tracking-tight">{docInfo.name}</span>
                                <span className="text-[9px] font-black text-cyan-500 uppercase tracking-[0.2em]">{item.package_name || "Basic Node"}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <span className="font-mono text-[11px] text-slate-500 uppercase tracking-widest flex items-center gap-1">
                               {item.id.slice(0, 8)}
                            </span>
                          </td>
                          <td className="px-8 py-6 text-center">
                            {item.cv_pdf_url ? (
                              <span className="px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 inline-flex items-center gap-2">
                                <CheckCircle2 className="w-3 h-3"/> Authorized
                              </span>
                            ) : (
                              <span className="px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse inline-flex items-center gap-2">
                                <Clock className="w-3 h-3"/> Processing
                              </span>
                            )}
                          </td>
                          <td className="px-8 py-6 text-right">
                            {item.cv_pdf_url && (
                              <a href={item.cv_pdf_url} target="_blank" rel="noreferrer" className="bg-cyan-600/10 text-cyan-400 border border-cyan-500/20 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-cyan-600 hover:text-white transition-all inline-flex items-center gap-2 group shadow-lg shadow-cyan-900/10">
                                Download <Download className="w-3 h-3 group-hover:translate-y-0.5 transition-transform"/>
                              </a>
                            )}
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
      </main>
    </div>
  );
}
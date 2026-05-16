import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Download, Loader2, LogOut, FileText, FileType, Clock,
  CheckCircle2, ShieldCheck, AlertCircle, Database,
  CreditCard, Zap, UserCircle, Activity, ArrowUpRight
} from "lucide-react";
import { supabase } from "../supabase";
import { RealtimeChannel } from "@supabase/supabase-js";
import { toast } from "sonner";

interface ArchiveItem {
  id: string;
  created_at: string;
  created_at_beirut?: string;
  cv_pdf_url: string | null;
  cv_file_path?: string | null;
  submission_id?: string | null;
  target_job?: string;
  user_name?: string;
  package_name?: string;
  region?: string;
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
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    const initPage = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }

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

        if (!error && data) setArchive(processArchiveData(data));
        setLoading(false);
      };

      await fetchArchives();

      channel = supabase.channel('my-account-updates').on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'cv_archive', filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.new.cv_pdf_url) {
            toast.success("Document Ready!", { description: "Your document is ready for download.", icon: '🚀' });
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
    if (item.computedType === 'analysis') return { name: `ATS ANALYSIS — ${displayName}`, icon: <AlertCircle className="w-4 h-4 text-amber-400" />, color: "bg-amber-500/10 border-amber-500/20" };
    if (item.computedType === 'cover')   return { name: `COVER LETTER — ${displayName}`, icon: <FileType className="w-4 h-4 text-cyber-cyan" />, color: "bg-cyber-teal/10 border-cyber-teal/20" };
    return { name: `PROFESSIONAL CV — ${displayName}`, icon: <FileText className="w-4 h-4 text-cyber-cyan" />, color: "bg-cyber-cyan/10 border-cyber-cyan/20" };
  };

  const handleDownload = async (item: ArchiveItem) => {
    setDownloadingId(item.id);
    try {
      if (item.cv_file_path) {
        const { data, error } = await supabase.storage.from('cv-files-download').createSignedUrl(item.cv_file_path, 300);
        if (!error && data?.signedUrl) { window.open(data.signedUrl, '_blank'); return; }
      }
      if (item.cv_pdf_url) {
        const docId = item.cv_pdf_url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1];
        if (docId) { window.open(`https://docs.google.com/document/d/${docId}/export?format=pdf`, '_blank'); return; }
        window.open(item.cv_pdf_url, '_blank');
      }
    } catch {
      toast.error("Download failed. Please try again.");
    } finally {
      setDownloadingId(null);
    }
  };

  const getUpgradeButtons = (item: ArchiveItem) => {
    const plan = (item.package_name || 'free').toLowerCase();
    const buttons: { label: string; color: string; target: string }[] = [];
    if (plan === 'free') {
      buttons.push({ label: 'Upgrade Premium', color: 'cyan',    target: 'premium'  });
      buttons.push({ label: 'Gold Plan',        color: 'teal',   target: 'gold'     });
      buttons.push({ label: 'Analyze CV',       color: 'teal',   target: 'analysis' });
    } else if (plan === 'premium') {
      buttons.push({ label: 'Gold Plan',  color: 'teal', target: 'gold'     });
      buttons.push({ label: 'Analyze CV', color: 'teal', target: 'analysis' });
    } else if (plan === 'gold') {
      buttons.push({ label: 'Analyze CV', color: 'teal', target: 'analysis' });
    }
    return buttons;
  };

  const handleUpgrade = (item: ArchiveItem, target: string) => {
    if (target === 'analysis') { navigate('/analyse'); return; }
    const newId = crypto.randomUUID();
    const oldSub = item.submission_id || item.id;
    navigate(`/plans?id=${newId}&old_sub=${oldSub}`);
  };

  const colorMap: Record<string, string> = {
    cyan: 'border-cyber-cyan/30 text-cyber-cyan hover:bg-cyber-cyan hover:text-white',
    teal: 'border-cyber-teal/30 text-cyber-teal hover:bg-cyber-teal hover:text-white',
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-cyber-bg">
      <Loader2 className="animate-spin text-cyber-cyan w-10 h-10" />
    </div>
  );

  return (
    <div className="min-h-screen bg-cyber-bg text-cyber-text/90 font-sans flex flex-col md:flex-row relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-cyber-teal/5 rounded-full blur-[120px] pointer-events-none" />

      {/* ── Sidebar ── */}
      <aside className="w-full md:w-72 bg-[rgba(35,113,123,0.12)] backdrop-blur-2xl border-r border-white/5 flex-shrink-0 z-20 flex flex-col">
        <div className="p-8 border-b border-white/5">
          <div className="flex items-center gap-3 mb-2">
            <Database className="w-5 h-5 text-cyber-cyan" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyber-cyan">Data Node</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-wide uppercase">My Account</h1>
        </div>
        <nav className="p-6 space-y-3">
          {(["downloads", "payments", "plan"] as const).map((tab) => {
            const icons = { downloads: <Download className="w-4 h-4" />, payments: <CreditCard className="w-4 h-4" />, plan: <Zap className="w-4 h-4" /> };
            const labels = { downloads: "Submissions", payments: "Billing Nodes", plan: "Active Tiers" };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === tab ? "bg-cyber-teal text-white shadow-lg shadow-cyber-teal/20" : "text-cyber-dim hover:bg-white/5 hover:text-white"}`}
              >
                {icons[tab]} {labels[tab]}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto p-6 border-t border-white/5">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-red-500 hover:bg-red-500/10 transition-all">
            <LogOut className="w-4 h-4" /> Terminate Session
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 p-6 md:p-16 relative z-10 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
            <div>
              <div className="flex items-center gap-2 text-cyber-cyan mb-2 font-black text-[10px] uppercase tracking-[0.3em]">
                <Activity className="w-4 h-4 animate-pulse" /> Live Archive Status
              </div>
              <h2 className="text-2xl lg:text-3xl font-black text-white uppercase tracking-wide">
                Your Services <span className="text-cyber-cyan">Tracking</span>
              </h2>
            </div>
            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
              <UserCircle className="w-10 h-10 text-cyber-dim" />
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-cyber-dim uppercase tracking-widest">Active Entity</span>
                <span className="text-sm font-black text-white">{userName}</span>
              </div>
            </div>
          </div>

          <div className="bg-[rgba(35,113,123,0.1)] backdrop-blur-xl rounded-[2.5rem] shadow-2xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 text-cyber-dim text-[10px] uppercase tracking-[0.2em] font-black border-b border-white/5">
                    <th className="px-6 py-5">Date</th>
                    <th className="px-6 py-5">Document</th>
                    <th className="px-6 py-5">Submission ID</th>
                    <th className="px-6 py-5">Plan</th>
                    <th className="px-6 py-5 text-center">Status</th>
                    <th className="px-6 py-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {archive.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-20 text-center text-cyber-dim font-bold uppercase tracking-widest text-xs italic">
                        No records detected in your encrypted archive.
                      </td>
                    </tr>
                  ) : (
                    archive.map((item) => {
                      const docInfo = getDocDetails(item);
                      const upgradeButtons = getUpgradeButtons(item);
                      const isDownloading = downloadingId === item.id;
                      return (
                        <tr key={item.id} className="hover:bg-white/5 transition-all duration-300">
                          <td className="px-6 py-5">
                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-black text-white">{formatDate(item.created_at)}</span>
                              {item.agreed_to_terms && (
                                <span className="flex items-center gap-1 text-[9px] text-emerald-500 font-black uppercase tracking-widest">
                                  <ShieldCheck className="w-3 h-3" /> Verified
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${docInfo.color}`}>
                                {docInfo.icon}
                              </div>
                              <span className="text-xs font-black text-white uppercase tracking-wide">{docInfo.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <span className="font-mono text-[11px] text-cyber-muted bg-white/5 px-3 py-1 rounded-lg border border-white/5">
                              {item.submission_id || item.id.slice(0, 8).toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                              (item.package_name || '').toLowerCase() === 'gold'
                                ? 'bg-cyber-cyan/10 text-cyber-cyan border-cyber-cyan/20'
                                : (item.package_name || '').toLowerCase() === 'premium'
                                ? 'bg-cyber-teal/10 text-cyber-teal border-cyber-teal/20'
                                : 'bg-white/5 text-cyber-dim border-white/10'
                            }`}>
                              {item.package_name || 'Free'}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-center">
                            {item.cv_pdf_url || item.cv_file_path ? (
                              <span className="px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 inline-flex items-center gap-1.5">
                                <CheckCircle2 className="w-3 h-3" /> Ready
                              </span>
                            ) : (
                              <span className="px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse inline-flex items-center gap-1.5">
                                <Clock className="w-3 h-3" /> Processing
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center justify-end gap-2 flex-wrap">
                              {(item.cv_pdf_url || item.cv_file_path) && (
                                <button
                                  onClick={() => handleDownload(item)}
                                  disabled={isDownloading}
                                  className="bg-cyber-teal/10 text-cyber-teal border border-cyber-teal/20 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-cyber-teal hover:text-white transition-all inline-flex items-center gap-2 group shadow-lg"
                                >
                                  {isDownloading
                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                    : <Download className="w-3 h-3 group-hover:translate-y-0.5 transition-transform" />
                                  }
                                  Download
                                </button>
                              )}
                              {upgradeButtons.map((btn) => (
                                <button
                                  key={btn.target}
                                  onClick={() => handleUpgrade(item, btn.target)}
                                  className={`border px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all inline-flex items-center gap-1.5 ${colorMap[btn.color]}`}
                                >
                                  <ArrowUpRight className="w-3 h-3" />
                                  {btn.label}
                                </button>
                              ))}
                            </div>
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

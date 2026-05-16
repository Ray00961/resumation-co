import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, Zap } from "lucide-react";
import { employersList } from "./data/employersData";
import { supabase } from "./supabase";

export default function AnalysisLinks() {
  const navigate = useNavigate();
  const companies = employersList.slice(0, 250);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/login");
    };
    checkSession();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-cyber-bg py-16 px-4 font-sans relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-cyber-teal/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-cyber-teal/10 border border-cyber-teal/20 text-cyber-cyan px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest mb-6 shadow-[0_0_15px_rgba(13,138,158,0.1)]">
            <Zap className="w-4 h-4" /> Analysis Plus Access
          </div>
          <h1 className="text-5xl font-black text-white mb-4 tracking-tighter uppercase">Ultimate Career Database</h1>
          <p className="text-cyber-muted text-sm font-medium max-w-2xl mx-auto">
            You have unlocked the full potential with <span className="text-cyber-cyan font-black">250+ Direct Employer Links</span> to dominate the job market.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {companies.map((company) => (
            <div key={company.id} className="bg-[rgba(35,113,123,0.10)] backdrop-blur-xl p-5 rounded-2xl border border-cyber-teal/10 hover:border-cyber-teal/30 transition-all group flex flex-col justify-between shadow-xl">
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${company.logoColor} flex items-center justify-center text-white font-bold shrink-0 shadow-sm`}>
                  {company.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-white leading-tight">{company.name}</h3>
                  <p className="text-[10px] text-cyber-dim font-black uppercase tracking-tighter">{company.industry}</p>
                </div>
              </div>
              <a href={company.careerPageUrl} target="_blank" rel="noreferrer" className="w-full py-2.5 bg-white/5 border border-white/10 text-cyber-muted rounded-xl text-xs font-bold flex items-center justify-center gap-2 group-hover:bg-cyber-teal group-hover:border-cyber-teal group-hover:text-white transition-all">
                Quick Apply <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

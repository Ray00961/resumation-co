import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { employersList } from "./data/employersData";
import { supabase } from "./supabase";

export default function PremiumLinks() {
  const navigate = useNavigate();
  const premiumCompanies = employersList.slice(0, 20);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); }
    };
    checkSession();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-cyber-bg py-12 px-4 font-sans relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-cyber-teal/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="max-w-6xl mx-auto relative z-10">

        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-cyber-teal/10 text-cyber-cyan border border-cyber-teal/20 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest mb-4">
            <ShieldCheck className="w-4 h-4" /> Premium Access Unlocked
          </div>
          <h1 className="text-4xl font-black text-white mb-3 uppercase tracking-tighter">Premium Employer List</h1>
          <p className="text-cyber-muted font-medium text-sm">
            You have exclusive access to <span className="text-cyber-cyan font-black">20 Top Employers</span>.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {premiumCompanies.map((company) => (
            <div key={company.id} className="bg-[rgba(35,113,123,0.12)] backdrop-blur-xl rounded-3xl overflow-hidden border border-cyber-teal/15 hover:border-cyber-teal/35 transition-all group shadow-xl">
              <div className={`h-24 bg-gradient-to-r ${company.logoColor} p-6 flex items-end relative`}>
                <h3 className="text-white font-bold text-xl relative z-10 tracking-tight">{company.name}</h3>
              </div>
              <div className="p-6">
                <div className="text-[10px] font-black text-cyber-dim uppercase mb-4 tracking-widest">{company.industry}</div>
                <a href={company.careerPageUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center w-full bg-cyber-teal text-white py-3.5 rounded-2xl font-bold hover:bg-cyber-cyan transition-all gap-2 shadow-lg">
                  Apply via Career Page <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useNavigate } from "react-router-dom";
import { ExternalLink, Lock, ArrowUpCircle } from "lucide-react";
import { employersList } from "./data/employersData";

export default function FreeLinks() {
  const navigate = useNavigate();
  const freeCompanies = employersList.slice(0, 2);

  return (
    <div className="min-h-screen bg-cyber-bg py-20 px-4 flex flex-col items-center font-sans relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-cyber-teal/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="max-w-4xl w-full text-center relative z-10">
        <h1 className="text-3xl font-black text-white mb-4 tracking-tighter uppercase">Your Free Career Links</h1>
        <p className="text-cyber-muted mb-12 font-medium text-sm">Start your journey with these top 2 hand-picked employers.</p>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {freeCompanies.map((company) => (
            <div key={company.id} className="bg-[rgba(35,113,123,0.12)] backdrop-blur-xl p-8 rounded-[2rem] border border-cyber-teal/20 text-left">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-r ${company.logoColor} mb-6 flex items-center justify-center text-white font-bold text-xl shadow-lg`}>
                {company.name.charAt(0)}
              </div>
              <h3 className="text-xl font-black text-white mb-2">{company.name}</h3>
              <p className="text-cyber-dim text-[10px] mb-6 uppercase font-bold tracking-widest">{company.industry}</p>
              <a href={company.careerPageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-cyber-cyan font-black hover:text-white transition-colors">
                Visit Career Page <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          ))}
        </div>

        <div className="bg-[rgba(35,113,123,0.15)] backdrop-blur-xl p-10 rounded-[2.5rem] border border-cyber-teal/30 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyber-cyan to-transparent" />
          <Lock className="absolute -right-4 -top-4 w-32 h-32 text-white/5 rotate-12" />
          <h2 className="text-2xl font-black text-white mb-2 relative z-10 uppercase tracking-tighter">Want more opportunities?</h2>
          <p className="text-cyber-muted mb-6 font-medium relative z-10 text-sm">Upgrade your plan to unlock up to 250+ direct application links and skyrocket your hiring chances.</p>
          <button onClick={() => navigate('/plans')} className="bg-cyber-teal text-white px-8 py-3 rounded-2xl font-black flex items-center gap-2 mx-auto hover:bg-cyber-cyan transition-all shadow-[0_0_20px_rgba(13,138,158,0.3)]">
            <ArrowUpCircle className="w-5 h-5" /> Upgrade Plan Now
          </button>
        </div>
      </div>
    </div>
  );
}

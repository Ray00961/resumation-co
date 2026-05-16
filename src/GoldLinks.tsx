import { ExternalLink, MapPin, Star, Sparkles } from "lucide-react";
import { employersList, type Employer } from "./data/employersData";

export default function GoldLinks() {
  const goldCompanies = employersList.slice(0, 50);

  return (
    <div className="min-h-screen bg-cyber-bg py-20 px-4 font-sans relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[40vw] h-[40vw] bg-cyber-teal/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="max-w-7xl mx-auto relative z-10">

        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-5 py-2 rounded-full text-xs font-black uppercase tracking-widest mb-6">
            <Star className="w-4 h-4 fill-amber-400" /> Gold VIP Network Unlocked
          </div>
          <h1 className="text-5xl font-black text-white mb-4 tracking-tighter uppercase">Ultimate Employer Network</h1>
          <p className="text-cyber-muted text-sm font-medium">
            Full access to <span className="font-black text-amber-400 border-b-2 border-amber-500/30">50 Top Tier Companies</span> worldwide.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {goldCompanies.map((company: Employer) => (
            <div key={company.id} className="bg-[rgba(35,113,123,0.12)] backdrop-blur-xl rounded-[2rem] overflow-hidden border border-cyber-teal/15 hover:border-amber-500/30 hover:-translate-y-1 transition-all duration-300 group shadow-xl">
              <div className={`h-28 bg-gradient-to-br ${company.logoColor} p-6 flex items-end relative overflow-hidden`}>
                <Sparkles className="absolute top-4 right-4 text-white/20 w-12 h-12" />
                <h3 className="text-white font-black text-2xl relative z-10">{company.name}</h3>
              </div>
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <span className="bg-white/5 text-cyber-dim px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-white/10">{company.industry}</span>
                </div>
                <div className="flex items-center gap-2 text-cyber-muted text-sm mb-6 font-medium">
                  <MapPin className="w-4 h-4 text-cyber-cyan" />
                  <span className="truncate">{company.locations.join(", ")}</span>
                </div>
                <a href={company.careerPageUrl} target="_blank" rel="noreferrer"
                  className="w-full py-4 bg-amber-600 text-white font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-amber-500 transition-all shadow-xl">
                  Direct Apply <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// src/GoldLinks.tsx
import { ExternalLink, MapPin, Star, Sparkles } from "lucide-react";
import { employersList, type Employer } from "./data/employersData"; 

export default function GoldLinks() {
  // 👇 تعديل: نأخذ أول 50 شركة لباقة الـ Gold
  const goldCompanies = employersList.slice(0, 50);

  return (
    <div className="min-h-screen bg-slate-50 py-20 px-4 font-sans">
      <div className="max-w-7xl mx-auto">
        
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-yellow-100 text-yellow-800 px-5 py-2 rounded-full text-xs font-black uppercase tracking-widest mb-6 border border-yellow-200">
            <Star className="w-4 h-4 fill-yellow-800" /> Gold VIP Network Unlocked
          </div>
          <h1 className="text-5xl font-black text-slate-900 mb-4 tracking-tighter">Ultimate Employer Network 🚀</h1>
          <p className="text-slate-500 text-xl font-medium">
            Full access to <span className="font-black text-slate-900 border-b-4 border-yellow-400">50 Top Tier Companies</span> worldwide.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {goldCompanies.map((company: Employer) => (
            <div key={company.id} className="bg-white rounded-[2rem] overflow-hidden shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-slate-100 group">
              <div className={`h-28 bg-gradient-to-br ${company.logoColor} p-6 flex items-end relative overflow-hidden`}>
                <Sparkles className="absolute top-4 right-4 text-white/20 w-12 h-12" />
                <h3 className="text-white font-black text-2xl relative z-10">{company.name}</h3>
              </div>
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <span className="bg-slate-50 text-slate-500 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-100">{company.industry}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400 text-sm mb-6 font-medium">
                  <MapPin className="w-4 h-4 text-blue-400" />
                  <span className="truncate">{company.locations.join(", ")}</span>
                </div>
                <a href={company.careerPageUrl} target="_blank" rel="noreferrer"
                  className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-900 transition-all shadow-xl shadow-blue-100">
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
// src/PremiumLinks.tsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { employersList } from "./data/employersData";
import { supabase } from "./supabase"; 

export default function PremiumLinks() {
  const navigate = useNavigate();

  // 👇 تعديل: نأخذ أول 20 شركة لباقة الـ Premium
  const premiumCompanies = employersList.slice(0, 20);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); }
    };
    checkSession();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 font-sans">
      <div className="max-w-6xl mx-auto">
        
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest mb-4">
             <ShieldCheck className="w-4 h-4" /> Premium Access Unlocked
          </div>
          <h1 className="text-4xl font-black text-slate-900 mb-3">Premium Employer List 💼</h1>
          <p className="text-slate-600 font-medium text-lg">
            You have exclusive access to <span className="text-blue-600 font-black underline decoration-blue-200">20 Top Employers</span>.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {premiumCompanies.map((company) => (
             <div key={company.id} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-xl transition-all group">
                <div className={`h-24 bg-gradient-to-r ${company.logoColor} p-6 flex items-end relative`}>
                    <h3 className="text-white font-bold text-xl relative z-10 tracking-tight">{company.name}</h3>
                </div>
                <div className="p-6">
                    <div className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">{company.industry}</div>
                    <a href={company.careerPageUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center w-full bg-slate-900 text-white py-3.5 rounded-2xl font-bold hover:bg-blue-600 transition-all gap-2 shadow-lg shadow-slate-100">
                        Apply via Career Page <ExternalLink className="w-4 h-4"/>
                    </a>
                </div>
             </div>
          ))}
        </div>
      </div>
    </div>
  );
}
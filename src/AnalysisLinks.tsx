import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, Globe, Zap, Search } from "lucide-react";
import { employersList } from "./data/employersData";
import { supabase } from "./supabase";

export default function AnalysisLinks() {
  const navigate = useNavigate();
  // عرض أول 250 شركة
  const companies = employersList.slice(0, 250);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/login");
    };
    checkSession();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-50 py-16 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest mb-6 shadow-lg shadow-purple-200">
            <Zap className="w-4 h-4 fill-white" /> Analysis Plus Access
          </div>
          <h1 className="text-5xl font-black text-slate-900 mb-4 tracking-tighter">Ultimate Career Database</h1>
          <p className="text-slate-500 text-xl font-medium max-w-2xl mx-auto">
            You have unlocked the full potential with <span className="text-purple-600 font-black">250+ Direct Employer Links</span> to dominate the job market.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {companies.map((company) => (
            <div key={company.id} className="bg-white p-5 rounded-2xl border border-slate-100 hover:border-purple-400 transition-all group flex flex-col justify-between shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${company.logoColor} flex items-center justify-center text-white font-bold shrink-0 shadow-sm`}>
                   {company.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 leading-tight">{company.name}</h3>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">{company.industry}</p>
                </div>
              </div>
              <a href={company.careerPageUrl} target="_blank" rel="noreferrer" className="w-full py-2.5 bg-slate-50 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 group-hover:bg-purple-600 group-hover:text-white transition-all">
                Quick Apply <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
import { useNavigate } from "react-router-dom";
import { ExternalLink, Lock, ArrowUpCircle } from "lucide-react";
import { employersList } from "./data/employersData";

export default function FreeLinks() {
  const navigate = useNavigate();
  // عرض أول شركتين فقط
  const freeCompanies = employersList.slice(0, 2);

  return (
    <div className="min-h-screen bg-slate-50 py-20 px-4 flex flex-col items-center">
      <div className="max-w-4xl w-full text-center">
        <h1 className="text-3xl font-black text-slate-900 mb-4 tracking-tight text-center">Your Free Career Links</h1>
        <p className="text-slate-500 mb-12">Start your journey with these top 2 hand-picked employers.</p>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {freeCompanies.map((company) => (
            <div key={company.id} className="bg-white p-8 rounded-[2rem] border-2 border-dashed border-slate-200 text-left">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-r ${company.logoColor} mb-6 flex items-center justify-center text-white font-bold text-xl shadow-lg`}>
                {company.name.charAt(0)}
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">{company.name}</h3>
              <p className="text-sm text-slate-400 mb-6 uppercase font-bold tracking-widest text-[10px]">{company.industry}</p>
              <a href={company.careerPageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-blue-600 font-black hover:underline">
                Visit Career Page <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          ))}
        </div>

        {/* Upgrade Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-blue-200 relative overflow-hidden">
          <Lock className="absolute -right-4 -top-4 w-32 h-32 text-white/10 rotate-12" />
          <h2 className="text-2xl font-black mb-2 relative z-10">Want more opportunities?</h2>
          <p className="text-blue-50 mb-6 font-medium relative z-10">Upgrade your plan to unlock up to 250+ direct application links and skyrocket your hiring chances.</p>
          <button onClick={() => navigate('/plans')} className="bg-white text-blue-600 px-8 py-3 rounded-2xl font-black flex items-center gap-2 mx-auto hover:scale-105 transition-transform">
            <ArrowUpCircle className="w-5 h-5" /> Upgrade Plan Now
          </button>
        </div>
      </div>
    </div>
  );
}
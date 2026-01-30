import { ExternalLink, Lock, MapPin } from "lucide-react";
// استيراد الداتا من المسار الصحيح بناءً على صورك
import { employersList } from "./data/employersData"; 

export default function PremiumLinks() {
  // نأخذ أول 5 شركات فقط
  const premiumCompanies = employersList.slice(0, 5);

  return (
    <div className="min-h-screen bg-slate-50 py-20 px-4 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Premium Employer List 💼</h1>
          <p className="text-slate-600">You have access to <span className="font-bold text-blue-600">5 Top Employers</span>.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {premiumCompanies.map((company) => (
            <div key={company.id} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition border border-slate-100 group">
              <div className={`h-24 bg-gradient-to-r ${company.logoColor} p-6 flex items-end`}>
                <h3 className="text-white font-bold text-xl">{company.name}</h3>
              </div>
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold uppercase">{company.industry}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-500 text-sm mb-6">
                  <MapPin className="w-4 h-4" />
                  <span>{company.locations.join(", ")}</span>
                </div>
                <a href={company.careerPageUrl} target="_blank" rel="noreferrer"
                  className="w-full py-3 border border-slate-200 text-slate-700 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-50 transition group-hover:border-blue-200 group-hover:text-blue-600">
                  Visit Career Page <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          ))}

          {/* Locked Box (للشركات المقفلة) */}
          <div className="bg-slate-100 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center p-8 text-center opacity-75 min-h-[300px]">
            <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="text-slate-900 font-bold mb-2">Want More?</h3>
            <p className="text-slate-500 text-sm mb-4">Unlock 5 more exclusive companies with the Gold Plan.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
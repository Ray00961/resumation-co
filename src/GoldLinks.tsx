import { ExternalLink, MapPin, Star } from "lucide-react";
// 👇 لاحظ الإضافة: (type Employer)
import { employersList, type Employer } from "./data/employersData"; 

export default function GoldLinks() {
  return (
    <div className="min-h-screen bg-slate-50 py-20 px-4 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-block bg-yellow-100 text-yellow-800 px-4 py-1 rounded-full text-sm font-bold mb-4 flex items-center gap-2 w-fit mx-auto">
            <Star className="w-4 h-4 fill-yellow-800" /> Gold Access Unlocked
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Ultimate Employer Network 🚀</h1>
          <p className="text-slate-600">Full access to <span className="font-bold text-slate-900">All Top Tier Companies</span>.</p>
        </div>

        {/* Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {employersList.map((company: Employer) => (
            <div key={company.id} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition border border-slate-100 group">
              
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
                  className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition shadow-md">
                  Apply Now <ExternalLink className="w-4 h-4" />
                </a>
              </div>

            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
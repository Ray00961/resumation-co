import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Building2, Lock, CheckCircle } from "lucide-react"; // أيقونات القفل والصح
import { employersList } from "../data/employersData";

export default function EmployerAccess() {
  const [isUnlocked, setIsUnlocked] = useState(false);

  // هذا الكود بيشتغل أول ما الصفحة تفتح
  useEffect(() => {
    // بيقرأ الرابط من المتصفح
    const params = new URLSearchParams(window.location.search);
    // إذا لقينا كلمة "paid=true" بالرابط، يعني الزبون دفع
    if (params.get("paid") === "true") {
      setIsUnlocked(true);
    }
  }, []);

  return (
    <section id="exclusive-access" className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-50 font-sans relative">
      <div className="max-w-7xl mx-auto">
        
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-blue-950 mb-4 flex items-center justify-center gap-3">
            {isUnlocked ? (
              <span className="text-green-600 flex items-center gap-2">
                <CheckCircle className="w-8 h-8" /> Premium Access Unlocked
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Lock className="w-8 h-8 text-amber-500" /> Exclusive Employers List
              </span>
            )}
          </h2>
          <p className="text-gray-600">
            Top 5 Companies hiring now in Engineering, Medical, and Banking.
          </p>
        </div>

        {/* الحاوية الرئيسية للكروت */}
        <div className="relative">
          
          {/* طبقة التغبش (القفل) - بتظهر بس إذا ما دفع */}
          {!isUnlocked && (
            <div className="absolute inset-0 z-10 backdrop-blur-md bg-white/60 flex flex-col items-center justify-center rounded-3xl border border-white/50">
              <div className="bg-white p-8 rounded-2xl shadow-2xl text-center border border-gray-100 max-w-md mx-4">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8 text-amber-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Locked Content</h3>
                <p className="text-gray-500 mb-6">
                  Get your CV + Access to these top 5 hiring companies for just <span className="text-blue-600 font-bold">$1</span>.
                </p>
                <button 
                  onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                  className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition w-full"
                >
                  Unlock Now
                </button>
              </div>
            </div>
          )}

          {/* شبكة الشركات (الخمسة الكبار) */}
          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${!isUnlocked ? 'opacity-50 pointer-events-none select-none' : ''}`}>
            {employersList.map((employer, index) => (
              <motion.a
                key={employer.id}
                href={isUnlocked ? employer.careerPageUrl : "#"}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 flex items-center gap-4 hover:shadow-xl transition-all"
              >
                <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${employer.logoColor} flex items-center justify-center text-white font-bold shadow-md flex-shrink-0`}>
                  <Building2 className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-blue-950">
                    {employer.name}
                  </h3>
                  <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
                    {employer.industry}
                  </span>
                </div>
              </motion.a>
            ))}
          </div>
        
        </div>
      </div>
    </section>
  );
}
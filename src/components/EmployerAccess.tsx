import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Building2, Lock, CheckCircle, Loader2, ShieldAlert, Zap, ArrowUpRight } from "lucide-react"; 
import { employersList } from "../data/employersData";
import { supabase } from "../supabase";

export default function EmployerAccess() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      // FIXED: حذفنا فحص الـ URL (paid=true) نهائياً لمنع أي Bypass
      
      // المصدر الوحيد للحقيقة هو الـ Database
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const { data: userData } = await supabase
          .from('users')
          .select('selected_plan, package_name')
          .eq('id', session.user.id)
          .single();

        if (userData) {
          const plan = (userData.selected_plan || userData.package_name || 'free').toLowerCase().trim();
          // لا يفتح إلا إذا كانت الخطة ليست مجانية
          if (plan !== 'free') {
            setIsUnlocked(true);
          }
        }
      }
      setLoading(false);
    };

    checkAccess();
  }, []);

  return (
    <section id="exclusive-access" className="py-24 px-6 lg:px-16 bg-[#050B14] font-sans relative overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] bg-cyan-600/5 rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            {loading ? (
              <Loader2 className="w-10 h-10 animate-spin text-cyan-500" />
            ) : isUnlocked ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 px-6 py-2 rounded-2xl flex items-center gap-3 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                <span className="text-xs font-black text-emerald-500 uppercase tracking-[0.2em]">Premium Access Authorized</span>
              </div>
            ) : (
              <div className="bg-amber-500/10 border border-amber-500/20 px-6 py-2 rounded-2xl flex items-center gap-3 shadow-[0_0_20px_rgba(245,158,11,0.1)]">
                <Lock className="w-5 h-5 text-amber-500" />
                <span className="text-xs font-black text-amber-500 uppercase tracking-[0.2em]">Restricted Data Stream</span>
              </div>
            )}
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white mb-6 uppercase tracking-tight">
            Exclusive <span className="text-cyan-400">Employer</span> Database
          </h2>
          <p className="text-slate-500 font-medium max-w-2xl mx-auto uppercase tracking-widest text-[10px]">
            Real-time direct access to top-tier hiring nodes in Engineering, Medical, and Global Banking.
          </p>
        </div>

        <div className="relative">
          
          {/* Cyber Lock Overlay */}
          {!loading && !isUnlocked && (
            <div className="absolute inset-0 z-30 backdrop-blur-xl bg-[#050B14]/40 flex flex-col items-center justify-center rounded-[3rem] border border-white/5 shadow-2xl transition-all duration-700">
              <div className="bg-[#0A1324] p-10 rounded-[2.5rem] shadow-2xl text-center border border-white/10 max-w-md mx-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
                <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(245,158,11,0.1)]">
                  <ShieldAlert className="w-10 h-10 text-amber-500" />
                </div>
                <h3 className="text-2xl font-black text-white mb-4 uppercase tracking-tighter">Encryption Active</h3>
                <p className="text-slate-400 mb-8 text-sm leading-relaxed font-medium">
                  Initialize your premium protocol to unlock direct links to <span className="text-white">250+ Global Employers</span> and professional ATS optimization.
                </p>
                <button 
                  onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                  className="px-8 py-4 bg-amber-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:bg-amber-500 transition-all w-full shadow-[0_0_20px_rgba(245,158,11,0.2)]"
                >
                  Authorize Access &rarr;
                </button>
              </div>
            </div>
          )}

          {/* Employers Grid */}
          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 transition-all duration-700 ${(!isUnlocked || loading) ? 'blur-md opacity-30 pointer-events-none select-none grayscale' : ''}`}>
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
                className="bg-[#0A1324]/60 backdrop-blur-md rounded-3xl p-6 border border-white/5 flex items-center gap-5 hover:border-cyan-500/30 hover:bg-[#0D1A30] transition-all group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowUpRight className="w-4 h-4 text-cyan-500" />
                </div>
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${employer.logoColor} flex items-center justify-center text-white font-black shadow-lg flex-shrink-0 group-hover:scale-110 transition-transform`}>
                  <Building2 className="w-8 h-8" />
                </div>
                <div className="flex flex-col">
                  <h3 className="text-lg font-black text-white tracking-tight group-hover:text-cyan-400 transition-colors">
                    {employer.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Zap className="w-3 h-3 text-cyan-500" />
                    <span className="text-[10px] font-black text-cyan-600 uppercase tracking-widest">
                        {employer.industry}
                    </span>
                  </div>
                </div>
              </motion.a>
            ))}
          </div>
        
        </div>

        {/* Global Stats Meta */}
        <div className="mt-20 pt-10 border-t border-white/5 flex justify-center items-center gap-12 opacity-20 pointer-events-none">
             <div className="flex items-center gap-2"><span className="text-[9px] font-black text-white uppercase tracking-[0.3em]">Total Hiring Nodes: 250+</span></div>
             <div className="flex items-center gap-2"><span className="text-[9px] font-black text-white uppercase tracking-[0.3em]">Update Frequency: Daily</span></div>
             <div className="flex items-center gap-2"><span className="text-[9px] font-black text-white uppercase tracking-[0.3em]">Sync Speed: 0.2ms</span></div>
        </div>

      </div>
    </section>
  );
}
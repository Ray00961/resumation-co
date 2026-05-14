import { ShieldAlert, Scale, CreditCard, Lock, FileText, Activity, Globe, AlertTriangle } from "lucide-react";

export default function Terms() {
  return (
    <div className="bg-[#050B14] min-h-screen py-20 px-6 font-sans relative overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-[60vw] h-[60vw] bg-cyan-600/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[50vw] h-[50vw] bg-fuchsia-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Header Section */}
        <div className="bg-[#0A1324]/60 backdrop-blur-2xl rounded-[2.5rem] border border-white/5 overflow-hidden mb-12 shadow-2xl relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-slate-500 to-transparent" />
          <div className="p-12 text-center">
            <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
               <Scale className="w-10 h-10 text-slate-300" />
            </div>
            <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tighter uppercase mb-4">Terms of <span className="text-slate-400">Service</span></h1>
            <div className="flex items-center justify-center gap-3">
               <Activity className="w-4 h-4 text-slate-500 animate-pulse" />
               <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em]">Protocol Version 2.0.26</span>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          
          {/* English Version: Legal Node */}
          <div className="bg-[#0A1324]/40 backdrop-blur-xl p-10 rounded-[2.5rem] border border-white/5 hover:border-white/10 transition-all duration-500 flex flex-col space-y-10">
            <div className="flex items-center gap-3 text-slate-400">
               <Globe className="w-5 h-5" />
               <span className="text-[10px] font-black uppercase tracking-[0.3em]">English Protocol</span>
            </div>

            <section>
              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4 border-l-2 border-cyan-500 pl-4">1. Introduction</h3>
              <p className="text-slate-400 text-sm leading-relaxed font-medium">By initializing a session on <span className="text-white">Resumation.co</span>, you agree to these Terms. If you do not authorize these protocols, please terminate use immediately.</p>
            </section>

            <section>
              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4 border-l-2 border-cyan-500 pl-4">2. Service Architecture</h3>
              <p className="text-slate-400 text-sm leading-relaxed font-medium">We operate on a <span className="text-white">Pay-per-use</span> infrastructure. Users settle fees per document generated. All digital assets are archived within your secure node for future access.</p>
            </section>

            <section className="bg-white/5 p-6 rounded-2xl border border-white/5 italic">
              <h3 className="text-[10px] font-black text-cyan-500 uppercase mb-2">3. External Career Nodes</h3>
              <p className="text-slate-500 text-xs leading-relaxed">External links are informational streams only. We hold no authority over 3rd party sites and do not guarantee employment outcomes or content accuracy.</p>
            </section>

            <section>
              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4 border-l-2 border-cyan-500 pl-4">4. IP Protocol</h3>
              <p className="text-slate-400 text-sm leading-relaxed font-medium">All source codes, neural templates, and branding assets are the exclusive property of Resumation.co. Reverse engineering is strictly prohibited.</p>
            </section>

            <section>
              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4 border-l-2 border-cyan-500 pl-4">5. Finality of Transaction</h3>
              <p className="text-slate-400 text-sm leading-relaxed font-medium">Due to instant digital generation, all transactions are final. Refunds are only initialized in cases of verified system failures.</p>
            </section>
          </div>

          {/* Arabic Version: العقد القانوني */}
          <div className="bg-[#0A1324]/40 backdrop-blur-xl p-10 rounded-[2.5rem] border border-white/5 hover:border-white/10 transition-all duration-500 flex flex-col space-y-10 text-right" dir="rtl">
            <div className="flex items-center gap-3 text-slate-400">
               <Globe className="w-5 h-5" />
               <span className="text-[10px] font-black uppercase tracking-[0.3em]">البروتوكول العربي</span>
            </div>

            <section>
              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4 border-r-2 border-fuchsia-500 pr-4 font-arabic">١. مقدمة النظام</h3>
              <p className="text-slate-400 text-sm leading-relaxed font-medium font-arabic">باستخدامك لمنصة <span className="text-white font-sans">Resumation.co</span>، فإنك تقر بالالتزام الكامل ببنود الخدمة. في حال عدم الموافقة، يرجى إنهاء الجلسة فوراً.</p>
            </section>

            <section>
              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4 border-r-2 border-fuchsia-500 pr-4 font-arabic">٢. وصف البنية الخدمية</h3>
              <p className="text-slate-400 text-sm leading-relaxed font-medium font-arabic">نعتمد نموذج <span className="text-white">الدفع مقابل الاستخدام</span>. يتم تحصيل الرسوم مقابل كل وثيقة يتم إنشاؤها، مع توفير أرشيف رقمي مشفر لملفاتك.</p>
            </section>

            <section className="bg-white/5 p-6 rounded-2xl border border-white/5 italic">
              <h3 className="text-[10px] font-black text-fuchsia-500 uppercase mb-2">٣. روابط التوظيف الخارجية</h3>
              <p className="text-slate-500 text-xs leading-relaxed font-arabic">هذه الروابط مقدمة كخدمة معلوماتية. المنصة لا تملك سلطة قانونية على هذه الجهات ولا تضمن الحصول على وظيفة أو دقة البيانات الخارجية.</p>
            </section>

            <section>
              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4 border-r-2 border-fuchsia-500 pr-4 font-arabic">٤. معايير الملكية الفكرية</h3>
              <p className="text-slate-400 text-sm leading-relaxed font-medium font-arabic">جميع الأكواد البرمجية، الخوارزميات، والشعارات هي ملكية حصرية للمنصة، ويُحظر نسخها أو محاولة تفكيك برمجياتها.</p>
            </section>

            <section>
              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4 border-r-2 border-fuchsia-500 pr-4 font-arabic">٥. سياسة التسوية المالية</h3>
              <p className="text-slate-400 text-sm leading-relaxed font-medium font-arabic">نظراً لطبيعة المنتجات الرقمية الفورية، فإن جميع العمليات نهائية وغير قابلة للاسترداد إلا في حالات الخطأ التقني الموثق من قبلنا.</p>
            </section>
          </div>

        </div>

        {/* Global Compliance Footer */}
        <div className="mt-16 flex justify-center items-center gap-6 opacity-20 grayscale pointer-events-none">
             <AlertTriangle className="w-4 h-4 text-white" />
             <span className="text-[9px] font-black uppercase tracking-[0.4em] text-white">Governing Law: Lebanese-Egyptian Tech Accord</span>
        </div>

      </div>
    </div>
  );
}
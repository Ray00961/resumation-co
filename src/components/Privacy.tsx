import { ShieldCheck, Eye, Database, Lock, Globe, Activity, ShieldAlert } from "lucide-react";

export default function Privacy() {
  return (
    <div className="bg-cyber-bg min-h-screen py-20 px-6 font-sans relative overflow-hidden">
      
      {/* Background Cyber Ambience */}
      <div className="absolute top-0 left-0 w-[50vw] h-[50vw] bg-cyber-teal/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[50vw] h-[50vw] bg-cyber-teal/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Header Node */}
        <div className="bg-[rgba(35,113,123,0.12)] backdrop-blur-2xl rounded-[2.5rem] border border-cyber-teal/20 overflow-hidden mb-12 shadow-2xl relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
          <div className="p-12 text-center">
            <div className="w-20 h-20 bg-cyber-teal/10 border border-cyber-teal/20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(13,138,158,0.1)]">
               <ShieldCheck className="w-10 h-10 text-cyber-cyan" />
            </div>
            <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tighter uppercase mb-4">Privacy <span className="text-cyber-cyan">Protocol</span></h1>
            <div className="flex items-center justify-center gap-3">
               <Activity className="w-4 h-4 text-cyber-cyan animate-pulse" />
               <span className="text-[10px] font-black text-cyber-dim uppercase tracking-[0.4em]">Encryption: Active / AES-256</span>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          
          {/* English Node: Data Encryption Standards */}
          <div className="bg-[rgba(35,113,123,0.08)] backdrop-blur-xl p-10 rounded-[2.5rem] border border-white/5 hover:border-cyber-teal/25 transition-all duration-500 flex flex-col space-y-10">
            <div className="flex items-center gap-3 text-cyber-cyan">
               <Globe className="w-5 h-5" />
               <span className="text-[10px] font-black uppercase tracking-[0.3em]">International Standards</span>
            </div>

            <section className="group">
              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                <Database className="w-4 h-4 text-cyber-cyan" /> 1. Information Collection
              </h3>
              <p className="text-cyber-muted text-sm leading-relaxed font-medium">We collect info necessary for CV building: Name, Email, Phone, Work History, and Education. Payments are handled via <span className="text-white underline decoration-cyan-500/30">Paymob / Whish Pay</span>. We do NOT store credit card info.</p>
            </section>

            <section>
              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyber-cyan" /> 2. Data Utilization
              </h3>
              <p className="text-cyber-muted text-sm leading-relaxed font-medium">To create and process your CV, archive documents for your access, improve user experience, and communicate updates regarding your account protocol.</p>
            </section>

            <section>
              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                <Lock className="w-4 h-4 text-cyber-cyan" /> 3. Secure Storage
              </h3>
              <p className="text-cyber-muted text-sm leading-relaxed font-medium">Personal data is stored in secured cloud nodes with modern encryption. Your documents remain in your private archive as long as your session is active.</p>
            </section>

            <div className="mt-auto pt-10 opacity-20 border-t border-white/5">
                <span className="text-[8px] font-black uppercase tracking-[0.5em]">Standard Compliance: GDPR / SSL</span>
            </div>
          </div>

          {/* Arabic Node: معايير حماية البيانات */}
          <div className="bg-[rgba(35,113,123,0.08)] backdrop-blur-xl p-10 rounded-[2.5rem] border border-white/5 hover:border-cyber-teal/25 transition-all duration-500 flex flex-col space-y-10 text-right" dir="rtl">
            <div className="flex items-center gap-3 text-cyber-cyan">
               <Globe className="w-5 h-5" />
               <span className="text-[10px] font-black uppercase tracking-[0.3em]">المعايير الإقليمية</span>
            </div>

            <section>
              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                <Database className="w-4 h-4 text-cyber-cyan" /> ١. المعلومات التي نجمعها
              </h3>
              <p className="text-cyber-muted text-sm leading-relaxed font-medium font-arabic">نجمع البيانات الضرورية لبناء السيرة الذاتية (الاسم، الخبرات، البيانات المهنية). عمليات الدفع تتم عبر <span className="text-white underline decoration-fuchsia-500/30">Paymob / Whish Pay</span> ولا نقوم بتخزين بيانات بطاقاتك.</p>
            </section>

            <section>
              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyber-cyan" /> ٢. كيف نستخدم بياناتك
              </h3>
              <p className="text-cyber-muted text-sm leading-relaxed font-medium font-arabic">لإنشاء ومعالجة الـ CV، أرشفة المستندات في حسابك للوصول إليها لاحقاً، وتحسين تجربة المستخدم داخل النظام الذكي للموقع.</p>
            </section>

            <section>
              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                <Lock className="w-4 h-4 text-cyber-cyan" /> ٣. حماية وتخزين البيانات
              </h3>
              <p className="text-cyber-muted text-sm leading-relaxed font-medium font-arabic">تُخزن البيانات في عُقد سحابية مؤمنة بتقنيات تشفير متطورة. تظل بياناتك محفوظة في أرشيفك الخاص طالما أن حسابك نشط.</p>
            </section>

            <div className="mt-auto pt-10 opacity-20 border-t border-white/5">
                <span className="text-[8px] font-black uppercase tracking-[0.5em]">التزام المعايير: SSL / Data Privacy</span>
            </div>
          </div>

        </div>

        {/* Global Security Disclaimer */}
        <div className="mt-16 flex justify-center items-center gap-4 opacity-30 grayscale pointer-events-none">
             <ShieldAlert className="w-4 h-4 text-cyber-cyan" />
             <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">End-to-End Encrypted Career Infrastructure</span>
        </div>

      </div>
    </div>
  );
}
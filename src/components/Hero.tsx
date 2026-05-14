import { useEffect, useRef, useState } from "react";
import Typed from "typed.js";
import { MapPin, ArrowLeft, ArrowRight, Cpu, ScanLine, Sparkles, ShieldCheck, Database, Layers } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Hero() {
  const el = useRef<HTMLSpanElement>(null);
  const navigate = useNavigate();
  
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [verifyingText, setVerifyingText] = useState<string>("");

  useEffect(() => {
    if (!el.current) return;
    const typed = new Typed(el.current, {
      strings: [
        'سيرة ذاتية تتخطى أنظمة الـ ATS.',
        'AI-Powered Resumes.',
        'نصيغ خبراتك بذكاء احترافي.',
        'Get Hired Faster.'
      ],
      typeSpeed: 40,
      backSpeed: 30,
      loop: true,
    });
    return () => typed.destroy();
  }, []);

  // دالة موحدة لحفظ البيانات والانتقال
  const saveAndNavigate = (region: string, lang: string, coords?: {lat: number, lon: number}) => {
    const initialUserData = {
      region: region,
      language: lang, 
      lat: coords?.lat || 0,
      lon: coords?.lon || 0,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('pending_user_data', JSON.stringify(initialUserData));
    setVerifyingText("");
    navigate("/login");
  };

  const handleStart = async (lang: 'ar' | 'en') => {
    setIsLoading(lang);
    setVerifyingText(lang === 'ar' ? "جاري تحديد منطقتك..." : "Detecting your region...");
    
    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 5000, // مهلة 5 ثواني كافية جداً
      maximumAge: 0
    };

    // 1. محاولة الـ GPS أولاً (للدقة)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const autoRegion = latitude < 32.5 ? 'EG' : 'LB';
        saveAndNavigate(autoRegion, lang, { lat: latitude, lon: longitude });
      },
      async (error) => {
        // 2. إذا فشل الـ GPS، نستخدم الـ IP (حل ذكي لا يزعج المستخدم)
        console.warn("GPS failed/denied, checking IP...");
        try {
          const response = await fetch('https://ipapi.co/json/');
          const data = await response.json();
          // نعتمد مصر إذا كان الـ code هو EG، غير ذلك نعتبره لبنان كخيار افتراضي لمنطقتك
          const ipRegion = data.country_code === 'EG' ? 'EG' : 'LB';
          saveAndNavigate(ipRegion, lang);
        } catch (ipError) {
          // 3. خيار أخير في حال انقطاع كل السبل
          saveAndNavigate('LB', lang); 
        }
      },
      geoOptions
    );
  };

  return (
    <div className="min-h-[100dvh] flex flex-col font-sans bg-[#050B14] relative overflow-x-hidden text-slate-300" dir="rtl">
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes cyber-scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .animate-cyber-scan {
          animation: cyber-scan 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        @keyframes float-tech {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .animate-float-tech {
          animation: float-tech 5s ease-in-out infinite;
        }
        .glass-panel {
          background: rgba(10, 19, 36, 0.6);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(6, 182, 212, 0.15);
        }
        .neon-line {
          background: linear-gradient(90deg, transparent, rgba(6, 182, 212, 0.8), transparent);
        }
      `}} />

      <div className="fixed inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEgMWgzOHYzOEgxVjF6IiBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIHN0cm9rZT0icmdiYSgyNTUsIDI1NSwgMjU1LCAwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9zdmc+')] opacity-30 pointer-events-none z-0" />
      <div className="absolute top-0 right-0 w-[50vw] h-[50vw] max-w-[800px] max-h-[800px] bg-cyan-600/10 rounded-full blur-[150px] pointer-events-none z-0" />

      <section className="relative z-10 w-full min-h-[90vh] flex flex-col lg:flex-row items-center justify-center px-6 lg:px-16 pt-12 lg:pt-0 gap-12 lg:gap-8">
        <div className="w-full lg:w-[50%] flex flex-col justify-center text-center lg:text-right">
          <div className="inline-flex items-center gap-2 bg-cyan-950/30 border border-cyan-500/30 text-cyan-400 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-8 mx-auto lg:mx-0 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
            <Sparkles className="w-3.5 h-3.5" /> AI Career Optimization
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tighter mb-4 leading-[1.1] text-white">
            الهيكل الرقمي <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-l from-cyan-400 to-teal-200">
              لمسارك المهني.
            </span>
          </h1>
          
          <div className="h-10 text-lg sm:text-xl lg:text-2xl text-slate-400 font-medium mb-12 font-mono tracking-wide">
            <span ref={el}></span>
          </div>

          <div className="w-full max-w-md mx-auto lg:mx-0 flex flex-col gap-4 relative z-20">
            {verifyingText && (
              <div className="flex items-center justify-center gap-2 text-cyan-400 text-sm font-bold bg-[#0A1324]/80 backdrop-blur-md py-3 rounded-xl border border-cyan-500/30 animate-pulse">
                <MapPin className="w-4 h-4" />
                <span>{verifyingText}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => handleStart('ar')} disabled={isLoading !== null}
                className="group relative w-full flex flex-col items-center justify-center gap-2 bg-[#0A1324] hover:bg-[#0c1b33] border border-cyan-900/60 hover:border-cyan-400 rounded-xl p-4 transition-all duration-300 active:scale-95 shadow-[0_0_15px_rgba(0,0,0,0.5)] hover:shadow-[0_0_25px_rgba(34,211,238,0.2)] disabled:opacity-50">
                <span className="text-lg font-black text-white z-10">العربية</span>
                <div className="flex items-center gap-1 text-[10px] text-cyan-500 uppercase tracking-widest font-bold z-10">
                  <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" /> ابدأ الآن
                </div>
              </button>

              <button onClick={() => handleStart('en')} disabled={isLoading !== null}
                className="group relative w-full flex flex-col items-center justify-center gap-2 bg-[#0A1324] hover:bg-[#0c1b33] border border-cyan-900/60 hover:border-cyan-400 rounded-xl p-4 transition-all duration-300 active:scale-95 shadow-[0_0_15px_rgba(0,0,0,0.5)] hover:shadow-[0_0_25px_rgba(34,211,238,0.2)] disabled:opacity-50" dir="ltr">
                <span className="text-lg font-black text-white z-10">English</span>
                <div className="flex items-center gap-1 text-[10px] text-cyan-500 uppercase tracking-widest font-bold z-10">
                  Start Now <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-[50%] relative flex justify-center items-center h-[350px] lg:h-[450px] animate-float-tech mt-12 lg:mt-0">
          <div className="absolute inset-0 max-w-[300px] mx-auto glass-panel border border-cyan-500/40 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden flex flex-col p-6">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-cyan-500/20">
              <div className="w-16 h-2 bg-cyan-400/80 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.6)]"></div>
              <Cpu className="w-5 h-5 text-cyan-500" />
            </div>
            <div className="w-full h-1.5 bg-slate-700/60 rounded-full mb-4"></div>
            <div className="w-4/5 h-1.5 bg-slate-700/60 rounded-full mb-4"></div>
            <div className="w-3/5 h-1.5 bg-slate-700/60 rounded-full mb-8"></div>
            <div className="w-full h-1.5 bg-slate-700/60 rounded-full mb-4"></div>
            <div className="w-5/6 h-1.5 bg-slate-700/60 rounded-full mb-4"></div>
            <div className="absolute left-0 right-0 h-[2px] bg-cyan-300 shadow-[0_0_20px_5px_rgba(34,211,238,0.6)] z-20 animate-cyber-scan"></div>
          </div>
        </div>
      </section>

      <section className="relative z-10 w-full max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-black text-white mb-4 uppercase tracking-wider font-mono">
            Core Services <span className="text-cyan-400">.</span> خدماتنا الأساسية
          </h2>
          <p className="text-slate-400 text-sm uppercase tracking-widest font-bold">
            OPTIMIZE YOUR VISIBILITY, SECURE YOUR DREAM ROLE.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="glass-panel p-8 rounded-2xl border-t border-l hover:border-cyan-400/50 transition-colors group">
            <ShieldCheck className="w-10 h-10 text-cyan-400 mb-6 group-hover:scale-110 transition-transform" strokeWidth={1.5} />
            <h3 className="text-xl font-bold text-white mb-2 font-mono">ATS Optimization</h3>
            <h4 className="text-sm font-bold text-cyan-500 mb-4">التوافق مع أنظمة الفرز</h4>
            <p className="text-slate-400 text-sm leading-relaxed">
              بناء سير ذاتية تتجاوز الفلاتر الآلية (ATS) بكفاءة عالية، مما يضمن وصول ملفك لمدراء التوظيف.
            </p>
          </div>

          <div className="glass-panel p-8 rounded-2xl border-t border-l hover:border-cyan-400/50 transition-colors group">
            <Database className="w-10 h-10 text-cyan-400 mb-6 group-hover:scale-110 transition-transform" strokeWidth={1.5} />
            <h3 className="text-xl font-bold text-white mb-2 font-mono">AI Skill Analysis</h3>
            <h4 className="text-sm font-bold text-cyan-500 mb-4">التحليل الذكي للمهارات</h4>
            <p className="text-slate-400 text-sm leading-relaxed">
              نظامنا يحلل مسارك المهني ويطابقه مع متطلبات سوق العمل العالمي لاستخراج أفضل الكلمات المفتاحية.
            </p>
          </div>

          <div className="glass-panel p-8 rounded-2xl border-t border-l hover:border-cyan-400/50 transition-colors group">
            <Layers className="w-10 h-10 text-cyan-400 mb-6 group-hover:scale-110 transition-transform" strokeWidth={1.5} />
            <h3 className="text-xl font-bold text-white mb-2 font-mono">Direct Career Links</h3>
            <h4 className="text-sm font-bold text-cyan-500 mb-4">الوصول لشبكة التوظيف</h4>
            <p className="text-slate-400 text-sm leading-relaxed">
              نوفر لك قاعدة بيانات ضخمة تضم مئات الروابط المباشرة لكبرى الشركات الإقليمية والعالمية.
            </p>
          </div>
        </div>
      </section>

      <footer className="relative z-10 w-full text-center py-8 text-slate-600 text-xs font-mono">
        © 2026 Resumation.co. All Rights Reserved. • Powered by AI
      </footer>
    </div>
  );
}
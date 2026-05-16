import { Check, ShieldCheck, Zap, BarChart3, Globe, Sparkles, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Cookies from "js-cookie";

export default function PricingDescription() {
  const navigate = useNavigate();
  const userRegion = Cookies.get("user_region") || "LB";
  const isEgypt = userRegion === "EG";

  const plans = [
    {
      name: "Free Trial",
      price: isEgypt ? "0 EGP" : "Free",
      description: "Test our AI neural infrastructure.",
      features: [
        "Professional Summary Generation",
        "Expert Tips for ATS Optimization",
        "Access to 2 Employer Links",
      ],
      icon: <Zap className="w-6 h-6 text-cyber-muted" />,
      buttonText: "Start Protocol",
      targetPath: "/build",
      isPopular: false,
      color: "cyan"
    },
    {
      name: "Premium Plan",
      price: isEgypt ? "50 EGP" : "$2",
      description: "The primary choice for active seekers.",
      features: [
        "Build New ATS CV from Scratch",
        "Access 10 Employer Links Worldwide",
        "Smart Skills Suggestions",
      ],
      icon: <ShieldCheck className="w-6 h-6 text-cyber-cyan" />,
      buttonText: "Initialize Premium",
      targetPath: "/build",
      isPopular: true,
      color: "cyan"
    },
    {
      name: "Gold Plan",
      price: isEgypt ? "250 EGP" : "$5",
      description: "Full suite application deployment.",
      features: [
        "Build New ATS CV from Scratch",
        "Professional Cover Letter Creation",
        "Access 20 Employer Links Worldwide",
      ],
      icon: <Globe className="w-6 h-6 text-cyber-cyan" />,
      buttonText: "Deploy Gold",
      targetPath: "/build",
      isPopular: false,
      color: "fuchsia"
    },
    {
      name: "Analysis Node",
      price: isEgypt ? "350 EGP" : "$10",
      description: "Deep dive profile alignment.",
      features: [
        "Full CV vs Job Description Alignment",
        "Key Keywords for ATS Pass",
        "250 Employer Links Database",
      ],
      icon: <BarChart3 className="w-6 h-6 text-teal-400" />,
      buttonText: "Activate Analysis",
      targetPath: "/analyse",
      isPopular: false,
      color: "teal"
    },
  ];

  return (
    <div className="bg-cyber-bg py-24 px-6 font-sans relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/4 w-[50vw] h-[50vw] bg-cyber-teal/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[40vw] h-[40vw] bg-cyber-teal/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 bg-cyber-teal/5 border border-cyber-teal/20 text-cyber-cyan px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.3em] mb-6 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
            <Activity className="w-3.5 h-3.5" />
            {isEgypt ? "Zone: Egypt (EGP)" : "Zone: International (USD)"}
          </div>
          <h2 className="text-4xl lg:text-6xl font-black text-white mb-6 uppercase tracking-tight">
            Service <span className="text-cyber-cyan">Tiers</span>
          </h2>
          <p className="text-cyber-dim font-medium max-w-2xl mx-auto uppercase tracking-widest text-xs">
            No upfront payment required. Initialize your career protocol and settle when you are satisfied.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan, index) => (
            <div 
              key={index} 
              className={`relative bg-[rgba(35,113,123,0.12)] backdrop-blur-xl rounded-[2.5rem] p-8 border transition-all duration-500 flex flex-col group ${
                plan.isPopular 
                ? 'border-cyber-teal/40 shadow-[0_0_40px_rgba(13,138,158,0.1)] scale-105 z-20' 
                : 'border-white/5 hover:border-white/20 z-10'
              }`}
            >
              {plan.isPopular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-cyber-teal text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg">
                  Most Popular
                </div>
              )}

              <div className="mb-8">
                <div className={`w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  {plan.icon}
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">{plan.name}</h3>
                <p className="text-xs text-cyber-dim mt-2 font-bold uppercase tracking-wider">{plan.description}</p>
              </div>

              <div className="mb-10">
                <span className="text-4xl font-black text-white tracking-tighter">{plan.price}</span>
                <span className="text-[10px] font-black text-cyber-dim uppercase tracking-widest ml-2">/ Protocol</span>
              </div>

              <ul className="space-y-5 mb-10 flex-grow">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-xs font-bold text-cyber-muted uppercase tracking-wide">
                    <Check className={`w-4 h-4 shrink-0 ${plan.isPopular ? 'text-cyber-cyan' : 'text-cyber-dim'}`} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button 
                onClick={() => navigate(plan.targetPath)}
                className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all duration-300 shadow-xl ${
                  plan.isPopular 
                  ? 'bg-cyber-teal text-white hover:bg-cyber-cyan shadow-cyber-teal/20' 
                  : 'bg-white/5 text-cyber-muted border border-white/10 hover:bg-white hover:text-black'
                }`}
              >
                {plan.buttonText}
              </button>
            </div>
          ))}
        </div>
        
        <div className="mt-20 flex justify-center items-center gap-4 opacity-30 grayscale pointer-events-none">
             <Sparkles className="w-4 h-4 text-cyber-cyan" />
             <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Encrypted Payment Gateway Architecture</span>
        </div>
      </div>
    </div>
  );
}
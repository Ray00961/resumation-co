import { Facebook, Twitter, Linkedin, Instagram, Mail, MessageCircle, MapPin, Shield, Cpu, Globe } from "lucide-react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="bg-[#141D1F] text-cyber-muted py-16 border-t border-cyber-teal/10 font-sans relative overflow-hidden">
      
      {/* Background Decorative Element */}
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-cyber-teal/5 blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 lg:px-16 relative z-10">
        
        {/* Top Section: Brand & Links */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-16">
          
          {/* Brand Identity Section */}
          <div className="md:col-span-5">
            <div className="flex items-center gap-2 mb-6">
               <Shield className="w-6 h-6 text-cyber-cyan" />
               <span className="text-2xl font-black tracking-tighter text-white">
                Resumation<span className="text-cyber-cyan">.co</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed mb-8 max-w-sm font-medium opacity-80">
              نظام هندسي متكامل مدعوم بالذكاء الاصطناعي لضمان تفوق سيرتك الذاتية في أنظمة التوظيف العالمية وتأمين مستقبلك المهني.
              <br />
              <span className="block mt-2 text-[11px] uppercase tracking-widest text-cyber-cyan/80 font-black">Industrial Career Infrastructure</span>
            </p>
            <div className="flex gap-3">
              <a href="#" className="w-10 h-10 flex items-center justify-center bg-white/5 border border-white/10 rounded-xl hover:border-cyber-teal/50 hover:text-cyber-cyan transition-all duration-300"><Linkedin className="w-4 h-4" /></a>
              <a href="#" className="w-10 h-10 flex items-center justify-center bg-white/5 border border-white/10 rounded-xl hover:border-cyber-teal/50 hover:text-cyber-cyan transition-all duration-300"><Facebook className="w-4 h-4" /></a>
              <a href="#" className="w-10 h-10 flex items-center justify-center bg-white/5 border border-white/10 rounded-xl hover:border-cyber-teal/50 hover:text-cyber-cyan transition-all duration-300"><Instagram className="w-4 h-4" /></a>
            </div>
          </div>

          {/* Links Column 1: Services */}
          <div className="md:col-span-2">
            <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] mb-6">Services</h3>
            <ul className="space-y-4 text-xs font-bold uppercase tracking-widest">
              <li><Link to="/build" className="hover:text-cyber-cyan transition-colors">Build AI CV</Link></li>
              <li><Link to="/analyse" className="hover:text-cyber-cyan transition-colors">ATS Analysis</Link></li>
              <li><Link to="/pricing" className="hover:text-cyber-cyan transition-colors">Pricing</Link></li>
              <li><Link to="/templates" className="hover:text-cyber-cyan transition-colors">Templates</Link></li>
            </ul>
          </div>

          {/* Links Column 2: Company */}
          <div className="md:col-span-2">
            <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] mb-6">Company</h3>
            <ul className="space-y-4 text-xs font-bold uppercase tracking-widest">
              <li><Link to="/about" className="hover:text-cyber-cyan transition-colors">About Us</Link></li>
              <li><Link to="/account" className="hover:text-cyber-cyan transition-colors">Account</Link></li>
              <li><Link to="/contact" className="hover:text-cyber-cyan transition-colors">Support</Link></li>
              <li><Link to="/blog" className="hover:text-cyber-cyan transition-colors">AI Insights</Link></li>
            </ul>
          </div>

          {/* Links Column 3: Contact */}
          <div className="md:col-span-3">
            <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] mb-6">Contact Node</h3>
            <ul className="space-y-4 text-xs font-bold tracking-widest">
              <li className="flex items-center gap-3 group cursor-pointer">
                <Mail className="w-4 h-4 text-cyber-cyan group-hover:animate-pulse" />
                <span className="group-hover:text-white transition-colors">support@resumation.co</span>
              </li>
              <li className="flex items-center gap-3 group cursor-pointer" dir="ltr">
                <MessageCircle className="w-4 h-4 text-emerald-500" />
                <a href="https://wa.me/201515770632" target="_blank" rel="noreferrer" className="group-hover:text-white transition-colors">+20 151 577 0632</a>
              </li>
              <li className="flex items-center gap-3 group cursor-pointer" dir="ltr">
                <MessageCircle className="w-4 h-4 text-emerald-500" />
                <a href="https://wa.me/96170000000" target="_blank" rel="noreferrer" className="group-hover:text-white transition-colors">+961 70 000 000</a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Section: Compliance & Partnership */}
        <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8">
          
          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyber-dim/70">
              © 2026 Resumation.co <span className="mx-2">|</span> AI Infrastructure
            </span>
            <div className="flex items-center gap-2 px-4 py-1.5 bg-cyber-teal/5 rounded-full border border-cyber-teal/10">
              <MapPin className="w-3 h-3 text-cyber-cyan" />
              <span className="text-[9px] font-black text-cyber-cyan uppercase tracking-widest">Lebanese-Egyptian Tech Alliance</span>
            </div>
          </div>

          <div className="flex gap-8 text-[10px] font-black uppercase tracking-widest">
            <Link to="/privacy" className="text-cyber-dim hover:text-cyber-cyan transition-colors">Privacy Node</Link>
            <Link to="/terms" className="text-cyber-dim hover:text-cyber-cyan transition-colors">Protocol Terms</Link>
          </div>
          
        </div>

      </div>
    </footer>
  );
}
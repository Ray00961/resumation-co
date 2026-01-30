import { Facebook, Twitter, Linkedin, Instagram, MapPin, Mail, Phone } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-[#0f172a] text-white py-16 border-t border-slate-800 font-sans">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          
          {/* Brand Section: اللوجو والوصف */}
          <div className="col-span-1 md:col-span-1">
            <h2 className="text-2xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
              Resumate.ai
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              The smartest way to build your career. Our AI engine ensures your CV gets past the robots and lands on the recruiter's desk.
            </p>
            <div className="flex gap-4">
              <a href="#" className="bg-slate-800 p-2 rounded-full hover:bg-blue-600 transition"><Linkedin className="w-4 h-4" /></a>
              <a href="#" className="bg-slate-800 p-2 rounded-full hover:bg-blue-400 transition"><Twitter className="w-4 h-4" /></a>
              <a href="#" className="bg-slate-800 p-2 rounded-full hover:bg-blue-800 transition"><Facebook className="w-4 h-4" /></a>
              <a href="#" className="bg-slate-800 p-2 rounded-full hover:bg-pink-600 transition"><Instagram className="w-4 h-4" /></a>
            </div>
          </div>

          {/* Links: Company */}
          <div>
            <h3 className="font-bold text-lg mb-4 text-white">Company</h3>
            <ul className="space-y-3 text-sm text-slate-400">
              <li><a href="#" className="hover:text-blue-400 transition">About Us</a></li>
              <li><a href="#" className="hover:text-blue-400 transition">How it Works</a></li>
              <li><a href="#pricing" className="hover:text-blue-400 transition">Pricing</a></li>
            </ul>
          </div>

          {/* Links: Resources */}
          <div>
            <h3 className="font-bold text-lg mb-4 text-white">Resources</h3>
            <ul className="space-y-3 text-sm text-slate-400">
              <li><a href="#" className="hover:text-blue-400 transition">CV Templates</a></li>
              <li><a href="#" className="hover:text-blue-400 transition">Career Blog</a></li>
              <li><a href="#" className="hover:text-blue-400 transition">ATS Checker</a></li>
            </ul>
          </div>

          {/* Links: Contact */}
          <div>
            <h3 className="font-bold text-lg mb-4 text-white">Contact</h3>
            <ul className="space-y-3 text-sm text-slate-400">
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-500" />
                <span>support@resumate.ai</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-500" />
                <span dir="ltr">+20 120 573 3992</span>
              </li>
               <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-500" />
                <span dir="ltr">+961 70 034 979</span>
              </li>
            </ul>
          </div>
        </div>

        {/* 🇱🇧 🇪🇬 Partnership Badge */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-8 text-center border border-slate-700/50 mb-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-white to-red-600 opacity-20"></div>
            
            <div className="flex items-center justify-center gap-2 text-yellow-500 font-bold mb-2">
                <MapPin className="w-5 h-5" /> Lebanese-Egyptian Partnership
            </div>
            <p className="text-slate-400 text-sm">
                Bridging talent across MENA with innovation from <span className="text-white font-semibold">Beirut</span> and <span className="text-white font-semibold">Cairo</span>.
            </p>
        </div>

        {/* Copyright */}
        <div className="text-center text-slate-600 text-xs border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center">
          <span>© 2026 Resumate.ai. All rights reserved.</span>
          <div className="flex gap-4 mt-4 md:mt-0">
            <a href="#" className="hover:text-slate-400">Privacy Policy</a>
            <a href="#" className="hover:text-slate-400">Terms of Service</a>
          </div>
        </div>

      </div>
    </footer>
  );
}
import { ArrowRight, LogIn, CheckCircle } from "lucide-react"; 
import { Link } from "react-router-dom"; 

export default function Hero() {
  return (
    <div className="relative isolate overflow-hidden bg-white font-sans min-h-screen flex flex-col">
      
      {/* --- Navbar --- */}
      <header className="absolute inset-x-0 top-0 z-50">
        <nav className="flex items-center justify-between p-6 lg:px-8" aria-label="Global">
          <div className="flex lg:flex-1">
            <Link to="/" className="-m-1.5 p-1.5 text-2xl font-bold text-blue-600 tracking-tight hover:opacity-80 transition">
              Resumate.ai
            </Link>
          </div>
          <div className="flex flex-1 justify-end">
            <Link 
              to="/login" 
              className="group flex items-center gap-2 text-sm font-semibold leading-6 text-slate-700 hover:text-blue-600 transition-all"
            >
              <span>Log In</span>
              <LogIn className="w-4 h-4 group-hover:translate-x-1 transition-transform" /> 
            </Link>
          </div>
        </nav>
      </header>

      {/* --- Hero Content --- */}
      <div className="relative pt-24 pb-16 sm:pt-32 lg:pb-24 overflow-hidden flex-grow flex items-center justify-center">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl mb-6">
              Build your professional CV <br />
              <span className="text-blue-600">Powered by AI</span>
            </h1>
            
            <p className="mt-6 text-lg leading-8 text-slate-600 max-w-2xl mx-auto">
              Stop guessing. Our AI builder ensures your resume passes the ATS robots and lands on the recruiter's desk. No writing skills needed.
            </p>
            
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                to="/login"
                className="rounded-xl bg-blue-600 px-8 py-4 text-lg font-bold text-white shadow-lg hover:bg-blue-500 hover:scale-105 transition-all flex items-center gap-2"
              >
                Create My CV Now <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
            
            {/* Trust Badges (عناصر الثقة) */}
            <div className="mt-12 flex flex-wrap justify-center gap-4 sm:gap-8 text-slate-500 text-sm font-medium">
                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
                  <CheckCircle className="w-4 h-4 text-green-500"/> ATS Friendly
                </div>
                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
                  <CheckCircle className="w-4 h-4 text-green-500"/> AI Generated
                </div>
                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-full border border-slate-100">
                  <CheckCircle className="w-4 h-4 text-green-500"/> Instant PDF
                </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
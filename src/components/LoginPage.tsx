import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom'; // تمت إزالة useNavigate من هنا
import { toast } from 'sonner';
import { supabase } from '../supabase'; // استدعاء ملف الاتصال

const LoginPage = () => {
  // تمت إزالة تعريف navigate من هنا لأنه كان يسبب الخطأ
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });

  // 1. دالة تسجيل الدخول عبر جوجل
  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `${window.location.origin}/dashboard` // التوجيه للداشبورد بعد الدخول
        }
      });
      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  // 2. دالة تسجيل الدخول بالإيميل (سنتركها للمستقبل)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // محاكاة مؤقتة للإيميل
    setTimeout(() => {
      setIsLoading(false);
      toast.success('Coming soon! Please use Google Login for now.');
    }, 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* خلفية جمالية */}
      <div className="absolute top-[-10%] right-[-5%] w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div className="absolute bottom-[-10%] left-[-5%] w-72 h-72 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full space-y-8 bg-white/80 backdrop-blur-lg p-8 rounded-2xl shadow-xl border border-white/20 z-10"
      >
        <div className="text-center">
          <h2 className="mt-2 text-3xl font-bold text-gray-900 tracking-tight">
            Welcome Back
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Log in to continue building your CV
          </p>
        </div>

        {/* --- زر جوجل الجديد (سيظهر الآن!) --- */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-xl py-3 px-4 text-gray-700 font-semibold hover:bg-gray-50 transition-all shadow-sm group mt-6"
        >
          {/* أيقونة جوجل SVG */}
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          <span className="group-hover:text-gray-900">Sign in with Google</span>
        </button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Or continue with email</span>
          </div>
        </div>
        {/* --- نهاية القسم الجديد --- */}

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Email Field */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              </div>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-gray-50/50 focus:bg-white"
                placeholder="Email address"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>

            {/* Password Field */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              </div>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                className="block w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-gray-50/50 focus:bg-white"
                placeholder="Password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600 cursor-pointer" />
                ) : (
                  <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600 cursor-pointer" />
                )}
              </button>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isLoading}
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <span className="flex items-center">
                Sign In with Email
                <ArrowRight className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
              </span>
            )}
          </motion.button>
        </form>
        
        <div className="text-center mt-4">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500 transition-colors">
                Create a free account
              </Link>
            </p>
        </div>

      </motion.div>
    </div>
  );
};

export default LoginPage;
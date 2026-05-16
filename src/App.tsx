import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";

// استيراد المكونات الأساسية (Layout)
import Header from "./components/Header";
import Footer from "./components/Footer";

// استيراد مكونات الصفحة الرئيسية
import Hero from "./components/Hero";

// استيراد الصفحات الأساسية
import PricingDescription from "./components/PricingDescription"; 
import PlansPage from "./components/PlansPage";
import SuccessPage from "./components/SuccessPage";
import LoginPage from "./components/LoginPage";
import Dashboard from "./components/Dashboard";
import BuilderPage from "./components/BuilderPage";
import CareerAnalysis from "./components/CareerAnalysis"; 
import MyAccount from "./components/MyAccount";
import PackageAccess from "./components/PackageAccess";
import ContactPage from "./components/ContactPage";
import Profile from "./pages/Profile";

// استيراد الصفحات القانونية
import Terms from "./components/Terms";
import Privacy from "./components/Privacy";

// استيراد مراقب الإشعارات
import NotificationListener from "./components/NotificationListener";

// استيراد صفحات الروابط المصنفة حسب الباقة ✅
import FreeLinks from "./FreeLinks"; 
import PremiumLinks from "./PremiumLinks"; 
import GoldLinks from "./GoldLinks"; 
import AnalysisLinks from "./AnalysisLinks"; 

// FIXED: إضافة مكون بسيط لصفحة 404 (فيك تغير تصميمه لاحقاً)
const NotFound = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
    <h1 className="text-6xl font-black text-cyber-cyan mb-4">404</h1>
    <p className="text-xl text-cyber-dim mb-8">عذراً، هذه الصفحة غير موجودة.</p>
    <a href="/" className="bg-cyber-teal text-white px-6 py-2 rounded-lg font-bold hover:bg-cyber-cyan transition-colors">العودة للرئيسية</a>
  </div>
);

export default function App() {
  return (
    <Router>
      <div className="flex flex-col min-h-screen bg-cyber-bg">
        
        {/* تشغيل المراقب في الخلفية */}
        <NotificationListener />

        {/* الـ Header سيظهر في كل الصفحات */}
        <Header />

        {/* محتوى الصفحات المتغير */}
        <main className="flex-grow">
          <Routes>
            
            {/* الصفحة الرئيسية */}
            <Route path="/" element={<Hero />} />

            {/* صفحة وصف الباقات (Pricing) */}
            <Route path="/pricing" element={<PricingDescription />} />

            {/* صفحة تسجيل الدخول */}
            <Route path="/login" element={<LoginPage />} />

            {/* صفحة الداشبورد وحسابي */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/account" element={<MyAccount />} />
            <Route path="/my-account" element={<MyAccount />} />

            {/* بناء السيرة الذاتية وتحليل المسار */}
            <Route path="/build" element={<BuilderPage />} />
            <Route path="/builder" element={<BuilderPage />} />
            <Route path="/analyse" element={<CareerAnalysis />} />
            <Route path="/career-analysis" element={<CareerAnalysis />} />

            {/* صفحة الخطط والوصول للباقة */}
            <Route path="/plans" element={<PlansPage />} />
            <Route path="/package-access" element={<PackageAccess />} />

            {/* --- نظام روابط التوظيف المخصص حسب الباقة --- */}
            <Route path="/free-links" element={<FreeLinks />} />
            <Route path="/premium-links" element={<PremiumLinks />} />
            <Route path="/gold-links" element={<GoldLinks />} />
            <Route path="/analysis-links" element={<AnalysisLinks />} />
            
            {/* للرجوع الخلفي (Backward Compatibility) */}
            <Route path="/employer-links" element={<AnalysisLinks />} /> 

            {/* الصفحات القانونية */}
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />

            {/* صفحة النجاح بعد الدفع */}
            <Route path="/success" element={<SuccessPage />} />

            <Route path="/contact" element={<ContactPage />} />
            <Route path="/profile" element={<Profile />} />

            {/* FIXED: إضافة Route لأي مسار غير معرف ليعرض صفحة 404 */}
            <Route path="*" element={<NotFound />} />
            

          </Routes>
        </main>

        {/* الـ Footer سيظهر في أسفل كل الصفحات */}
        <Footer />

        {/* الإشعارات - FIXED: شلنا الـ Toaster التاني اللي كان بـ MyAccount (حسب نصيحة كلوود) */}
        {/* هيدا الـ Toaster هون بيكفي لكل المشروع */}
        <Toaster position="top-center" richColors closeButton />
      </div>
    </Router>
  );
}
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";

// استيراد مكونات الصفحة الرئيسية
import Hero from "./components/Hero";
import PricingCard from "./components/PricingCard";
import Footer from "./components/Footer";

// استيراد الصفحات الأخرى
import PlansPage from "./components/PlansPage";
import PremiumLinks from "./PremiumLinks"; 
import GoldLinks from "./GoldLinks"; 
import SuccessPage from "./components/SuccessPage";
import LoginPage from "./components/LoginPage";
import Dashboard from "./components/Dashboard";
import BuilderPage from "./components/BuilderPage"; // <--- 1. استيراد صفحة البيلدر

export default function App() {
  return (
    <Router>
      <div className="min-h-screen">
        <Routes>
          
          {/* الصفحة الرئيسية */}
          <Route path="/" element={
            <div className="bg-gradient-to-b from-slate-50 to-white">
              <Hero />
              <PricingCard />
              <Footer />
            </div>
          } />

          {/* صفحة تسجيل الدخول */}
          <Route path="/login" element={<LoginPage />} />

          {/* صفحة الداشبورد (لوحة التحكم) */}
          <Route path="/dashboard" element={<Dashboard />} />

          {/* صفحة بناء السيرة الذاتية (الفورم) */}
          <Route path="/builder" element={<BuilderPage />} /> {/* <--- 2. المسار الجديد */}

          {/* صفحة اختيار الخطط */}
          <Route path="/plans" element={<PlansPage />} />

          {/* الصفحات المخفية */}
          <Route path="/premium-links" element={<PremiumLinks />} />
          <Route path="/gold-links" element={<GoldLinks />} />

          {/* صفحة النجاح بعد الدفع */}
          <Route path="/success" element={<SuccessPage />} />

        </Routes>

        <Toaster />
      </div>
    </Router>
  );
}
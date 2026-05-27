import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { LanguageProvider } from "./context/LanguageContext";
import { SidebarProvider } from "./context/SidebarContext";

import Header from "./components/Header";
import Footer from "./components/Footer";
import SidebarLayout from "./components/SidebarLayout";
import NotificationListener from "./components/NotificationListener";
import ScrollToTop from "./components/ScrollToTop";

import Hero from "./components/Hero";
import LoginPage from "./components/LoginPage";
import Dashboard from "./components/Dashboard";
import MyAccount from "./components/MyAccount";
import ResumeForm from "./components/ResumeForm";
import PlansPage from "./components/PlansPage";
import PackageAccess from "./components/PackageAccess";
import PricingDescription from "./components/PricingDescription";
import CareerAnalysis from "./components/CareerAnalysis";
import SuccessPage from "./components/SuccessPage";
import ContactPage from "./components/ContactPage";
import PrivateProfile from "./pages/PrivateProfile";
import PublicProfile from "./pages/PublicProfile";
import Terms from "./components/Terms";
import Privacy from "./components/Privacy";
import AboutPage from "./components/AboutPage";
import ProtectedRoute from "./components/ProtectedRoute";
import BuildingPage from "./components/BuildingPage";
import GoodbyePage from "./components/GoodbyePage";

import FreeLinks from "./FreeLinks";
import PremiumLinks from "./PremiumLinks";
import GoldLinks from "./GoldLinks";
import AnalysisLinks from "./AnalysisLinks";

// Pages that use the Sidebar — Footer hidden on these
const SIDEBAR_PATHS = ["/dashboard", "/my-account", "/account", "/analyse", "/career-analysis", "/profile"];

function ConditionalFooter() {
  const { pathname } = useLocation();
  if (SIDEBAR_PATHS.includes(pathname)) return null;
  return <Footer />;
}

const NotFound = () => {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") || params.get("error_code")) {
      window.location.replace("/login" + window.location.search);
    }
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h1 className="text-6xl font-black text-cyber-cyan mb-4">404</h1>
      <p className="text-xl text-cyber-dim mb-8">عذراً، هذه الصفحة غير موجودة.</p>
      <a href="/" className="bg-cyber-teal text-white px-6 py-2 rounded-lg font-bold hover:bg-cyber-cyan transition-colors">
        العودة للرئيسية
      </a>
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <LanguageProvider>
        <SidebarProvider>
        <div className="flex flex-col min-h-screen bg-cyber-bg">

          <ScrollToTop />
          <NotificationListener />
          <Header />

          {/* pt-20 = 80px — clears the floating header (fixed top-4 + h-16) for all pages.
              Hero.tsx compensates with -mt-20 so its full-bleed image still covers y=0. */}
          <main className="flex-grow pt-20">
            <Routes>

              {/* ══ PUBLIC ══ */}
              <Route path="/"          element={<Hero />} />
              <Route path="/pricing"   element={<PricingDescription />} />
              <Route path="/login"     element={<LoginPage />} />
              <Route path="/terms"     element={<Terms />} />
              <Route path="/privacy"   element={<Privacy />} />
              <Route path="/about"     element={<AboutPage />} />
              <Route path="/contact"   element={<ContactPage />} />
              <Route path="/goodbye"   element={<GoodbyePage />} />
              <Route path="/u/:username" element={<PublicProfile />} />

              {/* ══ PROTECTED — Sidebar ══ */}
              <Route path="/dashboard" element={
                <ProtectedRoute><SidebarLayout><Dashboard /></SidebarLayout></ProtectedRoute>
              }/>
              <Route path="/account" element={
                <ProtectedRoute><SidebarLayout><MyAccount /></SidebarLayout></ProtectedRoute>
              }/>
              <Route path="/my-account" element={
                <ProtectedRoute><SidebarLayout><MyAccount /></SidebarLayout></ProtectedRoute>
              }/>
              <Route path="/analyse" element={
                <ProtectedRoute><SidebarLayout><CareerAnalysis /></SidebarLayout></ProtectedRoute>
              }/>
              <Route path="/career-analysis" element={
                <ProtectedRoute><SidebarLayout><CareerAnalysis /></SidebarLayout></ProtectedRoute>
              }/>
              <Route path="/profile" element={
                <ProtectedRoute><SidebarLayout><PrivateProfile /></SidebarLayout></ProtectedRoute>
              }/>

              {/* ══ PROTECTED — Full screen ══ */}
              <Route path="/build"          element={<ProtectedRoute><ResumeForm /></ProtectedRoute>} />
              <Route path="/build/:id"      element={<ProtectedRoute><ResumeForm /></ProtectedRoute>} />
              <Route path="/builder"        element={<ProtectedRoute><ResumeForm /></ProtectedRoute>} />
              <Route path="/resume-builder" element={<ProtectedRoute><ResumeForm /></ProtectedRoute>} />
              <Route path="/plans"          element={<ProtectedRoute><PlansPage /></ProtectedRoute>} />
              <Route path="/building"      element={<ProtectedRoute><BuildingPage /></ProtectedRoute>} />
              <Route path="/package-access" element={<ProtectedRoute><PackageAccess /></ProtectedRoute>} />
              <Route path="/success"        element={<ProtectedRoute><SuccessPage /></ProtectedRoute>} />
              <Route path="/free-links"     element={<ProtectedRoute><FreeLinks /></ProtectedRoute>} />
              <Route path="/premium-links"  element={<ProtectedRoute><PremiumLinks /></ProtectedRoute>} />
              <Route path="/gold-links"     element={<ProtectedRoute><GoldLinks /></ProtectedRoute>} />
              <Route path="/analysis-links" element={<ProtectedRoute><AnalysisLinks /></ProtectedRoute>} />
              <Route path="/employer-links" element={<ProtectedRoute><AnalysisLinks /></ProtectedRoute>} />

              <Route path="*" element={<NotFound />} />

            </Routes>
          </main>

          <ConditionalFooter />
          <Toaster position="top-center" richColors closeButton />

        </div>
        </SidebarProvider>
      </LanguageProvider>
    </Router>
  );
}

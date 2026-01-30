import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

export default function PlansPage() {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null); 
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // 👇 الروابط التي أرسلتها لي (تم وضعها هنا)
  const PREMIUM_LINK = "https://accept.paymobsolutions.com/standalone?ref=p_LRR2djFVeWg0SWhkQzY2dnM3WGQxOFl6Zz09X05IeWQra29pd29zUXRTRHF5QkpxMWc9PQ";
  const GOLD_LINK = "https://accept.paymobsolutions.com/standalone?ref=p_LRR2U0d0ZklEUlIxZUwweWZhUVRGdDVqZz09X1hhTCtGYWhhK1pOSmVyb0pZVFE1dXc9PQ";

  useEffect(() => {
    // 1. التقاط الـ Submission ID من الرابط
    const params = new URLSearchParams(window.location.search);
    const idFromUrl = params.get("id");
    if (idFromUrl) setSubmissionId(idFromUrl);

    // 2. التحقق من المستخدم
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email) {
          setUserEmail(session.user.email);
        } else {
          navigate("/login"); 
        }
      } catch (error) {
        console.error("Auth Error:", error);
      } finally {
        setIsCheckingAuth(false);
      }
    };
    checkUser();
  }, [navigate]);

  // --- معالجة الدفع باستخدام الروابط الجاهزة ---
  const handlePaidPlan = async (plan: "premium" | "gold") => {
    if (!userEmail) return;
    setLoading(plan);

    const finalSid = submissionId || "NO_ID";
    
    // 1. تسجيل المحاولة في Make.com (اختياري)
    try {
        await fetch("https://hook.eu1.make.com/h4lv8gnzsdsd8yhffq96pzc6ppkrjcu6", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                sid: finalSid,
                plan: plan,
                email: userEmail
            }),
        });
    } catch (err) { console.warn("Make log failed", err); }

    // 2. التوجيه لرابط الدفع مع إضافة المعرف
    try {
        // نختار الرابط المناسب بناءً على الزر الذي ضغطه المستخدم
        const baseLink = plan === 'premium' ? PREMIUM_LINK : GOLD_LINK;

        // نصنع كود خاص يحتوي على اسم الباقة لتقرأه صفحة النجاح
        // النتيجة: ORDER_GOLD_user@email.com_123456
        const uniqueOrderId = `ORDER_${plan.toUpperCase()}_${userEmail}_${Date.now()}`;
        
        // دمج الرابط مع المعرف
        // النتيجة: https://paymob...?ref=...&merchant_order_id=ORDER_GOLD_...
        window.location.href = `${baseLink}&merchant_order_id=${uniqueOrderId}`;

    } catch (error) {
      alert("Payment Error. Please try again.");
      setLoading(null);
    }
  };

  // --- الباقة المجانية ---
  const handleFreePlan = async () => {
      if (!userEmail) return;
      setLoading('free');
      const finalSid = submissionId || userEmail;

      try {
        await fetch("https://hook.eu1.make.com/kptr5xyjzxxz1au9oolg9fmv4lds3i1p", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: finalSid, email: userEmail, plan: "free" }),
        });
      } catch (e) { console.warn("Webhook error", e); } 
      finally {
          setLoading(null);
          navigate('/employers'); 
      }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50">
        <Loader2 className="animate-spin w-10 h-10 text-blue-600"/>
        <p className="text-slate-500 font-medium">Verifying account...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-20 px-4 font-sans text-center">
      <h1 className="text-4xl font-bold text-slate-900 mb-4">Choose Your Path 🚀</h1>
      
      <p className="text-slate-600 mb-10">
        Account: <span className="font-mono bg-blue-100 px-2 py-1 rounded text-blue-900 font-bold">{userEmail}</span>
      </p>

      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          
          {/* Free Plan */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition">
            <h3 className="text-xl font-bold text-slate-900">Free Trial</h3>
            <div className="my-4"><span className="text-4xl font-bold">Free</span></div>
            <p className="text-slate-500 text-sm mb-6">Test our AI capabilities</p>
            <ul className="space-y-3 mb-8 text-left text-sm text-slate-600">
              <li className="flex gap-2"><Check className="w-4 h-4 text-green-500"/> Professional Summary</li>
              <li className="flex gap-2 text-slate-400"><Check className="w-4 h-4"/> Full CV (Locked)</li>
            </ul>
            <button 
                onClick={handleFreePlan}
                disabled={loading !== null}
                className="w-full py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition flex justify-center items-center gap-2"
            >
              {loading === 'free' ? <Loader2 className="animate-spin w-5 h-5"/> : "Get Summary Only"}
            </button>
          </div>

          {/* Premium Plan (1$) */}
          <div className="bg-blue-600 p-8 rounded-2xl shadow-xl border border-blue-600 transform scale-105 relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-yellow-400 text-blue-900 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide">Most Popular</div>
            <h3 className="text-xl font-bold text-white">Premium</h3>
            <div className="my-4 text-white"><span className="text-5xl font-bold">50EGP</span></div>
            <p className="text-blue-100 text-sm mb-6">Full Access + Top Companies</p>
            <ul className="space-y-3 mb-8 text-left text-sm text-blue-50">
              <li className="flex gap-2"><Check className="w-4 h-4 text-yellow-400"/> Full ATS-Friendly CV</li>
              <li className="flex gap-2"><Check className="w-4 h-4 text-yellow-400"/> PDF Download</li>
            </ul>
            <button 
                onClick={() => handlePaidPlan('premium')}
                disabled={loading !== null}
                className="w-full py-3 bg-white text-blue-600 font-bold rounded-xl hover:bg-gray-50 transition shadow-lg flex justify-center items-center gap-2"
            >
                {loading === 'premium' ? <Loader2 className="animate-spin w-5 h-5"/> : "Unlock Full CV"}
            </button>
          </div>

          {/* Gold Plan (5$) */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition">
            <h3 className="text-xl font-bold text-slate-900">Gold</h3>
            <div className="my-4"><span className="text-4xl font-bold">250EGP</span></div>
            <p className="text-slate-500 text-sm mb-6">Complete Career Package</p>
            <ul className="space-y-3 mb-8 text-left text-sm text-slate-600">
              <li className="flex gap-2"><Check className="w-4 h-4 text-green-500"/> Full ATS CV</li>
              <li className="flex gap-2"><Check className="w-4 h-4 text-green-500"/> Cover Letter</li>
            </ul>
            <button 
                onClick={() => handlePaidPlan('gold')}
                disabled={loading !== null}
                className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition flex justify-center items-center gap-2"
            >
               {loading === 'gold' ? <Loader2 className="animate-spin w-5 h-5"/> : "Get Gold Package"}
            </button>
          </div>

      </div>
    </div>
  );
}
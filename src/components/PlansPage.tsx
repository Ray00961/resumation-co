import { useEffect, useState } from "react";
import { Loader2, Globe, Gift, Star, Crown, Activity, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import Cookies from "js-cookie";
import { motion } from "framer-motion";

export default function PlansPage() {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [oldSubmissionId, setOldSubmissionId] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [userRegion, setUserRegion] = useState<string>(Cookies.get("user_region") || "LB");

  const PREMIUM_LINK_EGY = "https://accept.paymobsolutions.com/standalone?ref=p_LRR2djFVeWg0SWhkQzY2dnM3WGQxOFl6Zz09X05IeWQra29pd29zUXRTRHF5QkpxMWc9PQ";
  const GOLD_LINK_EGY    = "https://accept.paymobsolutions.com/standalone?ref=p_LRR2U0d0ZklEUlIxZUwweWZhUVRGdDVqZz09X1hhTCtGYWhhK1pOSmVyb0pZVFE1dXc9PQ";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idFromUrl = params.get("id");
    if (idFromUrl) setSubmissionId(idFromUrl);
    const oldSubFromUrl = params.get("old_sub");
    if (oldSubFromUrl) setOldSubmissionId(oldSubFromUrl);

    const initializePage = async () => {
      try {
        if (!Cookies.get("user_region")) {
          try {
            const res = await fetch('https://ipapi.co/json/');
            const data = await res.json();
            const detected = data.country_code === 'EG' ? 'EG' : 'LB';
            Cookies.set("user_region", detected, { expires: 7 });
            setUserRegion(detected);
          } catch (e) {
            console.warn("Region detection fallback to LB");
          }
        }
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserId(user.id);
          setUserEmail(user.email || "");
          setUserName(user.user_metadata?.full_name || "User");
        } else {
          navigate("/login");
        }
      } catch (error) {
        console.error("Initialization error:", error);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    initializePage();
  }, [navigate]);

  const handlePaidPlan = async (plan: "premium" | "gold") => {
    if (!userEmail || !userId) return;
    const PRE_PAYMENT_WEBHOOK = import.meta.env.VITE_MAKE_PRE_PAYMENT;
    if (!PRE_PAYMENT_WEBHOOK) { console.error("Pre-payment configuration missing"); return; }

    setLoading(plan);
    const isEgypt = userRegion === "EG";
    const finalSid = submissionId || "NO_ID";
    const amount   = isEgypt ? (plan === 'premium' ? 50 : 250) : (plan === 'premium' ? 2 : 5);
    const currency = isEgypt ? "EGP" : "USD";

    try {
      const response = await fetch(PRE_PAYMENT_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId, email: userEmail, full_name: userName,
          payment_id: finalSid, old_sub: oldSubmissionId || null,
          plan, region: userRegion, amount, currency
        }),
      });

      if (isEgypt) {
        const customIdentifier = `${userId}---${finalSid}`;
        const baseLink = plan === 'premium' ? PREMIUM_LINK_EGY : GOLD_LINK_EGY;
        const paymobUrl = baseLink
          + `&billing_data[first_name]=${encodeURIComponent(userName || 'User')}`
          + `&billing_data[last_name]=Customer`
          + `&billing_data[email]=${encodeURIComponent(userEmail)}`
          + `&billing_data[phone_number]=01111111111`
          + `&billing_data[street]=${encodeURIComponent(customIdentifier)}`
          + `&merchant_order_id=${encodeURIComponent(customIdentifier)}`;
        window.location.href = paymobUrl;
      } else {
        const result = await response.json();
        const collectUrl = result?.collectUrl || result?.data?.collectUrl || result?.url || result?.paymentUrl;
        if (collectUrl) {
          let finalUrl = collectUrl.trim();
          if (!finalUrl.startsWith('http')) finalUrl = `https://${finalUrl}`;
          window.location.replace(finalUrl);
        } else {
          alert("Payment link error. Please try again.");
        }
      }
    } catch (err) {
      console.warn("Connection error:", err);
    } finally {
      setLoading(null);
    }
  };

  const handleFreePlan = async () => {
    if (!userEmail) return;
    const FREE_TRIAL_WEBHOOK = import.meta.env.VITE_MAKE_FREE_TRIAL;
    if (!FREE_TRIAL_WEBHOOK) { navigate('/package-access'); return; }

    setLoading('free');
    try {
      await fetch(FREE_TRIAL_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: submissionId || userEmail, old_sub: oldSubmissionId || null,
          email: userEmail, plan: "free", region: userRegion
        }),
      });
    } catch (e) {
      console.warn("Webhook error", e);
    } finally {
      setLoading(null);
      navigate('/package-access');
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-cyber-bg">
        <Loader2 className="animate-spin w-10 h-10 text-cyber-cyan" />
        <p className="text-cyber-dim font-black uppercase tracking-[0.3em] mt-4 text-[10px]">Verifying Protocol & Zone...</p>
      </div>
    );
  }

  const isEgypt = userRegion === "EG";

  return (
    <div className="min-h-screen bg-cyber-bg py-24 px-6 font-sans relative overflow-hidden text-center">

      <div className="absolute top-0 right-0 w-[60vw] h-[60vw] bg-cyber-teal/6 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[50vw] h-[50vw] bg-cyber-cyan/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto">

        <div className="mb-12 inline-flex items-center gap-3 bg-cyber-teal/10 backdrop-blur-md px-6 py-2.5 rounded-full border border-cyber-teal/20 shadow-[0_0_20px_rgba(13,138,158,0.1)]">
          <Globe className="w-4 h-4 text-cyber-cyan" />
          <span className="text-[10px] font-black text-cyber-cyan uppercase tracking-[0.2em]">
            Deployment Zone: {isEgypt ? "Egypt Node 🇪🇬 (EGP)" : "International Node 🌐 (USD)"}
          </span>
        </div>

        <h1 className="text-4xl lg:text-6xl font-black text-white mb-4 uppercase tracking-tighter">
          Choose Your <span className="text-cyber-cyan">Path</span> 🚀
        </h1>

        <div className="flex items-center justify-center gap-2 mb-16 text-cyber-dim">
          <Activity className="w-4 h-4 text-cyber-teal/50" />
          <p className="text-xs font-bold uppercase tracking-widest">
            Linked Entity: <span className="text-white">{userEmail}</span>
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto items-center">

          {/* Free */}
          <div className="bg-cyber-teal/8 backdrop-blur-xl p-10 rounded-[2.5rem] border border-white/8 hover:border-cyber-teal/20 transition-all duration-300 flex flex-col min-h-[450px] justify-between">
            <div>
              <Gift className="w-10 h-10 text-cyber-dim mb-6 mx-auto" />
              <h3 className="text-xl font-black text-white uppercase tracking-tight">Free Trial</h3>
              <p className="text-[10px] font-bold text-cyber-dim uppercase tracking-widest mt-2">Initial Intelligence Summary</p>
              <div className="my-10 font-black text-4xl text-white tracking-tighter italic opacity-50">FREE</div>
            </div>
            <button
              onClick={handleFreePlan}
              disabled={loading !== null}
              className="w-full py-4 bg-white/5 border border-white/10 text-cyber-muted rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white hover:text-black transition-all"
            >
              {loading === 'free' ? <Loader2 className="animate-spin mx-auto w-5 h-5" /> : "Initialize Summary"}
            </button>
          </div>

          {/* Premium */}
          <div className="relative bg-cyber-teal/15 backdrop-blur-2xl p-10 lg:p-12 rounded-[3rem] border border-cyber-teal/35 transform lg:scale-110 shadow-[0_0_50px_rgba(13,138,158,0.18)] flex flex-col min-h-[500px] justify-between">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-cyber-teal text-white px-6 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl">
              Most Integrated
            </div>
            <div>
              <Star className="w-12 h-12 text-cyber-cyan mb-6 mx-auto drop-shadow-[0_0_10px_rgba(18,178,193,0.5)]" />
              <h3 className="text-2xl font-black text-white uppercase tracking-tight">Premium</h3>
              <p className="text-[10px] font-black text-cyber-cyan/60 uppercase tracking-[0.2em] mt-2">Complete Neural CV Build</p>
              <div className="my-10 text-6xl font-black text-white tracking-tighter italic">
                {isEgypt ? "50" : "2"}<span className="text-xs ml-2 opacity-50">{isEgypt ? "EGP" : "USD"}</span>
              </div>
            </div>
            <button
              onClick={() => handlePaidPlan('premium')}
              disabled={loading !== null}
              className="w-full py-5 bg-cyber-teal text-white font-black rounded-2xl shadow-[0_0_25px_rgba(13,138,158,0.4)] flex justify-center items-center gap-3 hover:bg-cyber-cyan transition-all uppercase text-xs tracking-widest"
            >
              {loading === 'premium' ? <Loader2 className="animate-spin w-5 h-5" /> : <>Unlock Full CV <ArrowRight size={16} /></>}
            </button>
          </div>

          {/* Gold */}
          <div className="bg-cyber-teal/8 backdrop-blur-xl p-10 rounded-[2.5rem] border border-white/8 hover:border-cyber-cyan/20 transition-all duration-300 flex flex-col min-h-[450px] justify-between">
            <div>
              <Crown className="w-10 h-10 text-cyber-cyan mb-6 mx-auto" />
              <h3 className="text-xl font-black text-white uppercase tracking-tight">Gold Package</h3>
              <p className="text-[10px] font-bold text-cyber-dim uppercase tracking-widest mt-2">Full Application Suite</p>
              <div className="my-10 text-4xl font-black text-white tracking-tighter italic">
                {isEgypt ? "250" : "5"}<span className="text-xs ml-2 opacity-50">{isEgypt ? "EGP" : "USD"}</span>
              </div>
            </div>
            <button
              onClick={() => handlePaidPlan('gold')}
              disabled={loading !== null}
              className="w-full py-4 bg-cyber-cyan/10 border border-cyber-cyan/30 text-cyber-cyan rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-cyber-teal hover:text-white transition-all"
            >
              {loading === 'gold' ? <Loader2 className="animate-spin w-5 h-5" /> : "Deploy Gold Protocol"}
            </button>
          </div>

        </div>

        <div className="mt-24 flex justify-center items-center gap-10 opacity-30 grayscale pointer-events-none">
          <div className="flex items-center gap-2"><Star size={14} /> <span className="text-[9px] font-black uppercase tracking-widest">Secure Checkout Architecture</span></div>
          <div className="flex items-center gap-2"><Gift size={14} /> <span className="text-[9px] font-black uppercase tracking-widest">Instant Node Activation</span></div>
        </div>

      </div>
    </div>
  );
}

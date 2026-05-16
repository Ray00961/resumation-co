import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, Loader2, ArrowRight, Mail, Hash, FileText, Activity, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "../supabase";

export default function SuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [planName, setPlanName] = useState("Premium Package");
  const [currentUser, setCurrentUser] = useState<{id: string, email: string, sid?: string} | null>(null);

  const paymobOrderId = searchParams.get("order") || searchParams.get("id");
  const merchantRef = searchParams.get("merchant_order_id") || "";
  const amountCents = searchParams.get("amount_cents");

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const { data: userData } = await supabase
          .from('users')
          .select('submission_id')
          .eq('id', session.user.id)
          .single();

        setCurrentUser({
          id: session.user.id,
          email: session.user.email || "",
          sid: userData?.submission_id || "NOT_FOUND"
        });
      } else {
        navigate("/login");
      }

      if (merchantRef.includes("GOLD") || amountCents === "25000") {
        setPlanName("Gold Package");
      } else {
        setPlanName("Premium Package");
      }
    };
    fetchData();
  }, [merchantRef, amountCents, navigate]);

  const handleGetPackage = async () => {
    if (!currentUser) return;
    setLoading(true);

    const webhookUrl = "https://hook.eu1.make.com/w1nmxyrd786vy4pv8exdba5vy58i1mnm";
    const detectedPlan = planName.toLowerCase().includes("gold") ? "gold" : "premium";

    try {
      const { error } = await supabase
        .from('users')
        .update({
          selected_plan: detectedPlan,
          payment_status: true
        })
        .eq('id', currentUser.id);

      if (error) throw error;

      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: currentUser.id,
          login_email: currentUser.email,
          submission_id: currentUser.sid,
          paymob_order_id: paymobOrderId,
          plan: detectedPlan,
          amount: amountCents,
          status: "confirmed"
        }),
      });

      setTimeout(() => navigate("/package-access"), 1500);
    } catch (error) {
      console.error("Update Error:", error);
      navigate("/package-access");
    }
  };

  return (
    <div className="min-h-screen bg-cyber-bg flex items-center justify-center p-6 font-sans relative overflow-hidden">

      <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[40vw] h-[40vw] bg-cyber-teal/5 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[rgba(35,113,123,0.12)] backdrop-blur-2xl p-10 rounded-[2.5rem] border border-emerald-500/20 max-w-md w-full text-center shadow-2xl relative"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />

        {!loading ? (
          <>
            <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </div>

            <h1 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Protocol <span className="text-emerald-400">Verified</span></h1>
            <div className="flex items-center justify-center gap-2 mb-8">
              <Activity className="w-3 h-3 text-emerald-500 animate-pulse" />
              <span className="text-[10px] font-black text-cyber-dim uppercase tracking-[0.3em]">Transaction Secured</span>
            </div>

            <div className="bg-[rgba(31,43,45,0.6)] rounded-2xl p-6 mb-10 text-left border border-white/5 space-y-5">
              <div className="flex items-start gap-4 border-b border-white/5 pb-4">
                <Mail className="w-4 h-4 text-cyber-cyan mt-1" />
                <div className="overflow-hidden">
                  <p className="text-[9px] uppercase text-cyber-dim font-black tracking-widest mb-1">Entity Linked</p>
                  <p className="text-sm font-bold text-slate-200 truncate">{currentUser?.email}</p>
                </div>
              </div>

              <div className="flex items-start gap-4 border-b border-white/5 pb-4">
                <FileText className="w-4 h-4 text-emerald-400 mt-1" />
                <div>
                  <p className="text-[9px] uppercase text-cyber-dim font-black tracking-widest mb-1">Trace ID (SID)</p>
                  <p className="text-sm font-black text-white tracking-widest">{currentUser?.sid}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <Hash className="w-4 h-4 text-cyber-cyan mt-1" />
                <div>
                  <p className="text-[9px] uppercase text-cyber-dim font-black tracking-widest mb-1">Payment Hash</p>
                  <p className="text-sm font-bold text-cyber-cyan font-mono tracking-tighter">{paymobOrderId}</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleGetPackage}
              className="w-full py-5 bg-emerald-600 text-white font-black rounded-2xl flex items-center justify-center gap-3 uppercase text-xs tracking-widest hover:bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all"
            >
              Initialize Deployment <ArrowRight className="w-4 h-4" />
            </button>

            <div className="mt-8 flex items-center justify-center gap-2 opacity-30 grayscale pointer-events-none">
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              <span className="text-[8px] font-black uppercase tracking-[0.3em] text-white">System Sync in Progress</span>
            </div>
          </>
        ) : (
          <div className="py-20 text-center">
            <Loader2 className="w-12 h-12 animate-spin text-cyber-cyan mx-auto mb-6 shadow-[0_0_20px_rgba(13,138,158,0.1)]" />
            <p className="text-cyber-cyan font-black uppercase tracking-[0.4em] text-[10px]">Updating Carrier Nodes...</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}

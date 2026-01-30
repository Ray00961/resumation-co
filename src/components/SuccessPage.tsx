import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, Loader2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function SuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [loading, setLoading] = useState(false);
  const [targetPath, setTargetPath] = useState("/premium-links"); 
  const [planName, setPlanName] = useState("Premium Package");

  // paymobId: الرقم القصير (397601250) -> هذا اللي رح نبعته للويب هوك
  const paymobId = searchParams.get("id") || searchParams.get("order"); 
  
  // merchantRef: الرقم الطويل (ORDER_GOLD_...) -> هذا بس عشان نعرف نوجه الزبون وين يروح
  const merchantRef = searchParams.get("merchant_order_id") || "";
  const amountCents = searchParams.get("amount_cents"); 

  useEffect(() => {
    // هذا الكود فقط لتحديد الوجهة (Gold ولا Premium)
    // لا يؤثر على الويب هوك
    if (amountCents === "25000" || merchantRef.includes("GOLD")) {
      setTargetPath("/gold-links");
      setPlanName("Gold Package");
    } else if (amountCents === "5000" || merchantRef.includes("PREMIUM")) {
      setTargetPath("/premium-links");
      setPlanName("Premium Package");
    } else {
      setTargetPath("/premium-links");
      setPlanName("Premium Package");
    }
  }, [merchantRef, amountCents]);

  const handleGetPackage = async () => {
    setLoading(true);

    const webhookUrl = "https://hook.eu1.make.com/w1nmxyrd786vy4pv8exdba5vy58i1mnm";

    try {
      if (paymobId || merchantRef) {
          await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              // ✅ رجعنا order_id ليكون رقم Paymob القصير عشان ما يخرب شغلك في Make
              order_id: paymobId, 
              
              // أرسلت الـ merchantRef في خانة جديدة اسمها ref_id (اختياري) لو احتجتها مستقبلاً، ما بتأثر عالحالية
              ref_id: merchantRef,

              amount: amountCents,
              status: "confirmed",
              source: "resumation_success_page"
            }),
          });
      }
      
      setTimeout(() => {
        navigate(`${targetPath}?paid=true`); 
      }, 2000);

    } catch (error) {
      console.error("Connection Error:", error);
      navigate(`${targetPath}?paid=true`); 
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-slate-100">
        
        {!loading ? (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Payment Verified ✅</h1>
            <p className="text-slate-500 mb-8">
              You have secured the <span className="font-bold text-slate-900">{planName}</span>.
            </p>

            <button
              onClick={handleGetPackage}
              className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-lg hover:shadow-xl flex items-center justify-center gap-2 group"
            >
              Get your package now <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform"/>
            </button>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-10">
            <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                <Loader2 className="absolute inset-0 m-auto w-8 h-8 text-blue-600 animate-pulse" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Processing Your Request...</h2>
            <p className="text-slate-500 text-sm animate-pulse">
              Unlocking employer database...
            </p>
          </motion.div>
        )}

      </div>
    </div>
  );
}
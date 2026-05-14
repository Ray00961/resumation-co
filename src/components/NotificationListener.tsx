import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { toast } from "sonner";
import { RealtimeChannel } from "@supabase/supabase-js";
import { Zap, ShieldCheck } from "lucide-react";

export default function NotificationListener() {
  const navigate = useNavigate();

  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    const subscribeToNotifications = (userId: string) => {
      if (channel) {
        supabase.removeChannel(channel);
      }

      console.log("🔌 [SYSTEM] Initializing Realtime Link for Node:", userId);

      channel = supabase
        .channel(`user-notifications-${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*', 
            schema: 'public',
            table: 'cv_archive',
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            console.log("🔥 [EVENT] Data Stream Injected:", payload);
            
            const newDoc = payload.new as any;
            
            // التحقق من جهوزية الملف
            if (newDoc && newDoc.cv_pdf_url) {
               console.log("✅ [SUCCESS] Neural Construction Complete!");
               
               // 1. إرسال الإشارة لصفحة التحميل (Custom Event)
               window.dispatchEvent(new CustomEvent('cv_ready_signal', { 
                 detail: { url: newDoc.cv_pdf_url } 
               }));

               // 2. إظهار الإشعار بستايل Cyber
               toast.success("Construction Complete 🚀", {
                 id: `cv-ready-${newDoc.id || 'unique'}`,
                 description: "Your professional document has been generated and is ready for deployment.",
                 duration: 10000,
                 style: {
                    background: '#0A1324',
                    color: '#fff',
                    border: '1px solid rgba(6, 182, 212, 0.3)',
                    borderRadius: '16px',
                 },
                 action: {
                   label: "Access Archive",
                   onClick: () => navigate("/account"),
                 },
               });
            }
          }
        )
        .subscribe((status) => {
           if (status === 'SUBSCRIBED') {
             console.log("📡 [STATUS] Link Established: Secure Node", userId);
           }
        });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user?.id) {
        subscribeToNotifications(session.user.id);
      } else {
        if (channel) {
          supabase.removeChannel(channel);
          channel = null;
        }
      }
    });

    return () => {
      subscription.unsubscribe();
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [navigate]);

  return null;
}
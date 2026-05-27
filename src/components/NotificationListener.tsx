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
            const newDoc = payload.new as any;

            // Defense-in-depth: verify row belongs to current user
            if (!newDoc || newDoc.user_id !== userId) return;

            if (newDoc.cv_pdf_url) {
               // Notify download page
               window.dispatchEvent(new CustomEvent('cv_ready_signal', {
                 detail: { url: newDoc.cv_pdf_url }
               }));

               toast.success("Construction Complete 🚀", {
                 id: `cv-ready-${newDoc.form_id || 'unique'}`,
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
        .subscribe();
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
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "../supabase";

interface Props {
  children: React.ReactNode;
}

/**
 * Wraps any route that requires authentication.
 * - Reads localStorage first (instant, no network)
 * - Falls back to supabase.auth.getSession() if localStorage is empty
 * - Shows a spinner while checking (no flash of protected content)
 * - Redirects to /login if not authenticated
 */
export default function ProtectedRoute({ children }: Props) {
  const navigate  = useNavigate();
  const [checked, setChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const verify = async () => {
      // 1. Fast path — read Supabase session from localStorage
      const lsKey = Object.keys(localStorage).find(
        k => k.startsWith("sb-") && k.endsWith("-auth-token")
      );
      if (lsKey) {
        try {
          const cached = JSON.parse(localStorage.getItem(lsKey) || "null");
          if (cached?.user?.id) {
            setAllowed(true);
            setChecked(true);
            return;
          }
        } catch {}
      }

      // 2. Fallback — ask Supabase (network call)
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setAllowed(true);
          setChecked(true);
          return;
        }
      } catch {}

      // 3. Not authenticated — redirect
      navigate("/login", { replace: true });
    };

    verify();
  }, [navigate]);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D1117]">
        <Loader2 className="w-8 h-8 animate-spin text-[#12B2C1]" />
      </div>
    );
  }

  return allowed ? <>{children}</> : null;
}

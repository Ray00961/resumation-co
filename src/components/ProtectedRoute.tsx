import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "../supabase";

interface Props {
  children: React.ReactNode;
}

function readCachedSupabaseUserId(): string | null {
  const lsKey = Object.keys(localStorage).find(
    k => k.startsWith("sb-") && k.endsWith("-auth-token")
  );

  if (!lsKey) return null;

  try {
    const cached = JSON.parse(localStorage.getItem(lsKey) || "null");

    const userId =
      cached?.user?.id ||
      cached?.session?.user?.id ||
      cached?.currentSession?.user?.id ||
      null;

    const expiresAt =
      cached?.expires_at ||
      cached?.session?.expires_at ||
      cached?.currentSession?.expires_at ||
      null;

    if (!userId) return null;

    // If an expiry exists and is clearly expired, do not trust the fast path.
    if (expiresAt && Number(expiresAt) * 1000 < Date.now() - 60_000) {
      return null;
    }

    return userId;
  } catch {
    return null;
  }
}

async function getSessionWithTimeout(ms = 5000) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      supabase.auth.getSession(),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Wraps any route that requires authentication.
 * - Trusts a valid cached Supabase user first for instant navigation.
 * - Falls back to getSession() with a timeout.
 * - Never leaves the app stuck because Supabase auth storage is locked.
 */
export default function ProtectedRoute({ children }: Props) {
  const navigate  = useNavigate();
  const [checked, setChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const allow = () => {
      if (cancelled) return;
      setAllowed(true);
      setChecked(true);
    };

    const reject = () => {
      if (cancelled) return;
      setAllowed(false);
      setChecked(true);
      navigate("/login", { replace: true });
    };

    const verify = async () => {
      const cachedUserId = readCachedSupabaseUserId();
      if (cachedUserId) {
        allow();
        return;
      }

      try {
        const result: any = await getSessionWithTimeout(5000);
        const session = result?.data?.session;

        if (session?.user?.id) {
          allow();
          return;
        }
      } catch {
        // fall through
      }

      reject();
    };

    verify();

    return () => {
      cancelled = true;
    };
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

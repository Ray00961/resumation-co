import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CheckCircle, Loader2, Mail, FileText,
  Activity, ShieldCheck, Globe, AlignRight,
  BadgeCheck, CreditCard, Tag, Sparkles,
  Clock, XCircle, RefreshCw, LayoutDashboard,
} from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "../supabase";

// ── Plan display labels ────────────────────────────────────────────────────
const PLAN_LABELS: Record<string, string> = {
  premium:   "Premium Lifetime Activation 👑",
  gold:      "Gold Executive Bundle 🏆",
  ai_search: "AI Search Intelligence Pack 🔍",
};

// ── Invoice data shape ─────────────────────────────────────────────────────
interface InvoiceData {
  transactionId:  string;  // platform receipt reference (transaction_id column)
  gatewayVoucher: string;  // wishmoney_order_id or paymob_order_id
  paymentMethod:  string;  // "wishmoney" | "paymob"
  packageName:    string;  // "premium" | "gold" | "ai_search"
}

// ══════════════════════════════════════════════════════════════════════════════
// CANONICAL PAYMENT STATUS — read-only
//
// For orders created by create-payment, this page is DISPLAY ONLY. Payment truth
// is the canonical payment_orders row, which only the signed Paymob webhook and
// the settle_payment_order RPC can change. Nothing here confirms, settles,
// grants or writes anything, and no Paymob redirect parameter (success, pending,
// id, amount, currency, hmac, its numeric order id) is ever treated as truth.
// ══════════════════════════════════════════════════════════════════════════════

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Only columns already granted to `authenticated`. Provider references, the
// checkout secret, customer snapshots and payment evidence are not requested.
const ORDER_FIELDS =
  "id,status,amount_cents,currency,product,market,paid_at,fulfilled_at,expires_at,created_at,updated_at";
const INVOICE_FIELDS = "invoice_number,product_display_name,amount_cents,currency,issued_at";

const POLL_INTERVAL_MS = 2_000;
const POLL_DEADLINE_MS = 60_000;

const NOT_COMPLETED_STATUSES = new Set(["failed", "expired", "cancelled", "refunded"]);

interface CanonicalOrder {
  id:           string;
  status:       string;
  amount_cents: number;
  currency:     string;
  product:      string;
  market:       string;
  paid_at:      string | null;
  fulfilled_at: string | null;
  expires_at:   string;
  created_at:   string;
  updated_at:   string;
}

interface CanonicalInvoice {
  invoice_number:       number;
  product_display_name: string;
  amount_cents:         number;
  currency:             string;
  issued_at:            string;
}

type OrderView =
  | "checking"       // first read in flight
  | "confirming"     // pending — the webhook may still be arriving
  | "paid"           // settled and fulfilled
  | "processing"     // still not final after the polling deadline
  | "not_completed"  // failed / expired / cancelled / refunded
  | "not_found";     // no UUID, unknown UUID, or not this user's order (RLS)

/**
 * One RLS-scoped read through plain REST. supabase.from() is deliberately not
 * used: the shared client can stall on its auth lock and silently return no
 * data, which here would be indistinguishable from "not found".
 * Returns { ok: false } for transport/HTTP failures so the caller can retry.
 */
async function readOwnRows<T>(
  path: string,
  token: string,
  signal: AbortSignal,
): Promise<{ ok: true; rows: T[] } | { ok: false }> {
  const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL as string;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method: "GET",
      headers: {
        apikey:        SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        Accept:        "application/json",
      },
      signal,
    });
    if (!res.ok) return { ok: false };
    const rows = await res.json();
    return { ok: true, rows: Array.isArray(rows) ? (rows as T[]) : [] };
  } catch {
    return { ok: false };
  }
}

function formatMoney(amountCents: number, currency: string): string {
  return `${(amountCents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ${currency}`;
}


function readValidSupabaseAuthFromStorage(): { userId: string; email: string | null; accessToken: string } | null {
  try {
    const key = Object.keys(localStorage).find(k => /^sb-.+-auth-token$/.test(k));
    if (!key) return null;

    console.log("[SuccessPage:localStorage] token found, key:", key);

    const raw = localStorage.getItem(key);
    if (!raw) return null;

    let cached: unknown;
    try {
      cached = JSON.parse(raw);
    } catch (_e) {
      console.warn("[SuccessPage:localStorage] token parse failed — removing key");
      localStorage.removeItem(key);
      return null;
    }

    if (!cached || typeof cached !== "object") {
      console.warn("[SuccessPage:localStorage] token not an object — removing key");
      localStorage.removeItem(key);
      return null;
    }

    const c = cached as Record<string, unknown>;
    let accessToken: string | null = null;
    let user: Record<string, unknown> | null = null;

    if (typeof c.access_token === "string" && c.user && typeof c.user === "object") {
      accessToken = c.access_token;
      user = c.user as Record<string, unknown>;
    } else if (c.session && typeof c.session === "object") {
      const s = c.session as Record<string, unknown>;
      if (typeof s.access_token === "string" && s.user && typeof s.user === "object") {
        accessToken = s.access_token;
        user = s.user as Record<string, unknown>;
      }
    }

    if (!accessToken || !user) {
      console.warn("[SuccessPage:localStorage] token shape unrecognized — removing key");
      localStorage.removeItem(key);
      return null;
    }

    try {
      const parts = accessToken.split(".");
      if (parts.length !== 3) throw new Error("not a JWT");
      const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      const exp = typeof payload.exp === "number" ? payload.exp : null;
      const nowSecs = Math.floor(Date.now() / 1000);

      if (!exp || exp - nowSecs < 60) {
        console.warn("[SuccessPage:localStorage] token expired or expires within 60s — removing key", {
          exp,
          nowSecs,
          diff: exp ? exp - nowSecs : null,
        });
        localStorage.removeItem(key);
        return null;
      }
    } catch (_e) {
      console.warn("[SuccessPage:localStorage] JWT decode failed — removing key");
      localStorage.removeItem(key);
      return null;
    }

    const userId = typeof user.id === "string" ? user.id : null;
    const email = typeof user.email === "string" ? user.email : null;

    if (!userId) {
      console.warn("[SuccessPage:localStorage] token missing user.id — removing key");
      localStorage.removeItem(key);
      return null;
    }

    console.log("[SuccessPage:localStorage] token valid:", { userId, email });
    return { userId, email, accessToken };
  } catch (err) {
    console.warn("[SuccessPage:localStorage] unexpected error reading token:", err);
    return null;
  }
}

export default function SuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [currentUser,       setCurrentUser]       = useState<{ id: string; email: string } | null>(null);
  const [displaySid,        setDisplaySid]        = useState<string>("");
  const [generating,        setGenerating]        = useState<"en" | "ar" | null>(null);
  const [pageLoading,       setPageLoading]       = useState(true);
  const [invoiceData,       setInvoiceData]       = useState<InvoiceData | null>(null);
  // Mirrors gidRef so React re-renders when gid resolves — critical for enabling buttons
  // after the safety timeout fires (pure ref writes don't trigger renders).
  const [resolvedGidState,  setResolvedGidState]  = useState<string>("");
  // ── Canonical payment status (create-payment orders) ──────────────────────
  const [authReady,         setAuthReady]         = useState(false);
  const [orderView,         setOrderView]         = useState<OrderView>("checking");
  const [canonicalOrder,    setCanonicalOrder]    = useState<CanonicalOrder | null>(null);
  const [canonicalInvoice,  setCanonicalInvoice]  = useState<CanonicalInvoice | null>(null);
  // Bumped by the manual "Check again" action to restart polling.
  const [refreshNonce,      setRefreshNonce]      = useState(0);

  // ── URL params ─────────────────────────────────────────────────────────────
  // WishMoney path: /success?gid=<generation_id>&tid=<transaction_id>&plan=<plan>
  // Paymob path:    /success?order=<payment_order UUID>&...Paymob redirect params
  //
  // create-payment sets `order` to our canonical payment_orders UUID, and Paymob
  // appends its OWN `order` (its numeric order id) plus success/pending/amount/
  // hmac/etc. So the URL can carry two `order` values in either order. Only the
  // UUID-shaped one is ours; everything else Paymob appended is ignored.
  const urlGid           = searchParams.get("gid")   || "";
  const urlTid           = searchParams.get("tid")   || "";
  const urlPlan          = searchParams.get("plan")  || "";
  const canonicalOrderId = searchParams.getAll("order").find((v) => UUID_RE.test(v.trim()))?.trim() || "";

  // WishMoney keeps its legacy path untouched. Every other visit is a
  // canonical-status visit — with or without a usable order id.
  const isCanonicalFlow = !urlGid;

  // ── Synchronous refs ───────────────────────────────────────────────────────
  // These are set once in init() and read synchronously by the click handler.
  // gidRef is always kept in sync with resolvedGidState — the ref for synchronous
  // access in the click handler, the state for React re-render triggering.
  const tokenRef  = useRef<string>("");
  const userIdRef = useRef<string>("");
  const gidRef    = useRef<string>(urlGid);  // generation_id PK — primary canonical anchor
  const tidRef    = useRef<string>(urlTid);  // transaction reference
  const planRef   = useRef<string>(urlPlan); // plan tier

  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    // WishMoney: gid is already in the URL — seed state immediately so buttons
    // are enabled as soon as the page loads without waiting for init().
    if (urlGid) setResolvedGidState(urlGid);

    const init = async () => {
      // 12 s safety net — prevents an infinite spinner if auth resolution or
      // the WishMoney receipt read hangs on a slow connection.
      const safetyTimeout = setTimeout(() => setPageLoading(false), 12_000);

      try {
        let authUserId = "";
        let authEmail = "";
        let authToken = "";

        console.log("[SuccessPage:init] start auth resolution");

        const localAuth = readValidSupabaseAuthFromStorage();
        if (localAuth) {
          console.log("[SuccessPage:init] using local token path");
          authUserId = localAuth.userId;
          authEmail = localAuth.email || "";
          authToken = localAuth.accessToken;
        }

        if (!authUserId || !authToken) {
          console.log("[SuccessPage:init] fallback to getSession");

          const sessionResult = await Promise.race([
            supabase.auth.getSession(),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 10_000)),
          ]);

          if (!sessionResult) {
            console.warn("[SuccessPage:init] getSession timed out after 10s");
          }

          const session = sessionResult?.data?.session ?? null;
          console.log("[SuccessPage:init] getSession result:", {
            hasSession: !!session,
            userId: session?.user?.id ?? null,
            email: session?.user?.email ?? null,
            hasAccessToken: !!session?.access_token,
          });

          if (session?.user && session.access_token) {
            authUserId = session.user.id;
            authEmail = session.user.email || "";
            authToken = session.access_token;
          }
        }

        if (!authUserId || !authToken) {
          clearTimeout(safetyTimeout);
          navigate("/login");
          return;
        }

        tokenRef.current  = authToken;
        userIdRef.current = authUserId;
        setCurrentUser({ id: authUserId, email: authEmail });
        // Unlocks the read-only canonical status reader below.
        setAuthReady(true);

        let resolvedGid = "";

        // ════════════════════════════════════════════════════════════════════
        // PATH A — WishMoney
        // gid, tid, and plan all arrive in the URL. The generation row was
        // minted by webhook-wishmoney before the 302 redirect fired.
        // ════════════════════════════════════════════════════════════════════
        if (urlGid) {
          resolvedGid     = urlGid;
          gidRef.current  = urlGid;
          tidRef.current  = urlTid;
          planRef.current = urlPlan || "premium";
          // State already seeded at top of useEffect — this is a no-op re-set.
          setResolvedGidState(urlGid);
        }

        // Paymob orders created by create-payment are NOT handled here. They
        // are read-only canonical-status visits, served by the effect below.
        // The legacy confirm-payment call and the order_generations lookup by
        // paymob_order_id are gone: the browser is not a payment authority.

        // ════════════════════════════════════════════════════════════════════
        // INVOICE DATA FETCH (WishMoney only)
        // Once resolvedGid is known (regardless of path), execute a single
        // authoritative read of order_generations for the invoice display fields.
        // ════════════════════════════════════════════════════════════════════
        if (resolvedGid) {
          try {
            const { data: og } = await supabase
              .from("order_generations")
              .select(
                "submission_id, transaction_id, wishmoney_order_id, " +
                "paymob_order_id, payment_method, package_name"
              )
              .eq("generation_id", resolvedGid)
              .maybeSingle();

            if (og) {
              if (og.submission_id) setDisplaySid(og.submission_id);

              // Gateway voucher: prefer payment-method-specific ID, then fall back
              const gatewayVoucher =
                og.wishmoney_order_id ||
                og.paymob_order_id    ||
                urlTid                ||
                "";

              setInvoiceData({
                transactionId:  og.transaction_id  || urlTid || "",
                gatewayVoucher,
                paymentMethod:  og.payment_method  || (urlGid ? "wishmoney" : "paymob"),
                packageName:    og.package_name    || planRef.current || "premium",
              });

              // Keep planRef in sync with the DB-authoritative value
              if (og.package_name) planRef.current = og.package_name;
            }
          } catch (e) {
            console.error("[SuccessPage] invoice fetch error:", e);
          }
        }

      } finally {
        clearTimeout(safetyTimeout);
        setPageLoading(false);
      }
    };

    init();
  }, []); // run once only

  // ── Canonical payment status reader — READ ONLY ────────────────────────────
  // Polls the user's own payment_orders row (RLS + column grants) until it
  // reaches a final state or the deadline passes. Two plain GETs are the only
  // network calls; nothing here writes. Reload-safe by construction.
  useEffect(() => {
    if (!isCanonicalFlow || !authReady) return;

    if (!canonicalOrderId) {
      // No UUID-shaped order id: never infer success from Paymob's parameters.
      setOrderView("not_found");
      return;
    }

    const token = tokenRef.current;
    const controller = new AbortController();
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const stop = () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };

    const scheduleNext = () => {
      if (stopped) return;
      if (Date.now() - startedAt >= POLL_DEADLINE_MS) {
        setOrderView("processing");
        stop();
        return;
      }
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    const poll = async () => {
      if (stopped) return;

      const orderRes = await readOwnRows<CanonicalOrder>(
        `payment_orders?id=eq.${encodeURIComponent(canonicalOrderId)}&select=${ORDER_FIELDS}`,
        token,
        controller.signal,
      );
      if (stopped) return;

      // Transport/HTTP failure: transient — keep trying until the deadline.
      if (!orderRes.ok) {
        scheduleNext();
        return;
      }

      // RLS makes "someone else's order" and "no such order" identical.
      const order = orderRes.rows[0] ?? null;
      if (!order) {
        setOrderView("not_found");
        stop();
        return;
      }

      setCanonicalOrder(order);

      if (order.status === "paid" && order.fulfilled_at) {
        const invoiceRes = await readOwnRows<CanonicalInvoice>(
          `invoices?payment_order_id=eq.${encodeURIComponent(order.id)}&select=${INVOICE_FIELDS}`,
          token,
          controller.signal,
        );
        if (stopped) return;
        if (invoiceRes.ok) setCanonicalInvoice(invoiceRes.rows[0] ?? null);
        setOrderView("paid");
        stop();
        return;
      }

      if (NOT_COMPLETED_STATUSES.has(order.status)) {
        setOrderView("not_completed");
        stop();
        return;
      }

      // pending (or paid without fulfilment yet): the webhook may still be
      // arriving. Keep reading — never writing.
      setOrderView("confirming");
      scheduleNext();
    };

    setOrderView("checking");
    setCanonicalInvoice(null);
    poll();

    return () => {
      stop();
      controller.abort();
    };
  }, [isCanonicalFlow, authReady, canonicalOrderId, refreshNonce]);

  // ── Language bundle click handler ──────────────────────────────────────────
  // Entirely synchronous up to navigate() — no await on the critical path.
  const handleGenerateBundle = (lang: "en" | "ar") => {
    if (generating) return;

    const activeGid = gidRef.current;
    const token     = tokenRef.current;

    if (!activeGid || !token) {
      console.error("[SuccessPage] Missing generation_id or token — cannot generate");
      return;
    }

    setGenerating(lang);

    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

    // Fire-and-forget: kick off generation.
    // generation_id = Tier-1 PK lookup in generate-cv — always precise, no fallbacks.
    fetch(`${SUPABASE_URL}/functions/v1/generate-cv`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({
        generation_id:    activeGid,
        transaction_id:   tidRef.current,
        selectedLanguage: lang,
      }),
    }).catch(e => console.error("[SuccessPage] generate-cv fire:", e));

    // Navigate immediately — BuildingPage's Realtime subscription handles the wait
    navigate(`/building?gid=${activeGid}&lang=${lang}`);
  };

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (pageLoading) {
    return (
      <div className="min-h-screen bg-cyber-bg flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-cyber-cyan" />
      </div>
    );
  }

  // ── Invoice block ──────────────────────────────────────────────────────────
  const InvoiceDashboard = () => {
    if (!invoiceData) return null;

    const planLabel = PLAN_LABELS[invoiceData.packageName] ?? invoiceData.packageName ?? "Premium Lifetime Activation 👑";
    const gwLabel   = invoiceData.paymentMethod === "wishmoney" ? "Whish Money Voucher Code" : "Paymob Gateway Reference";

    return (
      <div className="mb-8 rounded-2xl overflow-hidden border border-white/[0.06] bg-[rgba(10,18,28,0.7)] backdrop-blur-xl">

        {/* Top accent bar */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />

        <div className="p-5 space-y-0">

          {/* Invoice header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] font-black text-emerald-400/80 uppercase tracking-[0.3em]">
                Payment Receipt
              </span>
            </div>
            {/* Verified badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <BadgeCheck className="w-3 h-3 text-emerald-400" />
              <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Verified</span>
            </div>
          </div>

          {/* Row: Platform Invoice ID */}
          {invoiceData.transactionId && (
            <div className="py-3 border-b border-white/[0.04]">
              <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">
                Payment Receipt Reference
              </p>
              <p className="text-[12px] font-bold text-white/70 font-mono tracking-tight break-all">
                {invoiceData.transactionId}
              </p>
            </div>
          )}

          {/* Row: Gateway Voucher */}
          {invoiceData.gatewayVoucher && (
            <div className="py-3 border-b border-white/[0.04]">
              <div className="flex items-center gap-1.5 mb-1">
                <Tag className="w-2.5 h-2.5 text-cyber-cyan/60" />
                <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">
                  {gwLabel}
                </p>
              </div>
              <p className="text-[12px] font-bold text-cyber-cyan/80 font-mono tracking-tight break-all">
                {invoiceData.gatewayVoucher}
              </p>
            </div>
          )}

          {/* Row: Plan Activated */}
          <div className="py-3 border-b border-white/[0.04]">
            <div className="flex items-center gap-1.5 mb-1">
              <CreditCard className="w-2.5 h-2.5 text-white/30" />
              <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">
                Plan Type Activated
              </p>
            </div>
            <p className="text-[14px] font-black text-white tracking-tight">
              {planLabel}
            </p>
          </div>

          {/* Transaction status badge */}
          <div className="pt-4 pb-1">
            <div className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span className="text-[11px] font-black text-emerald-400 uppercase tracking-widest text-center leading-snug">
                PAID, VERIFIED &amp; EMAILED TO ACCOUNT ✓
              </span>
            </div>
          </div>

          {/* Disclaimer */}
          <p className="pt-3 text-[10px] text-white/25 leading-relaxed text-center font-medium">
            A formal copy of this digital receipt has been dispatched to your login email.
            This invoice reference code is your unique audit token for official merchant support
            lookup and verification.
          </p>

        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // CANONICAL STATUS RENDER — create-payment orders (read-only)
  // Every word of success shown here comes from the database row, never from
  // the redirect URL. Only the "paid" view uses success styling.
  // ══════════════════════════════════════════════════════════════════════════
  if (isCanonicalFlow) {
    const isPaid     = orderView === "paid";
    const isWaiting  = orderView === "checking" || orderView === "confirming";
    const isNegative = orderView === "not_completed" || orderView === "not_found";

    const accent = isPaid
      ? { ring: "border-emerald-500/20", glow: "bg-emerald-500/5", bar: "via-emerald-500", icon: "text-emerald-400", tile: "bg-emerald-500/10 border-emerald-500/20" }
      : isNegative
        ? { ring: "border-amber-500/20", glow: "bg-amber-500/5", bar: "via-amber-500", icon: "text-amber-400", tile: "bg-amber-500/10 border-amber-500/20" }
        : { ring: "border-cyber-cyan/20", glow: "bg-cyber-teal/5", bar: "via-cyber-cyan", icon: "text-cyber-cyan", tile: "bg-cyber-cyan/10 border-cyber-cyan/20" };

    const HeaderIcon =
      isPaid ? CheckCircle
      : orderView === "checking" ? Loader2
      : isNegative ? XCircle
      : Clock;

    const title =
      isPaid ? <>Payment <span className="text-emerald-400">Confirmed</span></>
      : orderView === "checking" ? <>Checking <span className="text-cyber-cyan">Payment</span></>
      : orderView === "confirming" ? <>Confirming <span className="text-cyber-cyan">Payment…</span></>
      : orderView === "processing" ? <>Still <span className="text-cyber-cyan">Processing</span></>
      : orderView === "not_completed" ? <>Payment <span className="text-amber-400">Not Completed</span></>
      : <>Order <span className="text-amber-400">Not Found</span></>;

    const subtitle =
      isPaid ? "Transaction Secured"
      : isWaiting ? "Awaiting provider confirmation"
      : orderView === "processing" ? "Confirmation in progress"
      : orderView === "not_completed" ? "No completed payment recorded"
      : "Nothing to show for this link";

    const message =
      orderView === "checking"
        ? "Looking up your order…"
      : orderView === "confirming"
        ? "Confirming your payment… This usually takes a few seconds."
      : orderView === "processing"
        ? "We haven't received the final confirmation yet. This can take a little longer. If your payment went through, it will appear in your account automatically — no need to pay again."
      : orderView === "not_completed"
        ? "We haven't recorded a completed payment for this order. If you were charged, it will be reflected in your account automatically once the payment provider confirms it."
      : orderView === "not_found"
        ? "We couldn't find this order on your account."
      : null;

    const receiptAmount   = canonicalInvoice?.amount_cents ?? canonicalOrder?.amount_cents ?? null;
    const receiptCurrency = canonicalInvoice?.currency ?? canonicalOrder?.currency ?? null;
    const receiptProduct  = canonicalInvoice?.product_display_name ?? "Career Package";
    const receiptDate     = canonicalInvoice?.issued_at ?? canonicalOrder?.paid_at ?? null;

    return (
      <div className="min-h-screen bg-cyber-bg flex items-center justify-center p-6 font-sans relative overflow-hidden">
        <div className={`absolute top-0 right-0 w-[50vw] h-[50vw] ${accent.glow} rounded-full blur-[120px] pointer-events-none`} />
        <div className="absolute bottom-0 left-0 w-[40vw] h-[40vw] bg-cyber-teal/5 rounded-full blur-[100px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`bg-[rgba(35,113,123,0.12)] backdrop-blur-2xl p-10 rounded-[2.5rem] border ${accent.ring} max-w-lg w-full text-center shadow-2xl relative`}
        >
          <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent ${accent.bar} to-transparent rounded-t-[2.5rem]`} />

          {/* ── Header ── */}
          <div className={`w-20 h-20 border ${accent.tile} rounded-3xl flex items-center justify-center mx-auto mb-8`}>
            <HeaderIcon className={`w-10 h-10 ${accent.icon} ${orderView === "checking" ? "animate-spin" : ""}`} />
          </div>

          <h1 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">{title}</h1>
          <div className="flex items-center justify-center gap-2 mb-8">
            <Activity className={`w-3 h-3 ${accent.icon} ${isWaiting ? "animate-pulse" : ""}`} />
            <span className="text-[11px] font-black text-cyber-dim uppercase tracking-[0.3em]">{subtitle}</span>
          </div>

          {/* ── Account ── */}
          <div className="bg-[rgba(31,43,45,0.6)] rounded-2xl p-5 mb-8 text-left border border-white/5">
            <div className="flex items-start gap-4">
              <Mail className="w-4 h-4 text-cyber-cyan mt-1 flex-shrink-0" />
              <div className="overflow-hidden">
                <p className="text-[10px] uppercase text-cyber-dim font-black tracking-widest mb-0.5">Entity Linked</p>
                <p className="text-sm font-bold text-slate-200 truncate">{currentUser?.email}</p>
              </div>
            </div>
          </div>

          {/* ── Non-paid state message ── */}
          {message && (
            <div className={`mb-8 px-4 py-4 rounded-2xl border text-[13px] leading-relaxed text-left ${
              isNegative
                ? "border-amber-500/25 bg-amber-500/[0.06] text-amber-200/90"
                : "border-white/[0.06] bg-[rgba(10,18,28,0.5)] text-slate-300"
            }`}>
              {isWaiting && <Loader2 className="inline w-4 h-4 mr-2 -mt-0.5 animate-spin text-cyber-cyan" />}
              {message}
            </div>
          )}

          {/* ── Receipt — database values only ── */}
          {isPaid && (
            <div className="mb-8 rounded-2xl overflow-hidden border border-white/[0.06] bg-[rgba(10,18,28,0.7)] backdrop-blur-xl text-left">
              <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />
              <div className="p-5">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[10px] font-black text-emerald-400/80 uppercase tracking-[0.3em]">Payment Receipt</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <BadgeCheck className="w-3 h-3 text-emerald-400" />
                    <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Verified</span>
                  </div>
                </div>

                {canonicalInvoice && (
                  <div className="py-3 border-b border-white/[0.04]">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Tag className="w-2.5 h-2.5 text-cyber-cyan/60" />
                      <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">Invoice Number</p>
                    </div>
                    <p className="text-[12px] font-bold text-cyber-cyan/80 font-mono tracking-tight">
                      #{canonicalInvoice.invoice_number}
                    </p>
                  </div>
                )}

                <div className="py-3 border-b border-white/[0.04]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <CreditCard className="w-2.5 h-2.5 text-white/30" />
                    <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">Package</p>
                  </div>
                  <p className="text-[14px] font-black text-white tracking-tight">{receiptProduct}</p>
                </div>

                {receiptAmount !== null && receiptCurrency && (
                  <div className="py-3 border-b border-white/[0.04]">
                    <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">Amount Paid</p>
                    <p className="text-[14px] font-black text-white tracking-tight">
                      {formatMoney(receiptAmount, receiptCurrency)}
                    </p>
                  </div>
                )}

                {receiptDate && (
                  <div className="py-3 border-b border-white/[0.04]">
                    <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-1">Date</p>
                    <p className="text-[12px] font-bold text-white/70">{new Date(receiptDate).toLocaleString()}</p>
                  </div>
                )}

                <div className="pt-4">
                  <div className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    <span className="text-[11px] font-black text-emerald-400 uppercase tracking-widest text-center leading-snug">
                      Paid &amp; Activated on Your Account ✓
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Actions — navigation only; no generation, no writes ── */}
          <div className="flex flex-col gap-3">
            {(orderView === "processing" || orderView === "not_completed") && (
              <button
                onClick={() => setRefreshNonce((n) => n + 1)}
                className="w-full py-4 px-5 rounded-2xl border-2 border-cyber-cyan/30 bg-cyber-cyan/5 hover:bg-cyber-cyan/10 text-white font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all duration-300"
              >
                <RefreshCw className="w-4 h-4 text-cyber-cyan" />
                <span>Check Again</span>
              </button>
            )}

            {!isWaiting && (
              <button
                onClick={() => navigate("/dashboard")}
                className={`w-full py-4 px-5 rounded-2xl border-2 text-white font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all duration-300 ${
                  isPaid
                    ? "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/50"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                }`}
              >
                <LayoutDashboard className={`w-4 h-4 ${isPaid ? "text-emerald-400" : "text-white/60"}`} />
                <span>Go to Dashboard</span>
              </button>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="mt-6 flex items-center justify-center gap-2 opacity-25 pointer-events-none">
            <ShieldCheck className="w-3 h-3 text-emerald-500" />
            <span className="text-[8px] font-black uppercase tracking-[0.3em] text-white">Secured by Resumation.co</span>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Main render — legacy WishMoney (?gid=) path, unchanged ─────────────────
  return (
    <div className="min-h-screen bg-cyber-bg flex items-center justify-center p-6 font-sans relative overflow-hidden">

      {/* Background glows */}
      <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[40vw] h-[40vw] bg-cyber-teal/5 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[rgba(35,113,123,0.12)] backdrop-blur-2xl p-10 rounded-[2.5rem] border border-emerald-500/20 max-w-lg w-full text-center shadow-2xl relative"
      >
        {/* Top gradient bar */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent rounded-t-[2.5rem]" />

        {/* ── Header ── */}
        <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
          <CheckCircle className="w-10 h-10 text-emerald-400" />
        </div>

        <h1 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">
          Payment <span className="text-emerald-400">Confirmed</span>
        </h1>
        <div className="flex items-center justify-center gap-2 mb-8">
          <Activity className="w-3 h-3 text-emerald-500 animate-pulse" />
          <span className="text-[11px] font-black text-cyber-dim uppercase tracking-[0.3em]">
            Transaction Secured
          </span>
        </div>

        {/* ── Account & session details ── */}
        <div className="bg-[rgba(31,43,45,0.6)] rounded-2xl p-5 mb-8 text-left border border-white/5 space-y-4">
          <div className="flex items-start gap-4 border-b border-white/5 pb-4">
            <Mail className="w-4 h-4 text-cyber-cyan mt-1 flex-shrink-0" />
            <div className="overflow-hidden">
              <p className="text-[10px] uppercase text-cyber-dim font-black tracking-widest mb-0.5">Entity Linked</p>
              <p className="text-sm font-bold text-slate-200 truncate">{currentUser?.email}</p>
            </div>
          </div>
          {displaySid && (
            <div className="flex items-start gap-4 border-b border-white/5 pb-4">
              <FileText className="w-4 h-4 text-emerald-400 mt-1 flex-shrink-0" />
              <div>
                <p className="text-[10px] uppercase text-cyber-dim font-black tracking-widest mb-0.5">Session ID</p>
                <p className="text-sm font-black text-white tracking-widest font-mono">{displaySid}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Luxury Invoice Dashboard ── */}
        <InvoiceDashboard />

        {/* ── Language selection ── */}
        <div className="mb-6">
          <p className="text-[11px] font-black text-cyber-dim uppercase tracking-[0.25em] mb-4">
            Choose Your Document Bundle
          </p>

          <div className="flex flex-col gap-3">
            {/* English bundle */}
            <button
              onClick={() => handleGenerateBundle("en")}
              disabled={!!generating || !resolvedGidState}
              className="w-full py-4 px-5 rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/50 text-white font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ boxShadow: generating === "en" ? "0 0 20px rgba(16,185,129,0.15)" : undefined }}
            >
              {generating === "en"
                ? <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                : <Globe className="w-4 h-4 text-emerald-400" />
              }
              <span>
                Generate <span className="text-emerald-400">English</span> Bundle
              </span>
              <span className="text-[10px] font-normal text-emerald-400/70 normal-case tracking-normal hidden sm:inline">
                ATS CV + Cover Letter
              </span>
            </button>

            {/* Arabic bundle */}
            <button
              onClick={() => handleGenerateBundle("ar")}
              disabled={!!generating || !resolvedGidState}
              className="w-full py-4 px-5 rounded-2xl border-2 border-[#E0C58F]/25 bg-[#E0C58F]/5 hover:bg-[#E0C58F]/10 hover:border-[#E0C58F]/45 text-white font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ boxShadow: generating === "ar" ? "0 0 20px rgba(224,197,143,0.12)" : undefined }}
            >
              {generating === "ar"
                ? <Loader2 className="w-4 h-4 animate-spin text-[#E0C58F]" />
                : <AlignRight className="w-4 h-4 text-[#E0C58F]" />
              }
              <span>
                Generate <span className="text-[#E0C58F]">Arabic</span> Bundle
              </span>
              <span className="text-[10px] font-normal text-[#E0C58F]/60 normal-case tracking-normal hidden sm:inline">
                Professional CV + Cover Letter
              </span>
            </button>
          </div>
        </div>

        {/* ── Advisory note ── */}
        <div className="bg-[rgba(224,197,143,0.06)] border border-[rgba(224,197,143,0.18)] rounded-2xl p-4 text-left">
          <p className="text-[12px] text-[#C8BFBA] leading-relaxed">
            💡{" "}
            <span className="text-[#E0C58F] font-bold">Professional Advice:</span>{" "}
            If you are applying through online corporate job portals or ATS systems, we strongly
            recommend generating the{" "}
            <span className="text-[#E0C58F] font-semibold">English Bundle</span>.{" "}
            Online recruitment systems screen English formats with 100% higher accuracy. Keep the
            Arabic bundle for direct email communications or local company follow-ups.
          </p>
        </div>

        {/* ── Footer ── */}
        <div className="mt-6 flex items-center justify-center gap-2 opacity-25 pointer-events-none">
          <ShieldCheck className="w-3 h-3 text-emerald-500" />
          <span className="text-[8px] font-black uppercase tracking-[0.3em] text-white">
            Secured by Resumation.co
          </span>
        </div>
      </motion.div>
    </div>
  );
}

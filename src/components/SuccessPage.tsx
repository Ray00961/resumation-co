import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CheckCircle, Loader2, Mail, Hash, FileText,
  Activity, ShieldCheck, Globe, AlignRight,
  BadgeCheck, CreditCard, Tag, Sparkles,
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

export default function SuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [currentUser, setCurrentUser] = useState<{ id: string; email: string } | null>(null);
  const [displaySid,  setDisplaySid]  = useState<string>("");
  const [generating,  setGenerating]  = useState<"en" | "ar" | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);

  // ── URL params ─────────────────────────────────────────────────────────────
  // WishMoney path: /success?gid=<generation_id>&tid=<transaction_id>&plan=<plan>
  // Paymob path:    /success?order=<paymob_order_id>  (no gid — recovered via confirm-payment)
  const urlGid        = searchParams.get("gid")   || "";
  const urlTid        = searchParams.get("tid")   || "";
  const urlPlan       = searchParams.get("plan")  || "";
  const paymobOrderId = searchParams.get("order") || searchParams.get("id") || "";

  // ── Synchronous refs ───────────────────────────────────────────────────────
  // These are set once in init() and read synchronously by the click handler.
  const tokenRef  = useRef<string>("");
  const userIdRef = useRef<string>("");
  const gidRef    = useRef<string>(urlGid);  // generation_id PK — primary canonical anchor
  const tidRef    = useRef<string>(urlTid);  // transaction reference
  const planRef   = useRef<string>(urlPlan); // plan tier

  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    const init = async () => {
      const safetyTimeout = setTimeout(() => setPageLoading(false), 5000);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          clearTimeout(safetyTimeout);
          navigate("/login");
          return;
        }

        tokenRef.current  = session.access_token;
        userIdRef.current = session.user.id;
        setCurrentUser({ id: session.user.id, email: session.user.email || "" });

        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
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
        }

        // ════════════════════════════════════════════════════════════════════
        // PATH B — Paymob
        // gid is NOT in the URL. Two sub-cases:
        //   B1. Row already exists (e.g. webhook already wrote it, or previous
        //       page load ran the cold-insert). Seed refs, fire a fire-and-
        //       forget idempotent re-confirm, then proceed.
        //   B2. Row does NOT exist yet. confirm-payment is the INSERT engine —
        //       await its response to receive the freshly minted generation_id.
        // ════════════════════════════════════════════════════════════════════
        else if (paymobOrderId) {
          const { data: existingRow } = await supabase
            .from("order_generations")
            .select("generation_id, submission_id, package_name")
            .eq("user_id", session.user.id)
            .order("created_at_utc", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existingRow?.generation_id) {
            // ── B1: Row exists ──────────────────────────────────────────────
            resolvedGid     = existingRow.generation_id;
            gidRef.current  = existingRow.generation_id;
            planRef.current = existingRow.package_name || urlPlan || "premium";
            if (existingRow.submission_id) setDisplaySid(existingRow.submission_id);

            // Fire idempotent re-confirm — Stage 1 idempotency exits immediately
            fetch(`${SUPABASE_URL}/functions/v1/confirm-payment`, {
              method:  "POST",
              headers: {
                "Content-Type":  "application/json",
                "Authorization": `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                generation_id:   existingRow.generation_id,
                paymob_order_id: paymobOrderId,
                source:          "paymob",
              }),
            }).catch(e => console.error("[SuccessPage] confirm-payment re-confirm:", e));

          } else {
            // ── B2: No row — confirm-payment performs the Paymob birth INSERT ──
            // Derive the plan from URL param → sessionStorage hint → default "premium"
            const planHint = urlPlan || sessionStorage.getItem("rsm_plan") || "premium";

            try {
              const cpRes = await fetch(`${SUPABASE_URL}/functions/v1/confirm-payment`, {
                method:  "POST",
                headers: {
                  "Content-Type":  "application/json",
                  "Authorization": `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                  paymob_order_id: paymobOrderId,
                  plan:            planHint,
                  source:          "paymob",
                }),
              });
              const cpResult = await cpRes.json().catch(() => ({}));

              if (cpResult?.generation_id) {
                resolvedGid     = cpResult.generation_id;
                gidRef.current  = cpResult.generation_id;
                planRef.current = planHint;
              } else {
                console.error("[SuccessPage] confirm-payment cold-insert returned no generation_id", cpResult);
              }
            } catch (e) {
              console.error("[SuccessPage] confirm-payment cold-insert error:", e);
            }
          }
        }

        // ════════════════════════════════════════════════════════════════════
        // INVOICE DATA FETCH
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
                paymobOrderId         ||
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

  // ── Language bundle click handler ──────────────────────────────────────────
  // Entirely synchronous up to navigate() — no await on the critical path.
  const handleGenerateBundle = (lang: "en" | "ar") => {
    if (generating) return;

    const activeGid = gidRef.current;
    const token     = tokenRef.current;
    const userId    = userIdRef.current;

    if (!activeGid || !token) {
      console.error("[SuccessPage] Missing generation_id or token — cannot generate");
      return;
    }

    setGenerating(lang);

    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

    // Fire-and-forget: persist the user's language choice on the order row
    supabase
      .from("order_generations")
      .update({ selected_language: lang })
      .eq("generation_id", activeGid)
      .eq("user_id", userId)
      .then(() => {})
      .catch(e => console.error("[SuccessPage] lang update:", e));

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

  // ── Main render ────────────────────────────────────────────────────────────
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
          {paymobOrderId && (
            <div className="flex items-start gap-4">
              <Hash className="w-4 h-4 text-cyber-cyan mt-1 flex-shrink-0" />
              <div>
                <p className="text-[10px] uppercase text-cyber-dim font-black tracking-widest mb-0.5">Payment Hash</p>
                <p className="text-sm font-bold text-cyber-cyan font-mono tracking-tighter">{paymobOrderId}</p>
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
              disabled={!!generating || !gidRef.current}
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
              disabled={!!generating || !gidRef.current}
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

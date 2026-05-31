import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { Download, FileText, Sparkles, ExternalLink, Loader2 } from "lucide-react";
import { RealtimeChannel } from "@supabase/supabase-js";

// ── 7 loading phrases for free plan (2.5 s each) ─────────────────────────────
const FREE_PHRASES = [
  "Reading your form data...",
  "Analyzing your professional experience...",
  "Extracting industry keywords...",
  "Applying Gulf-region market parameters...",
  "Removing AI clichés and buzzwords...",
  "Structuring your bilingual strategic tips...",
  "Compiling your downloadable Word document...",
];

// ── Fake CV lines for paid plan typewriter ────────────────────────────────────
const CV_LINES = [
  { type: "name",    text: "Loading your profile..." },
  { type: "title",   text: "AI Career Strategist is analyzing your data..." },
  { type: "divider", text: "" },
  { type: "section", text: "PROFESSIONAL SUMMARY" },
  { type: "body",    text: "Analyzing experience and achievements across roles..." },
  { type: "body",    text: "Identifying impact statements and quantifiable results..." },
  { type: "divider", text: "" },
  { type: "section", text: "RECOMMENDED ROLES" },
  { type: "chip",    text: "Matching job titles to your skill profile..." },
  { type: "divider", text: "" },
  { type: "section", text: "CAREER STRATEGY TIPS" },
  { type: "tip",     text: "🔑 Identifying missing ATS keywords for your industry..." },
  { type: "tip",     text: "📊 Calculating impact score for each experience bullet..." },
  { type: "tip",     text: "🎯 Calibrating CV to target job description match..." },
  { type: "divider", text: "" },
  { type: "section", text: "AI MATCH SCORE" },
  { type: "score",   text: "Computing your personalized career fit score..." },
  { type: "divider", text: "" },
  { type: "body",    text: "Almost done — finalizing your career report..." },
];

const LINE_DELAY   = 420;
const CHAR_DELAY   = 18;
const CURSOR_BLINK = 530;

// Strip <script> tags before rendering HTML inline
const sanitizeHtml = (html: string) =>
  html.replace(/<script[\s\S]*?<\/script>/gi, "");

export default function BuildingPage() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();

  // ── Routing params ─────────────────────────────────────────────────────────
  // Paid plan:  /building?gid=<generation_id>&lang=<en|ar>
  // Free plan:  /building?sid=<submission_id>&fid=<form_id>
  const gid  = searchParams.get("gid") ?? "";   // generation_id PK — paid plan anchor
  const fid  = searchParams.get("fid") ?? "";   // form_id — present on free plan only
  const sid  = searchParams.get("sid") ?? "";   // submission_id — free plan context
  const lang = searchParams.get("lang") ?? "en";

  // gid present = paid plan; fid present without gid = free plan
  const isFree = !gid && !!fid;

  // ── Shared state ──────────────────────────────────────────────────────────
  const [isComplete,   setIsComplete]   = useState(false);
  const [cvUrl,        setCvUrl]        = useState<string | null>(null);
  const [clUrl,        setClUrl]        = useState<string | null>(null);
  const [timedOut,     setTimedOut]     = useState(false);
  const [apiError,     setApiError]     = useState<string | null>(null);

  // ── Free plan state ───────────────────────────────────────────────────────
  const [phraseIndex,   setPhraseIndex]   = useState(0);
  const [phraseVisible, setPhraseVisible] = useState(true);
  const [htmlResult,    setHtmlResult]    = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const phraseTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const phraseTimeoutRef = useRef<ReturnType<typeof setTimeout>  | null>(null);

  // ── Paid plan typewriter ──────────────────────────────────────────────────
  const [visibleLines,  setVisibleLines]  = useState<string[]>([]);
  const [currentTyping, setCurrentTyping] = useState("");
  const [cursorOn,      setCursorOn]      = useState(true);
  const lineIndexRef   = useRef(0);
  const charIndexRef   = useRef(0);
  const typeTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef     = useRef<RealtimeChannel | null>(null);
  const pollRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef     = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const typewriterBoxRef = useRef<HTMLDivElement | null>(null);
  const bottomRef      = useRef<HTMLDivElement | null>(null);

  // ── Mark paid-plan complete ───────────────────────────────────────────────
  const markComplete = (url: string, cl?: string) => {
    setCvUrl(url);
    if (cl) setClUrl(cl);
    setIsComplete(true);
    if (pollRef.current)        clearInterval(pollRef.current);
    if (timeoutRef.current)     clearTimeout(timeoutRef.current);
    if (channelRef.current)     supabase.removeChannel(channelRef.current);
    if (typeTimerRef.current)   clearTimeout(typeTimerRef.current);
    if (cursorTimerRef.current) clearInterval(cursorTimerRef.current);

    // The generate-cv function updates order_generations, then the user
    // should land in the Downloads view. Keep the success state briefly so
    // the user sees completion, then move them to the archive.
    window.setTimeout(() => {
      navigate("/my-account?view=downloads");
    }, 2000);
  };

  // ── Typewriter (paid plan only) ───────────────────────────────────────────
  const scheduleNextChar = () => {
    const li = lineIndexRef.current;
    if (li >= CV_LINES.length) {
      lineIndexRef.current = 0;
      charIndexRef.current = 0;
      setVisibleLines([]);
      setCurrentTyping("");
      typeTimerRef.current = setTimeout(scheduleNextChar, 600);
      return;
    }
    const line = CV_LINES[li];
    const text = line.text;
    if (line.type === "divider") {
      setVisibleLines(prev => [...prev, "---"]);
      lineIndexRef.current++;
      charIndexRef.current = 0;
      typeTimerRef.current = setTimeout(scheduleNextChar, LINE_DELAY);
      return;
    }
    if (charIndexRef.current < text.length) {
      setCurrentTyping(text.slice(0, charIndexRef.current + 1));
      charIndexRef.current++;
      typeTimerRef.current = setTimeout(scheduleNextChar, CHAR_DELAY);
    } else {
      setVisibleLines(prev => [...prev, `${line.type}::${text}`]);
      setCurrentTyping("");
      lineIndexRef.current++;
      charIndexRef.current = 0;
      typeTimerRef.current = setTimeout(scheduleNextChar, LINE_DELAY);
    }
  };

  useEffect(() => {
    // Keep the animation scrolled inside its own terminal box.
    // Avoid scrollIntoView here because it can make the whole page jump upward.
    const el = typewriterBoxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visibleLines, currentTyping]);

  // ══════════════════════════════════════════════════════════════════════════
  // FREE PLAN EFFECT
  // ══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!isFree) return;
    if (!fid) { navigate("/my-account?view=downloads"); return; }

    phraseTimerRef.current = setInterval(() => {
      setPhraseVisible(false);
      phraseTimeoutRef.current = setTimeout(() => {
        setPhraseIndex(p => (p + 1) % FREE_PHRASES.length);
        setPhraseVisible(true);
      }, 300);
    }, 2500);

    const run = async () => {
      try {
        // ── Check existing: skip API call if already generated ──
        // generate-free-cv writes cv_file_path (HTML) + cv_pdf_url (DOCX signed URL)
        // into order_generations — NOT cv_archive. Filtering package_name = "free"
        // avoids accidentally matching a paid-plan row for the same form.
        const { data: existing } = await supabase
          .from("order_generations")
          .select("cv_file_path, cv_pdf_url")
          .eq("form_id", fid)
          .eq("package_name", "free")
          .order("created_at_utc", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existing?.cv_file_path && existing?.cv_pdf_url) {
          setHtmlResult(existing.cv_file_path);
          setCvUrl(existing.cv_pdf_url);
          setIsComplete(true);
          if (phraseTimerRef.current) clearInterval(phraseTimerRef.current);
          return;
        }

        const lsKey = Object.keys(localStorage).find(
          k => k.startsWith("sb-") && k.endsWith("-auth-token")
        );
        let token: string | null = null;
        if (lsKey) {
          try { token = JSON.parse(localStorage.getItem(lsKey) || "null")?.access_token ?? null; } catch {}
        }

        const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
        const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-free-cv`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ form_id: fid, submission_id: sid || undefined }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok || !data.htmlResult) {
          throw new Error(data.error || "No HTML returned from generate-free-cv");
        }

        setHtmlResult(data.htmlResult);
        setCvUrl(data.fileUrl || null);
        setIsComplete(true);

      } catch (err) {
        console.error("generate-free-cv error:", err);
        setApiError(String(err));
      } finally {
        if (phraseTimerRef.current) clearInterval(phraseTimerRef.current);
      }
    };

    run();

    return () => {
      if (phraseTimerRef.current)  clearInterval(phraseTimerRef.current);
      if (phraseTimeoutRef.current) clearTimeout(phraseTimeoutRef.current);
    };
  }, [fid]); // eslint-disable-line react-hooks/exhaustive-deps

  // ══════════════════════════════════════════════════════════════════════════
  // PAID PLAN EFFECT
  // Anchored exclusively to generation_id (gid) — the PK of order_generations.
  // Using .maybeSingle() is safe: generation_id is a UUID primary key; exactly
  // one row can ever match (or null if not yet committed).
  // ══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (isFree) return;
    if (!gid)   { navigate("/my-account?view=downloads"); return; }

    console.log("[BuildingPage] effect start", { gid, isFree });
    
    let cancelled = false;

    cursorTimerRef.current = setInterval(() => setCursorOn(p => !p), CURSOR_BLINK);
    typeTimerRef.current   = setTimeout(scheduleNextChar, 300);

    const checkReady = async () => {
      try {
        console.log("[BuildingPage] checkReady called");
        console.log("[BuildingPage] querying order_generations", gid);

        const { data, error } = await supabase
          .from("order_generations")
          .select("cv_pdf_url, cv_file_path, cl_pdf_url, cl_file_path")
          .eq("generation_id", gid)
          .maybeSingle();

        console.log("[BuildingPage] result", { data, error });

        if (error) {
          console.error("[BuildingPage]", error);
          return;
        }

        if (cancelled) return;

        const cvReady = data?.cv_pdf_url || data?.cv_file_path;
        const clReady = data?.cl_pdf_url || data?.cl_file_path;

        if (cvReady) {
          markComplete(cvReady, clReady ?? undefined);
        }
      } catch (err) {
        console.error("[BuildingPage] checkReady crashed", err);
      }
    };

    // ── Realtime subscription — tracks this exact generation_id row ──────
    // The filter `generation_id=eq.${gid}` is unambiguous: it references one
    // UUID PK in a table that contains only paid, confirmed rows.
    channelRef.current = supabase
      .channel(`building-paid-${gid}`)
      .on("postgres_changes", {
        event:  "UPDATE",
        schema: "public",
        table:  "order_generations",
        filter: `generation_id=eq.${gid}`,
      }, (payload: any) => {
        if (cancelled) return;
        const cvReady = payload.new?.cv_pdf_url || payload.new?.cv_file_path;
        const clReady = payload.new?.cl_pdf_url || payload.new?.cl_file_path;
        if (cvReady) {
          markComplete(cvReady, clReady ?? undefined);
        }
      })
      .subscribe();

    // ── Initial check + polling every 3 s ────────────────────────────────
    checkReady();
    pollRef.current = setInterval(checkReady, 3000);

    timeoutRef.current = setTimeout(() => setTimedOut(true), 3 * 60 * 1000);

    return () => {
      cancelled = true;
      if (channelRef.current)     supabase.removeChannel(channelRef.current);
      if (pollRef.current)        clearInterval(pollRef.current);
      if (timeoutRef.current)     clearTimeout(timeoutRef.current);
      if (typeTimerRef.current)   clearTimeout(typeTimerRef.current);
      if (cursorTimerRef.current) clearInterval(cursorTimerRef.current);
    };
  }, [gid]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Blob download (free plan) ─────────────────────────────────────────────
  const handleBlobDownload = async () => {
    if (!cvUrl) return;
    setIsDownloading(true);
    try {
      const res     = await fetch(cvUrl);
      const blob    = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a       = document.createElement("a");
      a.href        = blobUrl;
      a.download    = `resumation-free-cv-${fid?.slice(0, 8) || "report"}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // silent — signed URL may have expired
    } finally {
      setIsDownloading(false);
    }
  };

  // ── Blob download (paid plan) ─────────────────────────────────────────────
  const handlePaidDownload = async () => {
    if (!cvUrl) return;
    const ext  = cvUrl.includes(".html") ? "html" : "docx";
    const name = `resumation-cv-${gid?.slice(0, 8) || "report"}.${ext}`;
    try {
      const res     = await fetch(cvUrl);
      const blob    = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a       = document.createElement("a");
      a.href        = blobUrl;
      a.download    = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(cvUrl, "_blank");
    }
  };

  // ── Render typewriter line (paid plan) ────────────────────────────────────
  const renderLine = (raw: string, idx: number) => {
    if (raw === "---") return <div key={idx} className="border-t border-white/5 my-2" />;
    const [type, ...rest] = raw.split("::");
    const text = rest.join("::");
    if (type === "section") return <div key={idx} className="text-[10px] font-black text-cyber-teal uppercase tracking-[0.2em] mt-3 mb-1">{text}</div>;
    if (type === "name")    return <div key={idx} className="text-lg font-black text-white mb-0.5">{text}</div>;
    if (type === "title")   return <div key={idx} className="text-xs text-cyber-teal font-semibold italic mb-2">{text}</div>;
    if (type === "tip")     return <div key={idx} className="text-[11px] text-[#C8A96E] pl-2 border-l border-[#C8A96E]/30 py-0.5 mb-1">{text}</div>;
    if (type === "chip")    return <div key={idx} className="inline-flex items-center px-2 py-0.5 rounded-full bg-cyber-teal/10 border border-cyber-teal/20 text-[10px] text-cyber-teal mr-1 mb-1">{text}</div>;
    if (type === "score")   return (
      <div key={idx} className="flex items-center gap-2 mb-1">
        <div className="w-10 h-10 rounded-full border-2 border-cyber-teal/40 flex items-center justify-center text-cyber-teal font-black text-xs">--</div>
        <span className="text-[11px] text-[#7A8FAA]">{text}</span>
      </div>
    );
    return <div key={idx} className="text-[11px] text-[#7A8FAA] mb-0.5 leading-relaxed">{text}</div>;
  };

  const renderTypingLine = () => {
    if (!currentTyping) return null;
    const li     = lineIndexRef.current;
    const type   = li < CV_LINES.length ? CV_LINES[li]?.type : "body";
    const cursor = <span className={`inline-block w-[2px] h-[1em] bg-cyber-teal align-middle ml-0.5 transition-opacity ${cursorOn ? "opacity-100" : "opacity-0"}`} />;
    if (type === "section") return <div className="text-[10px] font-black text-cyber-teal uppercase tracking-[0.2em] mt-3 mb-1">{currentTyping}{cursor}</div>;
    if (type === "name")    return <div className="text-lg font-black text-white mb-0.5">{currentTyping}{cursor}</div>;
    if (type === "tip")     return <div className="text-[11px] text-[#C8A96E] pl-2 border-l border-[#C8A96E]/30 py-0.5 mb-1">{currentTyping}{cursor}</div>;
    return <div className="text-[11px] text-[#7A8FAA] mb-0.5 leading-relaxed">{currentTyping}{cursor}</div>;
  };

  // ══════════════════════════════════════════════════════════════════════════
  // FREE PLAN RENDER
  // ══════════════════════════════════════════════════════════════════════════
  if (isFree) {
    return (
      <div className="min-h-screen bg-[#0D1117] px-4 py-8 relative overflow-hidden">
        <style>{`@keyframes rsm-fadein { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>

        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(18,178,193,0.05) 0%, transparent 70%)" }} />
        <div className="fixed inset-0 pointer-events-none z-0"
          style={{ backgroundImage: "radial-gradient(rgba(18,178,193,0.025) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

        <div className="relative z-10 w-full max-w-3xl mx-auto">

          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyber-teal/20 bg-cyber-teal/5 mb-5">
              <Sparkles className={`w-3 h-3 text-cyber-teal ${!isComplete ? "animate-pulse" : ""}`} />
              <span className="text-[10px] font-black text-cyber-teal uppercase tracking-[0.25em]">
                {isComplete ? "Free Career Report Ready" : "Generating Your Free Career Report"}
              </span>
            </div>

            <h1 className="text-2xl font-black text-white mb-1.5 tracking-tight">
              {isComplete
                ? <span style={{ background: "linear-gradient(135deg, #12b2c1, #E0C58F)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    Your Free Report is Ready 🎉
                  </span>
                : "Building Your Career Strategy"
              }
            </h1>

            {!isComplete && !apiError && (
              <p
                className="text-cyber-teal/70 text-sm font-semibold min-h-[1.5rem] transition-opacity duration-300"
                style={{ opacity: phraseVisible ? 1 : 0 }}
              >
                {FREE_PHRASES[phraseIndex]}
              </p>
            )}
          </div>

          {!isComplete && !apiError && (
            <div className="flex flex-col items-center justify-center gap-6 min-h-[500px]">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border border-cyber-teal/20 animate-ping" />
                <Loader2 className="w-16 h-16 text-cyber-teal animate-spin" />
              </div>
              <p className="text-[11px] text-[#7A8FAA]/50 font-medium text-center max-w-xs">
                This usually takes 15–30 seconds. Please don't close this page.
              </p>
            </div>
          )}

          {apiError && (
            <div className="mt-4 p-4 rounded-2xl border border-red-500/20 bg-red-500/5 text-center">
              <p className="text-red-400 text-xs font-bold mb-2">Something went wrong — please try again.</p>
              <button
                onClick={() => navigate("/plans")}
                className="text-[11px] text-red-400/70 underline hover:text-red-400 transition-colors"
              >
                Back to Plans
              </button>
            </div>
          )}

          {isComplete && htmlResult && (
            <div className="w-full" style={{ animation: "rsm-fadein 0.5s ease both" }}>

              {cvUrl && (
                <div className="flex flex-col sm:flex-row gap-3 mb-8">
                  <button
                    onClick={handleBlobDownload}
                    disabled={isDownloading}
                    className="flex-1 py-4 rounded-2xl font-black text-sm uppercase tracking-widest text-white flex items-center justify-center gap-2 transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg, rgba(18,178,193,1), rgba(13,130,150,1))", boxShadow: "0 4px 24px rgba(18,178,193,0.3)" }}
                  >
                    {isDownloading
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <><Download className="w-4 h-4" /> Download Word Document</>
                    }
                  </button>
                  <button
                    onClick={() => navigate("/my-account?view=downloads")}
                    className="flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest border border-white/10 text-[#7A8FAA] hover:text-white hover:border-white/20 transition-all flex items-center justify-center gap-2"
                  >
                    <FileText className="w-3 h-3" /> View All Downloads
                  </button>
                </div>
              )}

              <div className="rounded-2xl overflow-hidden border border-white/10 bg-white shadow-2xl">
                <div
                  className="w-full"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(htmlResult) }}
                />
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                {cvUrl && (
                  <button
                    onClick={handleBlobDownload}
                    disabled={isDownloading}
                    className="flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest border border-cyber-teal/30 text-cyber-teal hover:bg-cyber-teal/5 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {isDownloading
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <><Download className="w-3.5 h-3.5" /> Download Again</>
                    }
                  </button>
                )}
                <button
                  onClick={() => navigate("/plans")}
                  className="flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest border border-[#E0C58F]/20 text-[#E0C58F] hover:bg-[#E0C58F]/5 transition-all flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Upgrade to Full CV
                </button>
              </div>

            </div>
          )}

        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PAID PLAN RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#0D1117] flex items-center justify-center px-4 py-8 relative overflow-hidden">

      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(18,178,193,0.05) 0%, transparent 70%)" }} />
      <div className="fixed inset-0 pointer-events-none z-0"
        style={{ backgroundImage: "radial-gradient(rgba(18,178,193,0.025) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

      <div className="relative z-10 w-full max-w-xl">

        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyber-teal/20 bg-cyber-teal/5 mb-5">
            <Sparkles className={`w-3 h-3 text-cyber-teal ${!isComplete ? "animate-pulse" : ""}`} />
            <span className="text-[10px] font-black text-cyber-teal uppercase tracking-[0.25em]">
              {isComplete ? "Report Delivered" : "AI Generating Your Report"}
            </span>
          </div>

          <h1 className="text-2xl font-black text-white mb-1.5 tracking-tight">
            {isComplete
              ? <span style={{ background: "linear-gradient(135deg, #12b2c1, #E0C58F)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  Your Career Report is Ready 🎉
                </span>
              : "Building Your Career Report"
            }
          </h1>
          <p className="text-[#7A8FAA] text-sm">
            {isComplete
              ? "Download your AI-powered career strategy report below."
              : "Watch your personalized CV strategy take shape in real time..."
            }
          </p>
        </div>

        {!isComplete && (
          <div className="rounded-2xl border border-white/8 bg-[#0A0E16] overflow-hidden mb-6 shadow-2xl">
            <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
              <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
              <span className="ml-3 text-[10px] text-[#7A8FAA] font-mono">resumation-ai · generating report...</span>
            </div>
            <div ref={typewriterBoxRef} className="p-5 h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent font-mono">
              {visibleLines.map((line, idx) => renderLine(line, idx))}
              {renderTypingLine()}
              <div ref={bottomRef} />
            </div>
          </div>
        )}

        {isComplete && cvUrl && (
          <div className="flex flex-col gap-3 mt-2">
            <button
              onClick={handlePaidDownload}
              className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest text-white flex items-center justify-center gap-2 transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
              style={{ background: "linear-gradient(135deg, rgba(18,178,193,1), rgba(13,130,150,1))", boxShadow: "0 4px 24px rgba(18,178,193,0.3)" }}
            >
              <Download className="w-4 h-4" /> Download CV ({lang === "ar" ? "Arabic" : "English"})
            </button>

            {clUrl && (
              <a
                href={clUrl}
                download={`resumation-cover-letter-${lang}-${gid?.slice(0, 8) || "cl"}.html`}
                className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest text-white flex items-center justify-center gap-2 transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
                style={{ background: "linear-gradient(135deg, rgba(224,197,143,0.9), rgba(180,140,70,0.9))", boxShadow: "0 4px 24px rgba(224,197,143,0.2)" }}
              >
                <FileText className="w-4 h-4" /> Download Cover Letter ({lang === "ar" ? "Arabic" : "English"})
              </a>
            )}

            <a
              href={cvUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 rounded-2xl font-black text-xs uppercase tracking-widest border border-cyber-teal/20 text-cyber-teal hover:bg-cyber-teal/5 transition-all flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open CV in Browser
            </a>

            <button
              onClick={() => navigate("/my-account?view=downloads")}
              className="w-full py-3 rounded-2xl font-black text-xs uppercase tracking-widest border border-white/10 text-[#7A8FAA] hover:text-white hover:border-white/20 transition-all flex items-center justify-center gap-2"
            >
              <FileText className="w-3 h-3" /> View All Downloads
            </button>
          </div>
        )}

        {timedOut && !isComplete && (
          <div className="mt-4 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 text-center">
            <p className="text-amber-400 text-xs font-bold mb-2">Still processing — taking longer than usual.</p>
            <button
              onClick={() => navigate("/my-account?view=downloads")}
              className="text-[11px] text-amber-400/70 underline hover:text-amber-400 transition-colors"
            >
              Check My Downloads
            </button>
          </div>
        )}

        {!isComplete && !timedOut && (
          <p className="text-center text-[11px] text-[#7A8FAA]/50 font-medium mt-4">
            Usually takes 15–40 seconds. You can close this tab — we'll save your report in downloads.
          </p>
        )}

      </div>
    </div>
  );
}
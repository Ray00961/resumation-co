import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Cookies from "js-cookie";
import { detectRegion, type Region } from "../utils/detectRegion";
import {
  BrainCircuit, Loader2, Send, Paperclip,
  User, Bot, FileText, Sparkles,
  ThumbsUp, ThumbsDown, ChevronRight,
} from "lucide-react";
import { supabase } from "../supabase";
import mammoth from "mammoth";
import * as pdfjs from "pdfjs-dist";
import { toast } from "sonner";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface Message {
  id: string;
  type: 'ai' | 'user';
  text: string;
  hasAttachment?: boolean;
  isAction?: boolean;
}

// System prompt is now fixed server-side in the analyze-cv Edge Function — not sent by client.

export default function CareerAnalysis() {
  const navigate = useNavigate();

  // ── Core chat state ──
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', type: 'ai', text: "Welcome to the Neural Analysis Node. 🧠\nPlease upload your CV and paste the Job Description to initialize the protocol." }
  ]);
  const [inputValue, setInputValue]     = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isTyping, setIsTyping]         = useState(false);
  const [showRewriteOption, setShowRewriteOption] = useState(false);
  const [jdAnalysisPending, setJdAnalysisPending] = useState(false);
  const [currentRecordId, setCurrentRecordId]     = useState<string | null>(null);
  const [userRegion, setUserRegion] = useState<Region>(Cookies.get("user_region") as Region || "LB");

  // ── CV Archive / subid flow ──
  const [gptResults, setGptResults]         = useState<any | null>(null);
  const [subId, setSubId]                   = useState<string | null>(null);
  const [showQuickReplies, setShowQuickReplies] = useState(false);

  const messagesEndRef    = useRef<HTMLDivElement>(null);
  const channelCleanupRef = useRef<(() => void) | null>(null);
  const typingTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ANALYSIS_PLAN_LINK = "https://accept.paymobsolutions.com/standalone?ref=p_LRR2V2VhcEw4aHBvSDV6R0hKTEJheE42UT09XytuU2hOT0pId0czbDJpcHZlMjdKT1E9PQ";
  const ANALYSIS_WEBHOOK   = import.meta.env.VITE_EF_ANALYZE_CV;

  // ── Mount: detect region + route by URL params ──
  useEffect(() => {
    detectRegion().then(r => setUserRegion(r));

    const initChat = async () => {
      const params = new URLSearchParams(window.location.search);

      // Priority 1: ?subid= → cv_archive flow (new)
      const sid = params.get("subid");
      if (sid) {
        setSubId(sid);
        loadCvArchiveData(sid);
        return;
      }

      // Priority 2: ?record_id= → cv_analysis_requests flow (existing)
      const rid = params.get("record_id");
      if (rid) {
        setCurrentRecordId(rid);
        loadExistingData(rid);
        window.history.pushState({}, '', `/career-analysis?record_id=${rid}`);
      }
    };

    initChat();
    return () => {
      channelCleanupRef.current?.();
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // ── Fetch cv_archive by submission_id ──
  const loadCvArchiveData = async (sid: string) => {
    setIsTyping(true);
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const lsKey = Object.keys(localStorage).find(
        k => k.startsWith("sb-") && k.endsWith("-auth-token")
      );
      const accessToken = lsKey
        ? (JSON.parse(localStorage.getItem(lsKey) || "null")?.access_token ?? null)
        : null;

      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/cv_archive?submission_id=eq.${encodeURIComponent(sid)}&select=*&limit=1`,
        { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${accessToken ?? SUPABASE_KEY}` } }
      );

      if (!res.ok) throw new Error("Fetch failed");

      const rows  = await res.json();
      const record = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

      if (record?.cv_gpt_result) {
        setGptResults(record.cv_gpt_result);
        setMessages([{
          id: '1',
          type: 'ai',
          text: "✅ CV profile loaded successfully!\nI've analyzed your career data. What would you like to explore?"
        }]);
        setShowQuickReplies(true);
      } else {
        setMessages([{
          id: '1',
          type: 'ai',
          text: "⚠️ CV found, but no AI profile has been generated yet.\nYou can paste a Job Description below to run a CV vs JD analysis."
        }]);
      }
    } catch {
      setMessages([{
        id: '1',
        type: 'ai',
        text: "Welcome to the Neural Analysis Node. 🧠\nPlease upload your CV and paste the Job Description to initialize the protocol."
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  // analysis_result & rewritten_cv_result are jsonb — may be string or object
  const asText = (v: any): string =>
    v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v);

  // ── Load existing cv_analysis_requests record ──
  const loadExistingData = async (id: string) => {
    setIsTyping(true);
    const { data } = await supabase.from('cv_analysis_requests').select('*').eq('id', id).single();

    if (data) {
      const history: Message[] = [{ id: '1', type: 'ai', text: "Re-establishing connection to secure node..." }];
      const jdText = data.jd_json?.description || (typeof data.jd_json === 'string' ? data.jd_json : "");
      if (jdText) history.push({ id: 'jd-init', type: 'user', text: jdText });
      if (data.cv_file_name) history.push({ id: 'cv-init', type: 'user', text: `CV Uploaded: ${data.cv_file_name}`, hasAttachment: true });

      const analysisText  = asText(data.analysis_result);
      const rewrittenText = asText(data.rewritten_cv_result);

      if (analysisText) {
        history.push({ id: 'ai-init', type: 'ai', text: analysisText });
        if (!rewrittenText) {
          history.push({ id: 'ai-ask-init', type: 'ai', text: "🎯 Analysis complete! Would you like me to rewrite your CV using the neural engine?", isAction: true });
          setShowRewriteOption(true);
        }
        setIsTyping(false);
      }
      if (rewrittenText) {
        history.push({ id: 'ai-rew', type: 'ai', text: "✨ Optimized CV Data Stream:\n\n" + rewrittenText });
        setShowRewriteOption(false);
      }
      setMessages(history);
      setupRealtimeListener(id);
    } else {
      setIsTyping(false);
    }
  };

  // ── Supabase realtime listener ──
  const setupRealtimeListener = (id: string) => {
    channelCleanupRef.current?.();

    const channel = supabase.channel(`results-${id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public',
        table: 'cv_analysis_requests', filter: `id=eq.${id}`
      }, (payload) => {
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

        const newAnalysis  = asText(payload.new.analysis_result);
        const newRewritten = asText(payload.new.rewritten_cv_result);

        if (newAnalysis) {
          setMessages(prev => {
            if (prev.find(m => m.text === newAnalysis)) return prev;
            return [
              ...prev,
              { id: 'res-' + Date.now(), type: 'ai', text: newAnalysis },
              { id: 'ask-' + Date.now(), type: 'ai', text: "🎯 Analysis complete! Would you like me to rewrite your CV using the neural engine?", isAction: true }
            ];
          });
          setShowRewriteOption(true);
          setIsTyping(false);
        }

        if (newRewritten) {
          setMessages(prev => [
            ...prev,
            { id: 'rew-' + Date.now(), type: 'ai', text: "✨ Optimized CV Data Stream:\n\n" + newRewritten }
          ]);
          setShowRewriteOption(false);
          setIsTyping(false);
        }
      })
      .subscribe();

    const cleanup = () => { supabase.removeChannel(channel); };
    channelCleanupRef.current = cleanup;
    return cleanup;
  };

  // ── Coin deduction helper ──────────────────────────────────────────────
  // p_reference MUST come from the Tally form submission_id (subId), never Paymob.
  const spendCoins = async (amount: number, reason: string): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Authentication required. Please log in.");
      navigate('/login');
      return false;
    }
    const { error } = await supabase.rpc('spend_coins', {
      p_amount:    amount,
      p_reason:    reason,
      p_reference: subId ?? currentRecordId ?? user.id,
    });
    if (error) {
      toast.error("Insufficient coin balance — please top up on the Plans page.");
      navigate('/plans');
      return false;
    }
    return true;
  };

  // ── Quick reply handler: options 1 / 2 / 3 ──
  const handleQuickReply = async (option: 1 | 2 | 3) => {
    // Option 3 → enter JD paste mode (6 coins deducted on Send)
    if (option === 3) {
      setJdAnalysisPending(true);
      setShowQuickReplies(false);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(), type: 'user',
          text: "3️⃣ Paste or Upload Job Description for CV Matching\nلصق أو رفع وصف وظيفي لمطابقة الـ CV"
        },
        {
          id: (Date.now() + 1).toString(), type: 'ai',
          text: "الرجاء لصق الوصف الوظيفي أدناه أو رفع الملف، وسأقوم بمطابقته مع بيانات سيرتك الذاتية.\n\nPlease paste the Job Description below or upload the file, and I'll match it against your CV profile."
        }
      ]);
      return;
    }

    // Options 1 & 2 → deduct 1 Coin each
    const coinsOk = await spendCoins(1, option === 1 ? 'ai_job_search_titles' : 'ai_job_search_markets');
    if (!coinsOk) return;

    const labels: Record<number, string> = {
      1: "1️⃣ أفضل المسميات الوظيفية المناسبة لخبرتي / Best Matching Position Titles",
      2: "2️⃣ الأسواق والقطاعات الأنسب للبحث عن عمل / Target Markets & Industries",
    };

    const questions: Record<number, string> = {
      1: "Based on the provided CV data (gpt_results), identify the top 7-10 best matching job titles and position names that perfectly align with this person's experience, skills, and education. Format as a numbered list with a brief 1-2 sentence explanation for each title. Include both Arabic market and international titles where relevant.",
      2: "Based on the provided CV data (gpt_results), identify the top 5-7 target industries, markets, and sectors for this person's job search. For each, explain why it's a great fit, which specific types of companies to target, and what the job market looks like in that sector.",
    };

    setShowQuickReplies(false);
    setMessages(prev => [...prev, { id: Date.now().toString(), type: 'user', text: labels[option] }]);
    setIsTyping(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error("Authentication Required.");
      const accessToken = session?.access_token;

      // Insert record for realtime tracking
      const { data: inserted } = await supabase.from('cv_analysis_requests')
        .insert([{
          user_id:          user.id,
          user_email:       user.email,
          jd_json:          { description: questions[option], query_type: option === 1 ? 'position_titles' : 'target_markets' },
          cv_content_json:  { gpt_results: gptResults, sub_id: subId },
        }]).select().single();

      if (inserted) {
        setCurrentRecordId(inserted.id);
        setupRealtimeListener(inserted.id);
      }

      if (!ANALYSIS_WEBHOOK) {
        setIsTyping(false);
        toast.error("Analysis service is not configured.");
        return;
      }

      typingTimerRef.current = setTimeout(() => {
        setIsTyping(false);
        toast.error("Analysis is taking longer than expected. Please try again.");
      }, 90_000);

      fetch(ANALYSIS_WEBHOOK, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          query_type:  option === 1 ? 'position_titles' : 'target_markets',
          question:    questions[option],
          gpt_results: gptResults,
          sub_id:      subId,
          analysis:    inserted,
        }),
      }).catch(e => console.error("Webhook Dispatch Failed", e));

    } catch (error: any) {
      setIsTyping(false);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      toast.error("System Error: " + error.message);
    }
  };

  // ── Send message (JD paste / file upload / free-text) ──
  const handleSendMessage = async () => {
    if (!inputValue.trim() && !selectedFile) return;

    // JD Analysis costs 6 Coins — deduct before proceeding
    if (jdAnalysisPending) {
      const coinsOk = await spendCoins(6, 'jd_analysis_rewrite');
      if (!coinsOk) return;
      setJdAnalysisPending(false);
    }

    const userText = inputValue || (selectedFile ? `File Injected: ${selectedFile.name}` : "");
    setMessages(prev => [...prev, { id: Date.now().toString(), type: 'user', text: userText, hasAttachment: !!selectedFile }]);

    const jd   = inputValue;
    const file = selectedFile;
    setInputValue("");
    setSelectedFile(null);
    setIsTyping(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error("Authentication Required.");
      const accessToken = session?.access_token;

      let extractedText = "";
      let fileUrl = "";

      if (file) {
        const arrayBuffer = await file.arrayBuffer();
        if (file.name.toLowerCase().endsWith('.docx')) {
          const result = await mammoth.extractRawText({ arrayBuffer });
          extractedText = result.value;
        } else if (file.name.toLowerCase().endsWith('.pdf')) {
          const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
          let fullText = "";
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            fullText += content.items.map((item: any) => (item as any).str).join(" ") + "\n";
          }
          extractedText = fullText;
        }
        const uniqueName = `${user.id}/${Date.now()}_${file.name}`;
        await supabase.storage.from('cv_uploads').upload(uniqueName, file);
        const { data: signedData } = await supabase.storage
          .from('cv_uploads').createSignedUrl(uniqueName, 604800);
        fileUrl = signedData?.signedUrl ?? "";
      }

      const analysisPayload = {
        user_id:        user.id,
        user_email:     user.email,
        cv_file_name:   file?.name,
        cv_file_url:    fileUrl,
        jd_json:        { description: jd },
        cv_content_json: {
          raw_text: extractedText,
          ...(gptResults && { gpt_results: gptResults }),
        },
      };

      let finalRecord;
      if (currentRecordId) {
        const { data: updated } = await supabase.from('cv_analysis_requests')
          .update({ ...analysisPayload, analysis_result: null, rewritten_cv_result: null })
          .eq('id', currentRecordId).select().single();
        finalRecord = updated;
      } else {
        const { data: inserted } = await supabase.from('cv_analysis_requests')
          .insert([analysisPayload]).select().single();
        finalRecord = inserted;
        if (finalRecord) {
          setCurrentRecordId(finalRecord.id);
          window.history.pushState({}, '', `?record_id=${finalRecord.id}`);
          setupRealtimeListener(finalRecord.id);
        }
      }

      const fullPayload = {
        question: jd,   // JD text as explicit question field
        analysis: finalRecord || analysisPayload,
        // Include gpt_results context if available (cv_archive subid flow)
        ...(gptResults && {
          gpt_results: gptResults,
          sub_id:      subId,
          query_type:  'jd_matching',
        }),
      };

      if (!ANALYSIS_WEBHOOK) {
        setIsTyping(false);
        toast.error("Analysis service is not configured.");
        return;
      }

      typingTimerRef.current = setTimeout(() => {
        setIsTyping(false);
        toast.error("Analysis is taking longer than expected. Please try again.");
      }, 90_000);

      fetch(ANALYSIS_WEBHOOK, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify(fullPayload),
      }).catch(e => console.error("Webhook Dispatch Failed", e));

    } catch (error: any) {
      setIsTyping(false);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      toast.error("System Error: " + error.message);
    }
  };

  // ── Rewrite decision — costs 3 Coins ──
  const handleRewriteDecision = async (decision: boolean) => {
    if (decision) {
      // Deduct 3 Coins before triggering the rewrite
      const coinsOk = await spendCoins(3, 'cv_cover_rewrite');
      if (!coinsOk) return;

      setShowRewriteOption(false);
      setMessages(prev => [
        ...prev,
        { id: Date.now().toString(), type: 'user', text: "Initiate professional rewrite protocol." }
      ]);
      setIsTyping(true);

      // Trigger CV rewrite via the analysis webhook
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        const accessToken = session?.access_token;
        if (user && ANALYSIS_WEBHOOK && currentRecordId) {
          fetch(ANALYSIS_WEBHOOK, {
            method: "POST",
            headers: {
              "Content-Type":  "application/json",
              "Authorization": `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              query_type:  'cv_rewrite',
              record_id:   currentRecordId,
              gpt_results: gptResults,
              sub_id:      subId,
            }),
          }).catch(e => console.error("Rewrite webhook failed", e));
        }
        typingTimerRef.current = setTimeout(() => {
          setIsTyping(false);
          toast.error("Rewrite is taking longer than expected. Please try again.");
        }, 90_000);
      } catch (error: any) {
        setIsTyping(false);
        toast.error("System Error: " + error.message);
      }
    } else {
      setShowRewriteOption(false);
      setMessages(prev => [...prev, { id: Date.now().toString(), type: 'user', text: "Abort rewrite." }]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setSelectedFile(e.target.files[0]);
  };

  // ── Payment ──
  const handleAnalysisPlanPayment = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !currentRecordId) return;

    const region  = await detectRegion();
    const isEgypt = region === "EG";

    if (isEgypt) {
      const customParams =
        `&shipping_data.first_name=${user.id}` +
        `&shipping_data.extra_description=${currentRecordId}` +
        `&shipping_data.last_name=Customer` +
        `&shipping_data.email=${encodeURIComponent(user.email || "")}` +
        `&shipping_data.phone_number=00000000` +
        `&shipping_data.street=NA` +
        `&shipping_data.city=NA` +
        `&shipping_data.country=EG`;
      const uniqueOrderId = `ANALYSIS_PLAN_${currentRecordId}_${user.id}_${Date.now()}`;
      window.location.href = `${ANALYSIS_PLAN_LINK}${customParams}&merchant_order_id=${uniqueOrderId}`;
    } else {
      const PRE_PAYMENT_WEBHOOK = import.meta.env.VITE_MAKE_PRE_PAYMENT;
      if (!PRE_PAYMENT_WEBHOOK) return;
      try {
        const response = await fetch(PRE_PAYMENT_WEBHOOK, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Resumation-Secret": import.meta.env.VITE_WEBHOOK_SECRET as string,
          },
          body: JSON.stringify({
            user_id: user.id, email: user.email,
            payment_id: currentRecordId, plan: "analysis",
            region, amount: 10, currency: "USD", payment_method: "whish",
          }),
        });
        const result     = await response.json().catch(() => ({}));
        const collectUrl = result?.collectUrl || result?.data?.collectUrl || result?.url || result?.paymentUrl;
        if (collectUrl) {
          let finalUrl = collectUrl.trim();
          if (!finalUrl.startsWith("http")) finalUrl = `https://${finalUrl}`;
          window.location.replace(finalUrl);
        }
      } catch (err) { console.warn("Analysis Whish payment error:", err); }
    }
  };

  /* ─────────────────────────── UI ─────────────────────────── */
  return (
    <div
      className="bg-[#0D1117] font-sans text-white flex flex-col overflow-hidden"
      style={{ height: 'calc(100vh - 4rem)' }}
    >
      <div className="flex-1 min-h-0 flex flex-col p-4 md:p-5">

        {/* ══════════ CHAT BOX ══════════ */}
        <div className="flex-1 min-h-0 flex flex-col rounded-2xl overflow-hidden border border-[rgba(60,80,125,0.25)] shadow-[0_8px_60px_rgba(0,0,0,0.70)]">

          {/* ▸ HEADER — always shows messages[0] ◂ */}
          <div className="shrink-0 bg-[rgba(60,80,125,0.09)] backdrop-blur-xl px-5 py-4 flex items-start gap-4 border-b border-[rgba(60,80,125,0.15)]">
            <div className="w-12 h-12 rounded-2xl bg-[#112250] border border-[rgba(18,178,193,0.25)] flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(18,178,193,0.10)]">
              <BrainCircuit className="w-6 h-6 text-[#12B2C1]" />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-white font-semibold text-sm leading-relaxed whitespace-pre-wrap">
                {messages[0]?.text ?? "Welcome to the Neural Analysis Node. 🧠\nPlease upload your CV and paste the Job Description to initialize the protocol."}
              </p>
            </div>
          </div>

          {/* ▸ MESSAGES BODY ◂ */}
          <div className="flex-1 min-h-0 overflow-y-auto bg-[#0D1117] scrollbar-hide">
            <div className="p-5 md:p-6 space-y-5">

              {/* Messages from index 1 onward */}
              {messages.slice(1).map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.type === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                    msg.type === 'user'
                      ? 'bg-[rgba(224,197,143,0.12)] border-[rgba(224,197,143,0.28)] text-[#E0C58F]'
                      : 'bg-[#112250] border-[rgba(18,178,193,0.2)] text-[#12B2C1]'
                  }`}>
                    {msg.type === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  <div className={`flex flex-col ${msg.type === 'user' ? 'items-end' : 'items-start'} max-w-[82%]`}>
                    <div className={`rounded-2xl px-4 py-3.5 whitespace-pre-wrap text-sm leading-relaxed border ${
                      msg.type === 'user'
                        ? 'bg-[rgba(224,197,143,0.09)] border-[rgba(224,197,143,0.22)] text-white/90 rounded-tr-sm'
                        : 'bg-[rgba(60,80,125,0.06)] border-[rgba(60,80,125,0.18)] text-[#F5F0E9]/80 rounded-tl-sm'
                    }`}>
                      {msg.hasAttachment && (
                        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#E0C58F] mb-2.5">
                          <Paperclip className="w-3 h-3" /> File Attached
                        </div>
                      )}
                      <p className="font-medium leading-relaxed">{msg.text}</p>
                    </div>

                    {/* Rewrite decision buttons */}
                    {msg.isAction && showRewriteOption && (
                      <div className="flex flex-wrap gap-2.5 mt-3 animate-in slide-in-from-top-2">
                        <button
                          onClick={() => handleRewriteDecision(true)}
                          className="flex items-center gap-2 px-5 py-2.5 bg-[#E0C58F] text-[#0D1117] rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-[#F0DFBF] shadow-[0_0_18px_rgba(224,197,143,0.25)] transition-all active:scale-95"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" /> Rewrite My CV
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-black text-[#0D1117]/60 bg-[#0D1117]/10 border border-[#0D1117]/15">✍️ 3 Coins</span>
                        </button>
                        <button
                          onClick={() => handleRewriteDecision(false)}
                          className="flex items-center gap-2 px-5 py-2.5 bg-white/[0.04] text-white/40 rounded-xl font-bold text-xs uppercase tracking-widest hover:text-white/60 border border-white/[0.08] transition-all"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" /> No Thanks
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* ── Interactive Quick Replies ── */}
              {showQuickReplies && (
                <div className="animate-in slide-in-from-bottom-4 duration-500 space-y-2.5 pt-1">
                  <p className="text-[11px] text-[#7A8FAA] font-semibold uppercase tracking-widest text-center mb-3">
                    Choose an option / اختر خياراً
                  </p>

                  {/* Option 1 — 🔍 1 Coin */}
                  <button
                    onClick={() => handleQuickReply(1)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 bg-[rgba(60,80,125,0.06)] hover:bg-[rgba(18,178,193,0.06)] border border-[rgba(60,80,125,0.15)] hover:border-[rgba(18,178,193,0.3)] rounded-xl transition-all duration-200 text-start group"
                  >
                    <span className="text-xl shrink-0">1️⃣</span>
                    <span className="flex-1 leading-snug">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-[#F5F0E9] group-hover:text-[#12B2C1] transition-colors">Best Matching Position Titles</span>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black text-amber-400 bg-amber-400/10 border border-amber-400/20 shrink-0">🔍 1 Coin</span>
                      </span>
                      <span className="block text-xs text-[#7A8FAA] mt-0.5">أفضل المسميات الوظيفية المناسبة لخبرتك ودراستك</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-[rgba(60,80,125,0.5)] group-hover:text-[#12B2C1] shrink-0 transition-colors" />
                  </button>

                  {/* Option 2 — 🔍 1 Coin */}
                  <button
                    onClick={() => handleQuickReply(2)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 bg-[rgba(60,80,125,0.06)] hover:bg-[rgba(18,178,193,0.06)] border border-[rgba(60,80,125,0.15)] hover:border-[rgba(18,178,193,0.3)] rounded-xl transition-all duration-200 text-start group"
                  >
                    <span className="text-xl shrink-0">2️⃣</span>
                    <span className="flex-1 leading-snug">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-[#F5F0E9] group-hover:text-[#12B2C1] transition-colors">Target Markets & Industries</span>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black text-amber-400 bg-amber-400/10 border border-amber-400/20 shrink-0">🔍 1 Coin</span>
                      </span>
                      <span className="block text-xs text-[#7A8FAA] mt-0.5">الأسواق والقطاعات الأنسب لك للبحث عن عمل</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-[rgba(60,80,125,0.5)] group-hover:text-[#12B2C1] shrink-0 transition-colors" />
                  </button>

                  {/* Option 3 — 📋 6 Coins (charged on Send) */}
                  <button
                    onClick={() => handleQuickReply(3)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 bg-[rgba(224,197,143,0.06)] hover:bg-[rgba(224,197,143,0.12)] border border-[rgba(224,197,143,0.18)] hover:border-[rgba(224,197,143,0.38)] rounded-xl transition-all duration-200 text-start group"
                  >
                    <span className="text-xl shrink-0">3️⃣</span>
                    <span className="flex-1 leading-snug">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-[#E0C58F]">Paste or Upload Job Description for CV Matching</span>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black text-amber-400 bg-amber-400/10 border border-amber-400/20 shrink-0">📋 6 Coins</span>
                      </span>
                      <span className="block text-xs text-[#E0C58F]/45 mt-0.5">لصق أو رفع وصف وظيفي لمطابقة الـ CV عليه</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#E0C58F]/30 group-hover:text-[#E0C58F] shrink-0 transition-colors" />
                  </button>
                </div>
              )}

              {/* Payment card removed — rewrite now uses Coin economy (3 Coins via handleRewriteDecision) */}

              {/* ── Typing indicator ── */}
              {isTyping && (
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#112250] border border-[rgba(18,178,193,0.2)] shrink-0 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-[rgba(18,178,193,0.5)]" />
                  </div>
                  <div className="bg-[rgba(60,80,125,0.06)] border border-[rgba(60,80,125,0.18)] rounded-2xl rounded-tl-sm px-5 py-3.5 flex items-center gap-3">
                    <Loader2 className="w-4 h-4 text-[#12B2C1] animate-spin shrink-0" />
                    <span className="text-[#7A8FAA] text-xs font-semibold uppercase tracking-widest italic">Analyzing Career Matrix…</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* ▸ INPUT FOOTER ◂ */}
          <div className="shrink-0 bg-[rgba(60,80,125,0.09)] backdrop-blur-xl border-t border-[rgba(60,80,125,0.15)] px-4 py-4">
            {selectedFile && (
              <div className="mb-3 px-4 py-2.5 bg-[rgba(224,197,143,0.07)] border border-[rgba(224,197,143,0.20)] text-[#E0C58F] rounded-xl text-xs flex items-center justify-between font-semibold uppercase tracking-wider">
                <span className="flex items-center gap-2 min-w-0 truncate">
                  <FileText className="w-3.5 h-3.5 shrink-0" /> {selectedFile.name}
                </span>
                <button onClick={() => setSelectedFile(null)} className="hover:text-red-400 transition-colors ml-3 shrink-0">
                  Remove
                </button>
              </div>
            )}

            <div className="flex items-center gap-3 bg-[rgba(60,80,125,0.06)] rounded-2xl px-4 py-2.5 border border-[rgba(60,80,125,0.2)] focus-within:border-[rgba(18,178,193,0.45)] transition-all duration-200">
              <label className="cursor-pointer text-[#7A8FAA] hover:text-[#12B2C1] transition-colors duration-200 shrink-0">
                <input type="file" accept=".pdf,.docx" className="hidden" onChange={handleFileChange} />
                <Paperclip className="w-5 h-5" />
              </label>

              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
                }}
                placeholder={gptResults
                  ? "Type your question or paste a Job Description…"
                  : "Paste job description or requirements…"
                }
                className="flex-1 bg-transparent border-none py-1.5 focus:outline-none resize-none max-h-32 text-sm font-medium text-[#F5F0E9] placeholder:text-[#7A8FAA] leading-relaxed"
                rows={1}
              />

              <button
                onClick={handleSendMessage}
                disabled={(!inputValue.trim() && !selectedFile) || isTyping}
                className="bg-[#E0C58F] text-[#0D1117] px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-[#F0DFBF] shadow-[0_0_18px_rgba(224,197,143,0.22)] active:scale-95 transition-all duration-200 disabled:opacity-25 disabled:cursor-not-allowed shrink-0 flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                {jdAnalysisPending
                  ? <><span>Send</span><span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-black text-[#0D1117]/60 bg-[#0D1117]/10 border border-[#0D1117]/15">📋 6 Coins</span></>
                  : <span>Send</span>
                }
              </button>
            </div>
          </div>

        </div>{/* end CHAT BOX */}
      </div>
    </div>
  );
}

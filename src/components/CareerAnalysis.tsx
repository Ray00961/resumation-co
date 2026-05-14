import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  BrainCircuit, Loader2, ArrowLeft, Send, Paperclip, 
  User, Bot, FileText, Check, Sparkles, 
  ThumbsUp, ThumbsDown, Shield, Activity, Zap
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

export default function CareerAnalysis() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', type: 'ai', text: "Welcome to the Neural Analysis Node. 🧠\nPlease upload your CV and paste the Job Description to initialize the protocol." }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showRewriteOption, setShowRewriteOption] = useState(false);
  const [isDecisionMade, setIsDecisionMade] = useState(false); 
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const ANALYSIS_PLAN_LINK = "https://accept.paymobsolutions.com/standalone?ref=p_LRR2V2VhcEw4aHBvSDV6R0hKTEJheE42UT09XytuU2hOT0pId0czbDJpcHZlMjdKT1E9PQ";
  const ANALYSIS_WEBHOOK = import.meta.env.VITE_MAKE_CAREER_ANALYSIS;

  useEffect(() => {
    const initChat = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) setUserEmail(session.user.email ?? null);

      const params = new URLSearchParams(window.location.search);
      let rid = params.get("record_id");

      if (rid) {
        setCurrentRecordId(rid);
        loadExistingData(rid);
        window.history.pushState({}, '', `/career-analysis?record_id=${rid}`);
      }
    };
    initChat();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const loadExistingData = async (id: string) => {
    setIsTyping(true);
    const { data } = await supabase.from('cv_analysis_requests').select('*').eq('id', id).single();

    if (data) {
      const history: Message[] = [{ id: '1', type: 'ai', text: "Re-establishing connection to secure node..." }];
      let jdText = data.jd_json?.description || (typeof data.jd_json === 'string' ? data.jd_json : "");
      if (jdText) history.push({ id: 'jd-init', type: 'user', text: jdText });
      if (data.cv_file_name) history.push({ id: 'cv-init', type: 'user', text: `CV Uploaded: ${data.cv_file_name}`, hasAttachment: true });

      if (data.analysis_result) {
        history.push({ id: 'ai-init', type: 'ai', text: data.analysis_result });
        if (!data.rewritten_cv_result) {
          history.push({ id: 'ai-ask-init', type: 'ai', text: "🎯 Analysis complete! Would you like me to rewrite your CV using the neural engine?", isAction: true });
          setShowRewriteOption(true);
        }
        setIsTyping(false);
      }
      if (data.rewritten_cv_result) {
        history.push({ id: 'ai-rew', type: 'ai', text: "✨ Optimized CV Data Stream:\n\n" + data.rewritten_cv_result });
        setShowRewriteOption(false);
      }
      setMessages(history);
      setupRealtimeListener(id);
    } else {
      setIsTyping(false);
    }
  };

  const setupRealtimeListener = (id: string) => {
    console.log("📡 Monitoring Analysis Node:", id);

    const channel = supabase.channel(`results-${id}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'cv_analysis_requests', 
        filter: `id=eq.${id}` 
      }, (payload) => {
        console.log("🔮 Real-time burst received:", payload.new);

        if (payload.new.analysis_result) {
          setMessages(prev => {
            if (prev.find(m => m.text === payload.new.analysis_result)) return prev;
            return [
              ...prev, 
              { id: 'res-' + Date.now(), type: 'ai', text: payload.new.analysis_result },
              { id: 'ask-' + Date.now(), type: 'ai', text: "🎯 Analysis complete! Would you like me to rewrite your CV using the neural engine?", isAction: true }
            ];
          });
          setShowRewriteOption(true);
          setIsTyping(false);
        }

        if (payload.new.rewritten_cv_result) {
          setMessages(prev => [
            ...prev, 
            { id: 'rew-' + Date.now(), type: 'ai', text: "✨ Optimized CV Data Stream:\n\n" + payload.new.rewritten_cv_result }
          ]);
          setShowRewriteOption(false);
          setIsDecisionMade(false);
          setIsTyping(false);
        }
      })
      .subscribe((status) => {
        console.log("🌐 Subscription Status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() && !selectedFile) return;

    const userText = inputValue || (selectedFile ? `File Injected: ${selectedFile.name}` : "");
    setMessages(prev => [...prev, { id: Date.now().toString(), type: 'user', text: userText, hasAttachment: !!selectedFile }]);

    const jd = inputValue;
    const file = selectedFile;
    setInputValue("");
    setSelectedFile(null);
    setIsTyping(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication Required.");

      const { data: userData } = await supabase.from('users').select('*').eq('id', user.id).single();

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
        const uniqueName = `${Date.now()}_${file.name}`;
        await supabase.storage.from('cv_uploads').upload(uniqueName, file);
        fileUrl = supabase.storage.from('cv_uploads').getPublicUrl(uniqueName).data.publicUrl;
      }

      const analysisPayload = {
        user_id: user.id,
        user_email: user.email,
        cv_file_name: file?.name,
        cv_file_url: fileUrl,
        jd_json: { description: jd },
        cv_content_json: { raw_text: extractedText }
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
        analysis: finalRecord || analysisPayload,
        user_profile: userData || { id: user.id, email: user.email }
      };

      fetch(ANALYSIS_WEBHOOK!, { 
        method: "POST", 
        body: JSON.stringify(fullPayload) 
      }).catch(e => console.error("Webhook Dispatch Failed"));

      setTimeout(() => {
        setIsTyping(prev => {
          if (prev) console.log("⏳ Waiting for neural response...");
          return prev;
        });
      }, 30000);

    } catch (error: any) {
      setIsTyping(false);
      toast.error("System Error: " + error.message);
    }
  };

  const handleRewriteDecision = (decision: boolean) => {
    if (decision) {
      setIsDecisionMade(true);
      setMessages(prev => [...prev, { id: Date.now().toString(), type: 'user', text: "Initiate professional rewrite protocol." }]);
    } else {
      setShowRewriteOption(false);
      setMessages(prev => [...prev, { id: Date.now().toString(), type: 'user', text: "Abort rewrite." }]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setSelectedFile(e.target.files[0]);
  };

  const handleAnalysisPlanPayment = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !currentRecordId) return;

    const customParams = 
      `&shipping_data.first_name=${user.id}` +
      `&shipping_data.extra_description=${currentRecordId}` +
      `&shipping_data.last_name=Customer` +
      `&shipping_data.email=${user.email}` +
      `&shipping_data.phone_number=00000000` +
      `&shipping_data.street=NA` +
      `&shipping_data.city=NA` +
      `&shipping_data.country=NA`;

    const uniqueOrderId = `ANALYSIS_PLAN_${currentRecordId}_${user.id}_${Date.now()}`;
    window.location.href = `${ANALYSIS_PLAN_LINK}${customParams}&merchant_order_id=${uniqueOrderId}`;
  };

  return (
    <div className="min-h-screen bg-[#050B14] p-4 md:p-6 flex flex-col items-center font-sans text-slate-300 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[60vw] h-[60vw] bg-cyan-600/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[50vw] h-[50vw] bg-fuchsia-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-5xl w-full flex-1 flex flex-col h-[90vh] relative z-10">
        <div className="flex items-center justify-between mb-6 shrink-0 border-b border-white/5 pb-4">
          <button onClick={() => navigate('/dashboard')} className="flex items-center text-slate-500 hover:text-cyan-400 transition-all font-black text-[10px] uppercase tracking-widest group">
            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" /> Exit Node
          </button>
          <div className="bg-[#0A1324]/60 backdrop-blur-md px-4 py-2 rounded-xl border border-cyan-500/20 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
            <BrainCircuit className="w-4 h-4 animate-pulse" /> Neural AI Analyzer
          </div>
        </div>

        <div className="bg-[#0A1324]/40 backdrop-blur-2xl rounded-[2.5rem] border border-white/5 flex flex-1 overflow-hidden shadow-2xl relative">
          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-4 ${msg.type === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all ${msg.type === 'user' ? 'bg-cyan-600/20 border-cyan-500/30 text-cyan-400' : 'bg-white/5 border-white/10 text-fuchsia-400'}`}>
                    {msg.type === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                  </div>
                  <div className={`flex flex-col ${msg.type === 'user' ? 'items-end' : 'items-start'} max-w-[85%]`}>
                    <div className={`rounded-2xl p-5 shadow-xl whitespace-pre-wrap text-sm md:text-base leading-relaxed border ${msg.type === 'user' ? 'bg-cyan-600/10 border-cyan-500/20 text-slate-200 rounded-tr-none' : 'bg-white/5 border-white/10 text-slate-300 rounded-tl-none'}`}>
                      {msg.hasAttachment && <div className="text-[9px] font-black uppercase mb-3 text-cyan-500 tracking-widest flex items-center gap-1"><Paperclip className="w-3 h-3"/> Data Stream Attached</div>}
                      <p className="font-medium tracking-wide">{msg.text}</p>
                    </div>
                    {msg.isAction && !isDecisionMade && showRewriteOption && (
                      <div className="flex gap-2 mt-4 animate-in slide-in-from-top-2">
                        <button onClick={() => handleRewriteDecision(true)} className="flex items-center gap-2 px-6 py-2.5 bg-cyan-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-cyan-500 shadow-lg transition-all active:scale-95"><ThumbsUp className="w-3 h-3" /> Initialize Rewrite</button>
                        <button onClick={() => handleRewriteDecision(false)} className="flex items-center gap-2 px-6 py-2.5 bg-white/5 text-slate-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:text-white transition-all border border-white/5"><ThumbsDown className="w-3 h-3" /> Decline</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isDecisionMade && showRewriteOption && (
                <div className="max-w-sm mx-auto bg-gradient-to-br from-cyan-900/40 via-[#0A1324] to-fuchsia-900/20 p-1 backdrop-blur-3xl rounded-[2.5rem] shadow-2xl animate-in slide-in-from-bottom-6 duration-700 mt-8 mb-8 border border-cyan-500/20">
                  <div className="bg-[#050B14]/80 p-8 rounded-[2.4rem] text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
                    <div className="bg-cyan-500/10 text-cyan-400 px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest mb-6 inline-block border border-cyan-500/20">Upgrade Protocol</div>
                    <h3 className="text-xl font-black text-white mb-4 uppercase tracking-tighter">Neural CV Optimization</h3>
                    <div className="my-8 text-white bg-white/5 py-6 rounded-3xl border border-white/5 shadow-inner">
                        <span className="text-5xl font-black italic tracking-tighter text-cyan-400">250</span> 
                        <span className="text-[10px] font-black opacity-40 uppercase tracking-widest ml-2">EGP</span>
                    </div>
                    <button onClick={handleAnalysisPlanPayment} className="w-full py-5 bg-cyan-600 text-white font-black rounded-2xl hover:bg-cyan-500 transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] flex justify-center items-center gap-3 uppercase text-[10px] tracking-[0.2em]">
                        <Sparkles className="w-4 h-4 animate-pulse"/> Buy Rewrite Now
                    </button>
                  </div>
                </div>
              )}

              {isTyping && (
                <div className="flex gap-4 animate-pulse">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10" />
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-sm flex items-center gap-3">
                        <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />
                        <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest italic">Analyzing Career Matrix...</span>
                    </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-6 bg-[#050B14]/40 border-t border-white/5 shrink-0">
              {selectedFile && (
                <div className="mb-4 px-5 py-3 bg-cyan-500/5 text-cyan-400 rounded-xl text-[10px] flex items-center justify-between font-black uppercase tracking-[0.2em] border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.05)]">
                    <span className="flex items-center gap-2"><FileText className="w-3 h-3" /> {selectedFile.name}</span>
                    <button onClick={() => setSelectedFile(null)} className="hover:text-red-500 transition-colors uppercase">Remove</button>
                </div>
              )}
              <div className="flex gap-3 items-end bg-[#050B14] p-2 rounded-[2rem] border border-white/5 focus-within:border-cyan-500/30 transition-all">
                <label className="cursor-pointer p-4 text-slate-600 hover:text-cyan-400 transition-all">
                    <input type="file" accept=".pdf,.docx" className="hidden" onChange={handleFileChange} />
                    <Paperclip className="w-6 h-6" />
                </label>
                <textarea 
                    value={inputValue} 
                    onChange={(e) => setInputValue(e.target.value)} 
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} 
                    placeholder="Input Job Requirements / Description..." 
                    className="flex-1 bg-transparent border-none p-4 focus:outline-none resize-none max-h-32 text-sm font-medium text-slate-200 placeholder-slate-700" 
                    rows={1} 
                />
                <button 
                    onClick={handleSendMessage} 
                    disabled={(!inputValue.trim() && !selectedFile) || isTyping} 
                    className="bg-cyan-600 text-white p-5 rounded-[1.5rem] hover:bg-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.2)] active:scale-95 transition-all disabled:opacity-20"
                >
                    <Send className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
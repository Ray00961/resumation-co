import { useNavigate } from "react-router-dom";

export default function GoodbyePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-cyber-bg flex items-center justify-center px-4">
      {/* Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyber-teal/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center max-w-md gap-8">

        {/* Icon */}
        <div className="w-20 h-20 rounded-3xl bg-cyber-teal/10 border border-cyber-teal/20 flex items-center justify-center text-4xl">
          👋
        </div>

        {/* Text */}
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-black text-white uppercase tracking-wide">
            Take Care!
          </h1>
          <p className="text-cyber-dim text-sm leading-relaxed">
            Your account and all associated data have been permanently removed.<br />
            We're sorry to see you go — but the door is always open.
          </p>
        </div>

        {/* Divider */}
        <div className="w-16 h-px bg-white/10" />

        {/* CTA */}
        <div className="flex flex-col gap-3 w-full">
          <button
            onClick={() => navigate("/")}
            className="w-full py-3.5 rounded-2xl bg-cyber-teal/10 border border-cyber-teal/20 text-cyber-teal font-black text-[12px] uppercase tracking-widest hover:bg-cyber-teal hover:text-white transition-all"
          >
            Back to Resumation.co
          </button>
          <p className="text-[11px] text-cyber-dim/50 font-bold">
            You can always create a new account whenever you're ready.
          </p>
        </div>

      </div>
    </div>
  );
}

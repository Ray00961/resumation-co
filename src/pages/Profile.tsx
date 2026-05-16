import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import {
  User, Briefcase, Zap, Edit3, Loader2,
  MapPin, Link2, ArrowLeft, Activity,
} from "lucide-react";

interface Experience {
  id:          string;
  title:       string;
  company:     string;
  duration:    string;
  description: string;
}

interface Profile {
  id:         string;
  full_name:  string;
  headline:   string;
  location:   string;
  website:    string;
  about:      string;
  avatar_url: string;
  cover_url:  string;
  skills:     string[];
  experience: Experience[];
}

export default function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { navigate("/login"); return; }

        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();

        if (error && error.code !== "PGRST116") throw error;

        if (data) {
          setProfile(data);
        } else {
          const meta = session.user.user_metadata;
          setProfile({
            id:         session.user.id,
            full_name:  meta?.full_name || session.user.email?.split("@")[0] || "User",
            headline:   "",
            location:   "",
            website:    "",
            about:      "",
            avatar_url: meta?.avatar_url || "",
            cover_url:  "",
            skills:     [],
            experience: [],
          });
        }
      } catch (err) {
        console.error("Profile fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cyber-bg">
        <Loader2 className="animate-spin text-cyber-cyan w-10 h-10" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cyber-bg text-cyber-text/90 font-sans relative overflow-x-hidden">

      {/* Ambient glows */}
      <div className="absolute top-0 right-0 w-[65vw] h-[65vw] bg-cyber-teal/8 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[55vw] h-[55vw] bg-cyber-teal/5 rounded-full blur-[130px] pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-10">

        {/* ── Top nav ── */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-cyber-dim hover:text-cyber-cyan transition-colors text-[10px] font-black uppercase tracking-widest"
          >
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </button>
          <div className="flex items-center gap-2 text-cyber-cyan text-[10px] font-black uppercase tracking-[0.4em]">
            <Activity className="w-3 h-3" /> Professional Profile
          </div>
        </div>

        {/* ── Cover + Avatar ── */}
        <div className="relative rounded-[2rem] overflow-visible mb-6 shadow-2xl">
          <div
            className="h-52 w-full rounded-[2rem] bg-gradient-to-br from-cyber-teal/30 via-cyber-bg to-cyber-cyan/20 border border-white/10"
            style={
              profile?.cover_url
                ? { backgroundImage: `url(${profile.cover_url})`, backgroundSize: "cover", backgroundPosition: "center" }
                : {}
            }
          />
          {/* Neon line */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyber-teal/50 to-transparent" />
          {/* Avatar */}
          <div className="absolute -bottom-10 left-8">
            <div className="w-24 h-24 rounded-2xl border-2 border-cyber-teal/50 bg-cyber-bg shadow-[0_0_30px_rgba(13,138,158,0.3)] flex items-center justify-center overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-cyber-cyan" />
              )}
            </div>
          </div>
        </div>

        {/* ── Name / Headline ── */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] px-8 pt-16 pb-8 mb-4 shadow-xl">
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div>
              <h1 className="text-3xl lg:text-4xl font-black text-white tracking-tight mb-1">
                {profile?.full_name || "Your Name"}
              </h1>
              <p className="text-cyber-cyan font-semibold text-sm mb-3 min-h-[1.25rem]">
                {profile?.headline || (
                  <span className="text-cyber-dim italic font-normal">No headline set</span>
                )}
              </p>
              <div className="flex flex-wrap gap-4 text-[11px] text-cyber-muted font-medium">
                {profile?.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 text-cyber-teal" />
                    {profile.location}
                  </span>
                )}
                {profile?.website && (
                  <span className="flex items-center gap-1.5">
                    <Link2 className="w-3 h-3 text-cyber-cyan" />
                    {profile.website}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => navigate("/my-account")}
              className="flex items-center gap-2 px-5 py-2.5 bg-cyber-teal/10 border border-cyber-teal/25 rounded-2xl text-cyber-cyan hover:bg-cyber-teal/20 hover:border-cyber-teal/50 transition-all text-[10px] font-black uppercase tracking-widest"
            >
              <Edit3 className="w-3 h-3" /> Edit Profile
            </button>
          </div>
        </div>

        {/* ── About ── */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 mb-4 shadow-xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-1 h-5 bg-gradient-to-b from-cyber-teal to-cyber-cyan rounded-full shadow-[0_0_8px_rgba(13,138,158,0.5)]" />
            <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-white">About</h2>
          </div>
          <p className="text-cyber-muted text-sm leading-relaxed">
            {profile?.about || <span className="text-cyber-dim italic">No bio added yet.</span>}
          </p>
        </div>

        {/* ── Experience ── */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 mb-4 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-5 bg-gradient-to-b from-cyber-teal to-cyber-cyan rounded-full shadow-[0_0_8px_rgba(13,138,158,0.5)]" />
            <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Experience</h2>
          </div>
          {profile?.experience?.length ? (
            <div className="space-y-7">
              {profile.experience.map((exp, i) => (
                <div key={exp.id || i} className="flex gap-4 group">
                  <div className="w-10 h-10 bg-cyber-teal/10 border border-cyber-teal/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:border-cyber-teal/50 group-hover:shadow-[0_0_12px_rgba(13,138,158,0.25)] transition-all">
                    <Briefcase className="w-4 h-4 text-cyber-teal" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-black text-sm tracking-tight">{exp.title}</h3>
                    <p className="text-cyber-cyan text-xs font-bold mt-0.5">{exp.company}</p>
                    <p className="text-cyber-dim text-xs mt-0.5 mb-2">{exp.duration}</p>
                    {exp.description && (
                      <p className="text-cyber-muted text-xs leading-relaxed">{exp.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-cyber-dim italic text-sm">No experience entries yet.</p>
          )}
        </div>

        {/* ── Skills ── */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-5 bg-gradient-to-b from-cyber-cyan to-cyber-teal rounded-full shadow-[0_0_8px_rgba(18,178,193,0.5)]" />
            <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Skills</h2>
          </div>
          {profile?.skills?.length ? (
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((skill, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-cyber-teal/10 border border-cyber-teal/20 rounded-xl text-cyber-cyan text-[10px] font-black uppercase tracking-wider hover:border-cyber-teal/50 hover:bg-cyber-teal/20 hover:shadow-[0_0_12px_rgba(13,138,158,0.2)] transition-all cursor-default"
                >
                  <Zap className="w-3 h-3" /> {skill}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-cyber-dim italic text-sm">No skills listed yet.</p>
          )}
        </div>

      </div>
    </div>
  );
}

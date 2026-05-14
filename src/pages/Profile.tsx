import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import {
  User, Briefcase, Zap, Edit3, Loader2,
  MapPin, Link2, ArrowLeft, Activity,
} from "lucide-react";

interface Experience {
  id: string;
  title: string;
  company: string;
  duration: string;
  description: string;
}

interface Profile {
  id: string;
  full_name: string;
  headline: string;
  location: string;
  website: string;
  about: string;
  avatar_url: string;
  cover_url: string;
  skills: string[];
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
            id: session.user.id,
            full_name: meta?.full_name || session.user.email?.split("@")[0] || "User",
            headline: "",
            location: "",
            website: "",
            about: "",
            avatar_url: meta?.avatar_url || "",
            cover_url: "",
            skills: [],
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
      <div className="min-h-screen flex items-center justify-center bg-[#050B14]">
        <Loader2 className="animate-spin text-cyan-500 w-12 h-12" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050B14] text-slate-300 font-sans relative overflow-x-hidden">
      {/* Background glows */}
      <div className="absolute top-0 right-0 w-[70vw] h-[70vw] bg-cyan-600/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[60vw] h-[60vw] bg-fuchsia-600/5 rounded-full blur-[150px] pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-10">

        {/* Back + Status bar */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-slate-500 hover:text-cyan-400 transition-colors text-[10px] font-black uppercase tracking-widest"
          >
            <ArrowLeft className="w-4 h-4" /> Dashboard
          </button>
          <div className="flex items-center gap-2 text-cyan-500 text-[10px] font-black uppercase tracking-[0.4em]">
            <Activity className="w-3 h-3" /> Identity Node
          </div>
        </div>

        {/* Cover + Avatar card */}
        <div className="relative rounded-[2rem] overflow-visible mb-6 shadow-2xl">
          {/* Cover image */}
          <div
            className="h-52 w-full rounded-[2rem] bg-gradient-to-br from-cyan-900/40 via-[#0A1324] to-fuchsia-900/40 border border-white/5"
            style={
              profile?.cover_url
                ? { backgroundImage: `url(${profile.cover_url})`, backgroundSize: "cover", backgroundPosition: "center" }
                : {}
            }
          />
          {/* Neon overlay line */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
          {/* Avatar */}
          <div className="absolute -bottom-10 left-8">
            <div className="w-24 h-24 rounded-2xl border-2 border-cyan-500/60 bg-[#050B14] shadow-[0_0_30px_rgba(6,182,212,0.25)] flex items-center justify-center overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-cyan-400" />
              )}
            </div>
          </div>
        </div>

        {/* Name / Headline card */}
        <div className="bg-[#0A1324]/70 backdrop-blur-md rounded-[2rem] border border-white/5 px-8 pt-16 pb-8 mb-4 shadow-xl">
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div>
              <h1 className="text-3xl lg:text-4xl font-black text-white tracking-tighter uppercase mb-1">
                {profile?.full_name || "Your Name"}
              </h1>
              <p className="text-cyan-400 font-semibold text-sm mb-3 min-h-[1.25rem]">
                {profile?.headline || <span className="text-slate-600 italic font-normal">No headline set</span>}
              </p>
              <div className="flex flex-wrap gap-4 text-[11px] text-slate-500 font-medium">
                {profile?.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 text-fuchsia-500" />{profile.location}
                  </span>
                )}
                {profile?.website && (
                  <span className="flex items-center gap-1.5">
                    <Link2 className="w-3 h-3 text-cyan-500" />{profile.website}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => navigate("/my-account")}
              className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-cyan-400 hover:bg-cyan-500/20 transition-all text-[10px] font-black uppercase tracking-widest"
            >
              <Edit3 className="w-3 h-3" /> Edit Profile
            </button>
          </div>
        </div>

        {/* About */}
        <div className="bg-[#0A1324]/60 backdrop-blur-md rounded-[2rem] border border-white/5 p-8 mb-4 shadow-xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-1 h-5 bg-cyan-500 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
            <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-white">About</h2>
          </div>
          <p className="text-slate-400 text-sm leading-relaxed">
            {profile?.about || <span className="text-slate-600 italic">No bio added yet.</span>}
          </p>
        </div>

        {/* Experience */}
        <div className="bg-[#0A1324]/60 backdrop-blur-md rounded-[2rem] border border-white/5 p-8 mb-4 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-5 bg-fuchsia-500 rounded-full shadow-[0_0_8px_rgba(217,70,239,0.6)]" />
            <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Experience</h2>
          </div>
          {profile?.experience?.length ? (
            <div className="space-y-7">
              {profile.experience.map((exp, i) => (
                <div key={exp.id || i} className="flex gap-4 group">
                  <div className="w-10 h-10 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:border-fuchsia-500/50 transition-colors">
                    <Briefcase className="w-4 h-4 text-fuchsia-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-black text-sm uppercase tracking-tight">{exp.title}</h3>
                    <p className="text-fuchsia-400 text-xs font-bold mt-0.5">{exp.company}</p>
                    <p className="text-slate-600 text-xs mt-0.5 mb-2">{exp.duration}</p>
                    {exp.description && (
                      <p className="text-slate-500 text-xs leading-relaxed">{exp.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-600 italic text-sm">No experience entries yet.</p>
          )}
        </div>

        {/* Skills */}
        <div className="bg-[#0A1324]/60 backdrop-blur-md rounded-[2rem] border border-white/5 p-8 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-5 bg-yellow-400 rounded-full shadow-[0_0_8px_rgba(250,204,21,0.6)]" />
            <h2 className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Skills</h2>
          </div>
          {profile?.skills?.length ? (
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((skill, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400/10 border border-yellow-400/20 rounded-xl text-yellow-300 text-[10px] font-black uppercase tracking-wider hover:border-yellow-400/50 transition-colors"
                >
                  <Zap className="w-3 h-3" /> {skill}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-slate-600 italic text-sm">No skills listed yet.</p>
          )}
        </div>

      </div>
    </div>
  );
}

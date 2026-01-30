import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Building2, ScanSearch, Lock, Loader2, Download, Clock, AlertCircle } from "lucide-react";
import { supabase } from "../supabase";

// تعريف شكل البيانات القادمة من الأرشيف
interface ArchiveItem {
  id: string;
  created_at: string;
  cv_pdf_url: string | null;
  target_job?: string;
  package_name?: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [archive, setArchive] = useState<ArchiveItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 1. عند فتح الصفحة: نتأكد من المستخدم ونجلب أرشيفه
  useEffect(() => {
    const initDashboard = async () => {
      // التحقق من الجلسة
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/login"); // طرد المستخدم إذا لم يسجل دخول
        return;
      }

      setUserEmail(session.user.email || "");
      setUserId(session.user.id);

      // جلب بيانات الأرشيف القديمة لهذا المستخدم
      await fetchArchive(session.user.id);
      setIsLoading(false);
    };

    initDashboard();
  }, [navigate]);

  // دالة لجلب البيانات من Supabase
  const fetchArchive = async (uid: string) => {
    const { data, error } = await supabase
      .from('cv_archive')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false }); // الأحدث أولاً

    if (!error && data) {
      setArchive(data);
    }
  };

  // 2. اشتراك Realtime (السحر هنا ✨)
  // هذا الكود يستمع لأي تغيير في قاعدة البيانات ليحدث الصفحة فوراً
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('archive-updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'cv_archive', filter: `user_id=eq.${userId}` },
        (payload) => {
          console.log("New CV generated!", payload);
          // إضافة الملف الجديد للقائمة فوراً
          setArchive((prev) => [payload.new as ArchiveItem, ...prev]);
        }
      )
      .on(
        'postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'cv_archive', filter: `user_id=eq.${userId}` },
        (payload) => {
           // تحديث حالة ملف موجود (مثلاً: تحول من جاري المعالجة إلى جاهز)
           setArchive((prev) => prev.map(item => item.id === payload.new.id ? payload.new as ArchiveItem : item));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const handleStartBuilding = () => {
    if (userEmail) {
      navigate(`/builder?email=${userEmail}`); 
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin w-8 h-8 text-blue-600"/></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-6 lg:p-12">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-4">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Welcome Back 👋</h1>
                <p className="text-slate-500 mt-2">Manage your career profile and access exclusive tools.</p>
            </div>
            <button 
                onClick={handleStartBuilding}
                className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition flex items-center gap-2 shadow-lg hover:shadow-xl transform active:scale-95 duration-200"
            >
                <FileText className="w-5 h-5"/> Build New CV
            </button>
        </div>

        {/* --- قسم الأرشيف (الجديد كلياً) --- */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm mb-12">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600"/> CV History & Downloads
            </h2>

            {archive.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                    <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-3">
                        <AlertCircle className="w-6 h-6 text-slate-400"/>
                    </div>
                    <p className="text-slate-500 font-medium">No CVs generated yet.</p>
                    <button onClick={handleStartBuilding} className="text-blue-600 font-bold text-sm mt-2 hover:underline">Create your first one now</button>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-slate-400 text-sm border-b border-slate-100">
                                <th className="py-4 font-medium pl-4">Date</th>
                                <th className="py-4 font-medium">Target Job</th>
                                <th className="py-4 font-medium">Status</th>
                                <th className="py-4 font-medium text-right pr-4">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {archive.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50 transition group">
                                    <td className="py-4 pl-4 text-slate-600 font-medium">
                                        {new Date(item.created_at).toLocaleDateString('en-GB')}
                                    </td>
                                    <td className="py-4 text-slate-900 font-bold">
                                        {item.target_job || "General CV"}
                                    </td>
                                    <td className="py-4">
                                        {item.cv_pdf_url ? (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                                                <span className="w-2 h-2 rounded-full bg-green-600"></span> Ready
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700 animate-pulse">
                                                <Loader2 className="w-3 h-3 animate-spin"/> Processing...
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-4 text-right pr-4">
                                        {item.cv_pdf_url ? (
                                            <a 
                                                href={item.cv_pdf_url} 
                                                target="_blank" 
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-800 transition shadow-sm hover:shadow"
                                            >
                                                <Download className="w-4 h-4"/> Download
                                            </a>
                                        ) : (
                                            <span className="text-slate-400 text-xs font-medium cursor-wait bg-slate-100 px-3 py-2 rounded-lg">Please wait...</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>

        {/* --- باقي الكروت (Employers & ATS) --- */}
        <div className="grid md:grid-cols-2 gap-8">
          
          {/* Employers Guide */}
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm relative group hover:shadow-md transition cursor-pointer" onClick={() => navigate('/premium-links')}>
            <div className="absolute top-4 right-4 bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
              <Lock className="w-3 h-3" /> Exclusive
            </div>
            <div className="bg-amber-50 w-12 h-12 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Building2 className="w-6 h-6 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Employers Guide</h2>
            <p className="text-slate-500 text-sm mb-4">
              Access database of top hiring companies in MENA with direct HR contacts.
            </p>
            <span className="text-blue-600 font-bold text-sm hover:underline flex items-center gap-1">View Companies <ArrowRight className="w-4 h-4"/></span>
          </div>

          {/* ATS Checker (Coming Soon) */}
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm relative opacity-75">
            <div className="absolute top-4 right-4 bg-purple-100 text-purple-800 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
              <Lock className="w-3 h-3" /> Coming Soon
            </div>
            <div className="bg-purple-50 w-12 h-12 rounded-xl flex items-center justify-center mb-6">
              <ScanSearch className="w-6 h-6 text-purple-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">ATS Score Checker</h2>
            <p className="text-slate-500 text-sm">
              Compare your CV against any job description to see your match score and AI tips.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
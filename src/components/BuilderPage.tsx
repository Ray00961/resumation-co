import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { Loader2, ArrowLeft } from 'lucide-react';

export default function BuilderPage() {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    // التأكد من هوية المستخدم قبل فتح الفورم
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // إذا لم يكن هناك جلسة، أعده لصفحة الدخول
      if (!session) {
        navigate('/login');
        return;
      }
      
      // هنا كان الخطأ: أضفنا (?? null) لحل مشكلة النوع
      setUserEmail(session.user.email ?? null);
    };
    getUser();
  }, [navigate]);

  // انتظار تحميل الإيميل
  if (!userEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin w-8 h-8 text-blue-600"/>
      </div>
    );
  }

  // رابط الفورم مع تمرير الإيميل كـ Hidden Field
  const tallyUrl = `https://tally.so/r/7RLDQR?transparentBackground=1&email=${encodeURIComponent(userEmail)}`;

  return (
    <div className="h-screen w-full bg-gray-50 flex flex-col overflow-hidden">
       {/* شريط علوي بسيط للخروج */}
       <div className="bg-white border-b px-6 py-4 flex justify-between items-center z-10 shadow-sm">
         <div className="font-bold text-xl text-slate-800 flex items-center gap-2">
            <span className="bg-blue-600 w-2 h-6 rounded-full inline-block"></span>
            CV Builder Mode
         </div>
         <button 
            onClick={() => navigate('/dashboard')} 
            className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg"
         >
            <ArrowLeft className="w-4 h-4" /> Exit Builder
         </button>
       </div>
       
       {/* تضمين الفورم داخل الصفحة */}
       <div className="flex-1 w-full h-full relative">
            <iframe 
                src={tallyUrl}
                className="absolute inset-0 w-full h-full"
                frameBorder="0" 
                marginHeight={0} 
                marginWidth={0} 
                title="Resumation Builder"
            ></iframe>
       </div>
    </div>
  );
}
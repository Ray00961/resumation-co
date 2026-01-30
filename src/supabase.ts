import { createClient } from '@supabase/supabase-js';

// استدعاء المفاتيح من ملف .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// إنشاء العميل وتصديره لاستخدامه في باقي الصفحات
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // 1. الحصول على الدولة من Vercel Headers
  const country = request.headers.get('x-vercel-ip-country') || 'LB'; 
  
  // 2. تحديد الـ Region (إذا مصر EG، وإلا فلبنان LB)
  const region = (country === 'EG') ? 'EG' : 'LB';

  const response = NextResponse.next();

  // 3. تخزين الـ Region في الـ Cookies ليكون متاحاً في الـ Client والـ Server
  // نضع httponly: false لنتمكن من قراءته عبر js-cookie في المتصفح
  response.cookies.set('user_region', region, {
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // أسبوع واحد
    httpOnly: false, 
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}

// تشغيل الـ Middleware على كل الصفحات باستثناء الملفات الثابتة والـ API
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
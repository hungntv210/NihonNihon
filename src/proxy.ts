import { NextResponse, type NextRequest } from 'next/server';
import { lessonAccessLocked, maintenanceActive } from './core/backup.ts';
import { authConfig } from './core/config.ts';
import { SESSION_COOKIE, verifySession } from './core/session.ts';

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const publicResource =
    path === '/login' ||
    path === '/api/session' ||
    path === '/robots.txt' ||
    path === '/icon.svg' || path === '/sw.js' || path === '/offline.html' || path === '/manifest.webmanifest' ||
    path.startsWith('/_next/static/') ||
    path.startsWith('/fonts/');
  const headers = {
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
  };
  if (publicResource) {
    const response = NextResponse.next();
    if (path === '/login' || path === '/api/session')
      for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
    return response;
  }
  let signedIn = false;
  try {
    signedIn = verifySession(request.cookies.get(SESSION_COOKIE)?.value, authConfig().secret);
  } catch {
    return new NextResponse('Ứng dụng chưa được cấu hình đăng nhập.', { status: 503, headers });
  }
  if (!signedIn)
    return path.startsWith('/api/')
      ? NextResponse.json({ error: 'Cần đăng nhập.' }, { status: 401, headers })
      : NextResponse.redirect(new URL('/login', request.url), { headers });
  if (maintenanceActive() && !['GET','HEAD','OPTIONS'].includes(request.method)) return NextResponse.json({error:'Đang khôi phục dữ liệu. Thử lại sau.'},{status:503,headers:{...headers,'Retry-After':'5'}});
  if ((path==='/vocab/lesson'||path.startsWith('/vocab/lesson/'))&&lessonAccessLocked()) return new NextResponse('Bài mới đang khóa: hoàn thành buổi shadowing bù trong Hôm nay. Bạn vẫn luôn có thể ôn SRS.',{status:423,headers:{...headers,'Content-Type':'text/plain; charset=utf-8'}});
  const response = NextResponse.next();
  for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
  return response;
}

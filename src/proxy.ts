import { NextResponse, type NextRequest } from 'next/server';
import { authConfig } from './core/config.ts';
import { SESSION_COOKIE, verifySession } from './core/session.ts';

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const publicResource =
    path === '/login' ||
    path === '/api/session' ||
    path === '/robots.txt' ||
    path === '/icon.svg' ||
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
  const response = NextResponse.next();
  for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
  return response;
}

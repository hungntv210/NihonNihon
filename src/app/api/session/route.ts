import { NextResponse } from 'next/server';
import { authConfig } from '../../../core/config.ts';
import {
  createSession,
  SESSION_COOKIE,
  SESSION_SECONDS,
  verifyPassword,
} from '../../../core/session.ts';
import { boundedBody, sameOrigin } from '../../../server/http.ts';

export const runtime = 'nodejs';
// One owner: a shared bounded window avoids trusting arbitrary proxy/IP headers.
let windowStart = 0,
  failures = 0;
export async function POST(request: Request) {
  try {
    const config = authConfig();
    if (!sameOrigin(request))
      return NextResponse.json({ error: 'Nguồn yêu cầu không hợp lệ.' }, { status: 403 });
    const now = Date.now();
    if (now - windowStart > 15 * 60 * 1000) {
      windowStart = now;
      failures = 0;
    }
    if (failures >= 10)
      return NextResponse.json(
        { error: 'Thử lại sau ít phút.' },
        { status: 429, headers: { 'Retry-After': '900' } },
      );
    const input = new URLSearchParams(await boundedBody(request)),
      password = input.get('password') ?? '';
    if (!verifyPassword(password, config.passwordHash)) {
      failures++;
      return NextResponse.redirect(new URL('/login?error=invalid', config.origin), 303);
    }
    failures = 0;
    const response = NextResponse.redirect(new URL('/', config.origin), 303);
    response.cookies.set(SESSION_COOKIE, createSession(config.secret), {
      httpOnly: true,
      secure: config.secure,
      sameSite: 'strict',
      path: '/',
      maxAge: SESSION_SECONDS,
    });
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch {
    return NextResponse.json(
      { error: 'Chưa thể đăng nhập. Kiểm tra cấu hình trên máy chủ.' },
      { status: 503 },
    );
  }
}

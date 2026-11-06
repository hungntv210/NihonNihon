import { NextResponse } from 'next/server';
import { authConfig } from '../../../core/config.ts';
import { SESSION_COOKIE } from '../../../core/session.ts';
import { sameOrigin } from '../../../server/http.ts';
import { requireSession } from '../../../server/auth.ts';

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: 'Nguồn yêu cầu không hợp lệ.' }, { status: 403 });
  await requireSession();
  const config = authConfig(),
    response = NextResponse.redirect(new URL('/login', config.origin), 303);
  response.cookies.set(SESSION_COOKIE, '', {
    path: '/',
    httpOnly: true,
    secure: config.secure,
    sameSite: 'strict',
    maxAge: 0,
  });
  return response;
}

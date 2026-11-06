import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authConfig } from '../core/config.ts';
import { SESSION_COOKIE, verifySession } from '../core/session.ts';

export async function isSignedIn() {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value, authConfig().secret);
}
export async function requireSession() {
  if (!(await isSignedIn())) redirect('/login');
}

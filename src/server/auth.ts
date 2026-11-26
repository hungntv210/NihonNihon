import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authConfig } from '../core/config.ts';
import { SESSION_COOKIE, sessionSubject } from '../core/session.ts';

export async function currentSessionSubject(): Promise<string | null> {
  return sessionSubject((await cookies()).get(SESSION_COOKIE)?.value, authConfig().secret);
}
export async function isSignedIn() {
  return (await currentSessionSubject()) !== null;
}
export async function requireSession() {
  if (!(await isSignedIn())) redirect('/login');
}
export async function requireSessionSubject(): Promise<string> {
  const subject = await currentSessionSubject();
  if (!subject) redirect('/login');
  return subject;
}

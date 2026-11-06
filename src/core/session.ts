import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'nihon_session';
export const SESSION_SECONDS = 12 * 60 * 60;
const signature = (body: string, secret: string) =>
  createHmac('sha256', secret).update(body).digest();
const validSecret = (secret: string) => {
  if (secret.length < 32) throw new Error('SESSION_SECRET must have at least 32 characters');
};

export function createSession(secret: string, now = Date.now()) {
  validSecret(secret);
  const body = Buffer.from(
    JSON.stringify({
      sub: 'owner',
      iat: Math.floor(now / 1000),
      exp: Math.floor(now / 1000) + SESSION_SECONDS,
      nonce: randomBytes(16).toString('hex'),
    }),
  ).toString('base64url');
  return `${body}.${signature(body, secret).toString('base64url')}`;
}

export function verifySession(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): boolean {
  validSecret(secret);
  if (!token || token.length > 1024) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const actual = Buffer.from(parts[1], 'base64url'),
      expected = signature(parts[0], secret);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
    const value = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')),
      seconds = Math.floor(now / 1000);
    return (
      value.sub === 'owner' &&
      Number.isSafeInteger(value.iat) &&
      Number.isSafeInteger(value.exp) &&
      value.iat <= seconds &&
      value.exp > seconds &&
      value.exp - value.iat === SESSION_SECONDS
    );
  } catch {
    return false;
  }
}

export function hashPassword(password: string): string {
  const normalized = password.normalize('NFC');
  if (normalized.length < 12 || normalized.length > 256)
    throw new Error('Password must contain 12–256 characters');
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${scryptSync(normalized, salt, 64).toString('hex')}`;
}

export function verifyPassword(password: string, encoded: string): boolean {
  if (password.length > 512 || !/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(encoded)) return false;
  const [, salt, digest] = encoded.split('$');
  return timingSafeEqual(
    scryptSync(password.normalize('NFC'), salt, 64),
    Buffer.from(digest, 'hex'),
  );
}

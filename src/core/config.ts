import path from 'node:path';

export function authConfig() {
  const secret = process.env.SESSION_SECRET ?? '',
    passwordHash = process.env.NIHON_PASSWORD_HASH ?? '';
  if (secret.length < 32 || !/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(passwordHash))
    throw new Error('Configure SESSION_SECRET and NIHON_PASSWORD_HASH before serving content');
  const origin = new URL(process.env.APP_ORIGIN ?? 'http://localhost:3000');
  if (
    !['http:', 'https:'].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash
  )
    throw new Error('APP_ORIGIN must be an HTTP origin');
  return { secret, passwordHash, origin: origin.origin, secure: origin.protocol === 'https:' };
}

export function databasePath() {
  return path.resolve(process.env.NIHON_DB_PATH || 'data/demo.sqlite');
}

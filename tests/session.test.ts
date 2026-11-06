import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSession,
  verifySession,
  hashPassword,
  verifyPassword,
  SESSION_SECONDS,
} from '../src/core/session.ts';
const secret = 'synthetic-test-secret-'.repeat(3),
  now = Date.parse('2026-11-06T08:00:00Z');
test('signed sessions reject tampering, future tokens, missing tokens and expiration', () => {
  const token = createSession(secret, now);
  assert.ok(verifySession(token, secret, now));
  assert.ok(!verifySession(token, secret, now + SESSION_SECONDS * 1000));
  assert.ok(!verifySession(token, secret, now - 1000));
  assert.ok(!verifySession(undefined, secret, now));
  const [body, signature] = token.split('.'),
    changed = Buffer.from(JSON.stringify({ sub: 'owner', exp: 9999999999 })).toString('base64url');
  assert.ok(!verifySession(`${changed}.${signature}`, secret, now));
  assert.ok(!verifySession(`${body}.invalid`, secret, now));
  assert.ok(!verifySession(token, secret + 'x', now));
  assert.notEqual(token, createSession(secret, now));
});
test('passwords normalize NFC, are salted, and have no default credential', () => {
  const password = 'Mật khẩu kiểm thử Ộ Ữ Ỹ',
    hash = hashPassword(password);
  assert.ok(verifyPassword(password.normalize('NFD'), hash));
  assert.ok(!verifyPassword('incorrect-password', hash));
  assert.ok(!verifyPassword(password, ''));
  assert.notEqual(hashPassword(password), hash);
  assert.throws(() => hashPassword('short'));
  assert.throws(() => createSession('short', now));
});

import fs from 'node:fs';
import path from 'node:path';
import {
  createCipheriv,
  createECDH,
  createPrivateKey,
  hkdfSync,
  randomBytes,
  sign as cryptoSign,
} from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { databasePath } from './config.ts';

export type VapidConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

export type PushSubscriptionInput = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  expirationTime?: number | null;
};

export type PushSubscriptionRecord = {
  endpoint: string;
  userId: string;
  p256dh: string;
  auth: string;
  expirationTime: number | null;
  userAgent: string;
  createdAt: string;
  updatedAt: string;
};

export type WebPushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

export type DispatchableReminder = WebPushPayload & {
  slotKey: string;
  dispatchKey: string;
  localDate: string;
  kind: string;
};

export type ReminderDispatchReport = {
  skipped: 'unconfigured' | 'disabled' | 'no_subscriptions' | null;
  evaluated: number;
  sent: number;
  deliveries: number;
  prunedSubscriptions: number;
};

const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;
const RECORD_SIZE = 4096;

function decodeBase64Url(value: unknown, expectedBytes: number): Buffer {
  if (typeof value !== 'string' || !value || value.length > 256 || !BASE64URL_RE.test(value)) {
    throw new Error('INVALID_PUSH_KEY');
  }
  const buf = Buffer.from(value, 'base64url');
  if (buf.length !== expectedBytes) throw new Error('INVALID_PUSH_KEY');
  return buf;
}

function validateUncompressedP256Point(publicKey: Buffer) {
  if (publicKey.length !== 65 || publicKey[0] !== 0x04) throw new Error('INVALID_PUSH_KEY');
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  ecdh.computeSecret(publicKey);
}

export function validatePushSubscription(value: unknown): PushSubscriptionInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('INVALID_SUBSCRIPTION');
  }
  const input = value as Record<string, unknown>;
  if (typeof input.endpoint !== 'string' || input.endpoint.length === 0 || input.endpoint.length > 2048) {
    throw new Error('INVALID_SUBSCRIPTION');
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(input.endpoint);
  } catch {
    throw new Error('INVALID_SUBSCRIPTION');
  }
  if (parsedUrl.protocol !== 'https:' || parsedUrl.username || parsedUrl.password || !parsedUrl.hostname) {
    throw new Error('INVALID_SUBSCRIPTION');
  }
  const keys = input.keys as Record<string, unknown> | undefined;
  if (!keys || typeof keys !== 'object' || Array.isArray(keys)) {
    throw new Error('INVALID_SUBSCRIPTION');
  }
  const p256dhBuf = decodeBase64Url(keys.p256dh, 65);
  validateUncompressedP256Point(p256dhBuf);
  decodeBase64Url(keys.auth, 16);
  const exp = input.expirationTime;
  if (exp !== undefined && exp !== null && (typeof exp !== 'number' || !Number.isSafeInteger(exp) || exp < 0)) {
    throw new Error('INVALID_SUBSCRIPTION');
  }
  return {
    endpoint: parsedUrl.href,
    keys: {
      p256dh: p256dhBuf.toString('base64url'),
      auth: Buffer.from(keys.auth as string, 'base64url').toString('base64url'),
    },
    expirationTime: exp ?? null,
  };
}

export function parseVapidConfig(env: Record<string, string | undefined> = process.env): VapidConfig | null {
  const publicKey = (env.VAPID_PUBLIC_KEY ?? '').trim();
  const privateKey = (env.VAPID_PRIVATE_KEY ?? '').trim();
  const subject = (env.VAPID_SUBJECT ?? '').trim();
  if (!publicKey && !privateKey && !subject) return null;
  if (!publicKey || !privateKey || !subject) throw new Error('VAPID_CONFIG_INCOMPLETE');
  const pubBuf = decodeBase64Url(publicKey, 65);
  validateUncompressedP256Point(pubBuf);
  const privBuf = decodeBase64Url(privateKey, 32);
  if (subject.length > 256 || (!subject.startsWith('mailto:') && !subject.startsWith('https://'))) {
    throw new Error('INVALID_VAPID_SUBJECT');
  }
  try {
    const parsedSubject = new URL(subject);
    if (!['mailto:', 'https:'].includes(parsedSubject.protocol)) {
      throw new Error('INVALID_VAPID_SUBJECT');
    }
  } catch {
    throw new Error('INVALID_VAPID_SUBJECT');
  }
  createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: pubBuf.subarray(1, 33).toString('base64url'),
      y: pubBuf.subarray(33, 65).toString('base64url'),
      d: privBuf.toString('base64url'),
    },
    format: 'jwk',
  });
  return {
    publicKey: pubBuf.toString('base64url'),
    privateKey: privBuf.toString('base64url'),
    subject,
  };
}

export function readVapidConfig(env: Record<string, string | undefined> = process.env): VapidConfig | null {
  try {
    return parseVapidConfig(env);
  } catch {
    return null;
  }
}

export function buildVapidAuthorization(endpoint: string, config: VapidConfig, now = new Date()): string {
  const parsed = new URL(endpoint);
  if (parsed.protocol !== 'https:') throw new Error('INVALID_SUBSCRIPTION');
  const pubBuf = decodeBase64Url(config.publicKey, 65);
  const privBuf = decodeBase64Url(config.privateKey, 32);
  const privateKey = createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: pubBuf.subarray(1, 33).toString('base64url'),
      y: pubBuf.subarray(33, 65).toString('base64url'),
      d: privBuf.toString('base64url'),
    },
    format: 'jwk',
  });
  const header = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })).toString('base64url');
  const exp = Math.floor(now.getTime() / 1000) + 12 * 3600;
  const claims = Buffer.from(
    JSON.stringify({ aud: parsed.origin, exp, sub: config.subject }),
  ).toString('base64url');
  const signingInput = `${header}.${claims}`;
  const signature = cryptoSign('sha256', Buffer.from(signingInput), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  }).toString('base64url');
  return `vapid t=${signingInput}.${signature}, k=${config.publicKey}`;
}

export function encryptWebPushPayload(
  plaintext: string | Buffer,
  p256dhB64Url: string,
  authB64Url: string,
): Buffer {
  const userPublicKey = decodeBase64Url(p256dhB64Url, 65);
  validateUncompressedP256Point(userPublicKey);
  const authSecret = decodeBase64Url(authB64Url, 16);
  const data = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : plaintext;
  if (data.length > 3800) throw new Error('PUSH_PAYLOAD_TOO_LARGE');

  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const ecdhSecret = ecdh.computeSecret(userPublicKey);
  const salt = randomBytes(16);

  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0', 'utf8'), userPublicKey, asPublic]);
  const ikm = Buffer.from(hkdfSync('sha256', ecdhSecret, authSecret, keyInfo, 32));
  const cek = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0', 'utf8'), 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0', 'utf8'), 12));

  const record = Buffer.concat([data, Buffer.from([0x02])]);
  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  const encrypted = Buffer.concat([cipher.update(record), cipher.final(), cipher.getAuthTag()]);

  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(RECORD_SIZE, 0);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, encrypted]);
}

export async function sendWebPushNotification(
  subscription: Pick<PushSubscriptionRecord, 'endpoint' | 'p256dh' | 'auth'>,
  payload: WebPushPayload,
  vapid: VapidConfig,
  options: { fetchImpl?: typeof fetch; now?: Date; ttlSeconds?: number } = {},
): Promise<{ ok: boolean; status: number; gone: boolean }> {
  const body = encryptWebPushPayload(JSON.stringify(payload), subscription.p256dh, subscription.auth);
  const authorization = buildVapidAuthorization(subscription.endpoint, vapid, options.now);
  const fetchFn = options.fetchImpl ?? fetch;
  const response = await fetchFn(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(options.ttlSeconds ?? 1800),
      Urgency: 'normal',
    },
    body: new Uint8Array(body),
    signal: AbortSignal.timeout(10000),
  });
  return {
    ok: response.ok,
    status: response.status,
    gone: response.status === 404 || response.status === 410,
  };
}

export function remindersDatabasePath() {
  return path.resolve(
    process.env.NIHON_REMINDERS_DB_PATH ||
      path.join(path.dirname(databasePath()), 'private', 'reminders.sqlite'),
  );
}

export function openRemindersDatabase(file = remindersDatabasePath()): DatabaseSync {
  const dir = path.dirname(path.resolve(file));
  fs.mkdirSync(dir, { recursive: true });
  const existed = fs.existsSync(file);
  const db = new DatabaseSync(file, { timeout: 5000 });
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      endpoint TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      expiration_time INTEGER,
      user_agent TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS push_subscriptions_user ON push_subscriptions(user_id);
    CREATE TABLE IF NOT EXISTS reminder_dispatches (
      dispatch_key TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      local_date TEXT NOT NULL,
      slot_key TEXT NOT NULL,
      kind TEXT NOT NULL,
      target_url TEXT NOT NULL,
      sent_at TEXT NOT NULL,
      delivery_count INTEGER NOT NULL DEFAULT 0
    ) STRICT;
    CREATE INDEX IF NOT EXISTS reminder_dispatches_date ON reminder_dispatches(local_date);
  `);
  if (!existed) {
    try {
      fs.chmodSync(file, 0o600);
    } catch {}
  }
  return db;
}

export function upsertPushSubscription(
  file: string,
  userId: string,
  input: unknown,
  userAgent = '',
  now = new Date(),
): PushSubscriptionRecord {
  if (!userId || userId.length > 64) throw new Error('INVALID_USER');
  const valid = validatePushSubscription(input);
  const safeUa = typeof userAgent === 'string' ? userAgent.slice(0, 200) : '';
  const ts = now.toISOString();
  const db = openRemindersDatabase(file);
  try {
    db.prepare(
      `INSERT INTO push_subscriptions(endpoint,user_id,p256dh,auth,expiration_time,user_agent,created_at,updated_at)
       VALUES(?,?,?,?,?,?,?,?)
       ON CONFLICT(endpoint) DO UPDATE SET
         user_id=excluded.user_id,
         p256dh=excluded.p256dh,
         auth=excluded.auth,
         expiration_time=excluded.expiration_time,
         user_agent=excluded.user_agent,
         updated_at=excluded.updated_at`,
    ).run(
      valid.endpoint,
      userId,
      valid.keys.p256dh,
      valid.keys.auth,
      valid.expirationTime ?? null,
      safeUa,
      ts,
      ts,
    );
    const row = db
      .prepare('SELECT * FROM push_subscriptions WHERE endpoint=? AND user_id=?')
      .get(valid.endpoint, userId)!;
    return {
      endpoint: String(row.endpoint),
      userId: String(row.user_id),
      p256dh: String(row.p256dh),
      auth: String(row.auth),
      expirationTime: row.expiration_time === null ? null : Number(row.expiration_time),
      userAgent: String(row.user_agent),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  } finally {
    db.close();
  }
}

export function removePushSubscription(file: string, userId: string, endpoint?: string): number {
  if (!fs.existsSync(file)) return 0;
  const db = openRemindersDatabase(file);
  try {
    const result = endpoint
      ? db.prepare('DELETE FROM push_subscriptions WHERE user_id=? AND endpoint=?').run(userId, endpoint)
      : db.prepare('DELETE FROM push_subscriptions WHERE user_id=?').run(userId);
    return Number(result.changes);
  } finally {
    db.close();
  }
}

export function listUserPushSubscriptions(file: string, userId: string): PushSubscriptionRecord[] {
  if (!fs.existsSync(file)) return [];
  const db = openRemindersDatabase(file);
  try {
    return db
      .prepare('SELECT * FROM push_subscriptions WHERE user_id=? ORDER BY updated_at DESC')
      .all(userId)
      .map(row => ({
        endpoint: String(row.endpoint),
        userId: String(row.user_id),
        p256dh: String(row.p256dh),
        auth: String(row.auth),
        expirationTime: row.expiration_time === null ? null : Number(row.expiration_time),
        userAgent: String(row.user_agent),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      }));
  } finally {
    db.close();
  }
}

export function listSentDispatchKeys(file: string, userId: string, localDate: string): Set<string> {
  if (!fs.existsSync(file)) return new Set();
  const db = openRemindersDatabase(file);
  try {
    const rows = db
      .prepare('SELECT dispatch_key FROM reminder_dispatches WHERE user_id=? AND local_date=?')
      .all(userId, localDate);
    return new Set(rows.map(r => String(r.dispatch_key)));
  } finally {
    db.close();
  }
}

export function claimReminderDispatch(
  file: string,
  entry: { dispatchKey: string; userId: string; localDate: string; slotKey: string; kind: string; targetUrl: string },
  now = new Date(),
): boolean {
  const db = openRemindersDatabase(file);
  try {
    db.exec('BEGIN IMMEDIATE');
    const result = db
      .prepare(
        `INSERT OR IGNORE INTO reminder_dispatches(dispatch_key,user_id,local_date,slot_key,kind,target_url,sent_at,delivery_count)
         VALUES(?,?,?,?,?,?,?,0)`,
      )
      .run(
        entry.dispatchKey,
        entry.userId,
        entry.localDate,
        entry.slotKey,
        entry.kind,
        entry.targetUrl,
        now.toISOString(),
      );
    db.exec('COMMIT');
    return Number(result.changes) === 1;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {}
    throw error;
  } finally {
    db.close();
  }
}

export function updateDispatchDeliveryCount(file: string, dispatchKey: string, deliveryCount: number) {
  if (!fs.existsSync(file)) return;
  const db = openRemindersDatabase(file);
  try {
    db.prepare('UPDATE reminder_dispatches SET delivery_count=? WHERE dispatch_key=?').run(
      deliveryCount,
      dispatchKey,
    );
  } finally {
    db.close();
  }
}

export function pruneOldDispatches(file: string, keepFromDate: string): number {
  if (!fs.existsSync(file)) return 0;
  const db = openRemindersDatabase(file);
  try {
    const result = db.prepare('DELETE FROM reminder_dispatches WHERE local_date < ?').run(keepFromDate);
    return Number(result.changes);
  } finally {
    db.close();
  }
}

export async function executeReminderDispatch(params: {
  remindersDbPath: string;
  userId: string;
  now: Date;
  keepFromDate: string;
  reminders: readonly DispatchableReminder[];
  vapid: VapidConfig;
  fetchImpl?: typeof fetch;
}): Promise<ReminderDispatchReport> {
  const subscriptions = listUserPushSubscriptions(params.remindersDbPath, params.userId);
  if (subscriptions.length === 0) {
    return { skipped: 'no_subscriptions', evaluated: params.reminders.length, sent: 0, deliveries: 0, prunedSubscriptions: 0 };
  }
  let sent = 0;
  let deliveries = 0;
  let prunedSubscriptions = 0;
  for (const reminder of params.reminders) {
    const claimed = claimReminderDispatch(
      params.remindersDbPath,
      {
        dispatchKey: reminder.dispatchKey,
        userId: params.userId,
        localDate: reminder.localDate,
        slotKey: reminder.slotKey,
        kind: reminder.kind,
        targetUrl: reminder.url,
      },
      params.now,
    );
    if (!claimed) continue;
    sent++;
    let okCount = 0;
    for (const sub of subscriptions) {
      try {
        const result = await sendWebPushNotification(
          sub,
          {
            title: reminder.title,
            body: reminder.body,
            url: reminder.url,
            tag: reminder.tag,
          },
          params.vapid,
          { fetchImpl: params.fetchImpl, now: params.now },
        );
        if (result.ok) {
          okCount++;
          deliveries++;
        } else if (result.gone) {
          prunedSubscriptions += removePushSubscription(params.remindersDbPath, params.userId, sub.endpoint);
        }
      } catch {
        // Continue to remaining subscriptions; dispatch key prevents duplicate storms.
      }
    }
    updateDispatchDeliveryCount(params.remindersDbPath, reminder.dispatchKey, okCount);
  }
  pruneOldDispatches(params.remindersDbPath, params.keepFromDate);
  return { skipped: null, evaluated: params.reminders.length, sent, deliveries, prunedSubscriptions };
}

import assert from 'node:assert/strict';
import {
  createDecipheriv,
  createECDH,
  createPublicKey,
  hkdfSync,
  randomBytes,
  verify as cryptoVerify,
} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  DEFAULT_PREFERENCES,
  parseReminderBreakTimesInput,
  validatePreferences,
} from '../src/core/preferences.ts';
import {
  buildVapidAuthorization,
  encryptWebPushPayload,
  executeReminderDispatch,
  listSentDispatchKeys,
  listUserPushSubscriptions,
  parseVapidConfig,
  removePushSubscription,
  upsertPushSubscription,
  validatePushSubscription,
  type VapidConfig,
} from '../src/core/push.ts';
import { defaults, emptyProgress, localClock, plusDays, type Settings } from '../src/app/(study)/today-roadmap/model.ts';
import { evaluateDueReminders } from '../src/app/(study)/today-roadmap/reminders.ts';
import { readTodaySettings } from '../src/app/(study)/today-roadmap/settings.ts';

function generateEphemeralP256Pair() {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  return {
    ecdh,
    publicKey: ecdh.getPublicKey().toString('base64url'),
    privateKey: ecdh.getPrivateKey().toString('base64url'),
  };
}

function decryptAes128GcmPayload(
  encrypted: Buffer,
  subscriberEcdh: ReturnType<typeof createECDH>,
  authSecretB64Url: string,
): string {
  const salt = encrypted.subarray(0, 16);
  const rs = encrypted.readUInt32BE(16);
  assert.equal(rs, 4096);
  const idlen = encrypted[20];
  assert.equal(idlen, 65);
  const asPublic = encrypted.subarray(21, 21 + idlen);
  const body = encrypted.subarray(21 + idlen);
  const ciphertext = body.subarray(0, body.length - 16);
  const tag = body.subarray(body.length - 16);

  const userPublic = subscriberEcdh.getPublicKey();
  const ecdhSecret = subscriberEcdh.computeSecret(asPublic);
  const authSecret = Buffer.from(authSecretB64Url, 'base64url');
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0', 'utf8'), userPublic, asPublic]);
  const ikm = Buffer.from(hkdfSync('sha256', ecdhSecret, authSecret, keyInfo, 32));
  const cek = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0', 'utf8'), 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0', 'utf8'), 12));

  const decipher = createDecipheriv('aes-128-gcm', cek, nonce);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  assert.equal(plain[plain.length - 1], 0x02);
  return plain.subarray(0, plain.length - 1).toString('utf8');
}

const enabledSettings: Settings = {
  ...defaults,
  remindersEnabled: true,
  dayBreakTimes: ['10:30', '12:15', '15:30'],
  eveningTime: '19:30',
  timeZone: 'Asia/Ho_Chi_Minh',
  shadowingDays: [2, 4],
};

test('daytime fires only on chosen break times with Ôn nhanh SRS, never reminds new lessons during work hours, and stays silent when queue is 0', () => {
  const forbiddenWorkTerms = /bài mới|kanji mới|từ mới|ngữ pháp|shadowing|jlpt/i;
  // Sweep every single daytime minute 00:00..19:29 on Tuesday (shadowing day) and Wednesday (non-shadowing day).
  for (const dayUtcStart of ['2026-11-02T17:00:00Z', '2026-11-03T17:00:00Z']) {
    const startMs = Date.parse(dayUtcStart); // 00:00 Asia/Ho_Chi_Minh
    const firedTimes: string[] = [];
    for (let minute = 0; minute < 19 * 60 + 30; minute++) {
      const now = new Date(startMs + minute * 60_000);
      const due = evaluateDueReminders({
        now,
        settings: enabledSettings,
        progress: emptyProgress(),
        dueQuickCount: 14,
      });
      for (const item of due) {
        firedTimes.push(item.localTime);
        assert.equal(item.kind, 'day_quick_review');
        assert.equal(item.url, '/srs?mode=quick');
        assert.match(item.title, /Ôn nhanh/);
        assert.match(item.body, /14 thẻ/);
        assert.doesNotMatch(item.title + ' ' + item.body, forbiddenWorkTerms);
      }
      // Same minute with empty queue (dueQuickCount = 0) must stay completely silent.
      const emptyQueue = evaluateDueReminders({
        now,
        settings: enabledSettings,
        progress: emptyProgress(),
        dueQuickCount: 0,
      });
      assert.equal(emptyQueue.length, 0);
    }
    assert.deepEqual(firedTimes, ['10:30', '12:15', '15:30']);
  }

  // Two break times also work cleanly.
  const twoBreakSettings: Settings = { ...enabledSettings, dayBreakTimes: ['11:00', '15:00'] };
  const at1100 = evaluateDueReminders({
    now: new Date('2026-11-03T04:00:00Z'), // 11:00 ICT
    settings: twoBreakSettings,
    progress: emptyProgress(),
    dueQuickCount: 5,
  });
  assert.equal(at1100.length, 1);
  assert.equal(at1100[0].slotKey, 'break:11:00');
  assert.equal(
    evaluateDueReminders({
      now: new Date('2026-11-03T05:15:00Z'), // 12:15 ICT (not in 2-slot list)
      settings: twoBreakSettings,
      progress: emptyProgress(),
      dueQuickCount: 5,
    }).length,
    0,
  );

  // Disabled switch silences everything.
  assert.equal(
    evaluateDueReminders({
      now: new Date('2026-11-03T03:30:00Z'), // 10:30 ICT
      settings: { ...enabledSettings, remindersEnabled: false },
      progress: emptyProgress(),
      dueQuickCount: 20,
    }).length,
    0,
  );
});

test('evening reminds at study time and repeats shadowing at 21:00 and 22:00 only on unfinished shadowing days', () => {
  // Tuesday 2026-11-03 is a shadowing day ([2, 4]).
  const atEvening = evaluateDueReminders({
    now: new Date('2026-11-03T12:30:00Z'), // 19:30 ICT
    settings: enabledSettings,
    progress: emptyProgress(),
    dueQuickCount: 0,
  });
  assert.equal(atEvening.length, 1);
  assert.equal(atEvening[0].kind, 'evening_study');
  assert.equal(atEvening[0].url, '/today-roadmap');

  // Unfinished shadowing day -> 21:00 and 22:00 fire /shadowing reminders.
  for (const [iso, expectedTime] of [
    ['2026-11-03T14:00:00Z', '21:00'],
    ['2026-11-03T15:00:00Z', '22:00'],
  ] as const) {
    const due = evaluateDueReminders({
      now: new Date(iso),
      settings: enabledSettings,
      progress: emptyProgress(),
      dueQuickCount: 0,
    });
    assert.equal(due.length, 1, expectedTime);
    assert.equal(due[0].kind, 'evening_shadowing_followup');
    assert.equal(due[0].slotKey, `shadowing:${expectedTime}`);
    assert.equal(due[0].url, '/shadowing');
  }

  // Minutes around 21:00/22:00 do not fire.
  for (const iso of ['2026-11-03T13:59:00Z', '2026-11-03T14:01:00Z', '2026-11-03T15:01:00Z']) {
    assert.equal(
      evaluateDueReminders({
        now: new Date(iso),
        settings: enabledSettings,
        progress: emptyProgress(),
        dueQuickCount: 10,
      }).length,
      0,
    );
  }

  // Once shadowing is recorded today (manual OR automatic), 21:00 and 22:00 stay silent.
  for (const shadowEntry of [
    { date: '2026-11-03', kind: 'regular' as const, minutes: 18, clips: ['clip-1'], method: 'manual' as const },
    {
      date: '2026-11-03',
      kind: 'regular' as const,
      minutes: 15,
      clips: ['clip-1'],
      method: 'automatic' as const,
      session: 'a'.repeat(64),
    },
  ]) {
    const doneProgress = { ...emptyProgress(), shadow: [shadowEntry] };
    for (const iso of ['2026-11-03T14:00:00Z', '2026-11-03T15:00:00Z']) {
      assert.equal(
        evaluateDueReminders({
          now: new Date(iso),
          settings: enabledSettings,
          progress: doneProgress,
          dueQuickCount: 0,
        }).length,
        0,
      );
    }
  }

  // Non-shadowing day (Wednesday 2026-11-04) does NOT fire 21:00 or 22:00 even when shadow[] is empty.
  for (const iso of ['2026-11-04T14:00:00Z', '2026-11-04T15:00:00Z']) {
    assert.equal(
      evaluateDueReminders({
        now: new Date(iso),
        settings: enabledSettings,
        progress: emptyProgress(),
        dueQuickCount: 0,
      }).length,
      0,
    );
  }

  // Evening study time set to 21:00 emits evening_study at 21:00 without duplicating shadowing at the same minute, then shadowing at 22:00.
  const lateEvening: Settings = { ...enabledSettings, eveningTime: '21:00' };
  const at21 = evaluateDueReminders({
    now: new Date('2026-11-03T14:00:00Z'),
    settings: lateEvening,
    progress: emptyProgress(),
    dueQuickCount: 0,
  });
  assert.deepEqual(
    at21.map(r => r.kind),
    ['evening_study'],
  );
  const at22 = evaluateDueReminders({
    now: new Date('2026-11-03T15:00:00Z'),
    settings: lateEvening,
    progress: emptyProgress(),
    dueQuickCount: 0,
  });
  assert.deepEqual(
    at22.map(r => r.kind),
    ['evening_shadowing_followup'],
  );
});

test('deduplication prevents duplicate reminders in pure evaluation and across process restarts in SQLite', async t => {
  const base = path.resolve('.tmp');
  fs.mkdirSync(base, { recursive: true });
  const dir = fs.mkdtempSync(path.join(base, 'reminders-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }));
  const remindersDb = path.join(dir, 'reminders.sqlite');

  const vapidPair = generateEphemeralP256Pair();
  const vapid: VapidConfig = {
    publicKey: vapidPair.publicKey,
    privateKey: vapidPair.privateKey,
    subject: 'mailto:reminders@example.invalid',
  };
  const subPair = generateEphemeralP256Pair();
  const authSecret = randomBytes(16).toString('base64url');
  const endpoint = 'https://push.example.invalid/sub/device-1';
  upsertPushSubscription(
    remindersDb,
    'owner',
    { endpoint, keys: { p256dh: subPair.publicKey, auth: authSecret } },
    'TestAgent/1.0',
  );

  // Pure deduplication via sentKeys.
  const nowDay1 = new Date('2026-11-03T03:30:00Z'); // 10:30 ICT
  const firstEval = evaluateDueReminders({
    now: nowDay1,
    settings: enabledSettings,
    progress: emptyProgress(),
    dueQuickCount: 8,
  });
  assert.equal(firstEval.length, 1);
  assert.equal(
    evaluateDueReminders({
      now: nowDay1,
      settings: enabledSettings,
      progress: emptyProgress(),
      dueQuickCount: 8,
      sentKeys: new Set([firstEval[0].dispatchKey]),
    }).length,
    0,
  );

  // End-to-end dispatch with encrypted Web Push + VAPID verification.
  const deliveries: Array<{ url: string; auth: string; body: Buffer }> = [];
  const mockFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const headers = init?.headers as Record<string, string>;
    deliveries.push({
      url: String(input),
      auth: headers.Authorization,
      body: Buffer.from(init?.body as Uint8Array),
    });
    return new Response('', { status: 201 });
  }) as typeof fetch;

  const localDate = localClock(nowDay1, enabledSettings.timeZone).date;
  const run1 = await executeReminderDispatch({
    remindersDbPath: remindersDb,
    userId: 'owner',
    now: nowDay1,
    keepFromDate: plusDays(localDate, -30),
    reminders: firstEval,
    vapid,
    fetchImpl: mockFetch,
  });
  assert.equal(run1.sent, 1);
  assert.equal(run1.deliveries, 1);
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].url, endpoint);

  // Decrypt payload and verify VAPID ES256 signature.
  const decrypted = JSON.parse(decryptAes128GcmPayload(deliveries[0].body, subPair.ecdh, authSecret));
  assert.equal(decrypted.url, '/srs?mode=quick');
  assert.match(decrypted.title, /Ôn nhanh/);
  assert.match(decrypted.body, /8 thẻ/);

  const authMatch = deliveries[0].auth.match(/^vapid t=([^,]+), k=(.+)$/);
  assert.ok(authMatch);
  assert.equal(authMatch[2], vapid.publicKey);
  const [jwtHeader, jwtPayload, jwtSig] = authMatch[1].split('.');
  const pubBytes = Buffer.from(vapid.publicKey, 'base64url');
  const pubKeyObj = createPublicKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: pubBytes.subarray(1, 33).toString('base64url'),
      y: pubBytes.subarray(33, 65).toString('base64url'),
    },
    format: 'jwk',
  });
  assert.equal(
    cryptoVerify(
      'sha256',
      Buffer.from(`${jwtHeader}.${jwtPayload}`),
      { key: pubKeyObj, dsaEncoding: 'ieee-p1363' },
      Buffer.from(jwtSig, 'base64url'),
    ),
    true,
  );
  const claims = JSON.parse(Buffer.from(jwtPayload, 'base64url').toString('utf8'));
  assert.equal(claims.aud, 'https://push.example.invalid');
  assert.equal(claims.sub, vapid.subject);

  // Simulate process restart in the same minute: SQLite claim blocks duplicate send even if passed again.
  const run2 = await executeReminderDispatch({
    remindersDbPath: remindersDb,
    userId: 'owner',
    now: new Date('2026-11-03T03:30:35Z'),
    keepFromDate: plusDays(localDate, -30),
    reminders: firstEval,
    vapid,
    fetchImpl: mockFetch,
  });
  assert.equal(run2.sent, 0);
  assert.equal(run2.deliveries, 0);
  assert.equal(deliveries.length, 1);
  assert.equal(listSentDispatchKeys(remindersDb, 'owner', localDate).has(firstEval[0].dispatchKey), true);

  // Next day at 10:30 fires again cleanly; HTTP 410 Gone prunes dead subscription.
  const nowDay2 = new Date('2026-11-04T03:30:00Z');
  const day2Eval = evaluateDueReminders({
    now: nowDay2,
    settings: enabledSettings,
    progress: emptyProgress(),
    dueQuickCount: 3,
    sentKeys: listSentDispatchKeys(remindersDb, 'owner', localClock(nowDay2, enabledSettings.timeZone).date),
  });
  assert.equal(day2Eval.length, 1);
  const goneFetch = (async () => new Response('Gone', { status: 410 })) as typeof fetch;
  const runDay2 = await executeReminderDispatch({
    remindersDbPath: remindersDb,
    userId: 'owner',
    now: nowDay2,
    keepFromDate: plusDays(localClock(nowDay2, enabledSettings.timeZone).date, -30),
    reminders: day2Eval,
    vapid,
    fetchImpl: goneFetch,
  });
  assert.equal(runDay2.sent, 1);
  assert.equal(runDay2.deliveries, 0);
  assert.equal(runDay2.prunedSubscriptions, 1);
  assert.equal(listUserPushSubscriptions(remindersDb, 'owner').length, 0);
});

test('VAPID config, push subscription validation, reminder settings validation, and PWA invariants hold', t => {
  const base = path.resolve('.tmp');
  fs.mkdirSync(base, { recursive: true });
  const dir = fs.mkdtempSync(path.join(base, 'reminders-cfg-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }));

  // VAPID config parsing.
  assert.equal(parseVapidConfig({}), null);
  const pair = generateEphemeralP256Pair();
  assert.throws(() => parseVapidConfig({ VAPID_PUBLIC_KEY: pair.publicKey }), /VAPID_CONFIG_INCOMPLETE/);
  assert.throws(
    () =>
      parseVapidConfig({
        VAPID_PUBLIC_KEY: pair.publicKey,
        VAPID_PRIVATE_KEY: pair.privateKey,
        VAPID_SUBJECT: 'http://insecure.invalid',
      }),
    /INVALID_VAPID_SUBJECT/,
  );
  const parsedVapid = parseVapidConfig({
    VAPID_PUBLIC_KEY: pair.publicKey,
    VAPID_PRIVATE_KEY: pair.privateKey,
    VAPID_SUBJECT: 'https://example.invalid',
  });
  assert.equal(parsedVapid?.publicKey, pair.publicKey);
  assert.match(buildVapidAuthorization('https://push.example.invalid/x', parsedVapid!), /^vapid t=.+, k=/);

  // Encrypt/decrypt sanity check.
  const sub = generateEphemeralP256Pair();
  const auth = randomBytes(16).toString('base64url');
  const encrypted = encryptWebPushPayload('{"ok":true}', sub.publicKey, auth);
  assert.equal(decryptAes128GcmPayload(encrypted, sub.ecdh, auth), '{"ok":true}');

  // Push subscription validation rejects HTTP, bad keys, missing fields.
  assert.throws(() =>
    validatePushSubscription({
      endpoint: 'http://insecure.invalid/sub',
      keys: { p256dh: sub.publicKey, auth },
    }),
  );
  assert.throws(() =>
    validatePushSubscription({
      endpoint: 'https://push.example.invalid/sub',
      keys: { p256dh: 'not-a-p256-key', auth },
    }),
  );
  const validSub = validatePushSubscription({
    endpoint: 'https://push.example.invalid/sub/valid',
    keys: { p256dh: sub.publicKey, auth },
  });
  assert.equal(validSub.endpoint, 'https://push.example.invalid/sub/valid');

  // Reminder settings validation (2-3 unique break times before eveningTime).
  const saved = validatePreferences({
    remindersEnabled: true,
    eveningTime: '19:30',
    dayBreakTimes: ['15:30', '10:30'],
  });
  assert.deepEqual(saved.dayBreakTimes, ['10:30', '15:30']);
  assert.equal(saved.remindersEnabled, true);
  assert.throws(() => validatePreferences({ dayBreakTimes: ['10:30'] }), /INVALID_BREAK_TIMES/);
  assert.throws(
    () => validatePreferences({ dayBreakTimes: ['09:00', '11:00', '13:00', '15:00'] }),
    /INVALID_BREAK_TIMES/,
  );
  assert.throws(() => validatePreferences({ dayBreakTimes: ['10:30', '10:30'] }), /INVALID_BREAK_TIMES/);
  assert.throws(
    () => validatePreferences({ eveningTime: '19:30', dayBreakTimes: ['10:30', '19:30'] }),
    /INVALID_BREAK_TIMES/,
  );
  assert.equal(parseReminderBreakTimesInput(['12:00', '10:00', ''], '19:30').ok, true);
  assert.equal(parseReminderBreakTimesInput(['12:00', '', ''], '19:30').ok, false);
  assert.equal(parseReminderBreakTimesInput(['12:00', '20:00', ''], '19:30').ok, false);

  // readTodaySettings reads new fields and rejects invalid break times.
  const settingsFile = path.join(dir, 'settings.json');
  fs.writeFileSync(
    settingsFile,
    JSON.stringify({ ...DEFAULT_PREFERENCES, remindersEnabled: true, dayBreakTimes: ['15:00', '10:00'] }),
  );
  const todaySettings = readTodaySettings(settingsFile);
  assert.equal(todaySettings.remindersEnabled, true);
  assert.deepEqual(todaySettings.dayBreakTimes, ['10:00', '15:00']);
  fs.writeFileSync(
    settingsFile,
    JSON.stringify({ ...DEFAULT_PREFERENCES, remindersEnabled: true, dayBreakTimes: ['10:00', '20:00'] }),
  );
  assert.throws(() => readTodaySettings(settingsFile));

  // Subscriptions bind to signed-in userId and isolate deletion.
  const dbFile = path.join(dir, 'rem.sqlite');
  upsertPushSubscription(dbFile, 'owner', validSub);
  assert.equal(listUserPushSubscriptions(dbFile, 'owner').length, 1);
  assert.equal(listUserPushSubscriptions(dbFile, 'other').length, 0);
  assert.equal(removePushSubscription(dbFile, 'owner', validSub.endpoint), 1);
  assert.equal(listUserPushSubscriptions(dbFile, 'owner').length, 0);

  // .env.example declares VAPID variable names with empty values only (never committed secrets).
  const envExample = fs.readFileSync(path.resolve('.env.example'), 'utf8');
  for (const name of ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT']) {
    const line = envExample.split(/\r?\n/).find(l => l.startsWith(`${name}=`));
    assert.equal(line, `${name}=`, `${name} must be declared empty in .env.example`);
  }

  // public/sw.js has push + notificationclick handlers and keeps private AES-GCM cache exclusions intact.
  const sw = fs.readFileSync(path.resolve('public/sw.js'), 'utf8');
  assert.match(sw, /addEventListener\('push'/);
  assert.match(sw, /addEventListener\('notificationclick'/);
  assert.match(sw, /AES-GCM/);
  assert.match(sw, /\/api\//);
  assert.match(sw, /\/jlpt-daily/);
  assert.match(sw, /set-cookie/);
  assert.match(sw, /\/review/);
  assert.match(sw, /\/srs\?mode=quick/);
});

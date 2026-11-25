import { execFile } from 'node:child_process';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import { geminiProvider } from './generate-week.ts';
import { withStoreLock } from './repository.ts';

const profile = {
 model: 'gemini-fixture', verifierModel: 'gemini-fixture', requestsPerMinute: 60_000,
 dailyBudget: 200, sharedDailyBudget: 200, timeoutMs: 1000, maxOutputTokens: 100,
};
const completion = { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '[]' }] } }] };

function ledgerFixture(t: TestContext, count: number) {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nihon-store-lock-'));
 t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
 const ledger = path.join(dir, 'shared-quota.json');
 const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
 fs.writeFileSync(ledger, JSON.stringify({ models: { [profile.model]: { day, count, last: 0 } } }));
 return ledger;
}

async function contend(ledger: string, afterRelease?: () => Promise<unknown>) {
 const lock = path.join(path.dirname(ledger), 'write.lock');
 const holder = fs.openSync(lock, 'wx', 0o600);
 const script = `
  import fs from 'node:fs';
  import path from 'node:path';
  import { geminiProvider } from ${JSON.stringify(new URL('./generate-week.ts', import.meta.url).href)};
  const ledger = process.argv[1];
  const lock = path.join(path.dirname(ledger), 'write.lock');
  const open = fs.openSync;
  let reported = false;
  fs.openSync = (...args) => {
   try { return open(...args); }
   catch (error) {
    if (!reported && args[0] === lock && error.code === 'EEXIST') {
     reported = true;
     process.stdout.write('contended\\n');
    }
    throw error;
   }
  };
  const provider = geminiProvider(${JSON.stringify(profile)}, ledger, 'fake',
   async () => Response.json(${JSON.stringify(completion)}));
  try {
   await provider('generate', '', {}, {});
   console.log('ok');
  } catch (error) {
   console.log(error.message);
  }
 `;
 const childArgs = ['--import', 'tsx', '--input-type=module', '--eval', script, ledger];
 let child!: ReturnType<typeof execFile>;
 const finished = new Promise<string>((resolve, reject) => {
  child = execFile(process.execPath, childArgs, (error, stdout) => {
   if (error) reject(error);
   else resolve(stdout);
  });
 });
 try {
  await Promise.race([once(child.stdout!, 'data'), finished]);
 } finally {
  fs.closeSync(holder);
  fs.unlinkSync(lock);
 }
 try {
  await afterRelease?.();
 } finally {
  await finished;
 }
 return (await finished).trim().split(/\r?\n/);
}

test('a second process waits for the ledger lock and runs after release', async t => {
 const ledger = ledgerFixture(t, 0);
 assert.deepEqual(await contend(ledger), ['contended', 'ok']);
 assert.equal(JSON.parse(fs.readFileSync(ledger, 'utf8')).models[profile.model].count, 1);
});

test('a held lock still returns STORE_BUSY after retrying', t => {
 const dir = path.dirname(ledgerFixture(t, 0));
 withStoreLock(dir, () => {
  assert.throws(() => withStoreLock(dir, () => assert.fail('must not run under another lock')), { message: 'STORE_BUSY' });
  assert.ok(fs.existsSync(path.join(dir, 'write.lock')));
 });
 assert.equal(fs.existsSync(path.join(dir, 'write.lock')), false);
});

test('two processes contending for the final ledger reservation cannot exceed 200', async t => {
 const ledger = ledgerFixture(t, 199);
 let calls = 0;
 const provider = geminiProvider(profile, ledger, 'fake', async () => {
  calls++;
  return Response.json(completion);
 });
 let parentOutcome: string | undefined;
 const [contention, childOutcome] = await contend(ledger, async () => {
  parentOutcome = await provider('generate', '', {}, {}).then(() => 'ok', error => error.message);
 });
 assert.equal(contention, 'contended');
 assert.deepEqual([parentOutcome, childOutcome].sort(), ['SHARED_DAILY_BUDGET_REACHED', 'ok']);
 assert.equal(calls, parentOutcome === 'ok' ? 1 : 0);
 assert.equal(JSON.parse(fs.readFileSync(ledger, 'utf8')).models[profile.model].count, 200);
});

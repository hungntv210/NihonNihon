import 'server-only';
import { saveDailyBackup } from '../core/backup.ts';
import { dispatchDueReminders } from './reminders.ts';

let started = false;
let reminderRunning = false;
const REMINDER_GLOBAL_KEY = '__nihonTodayReminderSchedulerStarted';

export function startReminderScheduler() {
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  const g = globalThis as Record<string, unknown>;
  if (g[REMINDER_GLOBAL_KEY]) return;
  g[REMINDER_GLOBAL_KEY] = true;
  const tick = () => {
    if (reminderRunning) return;
    reminderRunning = true;
    void dispatchDueReminders()
      .catch(error => console.error('Today reminder dispatch failed:', error instanceof Error ? error.message : 'unknown'))
      .finally(() => { reminderRunning = false; });
  };
  tick();
  setInterval(tick, 30_000).unref();
}

export function startDailyBackups() {
  startReminderScheduler();
  if (started) return;
  started = true;
  const run = () =>
    void saveDailyBackup().catch(error =>
      console.error('Daily G1 backup failed:', error instanceof Error ? error.message : 'unknown'),
    );
  run();
  setInterval(run, 60 * 60 * 1000).unref();
}

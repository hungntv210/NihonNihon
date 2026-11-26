import 'server-only';
import { databasePath } from '../core/config.ts';
import { openContentDatabase } from '../core/content.ts';
import {
  executeReminderDispatch,
  listSentDispatchKeys,
  listUserPushSubscriptions,
  readVapidConfig,
  remindersDatabasePath,
  type ReminderDispatchReport,
  type VapidConfig,
} from '../core/push.ts';
import { localClock, plusDays } from '../app/(study)/today-roadmap/model.ts';
import { readProgress, roadmapPath } from '../app/(study)/today-roadmap/repository.ts';
import { readTodaySettings } from '../app/(study)/today-roadmap/settings.ts';
import { evaluateDueReminders } from '../app/(study)/today-roadmap/reminders.ts';

export type ReminderDispatchOptions = {
  now?: Date;
  userId?: string;
  dbPath?: string;
  remindersDbPath?: string;
  settingsFile?: string;
  roadmapFile?: string;
  vapid?: VapidConfig | null;
  fetchImpl?: typeof fetch;
};

function countDueQuickCards(dbFile: string, now: Date): number {
  const db = openContentDatabase(dbFile);
  try {
    const row = db
      .prepare(
        `SELECT count(*) n FROM srs_cards c JOIN content_items i USING(item_id)
         WHERE i.is_active=1 AND i.kind IN ('vocab','kanji') AND c.card_type='recognition' AND c.due_at<=?`,
      )
      .get(now.toISOString());
    return Number(row?.n ?? 0);
  } finally {
    db.close();
  }
}

export async function dispatchDueReminders(
  options: ReminderDispatchOptions = {},
): Promise<ReminderDispatchReport> {
  const vapid = options.vapid !== undefined ? options.vapid : readVapidConfig();
  if (!vapid) {
    return { skipped: 'unconfigured', evaluated: 0, sent: 0, deliveries: 0, prunedSubscriptions: 0 };
  }
  const now = options.now ?? new Date();
  const userId = options.userId ?? 'owner';
  const settings = readTodaySettings(options.settingsFile);
  if (!settings.remindersEnabled) {
    return { skipped: 'disabled', evaluated: 0, sent: 0, deliveries: 0, prunedSubscriptions: 0 };
  }
  const remDb = options.remindersDbPath ?? remindersDatabasePath();
  if (listUserPushSubscriptions(remDb, userId).length === 0) {
    return { skipped: 'no_subscriptions', evaluated: 0, sent: 0, deliveries: 0, prunedSubscriptions: 0 };
  }
  const progress = readProgress(options.roadmapFile ?? roadmapPath());
  const dueQuickCount = countDueQuickCards(options.dbPath ?? databasePath(), now);
  const { date: localDate } = localClock(now, settings.timeZone);
  const sentKeys = listSentDispatchKeys(remDb, userId, localDate);
  const due = evaluateDueReminders({
    userId,
    now,
    settings,
    progress,
    dueQuickCount,
    sentKeys,
  });
  return executeReminderDispatch({
    remindersDbPath: remDb,
    userId,
    now,
    keepFromDate: plusDays(localDate, -30),
    reminders: due,
    vapid,
    fetchImpl: options.fetchImpl,
  });
}

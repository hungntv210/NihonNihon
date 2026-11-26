import { CLOCK_TIME_RE } from '../../../core/preferences.ts';
import { localClock, type Progress, type Settings } from './model.ts';

export const SHADOWING_FOLLOWUP_TIMES = ['21:00', '22:00'] as const;

export type ReminderKind =
  | 'day_quick_review'
  | 'evening_study'
  | 'evening_shadowing_followup';

export type ScheduledReminder = {
  slotKey: string;
  dispatchKey: string;
  localDate: string;
  localTime: string;
  kind: ReminderKind;
  title: string;
  body: string;
  url: '/srs?mode=quick' | '/today-roadmap' | '/shadowing';
  tag: string;
};

export type ReminderScheduleInput = {
  userId?: string;
  now: Date;
  settings: Pick<
    Settings,
    'eveningTime' | 'timeZone' | 'shadowingDays' | 'remindersEnabled' | 'dayBreakTimes'
  >;
  progress: Pick<Progress, 'shadow'>;
  dueQuickCount: number;
  sentKeys?: ReadonlySet<string> | readonly string[];
};

export function evaluateDueReminders(input: ReminderScheduleInput): ScheduledReminder[] {
  const { settings, progress, now } = input;
  if (!settings.remindersEnabled) return [];
  const userId = input.userId ?? 'owner';
  const { date: localDate, time: localTime } = localClock(now, settings.timeZone);
  const weekday = new Date(localDate + 'T00:00:00Z').getUTCDay();
  const evening = localTime >= settings.eveningTime;
  const sent = input.sentKeys instanceof Set ? input.sentKeys : new Set(input.sentKeys ?? []);
  const makeKey = (slotKey: string) => `${userId}:${localDate}:${slotKey}`;
  const dueCount = Number.isFinite(input.dueQuickCount) ? Math.max(0, Math.floor(input.dueQuickCount)) : 0;

  if (!evening) {
    // Daytime / work hours: ONLY send "Ôn nhanh" (SRS) on chosen break times strictly before eveningTime,
    // NEVER remind about new lessons, and stay silent when the quick review queue is empty.
    if (dueCount <= 0) return [];
    const validBreaks = [...new Set(settings.dayBreakTimes ?? [])]
      .filter(t => CLOCK_TIME_RE.test(t) && t < settings.eveningTime)
      .sort()
      .slice(0, 3);
    if (!validBreaks.includes(localTime)) return [];
    const slotKey = `break:${localTime}`;
    const dispatchKey = makeKey(slotKey);
    if (sent.has(dispatchKey)) return [];
    return [
      {
        slotKey,
        dispatchKey,
        localDate,
        localTime,
        kind: 'day_quick_review',
        title: 'Ôn nhanh · Nihon Nihon',
        body: `Còn ${dueCount} thẻ đến hạn. Dành 5–10 phút Ôn nhanh trong giờ nghỉ nhé.`,
        url: '/srs?mode=quick',
        tag: `nihon-day-${localDate}-${localTime}`,
      },
    ];
  }

  const out: ScheduledReminder[] = [];
  const shadowingDays = settings.shadowingDays ?? [2, 4];
  const isShadowingDay = shadowingDays.includes(weekday);
  const shadowingDoneToday = progress.shadow.some(s => s.date === localDate);

  if (localTime === settings.eveningTime) {
    const slotKey = `evening:${settings.eveningTime}`;
    const dispatchKey = makeKey(slotKey);
    if (!sent.has(dispatchKey)) {
      const body =
        weekday === 0
          ? 'Đã đến giờ học tối Chủ nhật. Mở Hôm nay để ôn SRS và kiểm tra tuần.'
          : isShadowingDay && !shadowingDoneToday
            ? 'Đã đến giờ học tối. Hôm nay có lịch shadowing — mở Hôm nay để bắt đầu.'
            : 'Đã đến giờ học tối. Mở Hôm nay để bắt đầu kế hoạch buổi tối.';
      out.push({
        slotKey,
        dispatchKey,
        localDate,
        localTime,
        kind: 'evening_study',
        title: 'Đến giờ học tối · Nihon Nihon',
        body,
        url: '/today-roadmap',
        tag: `nihon-evening-${localDate}`,
      });
    }
  }

  if (isShadowingDay && !shadowingDoneToday) {
    for (const followup of SHADOWING_FOLLOWUP_TIMES) {
      if (localTime !== followup || followup <= settings.eveningTime) continue;
      const slotKey = `shadowing:${followup}`;
      const dispatchKey = makeKey(slotKey);
      if (sent.has(dispatchKey)) continue;
      out.push({
        slotKey,
        dispatchKey,
        localDate,
        localTime: followup,
        kind: 'evening_shadowing_followup',
        title: `Nhắc shadowing ${followup} · Nihon Nihon`,
        body: 'Hôm nay là ngày shadowing nhưng bạn chưa hoàn thành buổi luyện. Mở Shadowing để luyện nhé.',
        url: '/shadowing',
        tag: `nihon-shadowing-${localDate}-${followup}`,
      });
    }
  }

  return out;
}

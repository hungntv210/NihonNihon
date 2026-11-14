import type {PracticeState} from '../shadowing/practice.ts';
export type Settings = { startDate: string; eveningTime: string; studyMinutes: number; examDate: string; timeZone: string; shadowingDays: number[]; newCardsPerDay: number };
export const defaults: Settings = { startDate: '2026-11-02', eveningTime: '19:30', studyMinutes: 50, examDate: '2028-07-02', timeZone: 'Asia/Ho_Chi_Minh', shadowingDays: [2, 4], newCardsPerDay: 10 };
export type Shadow = { date: string; kind: 'regular' | 'makeup'; minutes: number; clips: string[]; method: 'manual' | 'automatic'; session?: string };
export type Progress = { version: 1; shadowSessions?:Record<string,PracticeState>; shadow: Shadow[]; activity: string[]; activeTask: string | null; shortDays: string[] };
export const emptyProgress = (): Progress => ({ version: 1, shadow: [], activity: [], activeTask: null, shortDays: [] });
export const tasks = {
  review: { title: 'Ôn nốt thẻ + ngữ pháp', href: '/srs', minutes: 8 },
  new: { title: 'Kanji + từ mới', href: '/vocab/lesson', minutes: 12 },
  grammar: { title: 'Ngữ pháp + bài tập', href: '/grammar', minutes: 12 },
  jlpt: { title: 'Luyện dạng đề JLPT · 10 câu', href: '/jlpt', minutes: 13 },
  shadow: { title: 'Shadowing', href: '/shadowing', minutes: 18 },
  weekly: { title: 'Kiểm tra tuần', href: '/jlpt', minutes: 20 },
} as const;
export const validDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export const dayNumber = (date: string) => Date.parse(date + 'T00:00:00Z') / 86400000;
export const plusDays = (date: string, days: number) => new Date((dayNumber(date) + days) * 86400000).toISOString().slice(0, 10);
export function localClock(now: Date, timeZone = defaults.timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (key: string) => parts.find(p => p.type === key)!.value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}
export function weekStart(date: string) {
  return plusDays(date, -((new Date(date + 'T00:00:00Z').getUTCDay() + 6) % 7));
}
export function shadowCount(progress: Progress, monday: string) {
  return new Set(progress.shadow.filter(s => s.kind === 'regular' && s.date >= monday && s.date <= plusDays(monday, 6)).map(s => s.date)).size;
}
export function lessonAccess(progress: Progress, date: string, startDate: string) {
  const monday = weekStart(date), previous = plusDays(monday, -7);
  const required = monday > weekStart(startDate);
  const madeUp = progress.shadow.some(s => s.kind === 'makeup' && s.date >= monday && s.date <= date);
  return { locked: required && shadowCount(progress, previous) < 2 && !madeUp, reason: 'Thiếu 2 buổi shadowing tuần trước. Làm bù 25 phút với 2 clip để mở bài mới.' };
}
export function todayPlan(progress: Progress, settings: Settings, now: Date, due: number) {
  const { date, time } = localClock(now, settings.timeZone), monday = weekStart(date), weekday = new Date(date + 'T00:00:00Z').getUTCDay();
  const elapsedWeeks = Math.max(0, Math.floor((dayNumber(date) - dayNumber(settings.startDate)) / 7));
  const firstActivity = [...progress.activity].sort()[0];
  let delayedWeeks = 0;
  if (firstActivity) for (let n = 0; n < elapsedWeeks; n++) {
    const from = plusDays(settings.startDate, n * 7), until = plusDays(from, 6);
    if (until >= firstActivity && !progress.activity.some(d => d >= from && d <= until)) delayedWeeks++;
  }
  const week = Math.max(1, Math.min(87, elapsedWeeks - delayedWeeks + 1));
  const access = lessonAccess(progress, date, settings.startDate), short = progress.shortDays.includes(date) || settings.studyMinutes <= 20;
  const lastActivity = [...progress.activity].filter(d => d < date).sort().at(-1);
  const missed = lastActivity ? Math.max(0, dayNumber(date) - dayNumber(lastActivity) - 1) : 0;
  const recovery = missed >= 1 && due > 20;
  const selected: (keyof typeof tasks)[] = weekday === 0 ? ['review', 'weekly'] : recovery ? ['review'] : ['review', ...(!access.locked ? ['new', 'grammar'] as const : []), ...(!short ? [(settings.shadowingDays ?? [2, 4]).includes(weekday) ? 'shadow' as const : 'jlpt' as const] : [])];
  const count = shadowCount(progress, monday), urgent = count < 2 && (weekday === 0 || weekday === 6 || (weekday === 5 && time >= settings.eveningTime));
  const streakDays = new Set(progress.activity);let streak = 0, cursor = streakDays.has(date) ? date : plusDays(date, -1);
  while (streakDays.has(cursor)) { streak++;cursor = plusDays(cursor, -1); }
  const bonusWeeks = new Set(progress.shadow.filter(s => s.kind === 'regular').map(s => weekStart(s.date)));
  const freezes = Math.min(2, [...bonusWeeks].filter(w => shadowCount(progress, w) >= 3).length);
  return { date, time, week, monday, weekday, evening: time >= settings.eveningTime, access, short, selected, count, urgent, streak, freezes, recovery, missed, reduceNew: due > 60, delayedWeeks, expectedFinish: plusDays(settings.startDate, (87 + delayedWeeks) * 7 - 1), behindExam: dayNumber(plusDays(settings.startDate, (87 + delayedWeeks) * 7 - 1)) - dayNumber(settings.examDate) > 28, examDays: Math.ceil(dayNumber(settings.examDate) - dayNumber(date)) };
}
export type CatalogItem = { id: string; kind: 'vocab' | 'kanji' | 'grammar'; level: string; title: string; frequency: number | null };
export function allocateRoadmap(items: CatalogItem[], startDate: string) {
  const stages = [{ level: 'N5', weeks: 12, theme: 'Nền tảng và sinh hoạt' }, { level: 'N4', weeks: 23, theme: 'Cuộc sống và công việc' }, { level: 'N3', weeks: 22, theme: 'Kết nối và diễn đạt' }, { level: 'N2', weeks: 30, theme: 'Đọc hiểu và lập luận' }];
  let offset = 0;
  return stages.flatMap(stage => {
    const weeks = Array.from({ length: stage.weeks }, (_, n) => ({ week: offset + n + 1, date: plusDays(startDate, (offset + n) * 7), level: stage.level, theme: stage.theme, items: [] as CatalogItem[] }));
    for (const kind of ['kanji', 'vocab', 'grammar']) {
      const available = items.filter(i => i.level === stage.level && i.kind === kind).sort((a, b) => (a.frequency ?? Infinity) - (b.frequency ?? Infinity) || a.id.localeCompare(b.id));
      available.forEach((item, n) => weeks[Math.floor(n * stage.weeks / available.length)].items.push(item));
    }
    offset += stage.weeks;
    return weeks;
  });
}




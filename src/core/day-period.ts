export type DayPeriod = 'morning' | 'day' | 'sunset' | 'night';
export function vietnamClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (name: string) => parts.find(part => part.type === name)!.value;
  const hour = Number(get('hour'));
  const period: DayPeriod = hour >= 5 && hour < 11 ? 'morning' : hour >= 11 && hour < 17 ? 'day' : hour >= 17 && hour < 19 ? 'sunset' : 'night';
  return { period, time: `${get('hour')}:${get('minute')}`, now: now.toISOString() };
}

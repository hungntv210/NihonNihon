export const MIN_NEW_CARDS_PER_DAY = 0;
export const MAX_NEW_CARDS_PER_DAY = 100;
export const MIN_FSRS_RETENTION = 0.8;
export const MAX_FSRS_RETENTION = 0.97;
export const FSRS_RETENTION_STEP = 0.01;
export const DEFAULT_PREFERENCES = {
  startDate: '2026-11-02', eveningTime: '19:30', studyMinutes: 50,
  examDate: '2028-07-02', timeZone: 'Asia/Ho_Chi_Minh', shadowingDays: [2, 4],
  newCardsPerDay: 10, fsrsRetention: 0.9, furigana: true, ttsVoice: '', theme: 'system', motion: true,
};
export type StudyPreferences = typeof DEFAULT_PREFERENCES;
export function isValidNewCardsPerDay(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= MIN_NEW_CARDS_PER_DAY && value <= MAX_NEW_CARDS_PER_DAY;
}
export function normalizeNewCardsPerDay(value: unknown): number {
  return isValidNewCardsPerDay(value) ? value : DEFAULT_PREFERENCES.newCardsPerDay;
}
export function isValidFsrsRetention(value: unknown): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  const scaled = Math.round(value * 100);
  return scaled >= Math.round(MIN_FSRS_RETENTION * 100) && scaled <= Math.round(MAX_FSRS_RETENTION * 100) && Math.abs(value * 100 - scaled) < 1e-9;
}
export function normalizeFsrsRetention(value: unknown): number {
  return isValidFsrsRetention(value) ? Math.round(value * 100) / 100 : DEFAULT_PREFERENCES.fsrsRetention;
}
export function parseSrsSettingsInput(newCardsRaw: string, retentionRaw: string): { ok: true; newCardsPerDay: number; fsrsRetention: number } | { ok: false; error: string } {
  const cardsText = newCardsRaw.trim(), retentionText = retentionRaw.trim();
  if (!/^\d+$/.test(cardsText)) return { ok: false, error: 'Thẻ mới mỗi ngày phải là số nguyên từ 0 đến 100.' };
  const newCardsPerDay = Number(cardsText);
  if (!isValidNewCardsPerDay(newCardsPerDay)) return { ok: false, error: 'Thẻ mới mỗi ngày phải là số nguyên từ 0 đến 100.' };
  if (!/^\d+(?:\.\d{1,2})?$/.test(retentionText)) return { ok: false, error: 'Mức ghi nhớ mong muốn phải từ 0.80 đến 0.97 (bước 0.01).' };
  const fsrsRetention = Number(retentionText);
  if (!isValidFsrsRetention(fsrsRetention)) return { ok: false, error: 'Mức ghi nhớ mong muốn phải từ 0.80 đến 0.97 (bước 0.01).' };
  return { ok: true, newCardsPerDay, fsrsRetention: Math.round(fsrsRetention * 100) / 100 };
}
export function newLessonsLocked(p: StudyPreferences, shadow: {date:string;kind:string}[], now=new Date()) {
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:p.timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const shift=(day:string,n:number)=>new Date(Date.parse(day+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
  const monday=(day:string)=>shift(day,-((new Date(day+'T00:00:00Z').getUTCDay()+6)%7));
  const week=monday(date), previous=shift(week,-7);
  return week>monday(p.startDate)&&new Set(shadow.filter(s=>s.kind==='regular'&&s.date>=previous&&s.date<week).map(s=>s.date)).size<2&&!shadow.some(s=>s.kind==='makeup'&&s.date>=week&&s.date<=date);
}
export function validatePreferences(value: unknown): StudyPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('INVALID_SETTINGS');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !Object.hasOwn(DEFAULT_PREFERENCES,key))) throw Error('UNKNOWN_SETTING');
  const p = { ...DEFAULT_PREFERENCES, ...input } as StudyPreferences;
  const date = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s).toISOString().slice(0,10) === s;
  if (!date(p.startDate) || !date(p.examDate) || p.examDate <= p.startDate || !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.eveningTime)
    || !Number.isInteger(p.studyMinutes) || p.studyMinutes < 5 || p.studyMinutes > 180
    || !isValidNewCardsPerDay(p.newCardsPerDay)
    || !isValidFsrsRetention(p.fsrsRetention)
    || typeof p.furigana !== 'boolean' || typeof p.motion !== 'boolean' || typeof p.ttsVoice !== 'string' || p.ttsVoice.length > 200
    || !['system','light','dark'].includes(p.theme) || !Array.isArray(p.shadowingDays)
    || p.shadowingDays.length < 2 || p.shadowingDays.some(d => !Number.isInteger(d) || d < 0 || d > 6) || new Set(p.shadowingDays).size !== p.shadowingDays.length) throw Error('INVALID_SETTINGS');
  if (typeof p.timeZone !== 'string' || p.timeZone.length > 80) throw Error('INVALID_TIMEZONE');
  new Intl.DateTimeFormat('en', { timeZone: p.timeZone });
  return { ...p, fsrsRetention: Math.round(p.fsrsRetention * 100) / 100, ttsVoice: p.ttsVoice.normalize('NFC') };
}
export function parseStoredPreferences(value: unknown): StudyPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('INVALID_SETTINGS');
  const raw: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  if ('newCardsPerDay' in raw && !isValidNewCardsPerDay(raw.newCardsPerDay)) raw.newCardsPerDay = DEFAULT_PREFERENCES.newCardsPerDay;
  if ('fsrsRetention' in raw && !isValidFsrsRetention(raw.fsrsRetention)) raw.fsrsRetention = DEFAULT_PREFERENCES.fsrsRetention;
  return validatePreferences(raw);
}

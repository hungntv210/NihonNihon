export const DEFAULT_PREFERENCES = {
  startDate: '2026-11-02', eveningTime: '19:30', studyMinutes: 50,
  examDate: '2028-07-02', timeZone: 'Asia/Ho_Chi_Minh', shadowingDays: [2, 4],
  newCardsPerDay: 10, fsrsRetention: 0.9, furigana: true, ttsVoice: '', theme: 'system',
};
export type StudyPreferences = typeof DEFAULT_PREFERENCES;
export function validatePreferences(value: unknown): StudyPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('INVALID_SETTINGS');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !(key in DEFAULT_PREFERENCES))) throw Error('UNKNOWN_SETTING');
  const p = { ...DEFAULT_PREFERENCES, ...input } as StudyPreferences;
  const date = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s).toISOString().slice(0,10) === s;
  if (!date(p.startDate) || !date(p.examDate) || p.examDate <= p.startDate || !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.eveningTime)
    || !Number.isInteger(p.studyMinutes) || p.studyMinutes < 5 || p.studyMinutes > 180
    || !Number.isInteger(p.newCardsPerDay) || p.newCardsPerDay < 0 || p.newCardsPerDay > 100
    || !Number.isFinite(p.fsrsRetention) || p.fsrsRetention < .7 || p.fsrsRetention > .99
    || typeof p.furigana !== 'boolean' || typeof p.ttsVoice !== 'string' || p.ttsVoice.length > 200
    || !['system','light','dark'].includes(p.theme) || !Array.isArray(p.shadowingDays)
    || p.shadowingDays.some(d => !Number.isInteger(d) || d < 0 || d > 6) || new Set(p.shadowingDays).size !== p.shadowingDays.length) throw Error('INVALID_SETTINGS');
  if (typeof p.timeZone !== 'string' || p.timeZone.length > 80) throw Error('INVALID_TIMEZONE');
  new Intl.DateTimeFormat('en', { timeZone: p.timeZone });
  return { ...p, ttsVoice: p.ttsVoice.normalize('NFC') };
}

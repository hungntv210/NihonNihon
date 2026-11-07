export const DEFAULT_PREFERENCES = {
  startDate: '2026-11-02', eveningTime: '19:30', studyMinutes: 50,
  examDate: '2028-07-02', timeZone: 'Asia/Ho_Chi_Minh', shadowingDays: [2, 4],
  newCardsPerDay: 10, fsrsRetention: 0.9, furigana: true, ttsVoice: '', theme: 'system',
};
export type StudyPreferences = typeof DEFAULT_PREFERENCES;
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
    || !Number.isInteger(p.newCardsPerDay) || p.newCardsPerDay < 0 || p.newCardsPerDay > 100
    || !Number.isFinite(p.fsrsRetention) || p.fsrsRetention < .7 || p.fsrsRetention > .99
    || typeof p.furigana !== 'boolean' || typeof p.ttsVoice !== 'string' || p.ttsVoice.length > 200
    || !['system','light','dark'].includes(p.theme) || !Array.isArray(p.shadowingDays)
    || p.shadowingDays.length < 2 || p.shadowingDays.some(d => !Number.isInteger(d) || d < 0 || d > 6) || new Set(p.shadowingDays).size !== p.shadowingDays.length) throw Error('INVALID_SETTINGS');
  if (typeof p.timeZone !== 'string' || p.timeZone.length > 80) throw Error('INVALID_TIMEZONE');
  new Intl.DateTimeFormat('en', { timeZone: p.timeZone });
  return { ...p, ttsVoice: p.ttsVoice.normalize('NFC') };
}

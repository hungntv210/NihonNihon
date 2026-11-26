import fs from 'node:fs';
import path from 'node:path';
import { databasePath } from '../../../core/config.ts';
import { CLOCK_TIME_RE, isValidDayBreakTimes } from '../../../core/preferences.ts';
import { defaults, validDate, type Settings } from './model.ts';
// Route-local settings reader sharing validation rules with core preferences.
export function readTodaySettings(file = path.resolve(process.env.NIHON_SETTINGS_PATH || path.join(path.dirname(databasePath()), 'settings.json'))): Settings {
  let input: Record<string, unknown>;
  try {
    if (fs.statSync(file).size > 65536) throw Error('INVALID_SETTINGS');
    input = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { ...defaults, shadowingDays: [...defaults.shadowingDays], dayBreakTimes: [...defaults.dayBreakTimes] };
    }
    throw error;
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('INVALID_SETTINGS');
  const p = { ...defaults, ...input } as Settings;
  const enforceBeforeEvening = Object.hasOwn(input, 'dayBreakTimes') || p.remindersEnabled === true;
  if (
    !validDate(p.startDate) ||
    !validDate(p.examDate) ||
    p.examDate <= p.startDate ||
    typeof p.eveningTime !== 'string' ||
    !CLOCK_TIME_RE.test(p.eveningTime) ||
    !Number.isInteger(p.studyMinutes) ||
    p.studyMinutes < 5 ||
    p.studyMinutes > 180 ||
    typeof p.timeZone !== 'string' ||
    p.timeZone.length > 80 ||
    !Array.isArray(p.shadowingDays) ||
    p.shadowingDays.length < 2 ||
    p.shadowingDays.some(d => !Number.isInteger(d) || d < 0 || d > 6) ||
    new Set(p.shadowingDays).size !== p.shadowingDays.length ||
    !Number.isInteger(p.newCardsPerDay) ||
    p.newCardsPerDay < 0 ||
    p.newCardsPerDay > 100 ||
    typeof p.remindersEnabled !== 'boolean' ||
    !isValidDayBreakTimes(p.dayBreakTimes, enforceBeforeEvening ? p.eveningTime : undefined)
  ) {
    throw Error('INVALID_SETTINGS');
  }
  new Intl.DateTimeFormat('en', { timeZone: p.timeZone });
  return {
    startDate: p.startDate,
    examDate: p.examDate,
    eveningTime: p.eveningTime,
    studyMinutes: p.studyMinutes,
    timeZone: p.timeZone,
    shadowingDays: [...p.shadowingDays],
    newCardsPerDay: p.newCardsPerDay,
    remindersEnabled: p.remindersEnabled,
    dayBreakTimes: [...p.dayBreakTimes].sort(),
  };
}

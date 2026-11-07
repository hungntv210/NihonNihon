import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { requireSession } from './auth.ts';
import { DEFAULT_PREFERENCES, validatePreferences } from '../core/preferences.ts';
import { databasePath } from '../core/config.ts';
export const settingsPath = () => path.resolve(process.env.NIHON_SETTINGS_PATH || path.join(path.dirname(databasePath()),'settings.json'));
export async function getStudyPreferences() {
  await requireSession();
  try { return validatePreferences(JSON.parse(fs.readFileSync(settingsPath(), 'utf8'))); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ...DEFAULT_PREFERENCES }; throw error; }
}
export async function saveStudyPreferences(value: unknown) {
  await requireSession();
  const p = validatePreferences(value), file = settingsPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + '.' + randomUUID() + '.tmp';
  try { fs.writeFileSync(temporary, JSON.stringify(p), { mode: 0o600, flag: 'wx' }); fs.renameSync(temporary, file); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  return p;
}

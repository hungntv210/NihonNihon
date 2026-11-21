import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { requireSession } from './auth.ts';
import { DEFAULT_PREFERENCES, parseStoredPreferences, validatePreferences } from '../core/preferences.ts';
import { databasePath } from '../core/config.ts';
export const settingsPath = () => path.resolve(process.env.NIHON_SETTINGS_PATH || path.join(path.dirname(databasePath()),'settings.json'));
// Only these non-sensitive appearance flags are used by the public server-rendered shell.
export function getAppearance() {
  try { const p = parseStoredPreferences(JSON.parse(fs.readFileSync(settingsPath(), 'utf8'))); return { theme: p.theme, motion: p.motion }; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { theme: 'system', motion: true }; throw error; }
}
export async function getStudyPreferences() {
  await requireSession();
  try { return parseStoredPreferences(JSON.parse(fs.readFileSync(settingsPath(), 'utf8'))); }
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

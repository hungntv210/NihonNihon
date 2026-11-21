import 'server-only';
import { withContentDatabase } from '../../../server/dal.ts';
import { getStudyPreferences } from '../../../server/preferences.ts';
import { normalizeRetention, scheduler } from './model.ts';
import { session } from './repository.ts';
export async function getSession(mode: 'quick' | 'full') {
  const prefs = await getStudyPreferences();
  const desiredRetention = normalizeRetention(prefs.fsrsRetention);
  const engine = await scheduler(desiredRetention);
  return withContentDatabase(db => session(db, engine, mode, new Date(), {
    newCardsPerDay: prefs.newCardsPerDay,
    desiredRetention,
    timeZone: prefs.timeZone,
  }));
}

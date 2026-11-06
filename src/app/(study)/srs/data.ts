import 'server-only';
import { withContentDatabase } from '../../../server/dal.ts';
import { scheduler } from './model.ts';
import { session } from './repository.ts';
export async function getSession(mode: 'quick' | 'full') {
  const engine = await scheduler();
  return withContentDatabase(db => session(db, engine, mode));
}

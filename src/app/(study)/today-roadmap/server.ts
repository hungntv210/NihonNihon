import 'server-only';
import { requireSession } from '../../../server/auth.ts';
import { withContentDatabase } from '../../../server/dal.ts';
import { listRoadmapClips } from './roadmap-clips.ts';
import { buildRoadmap, lessonAccess, localClock } from './model.ts';
import { readTodaySettings } from './settings.ts';
import { readProgress, readRoadmapCatalog, roadmapData } from './repository.ts';
export async function getTodaySettings() { await requireSession();return readTodaySettings(); }
export async function getToday() {
  await requireSession();
  const now = new Date(), settings = await getTodaySettings();
  return { now: now.toISOString(), settings, progress: readProgress(), data: await withContentDatabase(db => roadmapData(db, now)) };
}
export async function getRoadmapToday() {
  const now = new Date(), settings = await getTodaySettings();
  const { due, items, saved } = await withContentDatabase(db => {
    const data = roadmapData(db, now);
    return { ...data, items: readRoadmapCatalog(db, data.items) };
  });
  const clips = listRoadmapClips();
  const roadmap = buildRoadmap(items, settings.startDate, clips);
  return { now: now.toISOString(), settings, progress: readProgress(), data: { due, roadmap, clips, saved } };
}
export async function getNewLessonAccess() {
  await requireSession();
  const settings = await getTodaySettings();
  const access = lessonAccess(readProgress(), localClock(new Date(), settings.timeZone).date, settings.startDate);
  return { locked: access.locked, reason: access.locked ? access.reason : null };
}


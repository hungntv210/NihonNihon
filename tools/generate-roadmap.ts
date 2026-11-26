import { openContentDatabase } from '../src/core/content.ts';
import { buildRoadmap, defaults } from '../src/app/(study)/today-roadmap/model.ts';
import { listRoadmapClips } from '../src/app/(study)/today-roadmap/roadmap-clips.ts';
import { readRoadmapCatalog } from '../src/app/(study)/today-roadmap/repository.ts';

const [database, youtubeFile] = process.argv.slice(2);
if (!database) throw Error('Usage: node --import tsx tools/generate-roadmap.ts SNAPSHOT [YOUTUBE_CLIP_JSON]');

const db = openContentDatabase(database);
try {
  const clips = listRoadmapClips(database, youtubeFile);
  console.log(JSON.stringify(buildRoadmap(readRoadmapCatalog(db), defaults.startDate, clips), null, 2));
} finally {
  db.close();
}

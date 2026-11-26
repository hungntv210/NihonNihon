import { listShadowingClips } from '../shadowing/clips.ts';

export function listRoadmapClips(file?: string, youtubeFile?: string) {
  return listShadowingClips(file, youtubeFile)
    .filter(clip => !clip.isDemo)
    .map(({ id, title, level }) => ({ id, title, level }));
}

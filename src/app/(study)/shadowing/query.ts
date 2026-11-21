import type { Clip } from './clip-model.ts';

export type ShadowingQuery = {
  clip?: string | string[];
  segment?: string | string[];
};

function firstQueryValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return (value[0] ?? '').trim();
  return typeof value === 'string' ? value.trim() : '';
}

export function resolveShadowingSelection(
  clips: readonly Clip[],
  query: ShadowingQuery = {},
): { clipId: string; segmentIndex: number } {
  if (!clips.length) return { clipId: '', segmentIndex: 0 };
  const clipParam = firstQueryValue(query.clip);
  const clip = (clipParam && clips.find((entry) => entry.id === clipParam)) || clips[0];
  const segmentParam = firstQueryValue(query.segment);
  if (!segmentParam) return { clipId: clip.id, segmentIndex: 0 };

  const byId = clip.segments.findIndex((segment) => segment.id === segmentParam);
  if (byId >= 0) return { clipId: clip.id, segmentIndex: byId };

  if (/^\d+$/.test(segmentParam)) {
    const parsed = Number.parseInt(segmentParam, 10);
    if (parsed >= 1 && parsed <= clip.segments.length) {
      return { clipId: clip.id, segmentIndex: parsed - 1 };
    }
  }
  return { clipId: clip.id, segmentIndex: 0 };
}

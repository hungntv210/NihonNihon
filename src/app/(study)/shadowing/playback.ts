import type { Clip } from './clip-model.ts';

export const SEEK_TOLERANCE = 0.25;

export function segmentAtIn(time: number, segments: readonly { start: number; end: number }[]) {
  return segments.findIndex((segment) => time >= segment.start && time < segment.end);
}

export function shouldRepeat(completed: number, limit: number) {
  return limit === 0 || completed < limit;
}

export function playbackTime(time: number, clip: Clip, skipGaps: boolean) {
  const bounded =
    time < clip.start && time >= clip.start - SEEK_TOLERANCE
      ? time
      : Math.max(clip.start, Math.min(clip.end, time));
  if (skipGaps) {
    for (let i = 1; i < clip.segments.length; i++) {
      const previous = clip.segments[i - 1],
        next = clip.segments[i];
      if (next.start - previous.end > 3 && bounded >= previous.end && bounded < next.start) {
        return next.start;
      }
    }
  }
  return bounded;
}

export type PlaybackSession = {
  selected: number;
  limit: number;
  count: number;
  active: boolean;
  whole: boolean;
  entered: boolean;
};

type PlaybackMedia = { currentTime: number; seeking: boolean; paused: boolean; pause(): void };

export function updatePlayback(media: PlaybackMedia, clip: Clip, loop: PlaybackSession) {
  // Safari can expose the OLD time during a seek, or land slightly before the target keyframe.
  if (media.seeking) return null;
  const now = media.currentTime,
    bounded = playbackTime(now, clip, loop.whole);
  const result = { time: bounded, finished: false, repeat: false };
  if (Math.abs(now - bounded) > SEEK_TOLERANCE) {
    if (bounded >= clip.end - 0.02) {
      media.pause();
      loop.whole = false;
    }
    media.currentTime = bounded;
    return result;
  }
  if (!loop.active) {
    if (bounded >= clip.end - 0.02) {
      media.pause();
      loop.whole = false;
    }
    return result;
  }
  if (media.paused) return result;
  const sentence = clip.segments[loop.selected];
  if (now >= sentence.start && now < sentence.end - 0.04) loop.entered = true;
  if (!loop.entered || now < sentence.end - 0.04) return result;
  loop.entered = false;
  loop.count++;
  if (loop.limit === 0 || loop.count < loop.limit) {
    media.currentTime = sentence.start;
    result.repeat = true;
  } else {
    loop.active = false;
    media.pause();
    result.finished = true;
  }
  return result;
}

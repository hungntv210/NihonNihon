import { fallbackSegmentTokens } from '../common-tools/lookup-popup-model.ts';
import type { Clip, ClipSegment } from './clip-model.ts';

export type ClipMetaSummary = {
  title: string;
  sourceLabel: string;
  level: string;
  topic: string;
  sentenceCount: number;
  /**
   * Speech rate in spoken characters per second (`ký tự/s`):
   * total NFC-normalized spoken characters across subtitle `ja` lines
   * (Unicode letters, numbers, prolonged sound mark `ー`, iteration marks `々/〆`,
   * excluding whitespace and punctuation) divided by total active subtitle
   * duration `Σ(end - start)` in seconds, rounded to 1 decimal place.
   * `null` when spoken characters or duration are <= 0.
   */
  speechRateCharsPerSec: number | null;
  /**
   * Percentage (0–100, rounded integer) of unique clickable Japanese words in
   * the clip that match the user's SRS cards / vocab notebook (`knownTerms`).
   * `null` when the user has 0 cards or the clip has 0 clickable words -> "—".
   */
  knownWordPercent: number | null;
};

const SPOKEN_CHAR_RE = /[\p{L}\p{N}\u30FC\u3005\u3006]/gu;

export function normalizeClipTerm(text: string): string {
  return text.normalize('NFC').trim();
}

export function clipSourceLabel(clip: Pick<Clip, 'isDemo' | 'youtubeId' | 'attribution'>): string {
  if (clip.isDemo) return 'Demo';
  const attribution = clip.attribution.trim();
  if (clip.youtubeId) {
    return attribution ? `YouTube · ${attribution}` : 'YouTube';
  }
  return attribution || 'Tư liệu riêng';
}

export function countSpokenCharacters(text: string): number {
  const normalized = text.normalize('NFC');
  const matches = normalized.match(SPOKEN_CHAR_RE);
  return matches ? matches.length : 0;
}

export function computeSpeechRate(
  segments: readonly Pick<ClipSegment, 'ja' | 'start' | 'end'>[],
): number | null {
  let spokenChars = 0;
  let durationSec = 0;
  for (const segment of segments) {
    const segDuration = segment.end - segment.start;
    if (Number.isFinite(segDuration) && segDuration > 0) {
      durationSec += segDuration;
      spokenChars += countSpokenCharacters(segment.ja);
    }
  }
  if (durationSec <= 0 || spokenChars <= 0) return null;
  return Math.round((spokenChars / durationSec) * 10) / 10;
}

export function extractClipWordGroups(
  segments: readonly Pick<ClipSegment, 'ja' | 'tokens'>[],
): string[][] {
  const byKey = new Map<string, Set<string>>();
  for (const segment of segments) {
    const tokens =
      segment.tokens && segment.tokens.length > 0
        ? segment.tokens
        : fallbackSegmentTokens(segment.ja);
    for (const token of tokens) {
      if (!token.clickable) continue;
      const surface = normalizeClipTerm(token.surface);
      const base = token.base ? normalizeClipTerm(token.base) : '';
      const key = base || surface;
      if (!key) continue;
      let forms = byKey.get(key);
      if (!forms) {
        forms = new Set<string>();
        byKey.set(key, forms);
      }
      if (base) forms.add(base);
      if (surface) forms.add(surface);
    }
  }
  return [...byKey.values()].map((forms) => [...forms]);
}

export function computeKnownWordPercent(
  segments: readonly Pick<ClipSegment, 'ja' | 'tokens'>[],
  knownTerms: ReadonlySet<string> | null | undefined,
): number | null {
  if (!knownTerms || knownTerms.size === 0) return null;
  const wordGroups = extractClipWordGroups(segments);
  if (wordGroups.length === 0) return null;
  let knownCount = 0;
  for (const forms of wordGroups) {
    if (forms.some((form) => knownTerms.has(form))) {
      knownCount++;
    }
  }
  return Math.round((knownCount / wordGroups.length) * 100);
}

export function computeClipMeta(
  clip: Clip,
  knownTerms?: ReadonlySet<string> | null,
): ClipMetaSummary {
  return {
    title: clip.title,
    sourceLabel: clipSourceLabel(clip),
    level: clip.level.trim() || '—',
    topic: clip.topic.trim() || '—',
    sentenceCount: clip.segments.length,
    speechRateCharsPerSec: computeSpeechRate(clip.segments),
    knownWordPercent: computeKnownWordPercent(clip.segments, knownTerms),
  };
}

export function formatSpeechRate(rate: number | null): string {
  if (rate === null || !Number.isFinite(rate) || rate <= 0) return '—';
  return `${rate.toFixed(1)} ký tự/s`;
}

export function formatKnownWordPercent(percent: number | null): string {
  if (percent === null || !Number.isFinite(percent)) return '—';
  return `${Math.max(0, Math.min(100, Math.round(percent)))}%`;
}

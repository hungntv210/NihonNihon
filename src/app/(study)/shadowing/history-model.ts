export const HISTORY_RETENTION_DAYS = 30;
export const RECORDING_RETENTION_DAYS = 14;
export const MAX_TURNS_PER_CLIP = 50;
export const MAX_PIN_AUDIO_BYTES = 2 * 1024 * 1024;
export const ALLOWED_AUDIO_MIMES = ['audio/webm', 'audio/mp4', 'audio/ogg'] as const;
export type AllowedAudioMime = (typeof ALLOWED_AUDIO_MIMES)[number];

export type ShadowingTurn = {
  id: string;
  clipId: string;
  segmentId: string | null;
  practicedAt: string;
  date: string;
  durationMs: number;
  recordedSegments: number;
  totalSegments: number;
  audioFile: string | null;
  audioMime: AllowedAudioMime | null;
  audioBytes: number | null;
};

export type PinnedBestTake = {
  id: string;
  clipId: string;
  segmentId: string;
  pinnedAt: string;
  durationMs: number;
  audioFile: string;
  audioMime: AllowedAudioMime;
  audioBytes: number;
};

export type ShadowingHistoryStore = {
  version: 1;
  turns: ShadowingTurn[];
  pinned: Record<string, Record<string, PinnedBestTake>>;
};

export type ClipHistorySummary = {
  clipId: string;
  totalTurns: number;
  lastPracticedAt: string | null;
  lastPracticedDate: string | null;
  turns: ShadowingTurn[];
  pinned: Record<string, PinnedBestTake>;
};

export function normalizeAudioMime(raw: string | null | undefined): AllowedAudioMime | null {
  if (!raw) return null;
  const base = raw.split(';')[0].trim().toLowerCase();
  if (base === 'audio/webm' || base === 'video/webm') return 'audio/webm';
  if (base === 'audio/mp4' || base === 'audio/x-m4a' || base === 'audio/m4a' || base === 'video/mp4')
    return 'audio/mp4';
  if (base === 'audio/ogg') return 'audio/ogg';
  return null;
}

export function extensionForMime(mime: AllowedAudioMime): 'webm' | 'm4a' | 'ogg' {
  if (mime === 'audio/mp4') return 'm4a';
  if (mime === 'audio/ogg') return 'ogg';
  return 'webm';
}

export function compareIsoDesc(a: string, b: string): number {
  const aMs = Date.parse(a);
  const bMs = Date.parse(b);
  if (Number.isFinite(aMs) && Number.isFinite(bMs) && aMs !== bMs) {
    return bMs - aMs;
  }
  return b.localeCompare(a);
}

export function summarizeClipHistory(
  store: ShadowingHistoryStore,
  clipId: string,
): ClipHistorySummary {
  const turns = store.turns
    .filter((turn) => turn.clipId === clipId)
    .slice()
    .sort((a, b) => {
      const cmp = compareIsoDesc(a.practicedAt, b.practicedAt);
      return cmp !== 0 ? cmp : b.id.localeCompare(a.id);
    });
  const latest = turns[0] ?? null;
  const pinnedMap = store.pinned[clipId] ? { ...store.pinned[clipId] } : {};
  return {
    clipId,
    totalTurns: turns.length,
    lastPracticedAt: latest ? latest.practicedAt : null,
    lastPracticedDate: latest ? latest.date : null,
    turns,
    pinned: pinnedMap,
  };
}

export function summarizeAllClips(
  store: ShadowingHistoryStore,
  clipIds: readonly string[],
): Record<string, ClipHistorySummary> {
  return Object.fromEntries(clipIds.map((id) => [id, summarizeClipHistory(store, id)]));
}

export function emptyClipHistory(clipId: string): ClipHistorySummary {
  return {
    clipId,
    totalTurns: 0,
    lastPracticedAt: null,
    lastPracticedDate: null,
    turns: [],
    pinned: {},
  };
}

export function formatHistoryDate(dateOrIso: string, timeZone = 'Asia/Ho_Chi_Minh'): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOrIso)) {
    const [y, m, d] = dateOrIso.split('-');
    return `${d}/${m}/${y}`;
  }
  const ms = Date.parse(dateOrIso);
  if (!Number.isFinite(ms)) return dateOrIso.slice(0, 10);
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString().slice(0, 10);
  }
}

export function formatHistoryTime(iso: string, timeZone = 'Asia/Ho_Chi_Minh'): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  try {
    const time = new Intl.DateTimeFormat('vi-VN', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(ms));
    const date = formatHistoryDate(iso, timeZone);
    return `${time} · ${date}`;
  } catch {
    return new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
  }
}

export function pinnedAudioUrl(clipId: string, segmentId: string, pinId: string): string {
  return `/api/shadowing/history?audio=${encodeURIComponent(pinId)}&clip=${encodeURIComponent(clipId)}&segment=${encodeURIComponent(segmentId)}`;
}

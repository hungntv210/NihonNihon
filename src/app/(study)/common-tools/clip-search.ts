import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { toRomaji } from 'wanakana';
import { listShadowingClips } from '../shadowing/clips.ts';
import {
  parsePrivateClip,
  parseYoutubeClip,
  syntheticClip,
  type Clip,
} from '../shadowing/clip-model.ts';
import { normalize, resolveMainFile } from './fts5.ts';

export type ClipSentenceHit = {
  id: string;
  clipId: string;
  clipTitle: string;
  clipSource: 'Demo' | 'YouTube' | 'Tư liệu riêng';
  level: string;
  segmentId: string;
  segmentNumber: number;
  ja: string;
  kana: string | null;
  vi: string | null;
  speaker: string | null;
  href: string;
};

export type ClipSearchOptions = {
  dbFile?: string;
  youtubeFile?: string;
  limit?: number;
};

const ACTIVE_PRIVATE_CLIP_SQL = `SELECT c.item_id id, r.manifest_json, m.storage_ref
  FROM content_items c
  JOIN source_releases r ON r.release_id=c.release_id
  JOIN media_assets m ON m.item_id=c.item_id
  WHERE c.kind='clip' AND c.source_id='user-media' AND c.is_active=1
    AND m.asset_kind='video' AND m.private_only=1
  ORDER BY c.item_id`;

export function clipSentenceHref(clipId: string, segmentId: string): string {
  return `/shadowing?clip=${encodeURIComponent(clipId)}&segment=${encodeURIComponent(segmentId)}`;
}

export function normalizeClipText(value: string): string {
  return normalize(value.normalize('NFKC'));
}

function isPrivateMediaAvailable(storageRef: string): boolean {
  const trimmed = storageRef.trim();
  if (!trimmed) return false;
  try {
    const actual = fs.realpathSync(trimmed);
    const stat = fs.statSync(actual);
    if (!stat.isFile()) return false;
    const root = process.env.NIHON_SHADOWING_MEDIA_ROOT?.trim();
    if (root) {
      const relative = path.relative(fs.realpathSync(root), actual);
      if (relative.startsWith('..') || path.isAbsolute(relative)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function resolveYoutubeFile(explicit?: string): string {
  if (explicit !== undefined) return explicit;
  return process.env.NIHON_YOUTUBE_CLIP_PATH || path.resolve('data/private/youtube-clip.json');
}

function loadActivePrivateRows(db: DatabaseSync): Array<{
  id: string;
  manifestJson: string;
  storageRef: string;
}> {
  try {
    return db
      .prepare(ACTIVE_PRIVATE_CLIP_SQL)
      .all()
      .map((row) => ({
        id: String(row.id),
        manifestJson: String(row.manifest_json),
        storageRef: String(row.storage_ref),
      }));
  } catch {
    return [];
  }
}

function loadClipsSafely(
  db: DatabaseSync,
  dbFile: string,
  youtubeFile: string,
): Clip[] {
  const privateRows = loadActivePrivateRows(db);
  const availablePrivateIds = new Set(
    privateRows
      .filter((row) => isPrivateMediaAvailable(row.storageRef))
      .map((row) => row.id),
  );

  if (dbFile && youtubeFile !== '') {
    try {
      const clips = listShadowingClips(dbFile, youtubeFile);
      return clips.filter(
        (clip) => clip.isDemo || Boolean(clip.youtubeId) || availablePrivateIds.has(clip.id),
      );
    } catch {
      // Fall back to per-clip resilient parsing so one corrupt private manifest or JSON never breaks search.
    }
  }

  const clips: Clip[] = [syntheticClip];
  if (youtubeFile && fs.existsSync(youtubeFile)) {
    try {
      clips.push(parseYoutubeClip(JSON.parse(fs.readFileSync(youtubeFile, 'utf8'))));
    } catch {
      // Ignore malformed or unreadable YouTube clip descriptor.
    }
  }
  for (const row of privateRows) {
    if (!availablePrivateIds.has(row.id)) continue;
    try {
      clips.push(parsePrivateClip(row.id, JSON.parse(row.manifestJson)));
    } catch {
      // Ignore malformed private clip manifest.
    }
  }
  return clips;
}

function clipSourceLabel(clip: Clip): ClipSentenceHit['clipSource'] {
  if (clip.isDemo) return 'Demo';
  if (clip.youtubeId) return 'YouTube';
  return 'Tư liệu riêng';
}

function segmentMatches(needle: string, values: Array<string | null | undefined>): boolean {
  if (!needle) return true;
  for (const raw of values) {
    if (!raw) continue;
    const nfkc = raw.normalize('NFKC');
    if (normalize(nfkc).includes(needle)) return true;
    if (normalize(toRomaji(nfkc)).includes(needle)) return true;
  }
  return false;
}

export function searchClipSentences(
  db: DatabaseSync,
  input: string,
  options?: ClipSearchOptions,
): { total: number; items: ClipSentenceHit[] } {
  const limit = Math.max(0, Math.min(Math.trunc(options?.limit ?? 10), 100));
  const q = input.normalize('NFKC').trim().slice(0, 160);
  const needle = normalizeClipText(q);
  const dbFile = options?.dbFile ?? resolveMainFile(db);
  const youtubeFile = resolveYoutubeFile(options?.youtubeFile);
  const clips = loadClipsSafely(db, dbFile, youtubeFile);

  let total = 0;
  const items: ClipSentenceHit[] = [];

  for (const clip of clips) {
    const source = clipSourceLabel(clip);
    const level = clip.level || '—';
    for (let index = 0; index < clip.segments.length; index++) {
      const segment = clip.segments[index];
      if (
        !segmentMatches(needle, [
          segment.ja,
          segment.kana,
          segment.vi,
          segment.speaker,
          clip.title,
        ])
      ) {
        continue;
      }
      total++;
      if (items.length < limit) {
        items.push({
          id: `${clip.id}::${segment.id}`,
          clipId: clip.id,
          clipTitle: clip.title,
          clipSource: source,
          level,
          segmentId: segment.id,
          segmentNumber: index + 1,
          ja: segment.ja,
          kana: segment.kana,
          vi: segment.vi,
          speaker: segment.speaker,
          href: clipSentenceHref(clip.id, segment.id),
        });
      }
    }
  }

  return { total, items };
}

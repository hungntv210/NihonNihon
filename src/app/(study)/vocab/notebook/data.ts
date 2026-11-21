import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { selectedTranslation, type Translation } from '../../../../core/content.ts';
import {
  lookupContextPath,
  readLookupSentenceStore,
  type LookupSentenceStore,
} from '../../common-tools/lookup-store.ts';
import type { SavedLookupSentence } from '../../common-tools/lookup-popup-model.ts';
import { parsePrivateClip, parseYoutubeClip, syntheticClip } from '../../shadowing/clip-model.ts';
import { wordSegments, type Segment } from '../data.ts';

export type NotebookSource = 'clip' | 'lookup' | 'srs';
export type NotebookSourceFilter = 'all' | NotebookSource;

export type ClipReference = {
  id: string;
  title: string;
  segments: { id: string; ja: string; position: number }[];
};

export type NotebookEntry = {
  id: string;
  word: string;
  reading: string;
  romaji: string;
  level: string;
  segments: Segment[];
  english: string[];
  meaning: Translation | null;
  sourceName: string;
  source: NotebookSource;
  sentenceJa: string | null;
  sentenceVi: string | null;
  sourceClipId: string | null;
  clipHref: string | null;
  clipTitle: string | null;
  segmentNumber: number | null;
  addedAt: string;
};

export type NotebookCounts = {
  all: number;
  clip: number;
  lookup: number;
  srs: number;
};

export type NotebookResult = {
  items: NotebookEntry[];
  total: number;
  filteredTotal: number;
  source: NotebookSourceFilter;
  counts: NotebookCounts;
};

export const NOTEBOOK_SOURCES: readonly { key: NotebookSourceFilter; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'clip', label: 'Phụ đề clip' },
  { key: 'lookup', label: 'Tra từ' },
  { key: 'srs', label: 'Hàng ôn SRS' },
];

export const NOTEBOOK_SOURCE_LABELS: Record<NotebookSource, string> = {
  clip: 'Phụ đề clip',
  lookup: 'Tra từ',
  srs: 'Hàng ôn SRS',
};

export function parseNotebookSource(
  value: string | string[] | undefined,
): NotebookSourceFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'clip' || raw === 'lookup' || raw === 'srs') return raw;
  return 'all';
}

export function notebookUrl(source: NotebookSourceFilter): string {
  return source === 'all' ? '/vocab/notebook' : `/vocab/notebook?source=${source}`;
}

export function formatNotebookDate(iso: string, timeZone = 'Asia/Ho_Chi_Minh'): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso.slice(0, 10);
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

export function loadShadowingClipCatalog(
  db: DatabaseSync,
  youtubeFile = process.env.NIHON_YOUTUBE_CLIP_PATH ||
    path.resolve('data/private/youtube-clip.json'),
): ClipReference[] {
  const clips: ClipReference[] = [
    {
      id: syntheticClip.id,
      title: syntheticClip.title,
      segments: syntheticClip.segments.map((segment, index) => ({
        id: segment.id,
        ja: segment.ja,
        position: index,
      })),
    },
  ];
  const seen = new Set<string>([syntheticClip.id]);

  if (youtubeFile && fs.existsSync(youtubeFile)) {
    try {
      const yt = parseYoutubeClip(JSON.parse(fs.readFileSync(youtubeFile, 'utf8')));
      if (!seen.has(yt.id)) {
        seen.add(yt.id);
        clips.push({
          id: yt.id,
          title: yt.title,
          segments: yt.segments.map((segment, index) => ({
            id: segment.id,
            ja: segment.ja,
            position: index,
          })),
        });
      }
    } catch {
      // Ignore malformed optional private YouTube clip metadata
    }
  }

  const privateRows = db
    .prepare(
      `SELECT c.item_id id, r.manifest_json
       FROM content_items c
       JOIN source_releases r ON r.release_id=c.release_id
       JOIN media_assets m ON m.item_id=c.item_id
       WHERE c.kind='clip' AND c.source_id='user-media' AND c.is_active=1
         AND m.asset_kind='video' AND m.private_only=1
       ORDER BY c.item_id`,
    )
    .all();

  for (const row of privateRows) {
    const id = String(row.id);
    if (seen.has(id)) continue;
    try {
      const parsed = parsePrivateClip(id, JSON.parse(String(row.manifest_json)));
      seen.add(id);
      clips.push({
        id: parsed.id,
        title: parsed.title,
        segments: parsed.segments.map((segment, index) => ({
          id: segment.id,
          ja: segment.ja,
          position: index,
        })),
      });
    } catch {
      // Skip clips with unreadable private manifests
    }
  }

  return clips;
}

export function resolveClipLink(
  clips: readonly ClipReference[],
  sourceClipId: string | null,
  sentenceJa: string | null,
): { href: string; clipTitle: string; segmentNumber: number | null } | null {
  if (!sourceClipId) return null;
  const clip = clips.find((entry) => entry.id === sourceClipId);
  if (!clip) return null;
  const targetJa = sentenceJa?.normalize('NFC').trim() ?? '';
  if (targetJa) {
    const exactIndex = clip.segments.findIndex(
      (segment) => segment.ja.normalize('NFC').trim() === targetJa,
    );
    if (exactIndex >= 0) {
      const seg = clip.segments[exactIndex];
      return {
        href: `/shadowing?clip=${encodeURIComponent(clip.id)}&segment=${encodeURIComponent(seg.id)}`,
        clipTitle: clip.title,
        segmentNumber: seg.position + 1,
      };
    }
  }
  return {
    href: `/shadowing?clip=${encodeURIComponent(clip.id)}`,
    clipTitle: clip.title,
    segmentNumber: null,
  };
}

function safeReadLookupStore(file: string): LookupSentenceStore {
  try {
    return readLookupSentenceStore(file);
  } catch {
    return { version: 1, entries: {} };
  }
}

function compareDescIso(a: string, b: string): number {
  const aMs = Date.parse(a);
  const bMs = Date.parse(b);
  if (Number.isFinite(aMs) && Number.isFinite(bMs) && aMs !== bMs) {
    return bMs - aMs;
  }
  return b.localeCompare(a);
}

export function listVocabNotebook(
  db: DatabaseSync,
  options: {
    source?: NotebookSourceFilter;
    contextPath?: string;
    youtubeFile?: string;
    clips?: readonly ClipReference[];
  } = {},
): NotebookResult {
  const sourceFilter = options.source ?? 'all';
  const store = safeReadLookupStore(options.contextPath ?? lookupContextPath());

  const latestLookupByItem = new Map<string, SavedLookupSentence>();
  for (const entry of Object.values(store.entries)) {
    const existing = latestLookupByItem.get(entry.itemId);
    if (!existing || compareDescIso(entry.savedAt, existing.savedAt) < 0) {
      latestLookupByItem.set(entry.itemId, entry);
    }
  }

  const srsRows = db
    .prepare(
      `SELECT v.item_id, v.word, v.reading, v.romaji, v.level, v.meanings_en, s.name source_name,
              MIN(
                CASE
                  WHEN (SELECT MIN(r.reviewed_at) FROM srs_reviews r WHERE r.card_id=c.card_id) IS NOT NULL
                   AND (SELECT MIN(r.reviewed_at) FROM srs_reviews r WHERE r.card_id=c.card_id) < c.updated_at
                  THEN (SELECT MIN(r.reviewed_at) FROM srs_reviews r WHERE r.card_id=c.card_id)
                  ELSE c.updated_at
                END
              ) srs_added_at
       FROM vocab v
       JOIN content_items i USING(item_id)
       JOIN data_sources s ON s.source_id=i.source_id
       JOIN srs_cards c ON c.item_id=v.item_id
       WHERE i.is_active=1
       GROUP BY v.item_id`,
    )
    .all();

  const rowById = new Map<string, Record<string, unknown>>();
  for (const row of srsRows) {
    rowById.set(String(row.item_id), row);
  }

  const extraLookupIds = [...latestLookupByItem.keys()].filter((id) => !rowById.has(id));
  if (extraLookupIds.length > 0) {
    const lookupVocabStmt = db.prepare(
      `SELECT v.item_id, v.word, v.reading, v.romaji, v.level, v.meanings_en, s.name source_name
       FROM vocab v
       JOIN content_items i USING(item_id)
       JOIN data_sources s ON s.source_id=i.source_id
       WHERE i.is_active=1 AND v.item_id=?`,
    );
    for (const id of extraLookupIds) {
      const row = lookupVocabStmt.get(id);
      if (row) rowById.set(id, row);
    }
  }

  const clips = options.clips ?? loadShadowingClipCatalog(db, options.youtubeFile);
  const furiganaStmt = db.prepare(
    'SELECT segments FROM word_furigana WHERE word=? AND reading=? ORDER BY source_id LIMIT 1',
  );

  const allEntries: NotebookEntry[] = [];
  for (const [id, row] of rowById.entries()) {
    const word = String(row.word);
    const reading = String(row.reading);
    const saved = latestLookupByItem.get(id) ?? null;
    const source: NotebookSource = saved
      ? saved.sourceClipId
        ? 'clip'
        : 'lookup'
      : 'srs';
    const addedAt = saved ? saved.savedAt : String(row.srs_added_at ?? '');
    const clipLink =
      source === 'clip' && saved
        ? resolveClipLink(clips, saved.sourceClipId, saved.sentenceJa)
        : null;
    const furiganaRow = furiganaStmt.get(word, reading);

    allEntries.push({
      id,
      word,
      reading,
      romaji: String(row.romaji),
      level: String(row.level),
      segments: wordSegments(
        furiganaRow ? String(furiganaRow.segments) : null,
        word,
        reading,
      ),
      english: JSON.parse(String(row.meanings_en)),
      meaning: selectedTranslation(db, id, 'meaning'),
      sourceName: String(row.source_name),
      source,
      sentenceJa: saved ? saved.sentenceJa : null,
      sentenceVi: saved ? saved.sentenceVi : null,
      sourceClipId: saved ? saved.sourceClipId : null,
      clipHref: clipLink ? clipLink.href : null,
      clipTitle: clipLink ? clipLink.clipTitle : null,
      segmentNumber: clipLink ? clipLink.segmentNumber : null,
      addedAt,
    });
  }

  allEntries.sort((a, b) => {
    const cmp = compareDescIso(a.addedAt, b.addedAt);
    return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
  });

  const counts: NotebookCounts = {
    all: allEntries.length,
    clip: allEntries.filter((e) => e.source === 'clip').length,
    lookup: allEntries.filter((e) => e.source === 'lookup').length,
    srs: allEntries.filter((e) => e.source === 'srs').length,
  };

  const items =
    sourceFilter === 'all'
      ? allEntries
      : allEntries.filter((entry) => entry.source === sourceFilter);

  return {
    items,
    total: allEntries.length,
    filteredTotal: items.length,
    source: sourceFilter,
    counts,
  };
}

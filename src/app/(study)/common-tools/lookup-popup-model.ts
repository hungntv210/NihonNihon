import type { ContentKind, Translation } from '../../../core/content.ts';

export type SentenceToken = {
  surface: string;
  base?: string;
  clickable: boolean;
};

export type LookupSaveSource = 'clip' | 'lookup' | 'jlpt';

export type SavedLookupSentence = {
  cardId: string;
  itemId: string;
  sentenceJa: string;
  sentenceVi: string | null;
  sourceClipId: string | null;
  savedAt: string;
  sourceKind?: LookupSaveSource;
  jlptDate?: string | null;
  jlptQuestionId?: string | null;
  jlptQuestionNumber?: number | null;
  notebookOnly?: boolean;
  sentenceMissing?: boolean;
  word?: string | null;
  reading?: string | null;
  romaji?: string | null;
  meaningVi?: string | null;
  meaningsEn?: string[] | null;
};

export type LookupMatchSource =
  | 'exact'
  | 'lemma'
  | 'form'
  | 'reading'
  | 'search'
  | 'jmdict'
  | 'kanji_fallback';

export type LookupItem = {
  id: string;
  kind: ContentKind;
  title: string;
  reading: string;
  level: string;
  english: string[];
  sourceName: string;
  meaning: Translation | null;
  hanViet: Translation | null;
  kanjiHanViet: { character: string; hanViet: Translation }[];
  href: string;
  cardType: 'recognition' | 'reading';
  inSrs: boolean;
  savedSentence: SavedLookupSentence | null;
  matchedBy: LookupMatchSource;
  outsideJlpt?: boolean;
};

export type LookupResponse = {
  query: string;
  base: string | null;
  found: boolean;
  item: LookupItem | null;
  alternatives: LookupItem[];
};

export type LookupTarget = {
  surface: string;
  base?: string;
  sentenceJa?: string | null;
  sentenceVi?: string | null;
  sourceClipId?: string | null;
  sourceKind?: LookupSaveSource;
  jlptDate?: string | null;
  jlptQuestionId?: string | null;
  jlptQuestionNumber?: number | null;
};

const JAPANESE_WORD_RE =
  /[\u3041-\u3096\u30A1-\u30FA\u30FC\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u3005\u3006\u30F6]/u;
const FALLBACK_RUN_RE =
  /([\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u3005\u3006\u30F6]+|[\u30A1-\u30FA\u30FC]+|[\u3041-\u3096]+|[^\u3041-\u3096\u30A1-\u30FA\u30FC\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u3005\u3006\u30F6]+)/gu;

export function isJapaneseClickableText(text: string): boolean {
  return JAPANESE_WORD_RE.test(text);
}

export function fallbackSegmentTokens(text: string): SentenceToken[] {
  if (!text) return [];
  const matches = text.match(FALLBACK_RUN_RE);
  if (!matches) return [{ surface: text, clickable: isJapaneseClickableText(text) }];
  return matches.map((surface) => ({
    surface,
    clickable: isJapaneseClickableText(surface),
  }));
}

export function resolveFocusTrapTarget(
  count: number,
  currentIndex: number,
  shiftKey: boolean,
): number | null {
  if (count <= 0) return null;
  if (shiftKey) {
    return currentIndex <= 0 ? count - 1 : null;
  }
  return currentIndex === -1 || currentIndex >= count - 1 ? 0 : null;
}

export function formatLookupKind(kind: ContentKind): string {
  if (kind === 'kanji') return 'Kanji';
  if (kind === 'grammar') return 'Ngữ pháp';
  return 'Từ vựng';
}

export function formatLookupSourceLabel(
  translation: Translation | null,
  fallback = 'OpenJLPT',
): string {
  if (!translation) return fallback === 'JMdict' ? 'EN · JMdict' : `Bản Anh · ${fallback}`;
  const labels: Record<string, string> = {
    machine: 'Dịch máy',
    dictionary: 'Từ điển',
    han_viet: 'Hán Việt',
    tatoeba: 'Bản dịch cộng đồng',
  };
  const kind = translation.autoSelected ? 'Tự chọn' : (labels[translation.method] ?? 'Bản dịch');
  return `${kind} · ${translation.sourceName}${translation.model ? ` · ${translation.model}` : ''}`;
}

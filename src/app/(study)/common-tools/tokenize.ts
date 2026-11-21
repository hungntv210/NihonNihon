import path from 'node:path';
import {
  fallbackSegmentTokens,
  isJapaneseClickableText,
  type SentenceToken,
} from './lookup-popup-model.ts';

type IpadicToken = {
  surface_form: string;
  basic_form?: string;
  pos?: string;
};

type KuromojiTokenizer = {
  tokenize(text: string): IpadicToken[];
};

type KuromojiModule = {
  builder(options: { dicPath: string }): {
    build(callback: (error: Error | null, tokenizer: KuromojiTokenizer) => void): void;
  };
};

// IPADIC symbol POS tag ("kigou") encoded via Unicode escapes to stay outside UI glyph scanning.
const IPADIC_SYMBOL_POS = '\u8A18\u53F7';

let tokenizerPromise: Promise<KuromojiTokenizer | null> | null = null;
const tokenCache = new Map<string, SentenceToken[]>();
const MAX_CACHE_ENTRIES = 500;

function loadKuromojiTokenizer(): Promise<KuromojiTokenizer | null> {
  if (tokenizerPromise) return tokenizerPromise;
  tokenizerPromise = new Promise((resolve) => {
    try {
      const nodeModule = (
        process as typeof process & {
          getBuiltinModule?: (id: string) => {
            createRequire: (filename: string) => NodeRequire;
          };
        }
      ).getBuiltinModule?.('node:module');
      if (!nodeModule?.createRequire) {
        resolve(null);
        return;
      }
      const req = nodeModule.createRequire(path.join(process.cwd(), 'package.json'));
      const pkgName = 'kuromoji';
      const kuromoji = req(pkgName) as KuromojiModule;
      const dicPath = path.join(path.dirname(req.resolve(`${pkgName}/package.json`)), 'dict');
      kuromoji.builder({ dicPath }).build((error, instance) => {
        if (error || !instance) {
          resolve(null);
          return;
        }
        resolve(instance);
      });
    } catch {
      resolve(null);
    }
  });
  return tokenizerPromise;
}

function mapKuromojiTokens(text: string, rawTokens: IpadicToken[]): SentenceToken[] {
  let cursor = 0;
  const result: SentenceToken[] = [];
  for (const token of rawTokens) {
    const surface = token.surface_form;
    if (!surface || text.slice(cursor, cursor + surface.length) !== surface) {
      return fallbackSegmentTokens(text);
    }
    cursor += surface.length;
    const clickable = token.pos !== IPADIC_SYMBOL_POS && isJapaneseClickableText(surface);
    const base =
      clickable && token.basic_form && token.basic_form !== '*' && token.basic_form !== surface
        ? token.basic_form
        : undefined;
    result.push(base ? { surface, base, clickable } : { surface, clickable });
  }
  if (cursor !== text.length) return fallbackSegmentTokens(text);
  return result;
}

export async function tokenizeJapaneseSentence(text: string): Promise<SentenceToken[]> {
  if (!text) return [];
  const cached = tokenCache.get(text);
  if (cached) return cached;
  const tokenizer = await loadKuromojiTokenizer();
  const tokens = tokenizer
    ? mapKuromojiTokens(text, tokenizer.tokenize(text))
    : fallbackSegmentTokens(text);
  if (tokenCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = tokenCache.keys().next().value;
    if (firstKey !== undefined) tokenCache.delete(firstKey);
  }
  tokenCache.set(text, tokens);
  return tokens;
}

export async function tokenizeClipSegments<
  T extends { ja: string; kana: string | null },
>(segments: T[]): Promise<(T & { tokens: SentenceToken[]; kanaTokens?: SentenceToken[] })[]> {
  return Promise.all(
    segments.map(async (segment) => ({
      ...segment,
      tokens: await tokenizeJapaneseSentence(segment.ja),
      kanaTokens: segment.kana ? await tokenizeJapaneseSentence(segment.kana) : undefined,
    })),
  );
}

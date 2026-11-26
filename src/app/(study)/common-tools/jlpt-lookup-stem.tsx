'use client';

import { lazy, Suspense, useEffect, useState } from 'react';
import { JaText } from '../../../components/text.tsx';
import {
  fallbackSegmentTokens,
  isJapaneseClickableText,
  type LookupTarget,
  type SentenceToken,
} from './lookup-popup-model.ts';

const LazyLookupPopup = lazy(() =>
  import('./lookup-popup.tsx').then((mod) => ({ default: mod.LookupPopup })),
);

const STEM_WORD_STYLE = {
  display: 'inline',
  width: 'auto',
  minHeight: 'auto',
  padding: '0 1px',
  margin: 0,
  border: 0,
  borderBottom: '1px dashed var(--color-border)',
  borderRadius: '2px',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  lineHeight: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
} as const;

export function JlptLookupStem({
  questionId,
  stem,
  onSelect,
}: {
  questionId: string;
  stem: string;
  onSelect: (token: { surface: string; base?: string }, el: HTMLElement) => void;
}) {
  const [tokens, setTokens] = useState<SentenceToken[] | null>(null);

  useEffect(() => {
    setTokens(null);
    if (!stem) return;
    const controller = new AbortController();
    void fetch(`/api/common-tools/lookup?tokenize=${encodeURIComponent(stem)}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok || controller.signal.aborted) return;
        const data = (await response.json()) as { tokens?: SentenceToken[] };
        if (!controller.signal.aborted && Array.isArray(data.tokens) && data.tokens.length > 0) {
          setTokens(data.tokens);
        }
      })
      .catch(() => {
        // Fallback segmentation stays active on network/abort errors
      });
    return () => {
      controller.abort();
    };
  }, [stem]);

  const list = tokens ?? fallbackSegmentTokens(stem);
  return (
    <JaText>
      {list.map((token, idx) =>
        token.clickable ? (
          <button
            key={`${questionId}-${idx}`}
            type="button"
            data-jlpt-word={token.surface}
            data-jlpt-base={token.base}
            style={STEM_WORD_STYLE}
            onClick={(event) => onSelect(token, event.currentTarget)}
          >
            {token.surface}
          </button>
        ) : (
          <span key={`${questionId}-${idx}`}>{token.surface}</span>
        ),
      )}
    </JaText>
  );
}

export function JlptAnswerLookup({
  word,
  onSelect,
}: {
  word: string;
  onSelect: (token: { surface: string; base?: string }, el: HTMLElement) => void;
}) {
  if (!isJapaneseClickableText(word)) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', margin: '0 0 14px' }}>
      <button
        type="button"
        className="button"
        data-jlpt-answer-word={word}
        style={{ width: 'auto' }}
        onClick={(event) => onSelect({ surface: word }, event.currentTarget)}
      >
        Tra &amp; lưu từ «<JaText>{word}</JaText>»
      </button>
    </div>
  );
}

export function JlptLookupDialog({
  target,
  triggerEl,
  onClose,
}: {
  target: LookupTarget | null;
  triggerEl: HTMLElement | null;
  onClose: () => void;
}) {
  if (!target) return null;
  return (
    <Suspense fallback={null}>
      <LazyLookupPopup target={target} triggerEl={triggerEl} onClose={onClose} />
    </Suspense>
  );
}

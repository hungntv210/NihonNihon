'use client';

import { useCallback, useEffect, useState } from 'react';
import { JaText } from '../../../components/text.tsx';
import { LookupPopup } from './lookup-popup.tsx';
import {
  fallbackSegmentTokens,
  isJapaneseClickableText,
  type LookupTarget,
  type SentenceToken,
} from './lookup-popup-model.ts';

const WORD_STYLE = {
  padding: 0,
  border: 0,
  borderBottom: '1px dashed var(--color-border)',
  background: 'none',
  color: 'inherit',
  font: 'inherit',
  cursor: 'pointer',
} as const;

export function useJlptLookup({
  date,
  questions,
  question,
  index,
  answer,
  onJump,
}: {
  date: string;
  questions: readonly { id: string }[];
  question: { id: string; stem: string; choices: readonly string[] } | undefined;
  index: number;
  answer: { correctIndex: number } | null | undefined;
  onJump: (index: number) => void;
}) {
  const [opened, setOpened] = useState<{ target: LookupTarget; el: HTMLElement } | null>(null);
  const [tokens, setTokens] = useState<SentenceToken[] | null>(null);
  const clear = useCallback(() => setOpened(null), []);

  useEffect(() => {
    const q = new URLSearchParams(location.search).get('q');
    const i = q ? questions.findIndex((item) => item.id === q) : -1;
    if (i >= 0) {
      onJump(i);
      setOpened(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions]);

  const stemText = answer && question ? question.stem : '';
  useEffect(() => {
    setTokens(null);
    if (!stemText) return;
    let alive = true;
    void fetch(`/api/common-tools/lookup?tokenize=${encodeURIComponent(stemText)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { tokens?: SentenceToken[] } | null) => {
        if (alive && data?.tokens?.length) setTokens(data.tokens);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [stemText]);

  function open(token: { surface: string; base?: string }, el: HTMLElement) {
    if (!question || !answer) return;
    setOpened({
      el,
      target: {
        surface: token.surface,
        base: token.base,
        sentenceJa: question.stem,
        sourceKind: 'jlpt',
        jlptDate: date,
        jlptQuestionId: question.id,
        jlptQuestionNumber: index + 1,
      },
    });
  }

  const ansWord = question && answer ? (question.choices[answer.correctIndex] ?? '') : '';

  return {
    clear,
    stem: !question ? null : answer ? (
      <JaText>
        {(tokens ?? fallbackSegmentTokens(question.stem)).map((tok, i) =>
          tok.clickable ? (
            <button
              key={i}
              type="button"
              data-jlpt-word={tok.surface}
              data-jlpt-base={tok.base}
              style={WORD_STYLE}
              onClick={(e) => open(tok, e.currentTarget)}
            >
              {tok.surface}
            </button>
          ) : (
            <span key={i}>{tok.surface}</span>
          ),
        )}
      </JaText>
    ) : (
      <JaText>{question.stem}</JaText>
    ),
    answerLookup:
      ansWord && isJapaneseClickableText(ansWord) ? (
        <button
          type="button"
          className="button"
          data-jlpt-answer-word={ansWord}
          style={{ width: 'auto', display: 'flex', margin: '0 0 14px' }}
          onClick={(e) => open({ surface: ansWord }, e.currentTarget)}
        >
          Tra &amp; lưu từ «<JaText>{ansWord}</JaText>»
        </button>
      ) : null,
    dialog: answer && opened ? <LookupPopup target={opened.target} triggerEl={opened.el} onClose={clear} /> : null,
  };
}

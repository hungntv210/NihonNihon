'use client';
import { CountUp, MotionProgress } from '../../../components/motion/data-motion.tsx';
import { animateUI } from '../../../components/motion/animate.ts';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { JaText, ViText } from '../../../components/text.tsx';
import {
  JlptAnswerLookup,
  JlptLookupDialog,
  JlptLookupStem,
} from '../common-tools/jlpt-lookup-stem.tsx';
import type { LookupTarget } from '../common-tools/lookup-popup-model.ts';
import { labels } from './labels.ts';
import type { QuestionType } from './model.ts';
import type { dailyView } from './repository.ts';
import styles from './jlpt.module.css';

type View = ReturnType<typeof dailyView>;

export function Practice({
  initial,
  answeredToday = initial.done,
}: {
  initial: View;
  answeredToday?: number;
}) {
  const [view, setView] = useState(initial);
  const [index, setIndex] = useState(Math.min(initial.done, Math.max(initial.total - 1, 0)));
  const [choice, setChoice] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const [finished, setFinished] = useState(initial.done === initial.total);
  const [lookupTarget, setLookupTarget] = useState<LookupTarget | null>(null);
  const lookupTriggerRef = useRef<HTMLElement | null>(null);
  const card = useRef<HTMLElement>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q');
    const i = q ? initial.questions.findIndex((item) => item.id === q) : -1;
    if (i >= 0) {
      setIndex(i);
      setFinished(false);
      setChoice(null);
    }
  }, [initial.questions]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('nihon-jlpt-answered', { detail: answeredToday + view.done - initial.done }),
    );
  }, [answeredToday, initial.done, view.done]);

  const question = view.questions[index];
  const answer = question?.answer;
  const complete = view.done === view.total && finished;

  useLayoutEffect(() => {
    if (!answer) return;
    animateUI(
      card.current,
      answer.correct
        ? [{ opacity: 0.8 }, { opacity: 1 }]
        : [
            { transform: 'translateX(0)' },
            { transform: 'translateX(-3px)' },
            { transform: 'translateX(3px)' },
            { transform: 'translateX(0)' },
          ],
      180,
    );
  }, [answer]);

  const closeLookup = useCallback(() => setLookupTarget(null), []);
  const openLookup = useCallback(
    (token: { surface: string; base?: string }, el: HTMLElement) => {
      if (!question) return;
      lookupTriggerRef.current = el;
      setLookupTarget({
        surface: token.surface,
        base: token.base,
        sentenceJa: question.stem,
        sentenceVi: null,
        sourceClipId: null,
        sourceKind: 'jlpt',
        jlptDate: view.date,
        jlptQuestionId: question.id,
        jlptQuestionNumber: index + 1,
      });
    },
    [index, question, view.date],
  );

  async function submit() {
    if (choice === null || busy || answer || !question) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/jlpt-daily/answer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ questionId: question.id, choice }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      setView((current) => ({
        ...current,
        done: current.done + 1,
        score: current.score + (result.correct ? 1 : 0),
        questions: current.questions.map((q) => (q.id === question.id ? { ...q, answer: result } : q)),
        weaknesses: {
          ...current.weaknesses,
          [question.type]: {
            total: (current.weaknesses[question.type]?.total ?? 0) + 1,
            wrong: (current.weaknesses[question.type]?.wrong ?? 0) + (result.correct ? 0 : 1),
          },
        },
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa thể lưu câu trả lời.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={styles.progressLabel}>
        <span>
          {view.done}/{view.total} câu đã làm
        </span>
        <span>{view.score} câu đúng</span>
      </div>
      <MotionProgress max={view.total} value={view.done} label="Tiến độ bài tối" />
      {complete ? (
        <div className={styles.summary}>
          <p className="eyebrow">HOÀN THÀNH HÔM NAY</p>
          <h2>
            <CountUp value={view.score} /> / {view.total} câu đúng
          </h2>
          <p>Mỗi chỗ chưa chắc là một gợi ý cho lần ôn tới.</p>
          <ul>
            {Object.entries(view.weaknesses).map(([type, s]) => (
              <li key={type}>
                <span>{labels[type as QuestionType]}</span>
                <strong>
                  {s.total - s.wrong}/{s.total}
                </strong>
              </li>
            ))}
          </ul>
          <p>Câu sai đã được thêm vào SRS; thẻ có sẵn giữ lịch ôn hiện tại.</p>
          <Link className="button primary" href="/srs">
            Xem hàng ôn
          </Link>
        </div>
      ) : (
        <article
          ref={card}
          data-jlpt-result={answer ? (answer.correct ? 'correct' : 'wrong') : undefined}
          className={styles.card}
        >
          <p className={styles.kicker}>
            Câu {index + 1} <span>{labels[question.type]}</span>
          </p>
          <h2 ref={heading} tabIndex={-1}>
            <JlptLookupStem questionId={question.id} stem={question.stem} onSelect={openLookup} />
          </h2>
          <fieldset disabled={!!answer || busy} className={styles.options}>
            <legend className={styles.srOnly}>Chọn một đáp án</legend>
            {question.choices.map((text, n) => (
              <label
                key={n}
                className={`${styles.option} ${choice === n ? styles.selected : ''} ${
                  answer && n === answer.correctIndex ? styles.correct : ''
                }`}
              >
                <input
                  type="radio"
                  name={question.id}
                  value={n}
                  checked={choice === n}
                  onChange={() => setChoice(n)}
                />
                <span className={styles.letter}>{'ABCD'[n]}</span>
                <JaText>{text}</JaText>
              </label>
            ))}
          </fieldset>
          {answer ? (
            <div className={styles.feedback} role="status">
              {answer.correct && (
                <span className="hanko" aria-label="Đã đúng">
                  済
                </span>
              )}
              <strong>{answer.correct ? 'Đúng rồi.' : 'Mình xem lại một chút.'}</strong>
              <p>
                <ViText>{answer.explanation}</ViText>
              </p>
              {!answer.correct && <p className={styles.muted}>Đã thêm câu sai vào SRS.</p>}
              <JlptAnswerLookup
                word={question.choices[answer.correctIndex] ?? ''}
                onSelect={openLookup}
              />
              <button
                className="button primary"
                onClick={() => {
                  if (index === view.total - 1) setFinished(true);
                  else setIndex(index + 1);
                  setChoice(null);
                  setTimeout(() => heading.current?.focus(), 0);
                }}
              >
                {index === view.total - 1 ? 'Xem kết quả' : 'Câu tiếp theo'}
              </button>
            </div>
          ) : (
            <button
              className="button primary"
              disabled={choice === null || busy}
              onClick={submit}
            >
              {busy ? 'Đang lưu…' : 'Kiểm tra đáp án'}
            </button>
          )}
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
        </article>
      )}
      <p className={styles.source}>
        {view.approval
          ? 'draft_roadmap · nháp lộ trình đã được tester duyệt'
          : 'Câu luyện do AI tạo từ OpenJLPT'}{' '}
        · {view.model}. Đây là bài luyện, không phải đề thi chính thức.
      </p>
      <JlptLookupDialog
        target={lookupTarget}
        triggerEl={lookupTriggerRef.current}
        onClose={closeLookup}
      />
    </>
  );
}

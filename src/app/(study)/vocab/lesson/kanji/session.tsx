'use client';
import { useEffect, useState, type ReactNode } from 'react';
import {
  EMPTY_EXAMPLE_PROGRESS,
  finishExamplePlayback,
  getExampleAudioState,
  startExamplePlayback,
  stopExamplePlayback,
  type ExampleProgress,
} from '../state.ts';
import { findJapaneseVoice, speakJapanese, stopJapaneseSpeech } from '../tts.ts';

export type KanjiLessonWordSlot = {
  id: string;
  reading: string;
  content: ReactNode;
};

export type KanjiLessonCard = {
  id: string;
  body: ReactNode;
  words: KanjiLessonWordSlot[];
  review: ReactNode;
};

export function KanjiLesson({
  items,
  done,
  footer,
}: {
  items: KanjiLessonCard[];
  done?: ReactNode;
  footer?: ReactNode;
}) {
  // Saving refreshes server props; keep the current lesson order until the learner advances.
  const [cards] = useState(items);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState<ExampleProgress>(EMPTY_EXAMPLE_PROGRESS);
  const [hasVoice, setHasVoice] = useState(false);
  const item = cards[index];

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    const update = () => setHasVoice(Boolean(findJapaneseVoice()));
    update();
    synth.addEventListener('voiceschanged', update);
    return () => {
      synth.removeEventListener('voiceschanged', update);
      stopJapaneseSpeech();
    };
  }, []);

  function playWord(id: string, text: string) {
    if (progress.playingId === id) {
      stopJapaneseSpeech();
      setProgress(stopExamplePlayback);
      return;
    }
    const voice = findJapaneseVoice();
    if (!voice) return;
    setProgress((p) => startExamplePlayback(p, id));
    speakJapanese(text, voice, {
      onEnd: () => setProgress((p) => finishExamplePlayback(p, id)),
      onError: () => setProgress(stopExamplePlayback),
    });
  }

  return item ? (
    <>
      <div data-lesson-progress="">
        <span>
          Kanji {index + 1}/{cards.length}
        </span>
        <progress value={index} max={cards.length} aria-label="Tiến độ bài học kanji" />
      </div>
      <article data-lesson-card="" key={item.id}>
        {item.body}
        <section data-lesson-examples="" aria-label="Từ đi kèm">
          <h3 data-lesson-examples-title="">Từ đi kèm</h3>
          {item.words.length ? (
            <ul data-lesson-example-list="">
              {item.words.map((word) => {
                const audio = getExampleAudioState(progress, word.id);
                return (
                  <li key={word.id} data-lesson-example="" data-step={audio.status}>
                    {word.content}
                    <div data-lesson-example-actions="">
                      <button
                        type="button"
                        className="button button-small"
                        disabled={!hasVoice}
                        aria-pressed={audio.status === 'playing'}
                        onClick={() => playWord(word.id, word.reading)}
                      >
                        {audio.status === 'playing'
                          ? 'Dừng đọc'
                          : audio.primaryLabel === 'Nghe câu'
                            ? 'Nghe từ'
                            : audio.primaryLabel}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p data-lesson-muted="" data-lesson-empty-examples="">
              Chưa có từ đi kèm trong thư viện hiện tại.
            </p>
          )}
        </section>
        {item.review}
      </article>
      <button
        type="button"
        className="button button-primary"
        onClick={() => {
          stopJapaneseSpeech();
          setIndex(index + 1);
          setProgress(EMPTY_EXAMPLE_PROGRESS);
        }}
      >
        {index + 1 < cards.length ? 'Kanji tiếp theo →' : 'Kết thúc bài học'}
      </button>
      {footer}
    </>
  ) : (
    <>{done}</>
  );
}

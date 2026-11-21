'use client';
import { useEffect, useState, type ReactNode } from 'react';
import {
  EMPTY_EXAMPLE_PROGRESS,
  finishExamplePlayback,
  getExampleAudioState,
  markExampleRead,
  startExamplePlayback,
  stopExamplePlayback,
  type ExampleProgress,
} from './state.ts';
import { findJapaneseVoice, speakJapanese, stopJapaneseSpeech } from './tts.ts';

export type LessonCardExample = {
  id: string;
  japanese: string;
  content?: ReactNode;
};

export type LessonCardItem = {
  id: string;
  reading?: string;
  head: ReactNode;
  meaning: ReactNode;
  examples: LessonCardExample[];
};

export function Lesson({
  items,
  done,
  footer,
}: {
  items: LessonCardItem[];
  done?: ReactNode;
  footer?: ReactNode;
}) {
  // Saving refreshes server props; keep the current lesson order until the learner advances.
  const [words] = useState(items);
  const [index, setIndex] = useState(0),
    [revealed, setRevealed] = useState(false),
    [progress, setProgress] = useState<ExampleProgress>(EMPTY_EXAMPLE_PROGRESS),
    [playingWord, setPlayingWord] = useState(false),
    [hasVoice, setHasVoice] = useState(false),
    [audioError, setAudioError] = useState('');
  const item = words[index];
  const examples = item?.examples ?? [];

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis,
      update = () => setHasVoice(Boolean(findJapaneseVoice()));
    update();
    synth.addEventListener('voiceschanged', update);
    return () => {
      synth.removeEventListener('voiceschanged', update);
      stopJapaneseSpeech();
    };
  }, []);

  function playWord(text: string) {
    if (playingWord) {
      stopJapaneseSpeech();
      setPlayingWord(false);
      return;
    }
    const voice = findJapaneseVoice();
    if (!voice) {
      setAudioError('Trình duyệt chưa có giọng Nhật.');
      return;
    }
    setAudioError('');
    setProgress(stopExamplePlayback);
    setPlayingWord(true);
    speakJapanese(text, voice, {
      onEnd: () => setPlayingWord(false),
      onError: () => {
        setPlayingWord(false);
        setAudioError('Chưa phát được giọng đọc. Bạn thử lại nhé.');
      },
    });
  }

  function playExample(exampleId: string, japanese: string, replay: boolean) {
    if (!replay && progress.playingId === exampleId) {
      stopJapaneseSpeech();
      setProgress(stopExamplePlayback);
      return;
    }
    const voice = findJapaneseVoice();
    if (!voice) {
      setProgress(stopExamplePlayback);
      setAudioError('Trình duyệt chưa có giọng Nhật.');
      return;
    }
    setAudioError('');
    setPlayingWord(false);
    setProgress((p) => startExamplePlayback(p, exampleId));
    speakJapanese(japanese, voice, {
      onEnd: () => setProgress((p) => finishExamplePlayback(p, exampleId)),
      onError: () => {
        setProgress(stopExamplePlayback);
        setAudioError('Chưa phát được giọng đọc. Bạn thử lại nhé.');
      },
    });
  }

  function handleReadDone(exampleId: string) {
    const result = markExampleRead(
      progress,
      exampleId,
      examples.map((e) => e.id),
    );
    setProgress(result.progress);
    if (result.allRead && !revealed) setRevealed(true);
  }

  return item ? (
    <>
      <div data-lesson-progress="">
        <span>
          Từ {index + 1}/{words.length}
        </span>
        <progress value={index} max={words.length} aria-label="Tiến độ xem bài" />
      </div>
      <article data-lesson-card="" key={item.id}>
        {item.head}
        {item.reading && (
          <div data-lesson-word-audio="">
            <button
              type="button"
              className="button button-small"
              disabled={!hasVoice}
              aria-pressed={playingWord}
              onClick={() => playWord(item.reading!)}
            >
              {playingWord ? 'Dừng đọc' : 'Nghe phát âm'}
            </button>
            <small role="status">
              {audioError ||
                (hasVoice
                  ? 'Giọng đọc của trình duyệt · chỉ phát khi bạn chọn.'
                  : 'Trình duyệt chưa có giọng Nhật.')}
            </small>
          </div>
        )}
        <section data-lesson-examples="" aria-label="Câu ví dụ">
          <h3 data-lesson-examples-title="">Câu ví dụ</h3>
          {examples.length ? (
            <ul data-lesson-example-list="">
              {examples.map((example) => {
                const audio = getExampleAudioState(progress, example.id);
                return (
                  <li key={example.id} data-lesson-example="" data-step={audio.status}>
                    {example.content ?? <p lang="ja">{example.japanese}</p>}
                    <div data-lesson-example-actions="">
                      <button
                        type="button"
                        className="button button-small"
                        disabled={!hasVoice}
                        aria-pressed={audio.status === 'playing'}
                        onClick={() => playExample(example.id, example.japanese, false)}
                      >
                        {audio.primaryLabel}
                      </button>
                      {audio.showReplayButton && (
                        <button
                          type="button"
                          className="button button-small"
                          disabled={!hasVoice}
                          onClick={() => playExample(example.id, example.japanese, true)}
                        >
                          Phát lại
                        </button>
                      )}
                      {audio.isReadDone && <span data-lesson-read-done="">Đã đọc ✓</span>}
                    </div>
                    {audio.showReadAloudPrompt && (
                      <div data-lesson-read-aloud="" role="status">
                        <p>Hãy đọc to câu ví dụ này theo giọng vừa nghe.</p>
                        <button
                          type="button"
                          className="button button-small button-primary"
                          onClick={() => handleReadDone(example.id)}
                        >
                          Đã đọc
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p data-lesson-muted="" data-lesson-empty-examples="">
              Chưa có câu ví dụ
            </p>
          )}
        </section>
        {!revealed ? (
          <button className="button button-primary" onClick={() => setRevealed(true)}>
            Mở nghĩa
          </button>
        ) : (
          item.meaning
        )}
      </article>
      {revealed && (
        <button
          className="button button-primary"
          onClick={() => {
            stopJapaneseSpeech();
            setPlayingWord(false);
            setIndex(index + 1);
            setRevealed(false);
            setProgress(EMPTY_EXAMPLE_PROGRESS);
            setAudioError('');
          }}
        >
          {index + 1 < words.length ? 'Từ tiếp theo →' : 'Kết thúc bài học'}
        </button>
      )}
      {footer}
    </>
  ) : (
    <>{done}</>
  );
}

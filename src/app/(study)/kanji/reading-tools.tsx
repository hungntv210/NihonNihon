'use client';
import { useEffect, useState } from 'react';
import { JaText } from '../../../components/text.tsx';
import styles from './kanji.module.css';

export function ReadingTools({
  onyomi,
  kunyomi,
  nanori,
}: {
  onyomi: string[];
  kunyomi: string[];
  nanori: string[];
}) {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null),
    [supported, setSupported] = useState(false);
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    setSupported(true);
    const select = () =>
      setVoice(
        window.speechSynthesis
          .getVoices()
          .find((v) => /^ja(?:-|$)/i.test(v.lang) && v.localService) ?? null,
      );
    select();
    window.speechSynthesis.addEventListener('voiceschanged', select);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', select);
      window.speechSynthesis.cancel();
    };
  }, []);
  function speak(text: string) {
    if (!voice) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/[.\-]/g, ''));
    utterance.voice = voice;
    utterance.lang = 'ja-JP';
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  }
  return (
    <>
      <div>
        {(
          [
            ['Âm On', onyomi],
            ['Âm Kun', kunyomi],
            ['Âm dùng trong tên', nanori],
          ] as const
        ).map(([label, readings]) => (
          <div className={styles.readingBlock} key={label}>
            <h3>{label}</h3>
            {readings.length ? (
              <div className={styles.readings}>
                {readings.map((reading, i) => (
                  <span className={styles.reading} key={reading + i}>
                    <JaText>{reading}</JaText>
                    <button
                      type="button"
                      className={styles.speak}
                      disabled={!voice}
                      onClick={() => speak(reading)}
                      aria-label={`Nghe ${reading}`}
                    >
                      ♪
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className={styles.missing}>Chưa có âm đọc trong dữ liệu.</p>
            )}
          </div>
        ))}
      </div>
      <p className={styles.voiceNote}>
        {voice
          ? 'Phát bằng giọng Nhật có sẵn trên thiết bị, chỉ khi bạn bấm nghe.'
          : supported
            ? 'Thiết bị chưa có giọng Nhật cục bộ. Bạn vẫn có thể đọc các âm ở trên.'
            : 'Trình duyệt này chưa hỗ trợ phát âm cục bộ.'}
      </p>
    </>
  );
}

'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { Vocabulary } from '../data.ts';
import { JaText, ViText } from '../../../../components/text.tsx';
import { SourceLabel } from '../../../../components/source-label.tsx';
import { AddToReview } from '../../../../components/add-to-review.tsx';
import { Speak } from '../speech.tsx';
import { ReportTranslation } from '../report.tsx';
import styles from '../vocab.module.css';
export function Lesson({ items }: { items: Vocabulary[] }) {
  const [words] = useState(items);
  const [index, setIndex] = useState(0),
    [revealed, setRevealed] = useState(false);
  const item = words[index];
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">MỘT BÀI HỌC NHỎ</p>
        <h1>Gặp những từ mới</h1>
        <p>Nghe, đọc to rồi mở nghĩa để đối chiếu. Bạn có thể dừng bất cứ lúc nào.</p>
      </div>
      {item ? (
        <>
          <div className={styles.lessonProgress}>
            <span>
              Từ {index + 1}/{words.length}
            </span>
            <progress value={index} max={words.length} aria-label="Tiến độ xem bài" />
          </div>
          <article className={styles.lessonCard} key={item.id}>
            <span className="level">{item.level}</span>
            <JaText as="h2" className={styles.detailWord}>
              {item.word}
            </JaText>
            <JaText as="p" className="reading">
              {item.reading}
            </JaText>
            <Speak text={item.reading} />
            {!revealed ? (
              <button className="button button-primary" onClick={() => setRevealed(true)}>
                Mở nghĩa
              </button>
            ) : (
              <div className={styles.lessonMeaning}>
                {item.meaning ? (
                  <ViText as="p" className={styles.translation}>
                    {item.meaning.text}
                  </ViText>
                ) : (
                  <p lang="en" className={styles.translation}>
                    {item.english.join('; ')}
                  </p>
                )}
                <SourceLabel translation={item.meaning} fallback={item.sourceName} />
                {item.meaningId && (
                  <ReportTranslation itemId={item.id} translationId={item.meaningId} />
                )}
                <AddToReview itemId={item.id} />
                <Link className="text-link" href={'/vocab/' + encodeURIComponent(item.id)}>
                  Mở cách dùng và ví dụ →
                </Link>
              </div>
            )}
          </article>
          {revealed && (
            <button
              className="button button-primary"
              onClick={() => {
                setIndex(index + 1);
                setRevealed(false);
              }}
            >
              {index + 1 < words.length ? 'Từ tiếp theo →' : 'Kết thúc bài học'}
            </button>
          )}
          <p className={styles.muted}>
            Mở nghĩa không tự đánh dấu đã nhớ. Chỉ các từ bạn chọn “Thêm vào ôn” mới được lưu vào
            hàng ôn.
          </p>
        </>
      ) : (
        <section className="empty-state">
          <h2>{words.length ? 'Đã đi hết bài học nhỏ.' : 'Các từ hiện có đã ở trong hàng ôn.'}</h2>
          <p>
            {words.length
              ? `Bạn vừa xem ${words.length} từ. Hãy gặp lại những từ đã lưu ở mục Ôn tập.`
              : 'Bạn có thể ôn lại từ đã lưu hoặc chọn từ trong sổ để xem cách dùng.'}
          </p>
          <div className={styles.topLinks}>
            <Link href="/srs" className="button button-primary">
              Mở hàng ôn
            </Link>
            <Link href="/vocab" className="button">
              Về sổ từ
            </Link>
          </div>
        </section>
      )}
    </>
  );
}

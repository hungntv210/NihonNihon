import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getVocabularyDetail } from '../server.ts';
import { parseFurigana } from '../data.ts';
import { Furigana } from '../furigana.tsx';
import { Speak } from '../speech.tsx';
import { ReportTranslation } from '../report.tsx';
import { JaText, ViText } from '../../../../components/text.tsx';
import { SourceLabel } from '../../../../components/source-label.tsx';
import { AddToReview } from '../../../../components/add-to-review.tsx';
import styles from '../vocab.module.css';

export default async function WordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params,
    item = await getVocabularyDetail(id);
  if (!item) notFound();
  return (
    <>
      <Link href="/vocab" className="text-link">
        ← Sổ từ vựng
      </Link>
      <header className={styles.detailHeading}>
        <div>
          <span className="level">{item.level}</span>
          <JaText as="h1" className={styles.detailWord}>
            <Furigana segments={item.segments} />
          </JaText>
          <JaText as="p" className="reading">
            {item.reading}
          </JaText>
          <p lang="ja-Latn" className={styles.romaji}>
            {item.romaji}
          </p>
        </div>
        <div className={styles.detailActions}>
          <Speak text={item.reading} />
          <AddToReview itemId={item.id} />
        </div>
      </header>
      {item.otherReadings.length > 0 && (
        <aside className={styles.notice}>
          <strong>Còn cách đọc khác cho cùng mặt chữ.</strong>
          <p>
            Nghĩa dưới đây thuộc cách đọc <JaText>{item.reading}</JaText>. Xem thêm:{' '}
            {item.otherReadings.map((r, i) => (
              <span key={r.id}>
                {i > 0 ? ' · ' : ''}
                <Link href={'/vocab/' + encodeURIComponent(r.id)}>
                  <JaText>{r.reading}</JaText>
                </Link>
              </span>
            ))}
          </p>
        </aside>
      )}
      <section className={styles.section} aria-labelledby="word-meaning">
        <h2 id="word-meaning">Nghĩa và cách dùng</h2>
        {item.meaning ? (
          <>
            <ViText as="p" className={styles.translation}>
              {item.meaning.text}
            </ViText>
            <SourceLabel translation={item.meaning} />
            {item.meaningId && (
              <ReportTranslation itemId={item.id} translationId={item.meaningId} />
            )}
            <details className={styles.english}>
              <summary>Xem nghĩa Anh gốc</summary>
              <p lang="en">{item.english.join('; ')}</p>
            </details>
          </>
        ) : (
          <>
            <p lang="en" className={styles.translation}>
              {item.english.join('; ')}
            </p>
            <SourceLabel translation={null} fallback={item.sourceName} />
            <p className={styles.muted}>Chưa có bản Việt được chọn cho mục này.</p>
          </>
        )}
        {item.pos.length > 0 && (
          <p className={styles.partOfSpeech}>
            Từ loại: <span lang="en">{item.pos.join(' · ')}</span>
          </p>
        )}
        {item.hanViet && (
          <div className={styles.hanViet}>
            <h3>Âm Hán Việt của từ</h3>
            <ViText as="strong">{item.hanViet.text}</ViText>
            <SourceLabel translation={item.hanViet} />
            {item.hanVietId && (
              <ReportTranslation itemId={item.id} translationId={item.hanVietId} />
            )}
          </div>
        )}
      </section>
      <section className={styles.section} aria-labelledby="word-examples">
        <h2 id="word-examples">Gặp từ trong câu</h2>
        {item.examples.length ? (
          item.examples.map((example, i) => (
            <article key={example.id} className={styles.example}>
              <span className={styles.exampleNumber}>{String(i + 1).padStart(2, '0')}</span>
              <div>
                <JaText as="p" className={styles.japaneseSentence}>
                  <Furigana segments={parseFurigana(example.furigana, example.japanese)} />
                </JaText>
                {example.translation ? (
                  <>
                    <ViText as="p">{example.translation.text}</ViText>
                    <SourceLabel translation={example.translation} />
                    {example.translationId && (
                      <ReportTranslation itemId={item.id} translationId={example.translationId} />
                    )}
                    <details className={styles.english}>
                      <summary>Xem câu Anh gốc</summary>
                      <p lang="en">{example.english}</p>
                    </details>
                  </>
                ) : (
                  <>
                    {example.english && <p lang="en">{example.english}</p>}
                    <SourceLabel translation={null} fallback={item.sourceName} />
                  </>
                )}
                <Speak text={example.japanese} label="Nghe câu này" />
              </div>
            </article>
          ))
        ) : (
          <p className={styles.muted}>
            Chưa có câu ví dụ trong dữ liệu hiện tại. Ví dụ sẽ hiện khi được nhập cùng nguồn.
          </p>
        )}
      </section>
      {item.kanji.length > 0 && (
        <section className={styles.section}>
          <h2>Kanji trong từ</h2>
          <div className={styles.kanjiLinks}>
            {item.kanji.map((k) => (
              <Link key={k.id} href={'/kanji/' + encodeURIComponent(k.character)}>
                <JaText>{k.character}</JaText>
                <span aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        </section>
      )}
      <section className={styles.practicePrompt}>
        <h2>Thử đọc một lần, rồi nhắc lại.</h2>
        <p>
          Nghe cách đọc nếu trình duyệt có giọng Nhật. Sau đó thử nói lại từ và đọc to câu ví dụ;
          thêm từ vào ôn để gặp lại vào ngày sau.
        </p>
      </section>
    </>
  );
}

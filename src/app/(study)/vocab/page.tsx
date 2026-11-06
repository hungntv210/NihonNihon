import Link from 'next/link';
import { getVocabulary } from './server.ts';
import { searchParams, vocabularyUrl } from './data.ts';
import { JaText, ViText } from '../../../components/text.tsx';
import { SourceLabel } from '../../../components/source-label.tsx';
import { AddToReview } from '../../../components/add-to-review.tsx';
import { ReportTranslation } from './report.tsx';
import styles from './vocab.module.css';

export default async function VocabPage({
  searchParams: params,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const result = await getVocabulary(searchParams(await params));
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">SỔ TỪ CỦA BẠN</p>
        <h1>Từ vựng</h1>
        <p>Tìm một từ, nghe cách đọc, rồi lưu lại để gặp nhau trong buổi ôn sau.</p>
      </div>
      <div className={styles.topLinks}>
        <Link href="/vocab/lesson" className="button button-primary">
          Học 5 từ mới →
        </Link>
        <Link href={result.search.saved ? '/vocab' : '/vocab?saved=1'} className="text-link">
          {result.search.saved ? 'Tất cả từ vựng' : 'Từ đã vào hàng ôn'}
        </Link>
      </div>
      <form method="get" action="/vocab" className={styles.filters} role="search">
        <label className={styles.searchLabel}>
          Tìm từ
          <input
            type="search"
            name="q"
            defaultValue={result.search.q}
            maxLength={100}
            placeholder="Kanji, kana, romaji hoặc nghĩa…"
          />
        </label>
        <label>
          Cấp JLPT
          <select name="level" defaultValue={result.search.level}>
            <option value="">Tất cả cấp</option>
            {['N5', 'N4', 'N3', 'N2', 'N1'].map((level) => (
              <option key={level}>{level}</option>
            ))}
          </select>
        </label>
        <label className={styles.savedFilter}>
          <input type="checkbox" name="saved" value="1" defaultChecked={result.search.saved} />
          Đã vào hàng ôn
        </label>
        <button className="button button-primary">Tìm từ</button>
      </form>
      <div className={styles.resultHeading}>
        <p>
          {result.total} từ{result.search.level ? ' · ' + result.search.level : ''}
          {result.search.saved ? ' · trong hàng ôn' : ''}
        </p>
        {(result.search.q || result.search.level || result.search.saved) && (
          <Link href="/vocab" className="text-link">
            Xoá bộ lọc
          </Link>
        )}
      </div>
      {result.items.length ? (
        <div className="content-grid">
          {result.items.map((item) => (
            <article key={item.id} className="content-card">
              <div className="card-heading">
                <JaText as="h2" className="word-title">
                  <Link href={'/vocab/' + encodeURIComponent(item.id)}>{item.word}</Link>
                </JaText>
                <span className="level">{item.level}</span>
              </div>
              <JaText as="p" className="reading">
                {item.reading}
              </JaText>
              <p className={styles.romaji} lang="ja-Latn">
                {item.romaji}
              </p>
              {item.meaning ? (
                <ViText as="p" className="meaning">
                  {item.meaning.text}
                </ViText>
              ) : (
                <p lang="en" className="meaning">
                  {item.english.join('; ')}
                </p>
              )}
              <SourceLabel translation={item.meaning} fallback={item.sourceName} />
              {item.meaningId && (
                <ReportTranslation itemId={item.id} translationId={item.meaningId} />
              )}
              <div className={styles.meta}>
                {item.otherReadings.length > 0 && (
                  <span className={styles.ambiguity}>Còn cách đọc khác</span>
                )}
                {item.queued && <span>Trong hàng ôn</span>}
              </div>
              <Link className="text-link" href={'/vocab/' + encodeURIComponent(item.id)}>
                Mở từ và ví dụ →
              </Link>
              <AddToReview itemId={item.id} />
            </article>
          ))}
        </div>
      ) : (
        <section className="empty-state">
          <h2>Chưa tìm thấy từ phù hợp.</h2>
          <p>Thử cách đọc khác hoặc mở rộng bộ lọc. Bạn cũng có thể tìm bằng nghĩa không dấu.</p>
          <Link className="button" href="/vocab">
            Xem tất cả từ
          </Link>
        </section>
      )}
      {result.pages > 1 && (
        <nav aria-label="Phân trang từ vựng" className={styles.pagination}>
          {result.page > 1 ? (
            <Link
              href={vocabularyUrl(result.search, result.page - 1)}
              className="button"
              rel="prev"
            >
              ← Trang trước
            </Link>
          ) : (
            <span />
          )}
          <span>
            Trang {result.page}/{result.pages}
          </span>
          {result.page < result.pages ? (
            <Link
              href={vocabularyUrl(result.search, result.page + 1)}
              className="button"
              rel="next"
            >
              Trang sau →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}

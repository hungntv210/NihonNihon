import Link from 'next/link';
import { withContentDatabase } from '../../../server/dal.ts';
import { JaText, ViText } from '../../../components/text.tsx';
import { SourceLabel } from '../../../components/source-label.tsx';
import { AddToReview } from '../../../components/add-to-review.tsx';
import { filterUrl, parseFilters, searchKanji } from './repository.ts';
import styles from './kanji.module.css';

export default async function KanjiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseFilters(await searchParams),
    result = await withContentDatabase((db) => searchKanji(db, filters));
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">TỪNG NÉT, TỪNG Ý</p>
        <h1>Kanji</h1>
        <p>Tìm mặt chữ, đối chiếu âm đọc và gặp lại trong những từ quen thuộc.</p>
      </div>
      <form
        key={filterUrl(filters)}
        className={styles.toolbar}
        action="/kanji"
        method="get"
        role="search"
        aria-label="Tra kanji"
      >
        <div className={styles.fields}>
          <label className={styles.field}>
            Tìm kanji
            <input
              name="q"
              type="search"
              defaultValue={filters.q}
              maxLength={80}
              placeholder="Chữ, Hán Việt, On/Kun, nghĩa…"
            />
          </label>
          <label className={styles.field}>
            Cấp JLPT
            <select name="level" defaultValue={filters.level}>
              <option value="">Tất cả cấp</option>
              {['N5', 'N4', 'N3', 'N2', 'N1'].map((level) => (
                <option key={level}>{level}</option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            Số nét
            <input
              name="strokes"
              type="number"
              min={1}
              max={64}
              defaultValue={filters.strokes ?? ''}
              placeholder="Tất cả"
            />
          </label>
          <button className="button button-primary">Tìm chữ</button>
        </div>
        {result.radicals.length > 0 && (
          <details className={styles.radicals} open={filters.radicals.length > 0}>
            <summary>
              Bộ thủ / thành phần{' '}
              {filters.radicals.length > 0 ? `· ${filters.radicals.length} đã chọn` : ''}
            </summary>
            <p className={styles.missing}>
              Chọn tối đa 8 thành phần. Kết quả phải có đủ các thành phần đã chọn.
            </p>
            <div className={styles.radicalOptions}>
              {result.radicals.map((radical) => (
                <label className={styles.radicalOption} key={radical}>
                  <input
                    type="checkbox"
                    name="radical"
                    value={radical}
                    defaultChecked={filters.radicals.includes(radical)}
                  />
                  <JaText>{radical}</JaText>
                </label>
              ))}
            </div>
          </details>
        )}
      </form>
      <div className={styles.resultsHeading}>
        <p>
          {result.total} chữ · Trang {result.page}/{result.pages}
        </p>
        <Link className="text-link" href="/kanji">
          Xoá bộ lọc
        </Link>
      </div>
      {result.items.length ? (
        <div className={styles.grid}>
          {result.items.map((item) => (
            <article className={styles.tile} key={item.id}>
              <div className={styles.tileTop}>
                <Link
                  href={'/kanji/' + encodeURIComponent(item.character)}
                  className={styles.characterLink}
                  aria-label={'Xem chữ ' + item.character}
                >
                  <JaText as="h2" className={styles.character}>
                    {item.character}
                  </JaText>
                </Link>
                <span className="level">{item.level}</span>
              </div>
              <div className={styles.hv}>
                {item.hanViet ? (
                  <ViText as="strong" className={styles.primaryReading}>
                    {item.hanViet.text}
                  </ViText>
                ) : (
                  <span className={styles.missing}>Chưa có âm chính</span>
                )}
                {item.alternatives.length > 0 && (
                  <ViText className={styles.alternativeReading}>
                    {(item.hanViet ? 'Âm khác: ' : 'Ứng viên: ') + item.alternatives.join(' · ')}
                  </ViText>
                )}
              </div>
              {item.hanViet && <SourceLabel translation={item.hanViet} />}
              <JaText as="p" className={styles.readingLine}>
                {[item.onyomi.join('・'), item.kunyomi.join('・')].filter(Boolean).join(' / ') ||
                  '—'}
              </JaText>
              {item.meaning ? (
                <>
                  <ViText as="p" className={styles.meaning}>
                    {item.meaning.text}
                  </ViText>
                  <p lang="en" className={styles.english}>
                    {item.english.join('; ')}
                  </p>
                </>
              ) : (
                <p lang="en" className={styles.meaning}>
                  {item.english.join('; ')}
                </p>
              )}
              <SourceLabel translation={item.meaning} />
              <div className={styles.meta}>
                <span>{item.strokes == null ? 'Chưa rõ số nét' : item.strokes + ' nét'}</span>
                {item.radical && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      Bộ <JaText>{item.radical}</JaText>
                    </span>
                  </>
                )}
              </div>
              <div className={styles.actions}>
                <AddToReview itemId={item.id} cardType="recognition" />
                <Link
                  className={styles.detailLink}
                  href={'/kanji/' + encodeURIComponent(item.character)}
                >
                  Xem âm đọc, nét viết và từ ghép →
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className={styles.empty}>
          <h2>Chưa tìm thấy chữ phù hợp.</h2>
          <p>Thử bỏ bớt bộ thủ, đổi số nét hoặc tìm bằng một âm đọc ngắn hơn.</p>
          <Link className="button" href="/kanji">
            Xem tất cả kanji
          </Link>
        </section>
      )}
      {result.pages > 1 && (
        <nav className={styles.pagination} aria-label="Trang kết quả Kanji">
          {result.page > 1 && (
            <Link
              className="button button-small"
              href={filterUrl(filters, { page: result.page - 1 })}
            >
              ← Trang trước
            </Link>
          )}
          <span>
            Trang {result.page}/{result.pages}
          </span>
          {result.page < result.pages && (
            <Link
              className="button button-small"
              href={filterUrl(filters, { page: result.page + 1 })}
            >
              Trang sau →
            </Link>
          )}
        </nav>
      )}
    </>
  );
}

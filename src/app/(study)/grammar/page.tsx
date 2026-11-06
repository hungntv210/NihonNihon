import Link from 'next/link';
import { withContentDatabase } from '../../../server/dal.ts';
import { SourceLabel } from '../../../components/source-label.tsx';
import { AddToReview } from '../../../components/add-to-review.tsx';
import { JaText, ViText } from '../../../components/text.tsx';
import { grammarHref, levels, listGrammar } from './repository.ts';
import styles from './grammar.module.css';
export default async function GrammarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams,
    input = {
      q: typeof params.q === 'string' ? params.q : '',
      level: typeof params.level === 'string' ? params.level : '',
      page: typeof params.page === 'string' ? params.page : '1',
    },
    result = await withContentDatabase((db) => listGrammar(db, input));
  function href(page: number) {
    const query = new URLSearchParams();
    if (result.q) query.set('q', result.q);
    if (result.level) query.set('level', result.level);
    query.set('page', String(page));
    return '/grammar?' + query;
  }
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">NỐI LỜI THÀNH CÂU</p>
        <h1>Ngữ pháp</h1>
        <p>Hiểu một mẫu câu, thử lại trong câu quen thuộc.</p>
      </div>
      <form
        key={result.q + '|' + result.level}
        className={styles.filters}
        action="/grammar"
        method="get"
      >
        <label>
          Tìm mẫu câu
          <input
            name="q"
            defaultValue={result.q}
            maxLength={160}
            placeholder="Mẫu Nhật, romaji, nghĩa Việt hoặc Anh"
          />
        </label>
        <label>
          Cấp JLPT
          <select name="level" defaultValue={result.level}>
            <option value="">Tất cả cấp</option>
            {levels.map((level) => (
              <option value={level} key={level}>
                {level}
              </option>
            ))}
          </select>
        </label>
        <button className="button button-primary">Tìm</button>
        {(result.q || result.level) && (
          <Link className="text-link" href="/grammar">
            Bỏ bộ lọc
          </Link>
        )}
      </form>
      <p className={styles.resultCount} role="status">
        {result.total} mẫu ngữ pháp{result.level ? ' · ' + result.level : ''}
        {result.q ? ' · “' + result.q + '”' : ''}
      </p>
      {result.items.length ? (
        <div className="content-grid">
          {result.items.map((item) => (
            <article key={item.id} className={`content-card ${styles.card}`}>
              <div className="card-heading">
                <Link href={grammarHref(item.id)}>
                  <JaText as="h2" className="word-title">
                    {item.pattern}
                  </JaText>
                </Link>
                <span className="level">{item.level}</span>
              </div>
              <p className={styles.romaji} lang="en">
                {item.romaji}
              </p>
              {item.meaningVi ? (
                <ViText as="p" className="meaning">
                  {item.meaningVi.text}
                </ViText>
              ) : (
                <p className="meaning" lang="en">
                  {item.meaningEn}
                </p>
              )}
              {item.meaningVi && (
                <p className="english" lang="en">
                  {item.meaningEn}
                </p>
              )}
              <SourceLabel translation={item.meaningVi} />
              <div className={styles.tags}>
                {item.tags.map((tag) => (
                  <span key={tag} lang="en">
                    {tag}
                  </span>
                ))}
              </div>
              <Link className="text-link" href={grammarHref(item.id)}>
                Mở mẫu câu và luyện tập →
              </Link>
              <AddToReview itemId={item.id} />
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>Chưa tìm thấy mẫu phù hợp.</h2>
          <p>Thử từ ngắn hơn hoặc chọn một cấp khác.</p>
          <Link href="/grammar" className="button">
            Xem tất cả mẫu
          </Link>
        </div>
      )}
      {result.pages > 1 && (
        <nav aria-label="Phân trang ngữ pháp" className={styles.pagination}>
          {result.page > 1 ? (
            <Link className="button button-small" href={href(result.page - 1)}>
              ← Trang trước
            </Link>
          ) : (
            <span />
          )}
          <span>
            Trang {result.page}/{result.pages}
          </span>
          {result.page < result.pages ? (
            <Link className="button button-small" href={href(result.page + 1)}>
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

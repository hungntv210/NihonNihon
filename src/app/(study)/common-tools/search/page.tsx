import Link from 'next/link';
import { RouteHeading } from '../../../../components/route-heading.tsx';
import { withContentDatabase } from '../../../../server/dal.ts';
import { SourceLabel } from '../../../../components/source-label.tsx';
import { AddToReview } from '../../../../components/add-to-review.tsx';
import { JaText, ViText } from '../../../../components/text.tsx';
import { searchAllKinds, type SearchResultItem } from '../repository.ts';
import { ReportViButton } from '../report-vi-button.tsx';
import styles from '../tools.module.css';

const CONTENT_GROUPS = [
  {
    key: 'vocab' as const,
    id: 'group-vocab',
    label: 'Từ',
    badge: 'Từ',
    empty: 'Không có từ phù hợp.',
  },
  {
    key: 'kanji' as const,
    id: 'group-kanji',
    label: 'Kanji',
    badge: 'Kanji',
    empty: 'Không có kanji phù hợp.',
  },
  {
    key: 'grammar' as const,
    id: 'group-grammar',
    label: 'Mẫu ngữ pháp',
    badge: 'Ngữ pháp',
    empty: 'Không có mẫu ngữ pháp phù hợp.',
  },
];

function groupCountText(shown: number, total: number) {
  if (total === 0) return '0 kết quả';
  if (total > shown) return `Hiển thị ${shown}/${total} kết quả`;
  return `${total} kết quả`;
}

function renderContentCard(item: SearchResultItem, badge: string) {
  return (
    <article className="content-card" key={item.id}>
      <span className="level">
        {badge} · {item.level}
      </span>
      <JaText as="h3">
        <Link href={item.href}>{item.title}</Link>
      </JaText>
      {item.reading && <JaText as="p">{item.reading}</JaText>}
      {item.hanViet && (
        <>
          <ViText as="p">{'Hán Việt: ' + item.hanViet.text}</ViText>
          <SourceLabel translation={item.hanViet} />
          {item.hanViet.translationId && (
            <ReportViButton translationId={item.hanViet.translationId} label="Hán Việt" />
          )}
        </>
      )}
      {item.meaning && <ViText as="p">{item.meaning.text}</ViText>}
      <p lang="en">{item.english.join('; ')}</p>
      <SourceLabel translation={item.meaning} fallback={item.sourceName} />
      {item.meaning?.translationId && (
        <ReportViButton translationId={item.meaning.translationId} label="nghĩa Việt" />
      )}
      <p>
        <Link href={item.href}>Chi tiết · ví dụ · Báo sai</Link>
      </p>
      <AddToReview
        itemId={item.id}
        cardType={item.kind === 'kanji' ? 'reading' : 'recognition'}
      />
    </article>
  );
}

function renderOutsideJlptCard(item: SearchResultItem) {
  return (
    <article className="content-card" key={item.id}>
      <span className="level">
        {item.level} · {item.sourceName}
      </span>
      <JaText as="h3">{item.title}</JaText>
      {item.reading && <JaText as="p">{item.reading}</JaText>}
      {item.kanjiHanViet && item.kanjiHanViet.length > 0 && (
        <>
          <ViText as="p">
            {'Hán Việt: ' +
              item.kanjiHanViet
                .map((entry) => `${entry.character}: ${entry.hanViet.text}`)
                .join(' · ')}
          </ViText>
          <SourceLabel translation={item.kanjiHanViet[0].hanViet} />
        </>
      )}
      {item.meaning ? (
        <>
          <ViText as="p">{item.meaning.text}</ViText>
          <SourceLabel translation={item.meaning} fallback={item.sourceName} />
          {item.meaning.translationId && (
            <ReportViButton translationId={item.meaning.translationId} label="nghĩa Việt" />
          )}
          {item.english.length > 0 && (
            <>
              <p lang="en">{item.english.join('; ')}</p>
              <ViText className="source-label">{`EN · ${item.sourceName}`}</ViText>
            </>
          )}
        </>
      ) : (
        <>
          <p lang="en">{item.english.join('; ')}</p>
          <ViText className="source-label">{`EN · ${item.sourceName}`}</ViText>
        </>
      )}
      <AddToReview itemId={item.id} cardType="recognition" />
    </article>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  const query = typeof p.q === 'string' ? p.q : '';
  const result = await withContentDatabase((db) => searchAllKinds(db, query));
  const { vocab, kanji, grammar, clipSentences, outsideJlpt } = result.groups;

  return (
    <>
      <RouteHeading title="Tra cứu chung" eyebrow="MỘT CHỖ ĐỂ TÌM" species="cat">
        <p>Tìm cùng lúc từ, kanji, mẫu ngữ pháp, câu trong clip shadowing và từ ngoài JLPT.</p>
      </RouteHeading>
      <form action="/common-tools/search">
        <label htmlFor="common-query">Nội dung cần tìm</label>
        <input
          id="common-query"
          name="q"
          defaultValue={result.q}
          maxLength={160}
          placeholder="Ví dụ: gakusei, học sinh, hoc sinh, おはよう"
        />
        <button className="button button-primary">Tìm kiếm</button>
      </form>
      <p role="status">
        {result.total} kết quả · Từ ({vocab.total}) · Kanji ({kanji.total}) · Mẫu ngữ pháp (
        {grammar.total}) · Câu trong clip ({clipSentences.total}) · Ngoài JLPT ({outsideJlpt.total})
      </p>
      <nav className={styles.groupJump} aria-label="Nhóm kết quả">
        <a href="#group-vocab">Từ ({vocab.total})</a>
        <a href="#group-kanji">Kanji ({kanji.total})</a>
        <a href="#group-grammar">Mẫu ngữ pháp ({grammar.total})</a>
        <a href="#group-clips">Câu trong clip ({clipSentences.total})</a>
        <a href="#group-outside-jlpt">Ngoài JLPT ({outsideJlpt.total})</a>
      </nav>
      {!result.total && (
        <p>
          Chưa tìm thấy. Thử cách đọc, romaji hoặc nghĩa tiếng Anh; tìm trong dữ liệu đã nhập, clip
          shadowing đang hoạt động và từ điển ngoài JLPT (nếu đã nạp).
        </p>
      )}
      {CONTENT_GROUPS.map((group) => {
        const data = result.groups[group.key];
        const headingId = `${group.id}-heading`;
        return (
          <section key={group.key} id={group.id} aria-labelledby={headingId}>
            <div className={styles.groupHeader}>
              <h2 id={headingId}>
                {group.label} ({data.total})
              </h2>
              <span className={styles.groupCount}>
                {groupCountText(data.items.length, data.total)}
              </span>
            </div>
            {data.items.length > 0 ? (
              <div className="content-grid">
                {data.items.map((item) => renderContentCard(item, group.badge))}
              </div>
            ) : (
              <p className={styles.emptyGroup}>{group.empty}</p>
            )}
          </section>
        );
      })}
      <section id="group-clips" aria-labelledby="group-clips-heading">
        <div className={styles.groupHeader}>
          <h2 id="group-clips-heading">Câu trong clip ({clipSentences.total})</h2>
          <span className={styles.groupCount}>
            {groupCountText(clipSentences.items.length, clipSentences.total)}
          </span>
        </div>
        {clipSentences.items.length > 0 ? (
          <div className="content-grid">
            {clipSentences.items.map((hit) => (
              <article className="content-card" key={hit.id}>
                <span className="level">
                  Clip · {hit.clipSource} · {hit.level} · Câu {hit.segmentNumber}
                </span>
                <JaText as="h3">
                  <Link href={hit.href}>{hit.ja}</Link>
                </JaText>
                {hit.kana && <JaText as="p">{hit.kana}</JaText>}
                {hit.vi && <ViText as="p">{hit.vi}</ViText>}
                <p className={styles.clipMeta}>
                  {hit.clipTitle}
                  {hit.speaker ? ` · ${hit.speaker}` : ''}
                </p>
                <p>
                  <Link href={hit.href}>Mở đúng câu trong Shadowing →</Link>
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className={styles.emptyGroup}>Không có câu trong clip phù hợp.</p>
        )}
      </section>
      <section id="group-outside-jlpt" aria-labelledby="group-outside-jlpt-heading">
        <div className={styles.groupHeader}>
          <h2 id="group-outside-jlpt-heading">Ngoài JLPT ({outsideJlpt.total})</h2>
          <span className={styles.groupCount}>
            {groupCountText(outsideJlpt.items.length, outsideJlpt.total)}
          </span>
        </div>
        {outsideJlpt.items.length > 0 ? (
          <div className="content-grid">
            {outsideJlpt.items.map((item) => renderOutsideJlptCard(item))}
          </div>
        ) : (
          <p className={styles.emptyGroup}>
            {result.q
              ? 'Không có từ ngoài JLPT phù hợp.'
              : 'Nhập từ khoá để tra thêm từ ngoài JLPT qua JMdict.'}
          </p>
        )}
      </section>
      <p className={styles.attribution}>
        Mỗi nhóm hiển thị tối đa {result.limitPerKind} kết quả; kết quả JLPT luôn xếp trước từ ngoài
        JLPT. Từ ngoài JLPT sử dụng{' '}
        <a href="https://www.edrdg.org/edrdg/licence.html" target="_blank" rel="noreferrer">
          JMdict
        </a>{' '}
        (James William Breen &amp; EDRDG) và{' '}
        <a href="https://github.com/bunchaway/tu-dien-nhat-viet" target="_blank" rel="noreferrer">
          tu-dien-nhat-viet
        </a>{' '}
        (Bunchaway), giấy phép{' '}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">
          CC BY-SA 4.0
        </a>
        .
      </p>
    </>
  );
}

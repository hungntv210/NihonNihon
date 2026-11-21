import Link from 'next/link';
import { RouteHeading } from '../../../../components/route-heading.tsx';
import { SourceLabel } from '../../../../components/source-label.tsx';
import { JaText, ViText } from '../../../../components/text.tsx';
import { withContentDatabase } from '../../../../server/dal.ts';
import { Furigana } from '../furigana.tsx';
import styles from '../vocab.module.css';
import {
  formatNotebookDate,
  listVocabNotebook,
  NOTEBOOK_SOURCE_LABELS,
  NOTEBOOK_SOURCES,
  notebookUrl,
  parseNotebookSource,
} from './data.ts';

export const dynamic = 'force-dynamic';

export default async function VocabNotebookPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const source = parseNotebookSource(params.source);
  const result = await withContentDatabase((db) => listVocabNotebook(db, { source }));

  return (
    <>
      <RouteHeading
        title="Sổ từ cá nhân"
        eyebrow="TỪ ĐÃ LƯU · CÂU GỐC · NGUỒN"
        species="cat"
      >
        <p>Tập hợp từ vựng bạn đã lưu, sắp theo ngày thêm mới nhất cùng câu gốc và nguồn.</p>
      </RouteHeading>
      <div className={styles.topLinks}>
        <Link href="/vocab" className="text-link">
          ← Sổ từ vựng
        </Link>
        <Link href="/shadowing" className="text-link">
          Shadowing →
        </Link>
      </div>
      <nav aria-label="Lọc theo nguồn lưu từ" className={styles.notebookFilters}>
        {NOTEBOOK_SOURCES.map((tab) => {
          const active = result.source === tab.key;
          return (
            <Link
              key={tab.key}
              href={notebookUrl(tab.key)}
              aria-current={active ? 'page' : undefined}
              className={`${styles.notebookFilter} ${active ? styles.notebookFilterActive : ''}`}
            >
              <span>{tab.label}</span>
              <span className={styles.notebookCount}>{result.counts[tab.key]}</span>
            </Link>
          );
        })}
      </nav>
      <p className={styles.notebookNote}>
        Hiển thị {result.filteredTotal}/{result.total} từ · Sắp theo ngày thêm mới nhất. Nguồn
        Reader và Đề thi JLPT hiện chưa có điểm lưu từ kèm câu gốc.
      </p>
      {result.items.length > 0 ? (
        <ul className={styles.notebookList}>
          {result.items.map((entry) => (
            <li key={entry.id} className={styles.notebookCard}>
              <div className={styles.notebookHead}>
                <div className={styles.notebookTitleGroup}>
                  <JaText as="h2" className={styles.notebookWord}>
                    <Link href={'/vocab/' + encodeURIComponent(entry.id)}>
                      <Furigana segments={entry.segments} />
                    </Link>
                  </JaText>
                  <JaText as="p" className="reading">
                    {entry.reading}
                  </JaText>
                </div>
                <span className="level">{entry.level}</span>
              </div>
              {entry.meaning ? (
                <ViText as="p" className={styles.notebookMeaning}>
                  {entry.meaning.text}
                </ViText>
              ) : (
                <p lang="en" className={styles.notebookMeaning}>
                  {entry.english.join('; ')}
                </p>
              )}
              <SourceLabel translation={entry.meaning} fallback={entry.sourceName} />
              {entry.sentenceJa && (
                <div className={styles.notebookSentence}>
                  <p className={styles.notebookSentenceLabel}>Câu gốc</p>
                  <JaText as="p" className={styles.notebookSentenceJa}>
                    {entry.sentenceJa}
                  </JaText>
                  {entry.sentenceVi && (
                    <ViText as="p" className={styles.notebookSentenceVi}>
                      {entry.sentenceVi}
                    </ViText>
                  )}
                </div>
              )}
              <footer className={styles.notebookFooter}>
                <span className={styles.notebookSourceBadge} data-source={entry.source}>
                  {NOTEBOOK_SOURCE_LABELS[entry.source]}
                </span>
                {entry.clipHref && (
                  <Link href={entry.clipHref} className={styles.notebookClipLink}>
                    Mở clip
                    {entry.clipTitle ? `: ${entry.clipTitle}` : ''}
                    {entry.segmentNumber ? ` · câu ${entry.segmentNumber}` : ''} →
                  </Link>
                )}
                <time dateTime={entry.addedAt} className={styles.notebookDate}>
                  Thêm ngày {formatNotebookDate(entry.addedAt)}
                </time>
              </footer>
            </li>
          ))}
        </ul>
      ) : result.total === 0 ? (
        <section className="empty-state">
          <h2>Sổ từ cá nhân chưa có từ nào.</h2>
          <p>
            Chạm vào từ trong phụ đề Shadowing để lưu kèm câu gốc, hoặc bấm «Thêm vào ôn» ở mục Từ
            vựng.
          </p>
          <div className={styles.notebookEmptyActions}>
            <Link href="/shadowing" className="button button-primary">
              Mở Shadowing
            </Link>
            <Link href="/vocab" className="button">
              Xem từ vựng
            </Link>
          </div>
        </section>
      ) : (
        <section className="empty-state">
          <h2>Chưa có từ nào thuộc nguồn này.</h2>
          <p>Thử chọn «Tất cả» để xem {result.total} từ đã lưu từ các nguồn khác.</p>
          <Link href="/vocab/notebook" className="button">
            Xem tất cả nguồn
          </Link>
        </section>
      )}
    </>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { withContentDatabase } from '../../../../server/dal.ts';
import { JaText, ViText } from '../../../../components/text.tsx';
import { SourceLabel } from '../../../../components/source-label.tsx';
import { AddToReview } from '../../../../components/add-to-review.tsx';
import { kanjiDetail } from '../repository.ts';
import { ReadingTools } from '../reading-tools.tsx';
import { StrokePlayer } from '../stroke-player.tsx';
import { PersonalMemo } from '../personal-memo.tsx';
import { ReportForm } from '../report-form.tsx';
import styles from '../kanji.module.css';

export default async function KanjiDetailPage({
  params,
}: {
  params: Promise<{ character: string }>;
}) {
  const { character } = await params,
    item = await withContentDatabase((db) => kanjiDetail(db, character));
  if (!item) notFound();
  return (
    <>
      <Link className={styles.back} href="/kanji">
        ← Sổ kanji
      </Link>
      <section className={styles.detailHeader}>
        <JaText className={styles.largeCharacter}>{item.character}</JaText>
        <div>
          <span className="level">{item.level}</span>
          <h1 className={styles.detailHeading}>
            Chữ <JaText>{item.character}</JaText>
          </h1>
          <div className={styles.hv}>
            {item.hanViet ? (
              <ViText as="strong" className={styles.primaryReading}>
                {item.hanViet.text}
              </ViText>
            ) : (
              <p className={styles.missing}>Chưa có âm Hán Việt chính trong dữ liệu hiện tại.</p>
            )}
            {item.hanViet?.autoSelected && <span className={styles.auto}>Tự chọn</span>}
            {item.alternatives.length > 0 && (
              <ViText className={styles.alternativeReading}>
                {(item.hanViet ? 'Âm khác: ' : 'Âm đang đối chiếu: ') +
                  item.alternatives.join(' · ')}
              </ViText>
            )}
          </div>
          {item.hanViet && <SourceLabel translation={item.hanViet} />}
          {item.hanVietId && (
            <ReportForm key={item.hanVietId} translationId={item.hanVietId} label="âm Hán Việt" />
          )}
          <div className={styles.detailMeaning}>
            {item.meaning ? (
              <ViText as="p" className={styles.meaning}>
                {item.meaning.text}
              </ViText>
            ) : (
              <p lang="en" className={styles.meaning}>
                {item.english.join('; ')}
              </p>
            )}
            {item.meaning && (
              <p lang="en" className={styles.english}>
                {item.english.join('; ')}
              </p>
            )}
            <SourceLabel translation={item.meaning} />
            {item.meaningId && (
              <ReportForm
                key={item.meaningId}
                translationId={item.meaningId}
                label="nghĩa tiếng Việt"
              />
            )}
          </div>
          <AddToReview key={item.id} itemId={item.id} cardType="recognition" />
        </div>
      </section>
      <div className={styles.columns}>
        <section className={styles.panel}>
          <h2>Âm đọc &amp; cấu tạo</h2>
          <ReadingTools
            key={item.id}
            onyomi={item.onyomi}
            kunyomi={item.kunyomi}
            nanori={item.nanori}
          />
          <dl className={styles.facts}>
            <div>
              <dt>Số nét</dt>
              <dd>{item.strokes ?? '—'}</dd>
            </div>
            <div>
              <dt>Lớp học Nhật</dt>
              <dd>{item.grade ?? '—'}</dd>
            </div>
            <div>
              <dt>Hạng tần suất</dt>
              <dd>{item.frequency ?? '—'}</dd>
            </div>
          </dl>
          <div className={styles.componentList}>
            {[
              ...new Set([item.radical, ...item.components].filter((v): v is string => Boolean(v))),
            ].map((component) => (
              <Link
                href={'/kanji?radical=' + encodeURIComponent(component)}
                key={component}
                title={'Tìm chữ cùng bộ/thành phần ' + component}
              >
                <JaText>{component}</JaText>
              </Link>
            ))}
          </div>
          <p className={styles.voiceNote}>
            Chạm bộ thủ hoặc thành phần để xem các chữ có cùng thành phần.
          </p>
        </section>
        <section className={styles.panel}>
          <h2>Thứ tự nét</h2>
          <StrokePlayer key={item.id} character={item.character} paths={item.strokePaths} />
          {item.strokeSource && (
            <p className={styles.attribution}>
              {/^https?:\/\//.test(item.strokeSource.url) ? (
                <a href={item.strokeSource.url} rel="noreferrer" target="_blank">
                  {item.strokeSource.name} ↗
                </a>
              ) : (
                item.strokeSource.name
              )}{' '}
              · {item.strokeSource.license}
            </p>
          )}
        </section>
      </div>
      <section className={styles.relatedSection}>
        <div className={styles.relatedHeading}>
          <h2>Gặp chữ trong từ</h2>
          <p>Ưu tiên từ đã thêm vào hàng ôn, rồi từ cùng cấp.</p>
        </div>
        {item.related.length ? (
          <div className={styles.words}>
            {item.related.map((word) => (
              <Link
                className={styles.word}
                href={'/vocab/' + encodeURIComponent(word.id)}
                key={word.id}
              >
                <div className={styles.wordLine}>
                  <JaText className={styles.wordTitle}>{word.word}</JaText>
                  <span className="level">{word.level}</span>
                </div>
                <JaText as="p" className={styles.wordReading}>
                  {word.reading}
                </JaText>
                {word.meaning ? (
                  <ViText as="p" className={styles.wordMeaning}>
                    {word.meaning.text}
                  </ViText>
                ) : (
                  <p lang="en" className={styles.wordMeaning}>
                    {word.english.join('; ')}
                  </p>
                )}
                <SourceLabel translation={word.meaning} />
                {word.studied && <span className={styles.wordStudied}>Đã ở trong hàng ôn</span>}
              </Link>
            ))}
          </div>
        ) : (
          <p className={styles.strokeEmpty}>Chưa có từ chứa chữ này trong thư viện hiện tại.</p>
        )}
      </section>
      <section className={styles.panel + ' ' + styles.memo}>
        <PersonalMemo key={item.id} itemId={item.id} />
      </section>
    </>
  );
}

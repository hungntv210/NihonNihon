import Link from 'next/link';
import { notFound } from 'next/navigation';
import { withContentDatabase } from '../../../../server/dal.ts';
import { SourceLabel } from '../../../../components/source-label.tsx';
import { AddToReview } from '../../../../components/add-to-review.tsx';
import { JaText, ViText } from '../../../../components/text.tsx';
import { grammarHref, getGrammar, type GrammarTranslation } from '../repository.ts';
import { focusOf, choiceQuestions, orderingQuestions } from '../practice.ts';
import { Furigana } from '../furigana.tsx';
import { PracticePanel } from '../practice-panel.tsx';
import { Speak } from '../speak.tsx';
import { ReportForm } from '../report-form.tsx';
import { SourceText, hasJapanese } from '../source-text.tsx';
import styles from '../grammar.module.css';
function Vietnamese({ value, grammarId }: { value: GrammarTranslation | null; grammarId: string }) {
  return value ? (
    <div>
      <ViText as="p">{value.text}</ViText>
      <SourceLabel translation={value} />
      {value.id && <ReportForm grammarId={grammarId} translationId={value.id} />}
    </div>
  ) : (
    <p className={styles.help}>Chưa có bản Việt được chọn; bản Anh gốc được giữ bên dưới.</p>
  );
}
export default async function GrammarDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params,
    data = await withContentDatabase((db) => {
      const item = getGrammar(db, id);
      return item
        ? {
            item,
            patterns: db
              .prepare(
                'SELECT g.pattern FROM grammar g JOIN content_items i USING(item_id) WHERE i.is_active=1 AND g.item_id<>? ORDER BY g.level,g.item_id',
              )
              .all(item.id)
              .map((r) => String(r.pattern)),
          }
        : null;
    });
  if (!data) notFound();
  const { item, patterns } = data,
    focus = focusOf(item.pattern),
    choices = choiceQuestions(item.pattern, item.examples, patterns),
    ordering = orderingQuestions(item.examples);
  return (
    <>
      <Link href="/grammar" className="text-link">
        ← Sổ ngữ pháp
      </Link>
      <div className={`page-heading ${styles.detailHeading}`}>
        <p className="eyebrow">MỘT MẪU, NHIỀU CÁCH GẶP</p>
        <div className={styles.title}>
          <JaText as="h1">{item.pattern}</JaText>
          <span className="level">{item.level}</span>
        </div>
        <p lang="en">{item.romaji}</p>
      </div>
      <div className={styles.detailGrid}>
        <section className={styles.panel} aria-labelledby="meaning-title">
          <h2 id="meaning-title">Ý nghĩa</h2>
          <Vietnamese value={item.meaningVi} grammarId={item.id} />
          <p lang="en" className={styles.original}>
            <SourceText text={item.meaningEn} />
          </p>
          <AddToReview itemId={item.id} />
        </section>
        <section className={styles.panel} aria-labelledby="formation-title">
          <h2 id="formation-title">Cách nối</h2>
          <Vietnamese value={item.formationVi} grammarId={item.id} />
          <div className={styles.formation} lang="en">
            {item.formationEn.split(/\s*\+\s*/u).map((part, i) => (
              <span key={i}>
                {i > 0 && <b aria-hidden="true">+</b>}
                  <code lang={hasJapanese(part) ? 'ja' : 'en'} className={hasJapanese(part) ? styles.japaneseFormation : undefined}><SourceText text={part} /></code>
              </span>
            ))}
          </div>
        </section>
      </div>
      {(item.notesEn || item.notesVi) && (
        <section className={styles.note} aria-labelledby="notes-title">
          <h2 id="notes-title">Để ý thêm một chút</h2>
          <Vietnamese value={item.notesVi} grammarId={item.id} />
          {item.notesEn && (
            <p lang="en" className={styles.original}>
              <SourceText text={item.notesEn} />
            </p>
          )}
        </section>
      )}
      <section className="section-block" aria-labelledby="examples-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">GẶP MẪU TRONG CÂU</p>
            <h2 id="examples-title">Ví dụ</h2>
          </div>
          <span className={styles.help}>{item.examples.length} câu</span>
        </div>
        {item.examples.length ? (
          <div className={styles.examples}>
            {item.examples.map((example, index) => (
              <article key={example.id} className={styles.example}>
                <span className={styles.exampleNumber}>{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <p className={styles.japanese}>
                    <Furigana
                      japanese={example.japanese}
                      notation={example.furigana}
                      focus={focus}
                    />
                  </p>
                  <Vietnamese value={example.vietnamese} grammarId={item.id} />
                  {example.english && (
                    <p className={styles.original} lang="en">
                      <SourceText text={example.english} />
                    </p>
                  )}
                  <p className={styles.help}>{example.attribution}</p>
                  <Speak text={example.japanese} />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className={styles.notice}>Nguồn hiện tại chưa có câu ví dụ cho mẫu này.</p>
        )}
      </section>
      <PracticePanel key={item.id} choices={choices} ordering={ordering} />
      {item.related.length > 0 && (
        <section className="section-block" aria-labelledby="related-title">
          <h2 id="related-title" className={styles.sectionTitle}>
            Mẫu cùng nhóm
          </h2>
          <p className={styles.help}>
            Được nối theo nhãn nhóm của nguồn, không phải kết luận các mẫu thay thế được cho nhau.
          </p>
          <div className={styles.related}>
            {item.related.map((related) => (
              <Link className={styles.relatedCard} href={grammarHref(related.id)} key={related.id}>
                <JaText>{related.pattern}</JaText>
                <span className="level">{related.level}</span>
                <p>
                  {related.meaningVi ? (
                    <ViText>{related.meaningVi.text}</ViText>
                  ) : (
                    <span lang="en">{related.meaningEn}</span>
                  )}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
      {item.clips.length > 0 && (
        <section className="section-block">
          <h2 className={styles.sectionTitle}>Câu này trong clip của bạn</h2>
          <ul>
            {item.clips.map((clip) => (
              <li key={clip.id + ':' + clip.position}>
                <Link
                  className="text-link"
                  href={
                    '/shadowing?clip=' + encodeURIComponent(clip.id) + '&segment=' + clip.position
                  }
                >
                  Clip · câu {clip.position + 1} →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

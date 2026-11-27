import {RouteHeading} from '../../../../components/route-heading.tsx';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { withContentDatabase } from '../../../../server/dal.ts';
import { SourceLabel } from '../../../../components/source-label.tsx';
import { AddToReview } from '../../../../components/add-to-review.tsx';
import { JaText, ViText } from '../../../../components/text.tsx';
import { ReportViButton } from '../../common-tools/report-vi-button.tsx';
import {
  grammarClipHref,
  grammarHref,
  getGrammar,
  type GrammarTranslation,
} from '../repository.ts';
import { decodeGrammarRouteId } from '../route-id.ts';
import { grammarPractice } from '../practice.ts';
import { resolveGrammarHighlights } from '../highlight.ts';
import { FORMULA_LEGEND, parseGrammarFormula, type FormulaKind } from '../formula.ts';
import { Furigana } from '../furigana.tsx';
import { PracticePanel } from '../practice-panel.tsx';
import { Speak } from '../speak.tsx';
import { ReportForm } from '../report-form.tsx';
import { SourceText, hasJapanese } from '../source-text.tsx';
import styles from '../grammar.module.css';

const FORMULA_BLOCK_CLASS: Record<Exclude<FormulaKind, 'connector'>, string> = {
  verb: styles.formulaVerb,
  'i-adj': styles.formulaIAdj,
  'na-adj': styles.formulaNaAdj,
  noun: styles.formulaNoun,
  fixed: styles.formulaFixed,
  neutral: styles.formulaNeutral,
};

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
  const id = decodeGrammarRouteId((await params).id);
  if (id === null) notFound();
  const data = await withContentDatabase((db) => {
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
    formula = parseGrammarFormula(item.formationEn, item.pattern),
    { choices, ordering } = grammarPractice(item.pattern, item.examples, patterns, item.exercises);
  return (
    <>
      <RouteHeading heading="h2" title="Chi tiết ngữ pháp" species="owl" eyebrow="ĐỌC · HIỂU · GẶP LẠI"><p>Đối chiếu nội dung và lưu lại để ôn.</p></RouteHeading>
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
        {formula.lines.length > 0 && (
          <div className={styles.formulaBox} role="region" aria-label="Công thức nối">
            <div className={styles.formulaLines}>
              {formula.lines.map((line, lineIndex) => (
                <div className={styles.formulaRow} key={lineIndex}>
                  {line.map((block, blockIndex) =>
                    block.kind === 'connector' ? (
                      <span
                        key={blockIndex}
                        className={
                          block.text === '+' ? styles.formulaPlus : styles.formulaSlash
                        }
                        aria-hidden="true"
                      >
                        {block.text}
                      </span>
                    ) : (
                      <span
                        key={blockIndex}
                        className={`${styles.formulaBlock} ${FORMULA_BLOCK_CLASS[block.kind]}`}
                        data-formula-kind={block.kind}
                      >
                        <span className={styles.formulaTag} data-formula-tag="">
                          {block.tag}
                        </span>
                        <span
                          className={
                            block.lang === 'ja' ? styles.formulaJaText : styles.formulaText
                          }
                          lang={block.lang}
                        >
                          {block.text}
                        </span>
                      </span>
                    ),
                  )}
                </div>
              ))}
            </div>
            <p className={styles.formulaLegend}>
              {FORMULA_LEGEND.map((entry, idx) => (
                <span key={entry.kind} className={styles.formulaLegendItem}>
                  {idx > 0 && <span aria-hidden="true"> · </span>}
                  <strong>{entry.code}</strong> = {entry.label}
                </span>
              ))}
            </p>
          </div>
        )}
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
      {item.confusables.length > 0 && (
        <section className={styles.confusables} aria-labelledby="confusables-title">
          <h2 id="confusables-title">Dễ nhầm với</h2>
          <ul className={styles.confusableList}>
            {item.confusables.map((entry) => {
              const noteViId = entry.noteVi?.id ?? entry.noteVi?.translationId;
              return (
                <li key={entry.targetId} className={styles.confusableItem}>
                  <div className={styles.confusableHeader}>
                    <Link href={entry.href} className={styles.confusableLink}>
                      <JaText>{entry.targetPattern}</JaText>
                    </Link>
                    <span className="level">{entry.targetLevel}</span>
                  </div>
                  {entry.noteVi && (
                    <ViText as="p" className={styles.confusableVi}>
                      {entry.noteVi.text}
                    </ViText>
                  )}
                  <p lang="en" className={styles.original}>
                    <SourceText text={entry.noteEn} />
                  </p>
                  <div className={styles.confusableMeta}>
                    <SourceLabel translation={entry.noteVi} fallback={entry.sourceName} />
                    {noteViId && <ReportViButton translationId={noteViId} />}
                    {entry.noteVi && <span className={styles.help}>Bản gốc: {entry.sourceName}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
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
                      highlights={
                        example.highlights?.length
                          ? example.highlights
                          : resolveGrammarHighlights(
                              item.pattern,
                              example.japanese,
                              example.furigana,
                              item.formationEn,
                            )
                      }
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
            {item.related.map((related) => {
              const relatedMeaningId = related.meaningVi?.id ?? related.meaningVi?.translationId;
              return (
                <article className={styles.relatedCard} key={related.id}>
                  <Link href={grammarHref(related.id)}>
                    <JaText>{related.pattern}</JaText>
                  </Link>
                  <span className="level">{related.level}</span>
                  <p>
                    {related.meaningVi ? (
                      <ViText>{related.meaningVi.text}</ViText>
                    ) : (
                      <span lang="en">{related.meaningEn}</span>
                    )}
                  </p>
                  {relatedMeaningId && <ReportViButton translationId={relatedMeaningId} />}
                </article>
              );
            })}
          </div>
        </section>
      )}
      {item.clips.length > 0 && (
        <section className="section-block" aria-labelledby="clips-title">
          <h2 id="clips-title" className={styles.sectionTitle}>
            Câu này trong clip của bạn
          </h2>
          <ul>
            {item.clips.map((clip) => (
              <li key={clip.id + ':' + clip.position}>
                <Link className="text-link" href={grammarClipHref(clip.id, clip.position)}>
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

import Link from 'next/link';
import { JaText, ViText } from '../../../../../components/text.tsx';
import { SourceLabel } from '../../../../../components/source-label.tsx';
import { AddToReview } from '../../../../../components/add-to-review.tsx';
import type { KanjiLessonWord, LessonKanji } from './model.ts';

export function KanjiCardBody({ item }: { item: LessonKanji }) {
  return (
    <>
      <span className="level">{item.level}</span>
      <JaText as="h2" data-lesson-word="">
        {item.character}
      </JaText>
      {item.hanViet ? (
        <ViText
          as="strong"
          data-lesson-translation=""
          style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}
        >
          {item.hanViet.text}
        </ViText>
      ) : (
        <p data-lesson-muted="">Chưa có âm Hán Việt chính trong dữ liệu hiện tại.</p>
      )}
      {item.alternatives.length > 0 && (
        <ViText as="p" data-lesson-muted="">
          {(item.hanViet ? 'Âm khác: ' : 'Âm đang đối chiếu: ') + item.alternatives.join(' · ')}
        </ViText>
      )}
      {item.hanViet && <SourceLabel translation={item.hanViet} />}
      <div data-lesson-meaning="">
        {item.meaning ? (
          <>
            <ViText as="p" data-lesson-translation="">
              {item.meaning.text}
            </ViText>
            {item.english.length > 0 && (
              <p lang="en" data-lesson-muted="">
                {item.english.join('; ')}
              </p>
            )}
          </>
        ) : (
          <p lang="en" data-lesson-translation="">
            {item.english.join('; ')}
          </p>
        )}
        <SourceLabel translation={item.meaning} />
      </div>
      <dl
        data-lesson-muted=""
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '8px 20px',
          margin: 0,
        }}
      >
        <div>
          <dt style={{ display: 'inline', fontWeight: 600 }}>On: </dt>
          <dd style={{ display: 'inline', margin: 0 }}>
            <JaText>{item.onyomi.join('・') || '—'}</JaText>
          </dd>
        </div>
        <div>
          <dt style={{ display: 'inline', fontWeight: 600 }}>Kun: </dt>
          <dd style={{ display: 'inline', margin: 0 }}>
            <JaText>{item.kunyomi.join('・') || '—'}</JaText>
          </dd>
        </div>
        <div>
          <dt style={{ display: 'inline', fontWeight: 600 }}>Số nét: </dt>
          <dd style={{ display: 'inline', margin: 0 }}>
            {item.strokes == null ? '—' : `${item.strokes} nét`}
          </dd>
        </div>
      </dl>
    </>
  );
}

export function KanjiWordBody({ word, index }: { word: KanjiLessonWord; index: number }) {
  return (
    <div data-lesson-example-body="">
      <span data-lesson-example-number="">{String(index + 1).padStart(2, '0')}</span>
      <div data-lesson-example-text="">
        <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
          <JaText as="p" data-lesson-sentence="" style={{ margin: 0 }}>
            {word.word}
          </JaText>
          <JaText as="span" className="reading">
            {word.reading}
          </JaText>
          <span className="level">{word.level}</span>
        </div>
        {word.meaning ? (
          <ViText as="p" data-lesson-example-meaning="">
            {word.meaning.text}
          </ViText>
        ) : (
          <p lang="en" data-lesson-example-meaning="">
            {word.english.join('; ')}
          </p>
        )}
        <SourceLabel translation={word.meaning} />
        <div style={{ marginTop: 6 }}>
          <Link
            className="text-link"
            href={'/vocab/' + encodeURIComponent(word.id)}
            prefetch={false}
          >
            Xem từ →
          </Link>
        </div>
      </div>
    </div>
  );
}

export function KanjiCardReview({ item }: { item: LessonKanji }) {
  return (
    <div data-lesson-meaning="">
      <AddToReview itemId={item.id} cardType="recognition" />
      <Link
        className="text-link"
        href={'/kanji/' + encodeURIComponent(item.character)}
        prefetch={false}
      >
        Xem nét viết và chi tiết →
      </Link>
    </div>
  );
}

export function KanjiLessonDone({ count }: { count: number }) {
  return (
    <section className="empty-state">
      <h2>{count ? 'Đã đi hết bài học kanji.' : 'Các kanji hiện có đã ở trong hàng ôn.'}</h2>
      <p>
        {count
          ? `Bạn vừa xem ${count} kanji mới. Hãy gặp lại những chữ đã lưu ở mục Ôn tập.`
          : 'Bạn có thể quay về bài từ vựng, mở hàng ôn hoặc tra thêm chữ trong sổ kanji.'}
      </p>
      <div data-lesson-links="">
        <Link href="/vocab/lesson" className="button button-primary" prefetch={false}>
          Quay về bài từ vựng
        </Link>
        <Link href="/srs" className="button" prefetch={false}>
          Mở hàng ôn
        </Link>
        <Link href="/kanji" className="button" prefetch={false}>
          Về sổ kanji
        </Link>
      </div>
    </section>
  );
}

import Link from 'next/link';
import { JaText, ViText } from '../../../../components/text.tsx';
import { SourceLabel } from '../../../../components/source-label.tsx';
import { AddToReview } from '../../../../components/add-to-review.tsx';
import { Furigana } from '../furigana.tsx';
import { ReportTranslation } from '../report.tsx';
import type { LessonExample, LessonWord } from './model.ts';

export function LessonExampleBody({
  itemId,
  sourceName,
  example,
  index,
}: {
  itemId: string;
  sourceName: string;
  example: LessonExample;
  index: number;
}) {
  return (
    <div data-lesson-example-body="">
      <span data-lesson-example-number="">{String(index + 1).padStart(2, '0')}</span>
      <div data-lesson-example-text="">
        <JaText as="p" data-lesson-sentence="">
          <Furigana segments={example.segments} />
        </JaText>
        {example.translation ? (
          <>
            <ViText as="p" data-lesson-example-meaning="">
              {example.translation.text}
            </ViText>
            <SourceLabel translation={example.translation} />
            {example.translationId && (
              <ReportTranslation itemId={itemId} translationId={example.translationId} />
            )}
            {example.english && (
              <details data-lesson-english="">
                <summary>Xem câu Anh gốc</summary>
                <p lang="en">{example.english}</p>
              </details>
            )}
          </>
        ) : (
          <>
            {example.english && (
              <p lang="en" data-lesson-example-meaning="">
                {example.english}
              </p>
            )}
            <SourceLabel translation={null} fallback={sourceName} />
          </>
        )}
      </div>
    </div>
  );
}

export function LessonWordHead({ item }: { item: LessonWord }) {
  return (
    <>
      <span className="level">{item.level}</span>
      <JaText as="h2" data-lesson-word="">
        {item.word}
      </JaText>
      <JaText as="p" className="reading">
        {item.reading}
      </JaText>
    </>
  );
}

export function LessonWordMeaning({ item }: { item: LessonWord }) {
  return (
    <div data-lesson-meaning="">
      {item.meaning ? (
        <ViText as="p" data-lesson-translation="">
          {item.meaning.text}
        </ViText>
      ) : (
        <p lang="en" data-lesson-translation="">
          {item.english.join('; ')}
        </p>
      )}
      <SourceLabel translation={item.meaning} fallback={item.sourceName} />
      {item.meaningId && <ReportTranslation itemId={item.id} translationId={item.meaningId} />}
      <AddToReview itemId={item.id} />
      <Link className="text-link" href={'/vocab/' + encodeURIComponent(item.id)}>
        Mở cách dùng và ví dụ →
      </Link>
    </div>
  );
}

export function LessonEmptyState({ count }: { count: number }) {
  return (
    <section className="empty-state">
      <h2>{count ? 'Đã đi hết bài học nhỏ.' : 'Các từ hiện có đã ở trong hàng ôn.'}</h2>
      <p>
        {count
          ? `Bạn vừa xem ${count} từ. Hãy gặp lại những từ đã lưu ở mục Ôn tập.`
          : 'Bạn có thể ôn lại từ đã lưu hoặc chọn từ trong sổ để xem cách dùng.'}
      </p>
      <div data-lesson-links="">
        <Link href="/srs" className="button button-primary">
          Mở hàng ôn
        </Link>
        <Link href="/vocab" className="button">
          Về sổ từ
        </Link>
      </div>
    </section>
  );
}

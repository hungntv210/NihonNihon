import type { Content } from '../core/content.ts';
import { JaText, ViText } from './text.tsx';
import { SourceLabel } from './source-label.tsx';
import { AddToReview } from './add-to-review.tsx';
export function ContentCard({ item }: { item: Content }) {
  return (
    <article className="content-card">
      <div className="card-heading">
        <JaText as="h3" className={item.kind === 'kanji' ? 'kanji-title' : 'word-title'}>
          {item.title}
        </JaText>
        <span className="level">{item.level}</span>
      </div>
      {item.reading && (
        <JaText as="p" className="reading">
          {item.reading}
        </JaText>
      )}
      {item.vietnamese ? (
        <ViText as="p" className="meaning">
          {item.vietnamese.text}
        </ViText>
      ) : (
        <p lang="en" className="meaning">
          {item.english.join('; ')}
        </p>
      )}
      {item.vietnamese && (
        <p lang="en" className="english">
          {item.english.join('; ')}
        </p>
      )}
      <SourceLabel translation={item.vietnamese} fallback={item.sourceName} />
      <AddToReview itemId={item.id} cardType={item.kind === 'kanji' ? 'reading' : 'recognition'} />
    </article>
  );
}

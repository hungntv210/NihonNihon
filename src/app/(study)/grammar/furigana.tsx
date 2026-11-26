import { Fragment } from 'react';
import type { Highlight } from '../../../core/content-supplement.ts';
export type RubySegment = { text: string; reading?: string };
export function rubySegments(japanese: string, notation: string | null): RubySegment[] {
  if (!notation) return [{ text: japanese }];
  const parts: RubySegment[] = [];
  let end = 0;
  for (const match of notation.matchAll(/\{([^|{}]+)\|([^{}]+)\}/gu)) {
    if (match.index! > end) parts.push({ text: notation.slice(end, match.index) });
    parts.push({ text: match[1], reading: match[2] });
    end = match.index! + match[0].length;
  }
  if (end < notation.length) parts.push({ text: notation.slice(end) });
  return parts.length && parts.map((p) => p.text).join('') === japanese
    ? parts
    : [{ text: japanese }];
}
export function Furigana({
  japanese,
  notation,
  focus,
  highlights,
}: {
  japanese: string;
  notation: string | null;
  focus?: string | null;
  highlights?: Highlight[];
}) {
  let position = 0;
  return (
    <span lang="ja" className="text-ja">
      {rubySegments(japanese, notation).map((part, index) => {
        const start = position;
        position += part.text.length;
        const content = part.reading ? (
          <ruby>
            {part.text}
            <rp>(</rp>
            <rt>{part.reading}</rt>
            <rp>)</rp>
          </ruby>
        ) : (
          <Fragment>{part.text}</Fragment>
        );
        if (highlights?.length) {
          const marked = (offset: number) => highlights.some((r) => offset >= r.start && offset < r.end);
          if (part.reading) return highlights.some((r) => r.start < position && r.end > start)
            ? <mark key={index}>{content}</mark> : <Fragment key={index}>{content}</Fragment>;
          const boundaries = [start, ...highlights.flatMap((r) => [r.start, r.end])
            .filter((offset) => offset > start && offset < position), position];
          return <Fragment key={index}>{[...new Set(boundaries)].sort((a, b) => a - b).slice(0, -1).map((offset, i, offsets) => {
            const end = offsets[i + 1] ?? position;
            const text = part.text.slice(offset - start, end - start);
            return marked(offset) ? <mark key={offset}>{text}</mark> : <Fragment key={offset}>{text}</Fragment>;
          })}</Fragment>;
        }
        return focus && part.text === focus ? (
          <mark key={index}>{content}</mark>
        ) : (
          <Fragment key={index}>
            {part.reading
              ? content
              : part.text.split(focus || '\0').map((text, i) => (
                  <Fragment key={i}>
                    {i > 0 && focus && <mark>{focus}</mark>}
                    {text}
                  </Fragment>
                ))}
          </Fragment>
        );
      })}
    </span>
  );
}

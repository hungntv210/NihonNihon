import { Fragment } from 'react';
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
}: {
  japanese: string;
  notation: string | null;
  focus?: string | null;
}) {
  return (
    <span lang="ja" className="text-ja">
      {rubySegments(japanese, notation).map((part, index) => {
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

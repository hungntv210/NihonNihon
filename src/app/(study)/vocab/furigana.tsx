import type { Segment } from './data.ts';
export function Furigana({ segments }: { segments: Segment[] }) {
  return (
    <span lang="ja">
      {segments.map((s, i) =>
        s.reading ? (
          <ruby key={i}>
            {s.text}
            <rp>（</rp>
            <rt>{s.reading}</rt>
            <rp>）</rp>
          </ruby>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </span>
  );
}

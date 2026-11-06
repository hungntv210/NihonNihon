import type { Example } from './repository.ts';
export type ChoiceQuestion = {
  id: string;
  sentence: string;
  blank: string;
  choices: string[];
  answer: string;
  original: string;
  english: string | null;
};
export type OrderingQuestion = {
  id: string;
  sentence: string;
  pieces: { id: number; text: string }[];
  star: number;
  english: string | null;
};
function shuffled<T>(values: T[], seed: string) {
  let n = [...seed].reduce(
    (value, c) => (Math.imul(value, 31) + c.codePointAt(0)!) >>> 0,
    2166136261,
  );
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    const j = n % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
export function focusOf(pattern: string): string | null {
  const focus = pattern
    .replace(/^[〜～~…\s]+/u, '')
    .split(/[（(]/u)[0]
    .trim();
  return focus && /^[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]+$/u.test(focus)
    ? focus
    : null;
}
export function choiceQuestions(
  pattern: string,
  examples: Example[],
  otherPatterns: string[],
): ChoiceQuestion[] {
  const focus = focusOf(pattern);
  if (!focus) return [];
  const other = [
    ...new Set(otherPatterns.map(focusOf).filter((s): s is string => !!s && s !== focus)),
  ].slice(0, 3);
  if (other.length < 2) return [];
  return examples.flatMap((example) => {
    const first = example.japanese.indexOf(focus);
    if (first < 0 || example.japanese.indexOf(focus, first + focus.length) >= 0) return [];
    return [
      {
        id: example.id,
        sentence:
          example.japanese.slice(0, first) + '＿＿' + example.japanese.slice(first + focus.length),
        blank: focus,
        choices: shuffled([focus, ...other], example.id),
        answer: focus,
        original: example.japanese,
        english: example.english,
      },
    ];
  });
}
export function orderingQuestions(examples: Example[]): OrderingQuestion[] {
  const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });
  return examples.flatMap((example) => {
    const units: string[] = [];
    let prefix = '';
    for (const part of segmenter.segment(example.japanese)) {
      if (part.isWordLike) {
        units.push(prefix + part.segment);
        prefix = '';
      } else if (units.length) units[units.length - 1] += part.segment;
      else prefix += part.segment;
    }
    if (prefix || units.length < 4) return [];
    const pieces = Array.from({ length: 4 }, (_, i) => ({
      id: i,
      text: units
        .slice(Math.floor((units.length * i) / 4), Math.floor((units.length * (i + 1)) / 4))
        .join(''),
    }));
    let choices = shuffled(pieces, example.id);
    if (choices.every((piece, index) => piece.id === index))
      choices = [...choices.slice(1), choices[0]];
    return [
      {
        id: example.id,
        sentence: example.japanese,
        pieces: choices,
        star: 1,
        english: example.english,
      },
    ];
  });
}
export function correctOrder(question: OrderingQuestion, order: number[]) {
  if (
    order.length !== 4 ||
    new Set(order).size !== 4 ||
    order.some((id) => !question.pieces.some((piece) => piece.id === id))
  )
    return false;
  return (
    order.map((id) => question.pieces.find((piece) => piece.id === id)!.text).join('') ===
    question.sentence
  );
}

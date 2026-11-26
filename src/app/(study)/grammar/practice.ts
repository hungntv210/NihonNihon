import type { Example } from './repository.ts';
import type { SupplementExercise } from '../../../core/content-supplement.ts';
type ExerciseFeedback = { furigana?: string; vietnamese?: string; explanation?: string; attribution?: string };
export type ChoiceQuestion = ExerciseFeedback & {
  id: string;
  sentence: string;
  blank: string;
  choices: string[];
  answer: string;
  original: string;
  english: string | null;
  promptFurigana?: string;
};
export type OrderingQuestion = ExerciseFeedback & {
  id: string;
  sentence: string;
  pieces: { id: number; text: string }[];
  star: number;
  prefix?: string;
  suffix?: string;
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
    (question.prefix ?? '') + order.map((id) => question.pieces.find((piece) => piece.id === id)!.text).join('') + (question.suffix ?? '') ===
    question.sentence
  );
}

function blankNotation(notation: string, start: number, end: number) {
  let position = 0;
  const before: string[] = [], after: string[] = [];
  for (const token of notation.match(/\{[^{}|]+\|[^{}|]+\}|[^{}]/gu) ?? []) {
    const plain = token.replace(/\{([^|]+)\|[^}]+\}/u, '$1');
    const next = position + plain.length;
    if (next <= start) before.push(token);
    else if (position >= end) after.push(token);
    else {
      if (position < start) before.push(plain.slice(0, start - position));
      if (next > end) after.push(plain.slice(end - position));
    }
    position = next;
  }
  return before.join('') + '＿＿' + after.join('');
}

export function grammarPractice(pattern: string, examples: Example[], otherPatterns: string[], exercises: SupplementExercise[] = []) {
  const choices: ChoiceQuestion[] = [], ordering: OrderingQuestion[] = [];
  for (const row of exercises) {
    const feedback = { id: row.id, english: row.english, furigana: row.furigana,
      vietnamese: row.vietnamese, explanation: row.explanation, attribution: row.attribution };
    if (row.kind === 'choice') choices.push({ ...feedback, original: row.japanese,
      sentence: row.japanese.slice(0, row.start) + '＿＿' + row.japanese.slice(row.end),
      blank: row.answer, answer: row.answer, choices: shuffled(row.choices.map((c) => c.text), row.id),
      promptFurigana: blankNotation(row.furigana, row.start, row.end),
    });
    else {
      const pieces = row.pieces.map((text, id) => ({ id, text }));
      let mixed = shuffled(pieces, row.id);
      if (mixed.every((p, i) => p.id === i)) mixed = [...mixed.slice(1), mixed[0]];
      ordering.push({ ...feedback, sentence: row.japanese, pieces: mixed, star: 1,
        prefix: row.prefix, suffix: row.suffix });
    }
  }
  const normalize = (s: string) => s.normalize('NFKC').replace(/[\p{P}\s]/gu, '');
  const originals = [...new Map(examples.filter((e) => !e.id.startsWith('g1:sentence:'))
    .map((e) => [e.japanese.normalize('NFKC'), e])).values()];
  const choiceTexts = new Set(choices.map((q) => normalize(q.original)));
  const orderTexts = new Set(ordering.map((q) => normalize(q.sentence)));
  return {
    choices: [...choices, ...choiceQuestions(pattern, originals, otherPatterns).filter((q) => !choiceTexts.has(normalize(q.original)))],
    ordering: [...ordering, ...orderingQuestions(originals).filter((q) => !orderTexts.has(normalize(q.sentence)))],
  };
}

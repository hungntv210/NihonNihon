import type {V2Source} from './v2-data.ts';

const politePredicate = /(?:です|でした|ます|ました|ません|ませんでした)$/u;

// Identify only forms with positive evidence at this occurrence. A matching
// surface in a borrowed sentence is not evidence of the lesson's function.
export function matchesGrammarFunction(source: V2Source, surface: string, sentence: string, start: number) {
 if (source.kind !== 'grammar') return true;
 const before = sentence.slice(0, start).trimEnd();
 const after = sentence.slice(start + surface.length).trimStart();
 if (surface === 'が' && source.id === 'openjlpt:grammar:ga-subject') {
  return !politePredicate.test(before) &&
   /^(?:ある|いる|あります|います|ありました|いました)(?=[。．.!！?？、，,」』]|$)/u.test(after);
 }
 if (surface === 'が' && source.id === 'openjlpt:grammar:ga-but') {
  return politePredicate.test(before) && /^[、，,]/u.test(after) &&
   politePredicate.test(after.replace(/[。．.!！?？」』]+$/u, ''));
 }
 if (surface === 'か' && source.id === 'openjlpt:grammar:ka-question') {
  return politePredicate.test(before) && /^[。．.!！?？」』]*$/u.test(after);
 }
 if (surface === 'か' && source.id === 'openjlpt:grammar:ka-or') {
  return !politePredicate.test(before) && /^[^、，,。．.!！?？か]+(?:のどちら|のいずれ)/u.test(after);
 }
 if (surface === 'まで' || surface === 'までに') {
  if (surface === 'まで' && after.startsWith('に')) return false;
  return /[0-9０-９一二三四五六七八九十百]+(?:時間|時|分|日|月|年|じ|ふん|ぷん)$|(?:今日|明日|きょう|あした)$/u.test(before);
 }
 return true;
}

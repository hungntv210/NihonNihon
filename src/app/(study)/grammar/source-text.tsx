import { Fragment } from 'react';
import { JaText } from '../../../components/text.tsx';
const japanese = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}々ー]+$/u;
export function SourceText({ text }: { text: string }) {
  return <>{text.normalize('NFC').split(/([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}々ー]+)/gu).map((part,index) => japanese.test(part) ? <JaText key={index}>{part}</JaText> : <Fragment key={index}>{part}</Fragment>)}</>;
}
export const hasJapanese = (text: string) => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text);

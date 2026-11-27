import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSentenceFurigana, loadShadowingTokenizer } from '../src/app/(study)/shadowing/auto-meta-server.ts';
import { reviewVocabFurigana, type TargetReading } from '../tools/vocab-furigana-review.ts';

const tokenizer = await loadShadowingTokenizer();
assert.ok(tokenizer);
function review(text: string, notation: string, targets: TargetReading[] = []) {
  return reviewVocabFurigana(text, notation, buildSentenceFurigana(text, tokenizer).tokens, targets);
}

test('normalizes everyday Japan while keeping institution and ambiguous place-name readings separate', () => {
  const general = review('日本語を話す。', '{日本語|にっぽんご}を{話|はな}す。');
  assert.equal(general.furigana, '{日本語|にほんご}を{話|はな}す。');
  assert.deepEqual(general.changes, { nihon: 1 });
  const bank = review('日本銀行へ行く。', '{日本|にほん}{銀行|ぎんこう}へ{行|い}く。');
  assert.equal(bank.furigana, '{日本|にっぽん}{銀行|ぎんこう}へ{行|い}く。');
  assert.ok(review('日本橋に着く。', '{日本|にっぽん}{橋|ばし}に{着|つ}く。').reasons.includes('place-name:日本橋'));
});

test('uses conversational readings after a past verb and for standalone now', () => {
  const after = review('読んだ後で会う。', '{読|よ}んだ{後|のち}で{会|あ}う。');
  assert.equal(after.furigana, '{読|よ}んだ{後|あと}で{会|あ}う。');
  assert.deepEqual(after.reasons, []);
  const noun = review('明日の後に。', '{明日|あした}の{後|のち}に。');
  assert.equal(noun.furigana, '{明日|あした}の{後|のち}に。');
  assert.ok(noun.reasons.includes('ambiguous-reading:後'));
  assert.equal(review('今歯をみがく。', '{今|こん}{歯|は}をみがく。').furigana, '{今|いま}{歯|は}をみがく。');
  assert.equal(review('今週はあく。', '{今|こん}{週|しゅう}はあく。').furigana, '{今|こん}{週|しゅう}はあく。');
});

test('uses clock and line readings, including the interval after a clock time', () => {
  const clock = review('十時の間に帰る。', '{十|じゅう}{時|とき}の{間|ま}に{帰|かえ}る。');
  assert.equal(clock.furigana, '{十時|じゅうじ}の{間|あいだ}に{帰|かえ}る。');
  assert.deepEqual(clock.changes, { 'counter-時': 1, 'clock-interval': 1 });
  assert.deepEqual(clock.reasons, []);
  assert.equal(review('６行に分ける。', '６{行|こう}に{分|わ}ける。').furigana, '{６行|ろくぎょう}に{分|わ}ける。');
  assert.ok(review('一行で到着した。', '{一行|いっこう}で{到着|とうちゃく}した。').reasons.includes('ambiguous-counter:行'));
});

test('applies contextual counter tables to supported numbers and withholds other readings', () => {
  for (const [text, old, expected] of [
    ['二人。', '{二|に}{人|にん}。', '{二人|ふたり}。'],
    ['三本。', '{三|さん}{本|ぽん}。', '{三本|さんぼん}。'],
    ['六匹。', '{六|ろく}{匹|ひき}。', '{六匹|ろっぴき}。'],
    ['８回。', '８{回|かい}。', '{８回|はっかい}。'],
    ['四分。', '{四|よん}{分|ふん}。', '{四分|よんぷん}。'],
    ['五月一日。', '{五|ご}{月|つき}{一|いち}{日|ひ}。', '{五月|ごがつ}{一日|ついたち}。'],
    ['一日中。', '{一日|ついたち}{中|じゅう}。', '{一日|いちにち}{中|じゅう}。'],
    ['七月。', '{七|なな}{月|つき}。', '{七月|しちがつ}。'],
    ['四年。', '{四|よん}{年|ねん}。', '{四年|よねん}。'],
    ['三階。', '{三|さん}{階|かい}。', '{三階|さんがい}。'],
    ['一杯。', '{一|いち}{杯|はい}。', '{一杯|いっぱい}。'],
  ]) {
    assert.equal(review(text, old).furigana, expected, text);
    assert.deepEqual(review(text, old).reasons, [], text);
  }
  assert.ok(review('一日。', '{一日|ついたち}。').reasons.includes('ambiguous-counter:日'));
  assert.ok(review('三分の一。', '{三|さん}{分|ぶん}の{一|いち}。').reasons.includes('ambiguous-counter:分'));
  assert.ok(review('３冊。', '３{冊|さつ}。').reasons.includes('unsupported-number'));
  assert.ok(review('三日月が見えた。', '{三日|みか}{月|づき}が{見|み}えた。').reasons.includes('ambiguous-counter:日'));
});

test('prefers a matching target reading and queues conflicts without overriding context rules', () => {
  const word = '上手に作る。', notation = '{上手|うわて}に{作|つく}る。';
  assert.equal(review(word, notation, [{ word: '上手', reading: 'ジョウズ' }]).furigana, '{上手|じょうず}に{作|つく}る。');
  assert.ok(review(word, notation, [{ word: '上手', reading: 'うわて' }, { word: '上手', reading: 'じょうず' }]).reasons.includes('target-reading-conflict:上手'));
  assert.equal(review(word, notation, [{ word: '手', reading: 'て' }]).furigana, notation);
  assert.equal(review('日本語。', '{日本語|にっぽんご}。', [{ word: '日本語', reading: 'にっぽんご' }]).furigana, '{日本語|にほんご}。');
  assert.deepEqual(review('本です。', '{本|ほん}でした。').reasons, ['surface-mismatch']);
});

test('reads 今日 according to context and queues genuinely ambiguous uses', () => {
  const daily = review('彼は宿題を今日終えねばならない。', '{彼|かれ}は{宿題|しゅくだい}を{今日|こんにち}{終|お}えねばならない。',
    [{ word: '今日', reading: 'こんにち' }]);
  assert.equal(daily.furigana, '{彼|かれ}は{宿題|しゅくだい}を{今日|きょう}{終|お}えねばならない。');
  assert.deepEqual(daily.changes, { 'day-今日': 1 });
  assert.deepEqual(daily.reasons, []);
  const formal = review('彼がその会社を今日の会社にした。', '{彼|かれ}がその{会社|かいしゃ}を{今日|きょう}の{会社|かいしゃ}にした。');
  assert.equal(formal.furigana, '{彼|かれ}がその{会社|かいしゃ}を{今日|こんにち}の{会社|かいしゃ}にした。');
  assert.deepEqual(formal.reasons, []);
  assert.equal(review('こんにちは！', 'こんにちは！').furigana, 'こんにちは！');
  const uncertain = review('今日の会社。', '{今日|こんにち}の{会社|かいしゃ}。', [{ word: '今日', reading: 'きょう' }]);
  assert.equal(uncertain.furigana, '{今日|こんにち}の{会社|かいしゃ}。');
  assert.deepEqual(uncertain.reasons, ['ambiguous-reading:今日']);
});

test('defaults to everyday readings for 明日 and 昨日 and preserves explicit formal usage', () => {
  for (const [text, old, expected] of [
    ['明日はあくよ。', '{明日|あす}はあくよ。', '{明日|あした}はあくよ。'],
    ['昨日もあいていた。', '{昨日|さくじつ}もあいていた。', '{昨日|きのう}もあいていた。'],
    ['明日付けで知らせます。', '{明日|あした}{付|づ}けで{知|し}らせます。', '{明日|あす}{付|づ}けで{知|し}らせます。'],
    ['昨日付けで出した。', '{昨日|きのう}{付|づ}けで{出|だ}した。', '{昨日|さくじつ}{付|づ}けで{出|だ}した。'],
  ]) {
    const result = review(text, old);
    assert.equal(result.furigana, expected, text);
    assert.deepEqual(result.reasons, [], text);
  }
  assert.ok(review('明日の世界。', '{明日|あす}の{世界|せかい}。').reasons.includes('ambiguous-reading:明日'));
});

test('distinguishes the first day of a month from a full day and queues an unspecified 一日', () => {
  assert.equal(review('八月一日。', '{八月|はちがつ}{一日|いちにち}。').furigana, '{八月|はちがつ}{一日|ついたち}。');
  assert.equal(review('丸一日かかった。', '{丸|まる}{一日|ついたち}かかった。').furigana, '{丸|まる}{一日|いちにち}かかった。');
  const unspecified = review('一日。', '{一日|ついたち}。', [{ word: '一日', reading: 'いちにち' }]);
  assert.equal(unspecified.furigana, '{一日|ついたち}。');
  assert.ok(unspecified.reasons.includes('ambiguous-reading:一日'));
});

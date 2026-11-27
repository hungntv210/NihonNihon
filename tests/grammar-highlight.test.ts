import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Furigana } from '../src/app/(study)/grammar/furigana.tsx';
import {
  auditGrammarHighlight,
  legacyFocusHighlights,
  resolveGrammarHighlights,
} from '../src/app/(study)/grammar/highlight.ts';
// @ts-expect-error CLI JavaScript module has no declaration file.
import { reportGrammarExerciseGapsByLevel, reportGrammarHighlights } from '../tools/report-grammar-highlight.mjs';

function markedTexts(
  pattern: string,
  japanese: string,
  furigana?: string | null,
  formationEn?: string | null,
): string[] {
  const ranges = resolveGrammarHighlights(pattern, japanese, furigana, formationEn);
  const audit = auditGrammarHighlight({ pattern, japanese, furigana, formationEn, highlights: ranges });
  assert.equal(
    audit.status,
    'ok',
    `expected ok audit for ${pattern} on ${japanese}, got ${JSON.stringify(audit)}`,
  );
  return ranges.map((r) => japanese.slice(r.start, r.end));
}

test('conjugations: te/ta/nai/polite/voicing forms', () => {
  assert.deepEqual(markedTexts('〜ている', '弟が本を読んでいます。', '{弟|おとうと}が{本|ほん}を{読|よ}んでいます。'), ['んでいます'.slice(1)]);
  assert.deepEqual(markedTexts('〜てしまう', '鍵を忘れてしまった。', '{鍵|かぎ}を{忘|わす}れてしまった。'), ['てしまった']);
  assert.deepEqual(markedTexts('〜てしまう', 'ケーキを全部食べちゃった。', 'ケーキを{全部|ぜんぶ}{食|た}べちゃった。'), ['ちゃった']);
  assert.deepEqual(markedTexts('〜ておく', '資料を机に置いておきます。', '{資料|しりょう}を{机|つくえ}に{置|お}いておきます。'), ['ておきます']);
  assert.deepEqual(markedTexts('〜ていく', 'これから人口が増えていきます。', 'これから{人口|じんこう}が{増|ふ}えていきます。'), ['ていきます']);
  assert.deepEqual(markedTexts('〜てくる', '外が急に暗くなってきました。', '{外|そと}が{急|きゅう}に{暗|くら}くなってきました。'), ['てきました']);
  assert.deepEqual(markedTexts('〜てみる', '新しいレシピを試してみます。', '{新|あたら}しいレシピを{試|ため}してみます。'), ['てみます']);
  assert.deepEqual(markedTexts('〜てから', '薬を飲んでから寝ました。', '{薬|くすり}を{飲|の}んでから{寝|ね}ました。'), ['でから']);
  assert.deepEqual(markedTexts('〜たら', '雨が止んだら出かけましょう。', '{雨|あめ}が{止|や}んだら{出|で}かけましょう。'), ['だら']);
  assert.deepEqual(markedTexts('〜て（reason）', 'このお茶は熱くて、すぐ飲めない。', 'このお{茶|ちゃ}は{熱|あつ}くて、すぐ{飲|の}めない。'), ['くて']);
  assert.deepEqual(markedTexts('〜て（reason）', '台風で電車が止まった。', '{台風|たいふう}で{電車|でんしゃ}が{止|と}まった。'), ['で']);
  assert.deepEqual(markedTexts('〜ない', '昨日はテレビを見ませんでした。', '{昨日|きのう}はテレビを{見|み}ませんでした。'), ['ませんでした']);
  assert.deepEqual(markedTexts('〜なければならない', '明日までに提出しなければなりません。', '{明日|あした}までに{提出|ていしゅつ}しなければなりません。'), ['なければなりません']);
  assert.deepEqual(markedTexts('〜てはいけない', 'ここに車を止めてはいけません。', 'ここに{車|くるま}を{止|と}めてはいけません。'), ['てはいけません']);
  assert.deepEqual(markedTexts('〜ではない / 〜じゃない', '彼は医者じゃありませんでした。', '{彼|かれ}は{医者|いしゃ}じゃありませんでした。'), ['じゃありませんでした']);
  assert.deepEqual(markedTexts('〜がほしい', '今は特に何もほしくないです。', '{今|いま}は{特|とく}に{何|なに}もほしくないです。'), ['もほしくないです']);
});

test('copula 〜だ variants including conjunctive and negative forms', () => {
  assert.deepEqual(markedTexts('〜はずだ', '荷物はもう届いているはずです。', '{荷物|にもつ}はもう{届|とど}いているはずです。'), ['はずです']);
  assert.deepEqual(markedTexts('〜はずだ', 'メモに書いたはずなのに見つからない。', 'メモに{書|か}いたはずなのに{見|み}つからない。'), ['はずなのに']);
  assert.deepEqual(markedTexts('〜ようだ', '外は寒いようで、皆コートを着ている。', '{外|そと}は{寒|さむ}いようで、{皆|みな}コートを{着|き}ている。'), ['ようで']);
  assert.deepEqual(markedTexts('〜一方だ', '利用者は増える一方だった。', '{利用者|りようしゃ}は{増|ふ}える{一方|いっぽう}だった。'), ['一方だった']);
});

test('honorifics: sonkeigo, kenjougo, o~ni naru, o/go~suru', () => {
  assert.deepEqual(
    markedTexts(
      '尊敬語',
      '先生はもう教室にいらっしゃいます。',
      '{先生|せんせい}はもう{教室|きょうしつ}にいらっしゃいます。',
      'いらっしゃる (go/come/be) / おっしゃる (say) / 召し上がる (eat/drink)',
    ),
    ['いらっしゃいます'],
  );
  assert.deepEqual(
    markedTexts(
      '謙譲語',
      '来週そちらに伺います。',
      '{来週|らいしゅう}そちらに{伺|うかが}います。',
      '伺う (visit/ask) / 申す (say) / 拝見する (look)',
    ),
    ['伺います'],
  );
  assert.deepEqual(
    markedTexts('お〜になる', '部長はもうお帰りになりました。', '{部長|ぶちょう}はもうお{帰|かえ}りになりました。'),
    ['お', 'になりました'],
  );
  assert.deepEqual(
    markedTexts('お〜する', '後ほど詳しくご案内いたします。', '{後|のち}ほど{詳|くわ}しくご{案内|あんない}いたします。'),
    ['ご', 'いたします'],
  );
});

test('multi-slot 〜 splits, reorder, counter gaps, slash branches, and optional parens', () => {
  assert.deepEqual(markedTexts('あまり〜ない', '甘い物はあまり食べません。', '{甘|あま}い{物|もの}はあまり{食|た}べません。'), ['あまり', 'ません']);
  assert.deepEqual(markedTexts('〜たり〜たりする', '休日は走ったり泳いだりします。', '{休日|きゅうじつ}は{走|はし}ったり{泳|およ}いだりします。'), ['たり', 'だりします']);
  assert.deepEqual(markedTexts('〜ば〜ほど', '練習すればするほど上達する。', '{練習|れんしゅう}すればするほど{上達|じょうたつ}する。'), ['ば', 'ほど']);
  assert.deepEqual(markedTexts('〜ば〜ほど', '環境が静かなら静かなほど集中できる。', '{環境|かんきょう}が{静|しず}かなら{静|しず}かなほど{集中|しゅうちゅう}できる。'), ['なら', 'ほど']);
  assert.deepEqual(markedTexts('〜の方が〜より', '電車の方がバスより速いです。', '{電車|でんしゃ}の{方|ほう}がバスより{速|はや}いです。'), ['の方が', 'より']);
  assert.deepEqual(markedTexts('〜の方が〜より', 'バスより電車の方が速いです。', 'バスより{電車|でんしゃ}の{方|ほう}が{速|はや}いです。'), ['より', 'の方が']);
  assert.deepEqual(markedTexts('〜ことは〜が', 'その本は読んだことは読んだけど、内容を忘れた。', 'その{本|ほん}は{読|よ}んだことは{読|よ}んだけど、{内容|ないよう}を{忘|わす}れた。'), ['ことは', 'けど']);
  assert.deepEqual(markedTexts('もう〜た', '「もう宿題を終えましたか。」「はい、もう終えました。」', '「もう{宿題|しゅくだい}を{終|お}えましたか。」「はい、もう{終|お}えました。」'), ['もう', 'ました']);
  assert.deepEqual(markedTexts('〜がある / 〜がいる', '机の上にノートがあります。', '{机|つくえ}の{上|うえ}にノートがあります。'), ['があります']);
  assert.deepEqual(markedTexts('〜がある / 〜がいる', '庭に犬が二匹います。', '{庭|にわ}に{犬|いぬ}が{二匹|にひき}います。'), ['が', 'います']);
  assert.deepEqual(markedTexts('〜をください', 'コーヒーを二杯ください。', 'コーヒーを{二杯|にはい}ください。'), ['を', 'ください']);
  assert.deepEqual(markedTexts('〜際（に）', '申請する際には身分証が必要です。', '{申請|しんせい}する{際|さい}には{身分証|みぶんしょう}が{必要|ひつよう}です。'), ['際に']);
  assert.deepEqual(markedTexts('〜とおりに / 〜どおりに', '予想したとおり、試合は接戦になった。', '{予想|よそう}したとおり、{試合|しあい}は{接戦|せっせん}になった。'), ['とおり']);
  assert.deepEqual(markedTexts('〜に行く', '友達が家に遊びに来ました。', '{友達|ともだち}が{家|いえ}に{遊|あそ}びに{来|き}ました。'), ['に来ました']);
  assert.deepEqual(markedTexts('〜ように言う / 〜ように頼む', '田中さんに遅れないように伝えてください。', '{田中|たなか}さんに{遅|おく}れないように{伝|つた}えてください。'), ['ように伝えて']);
  assert.deepEqual(
    markedTexts(
      '〜て以来',
      '開店以来、この店は常連客に愛されている。',
      '{開店|かいてん}{以来|いらい}、この{店|みせ}は{常連客|じょうれんきゃく}に{愛|あい}されている。',
      'Verb-te + 以来 / Noun + 以来',
    ),
    ['以来'],
  );
});

test('inflectional grammar specials: potential, passive, causative, volitional, imperative', () => {
  assert.deepEqual(markedTexts('〜える / 〜られる（potential）', '漢字が三百ぐらい書けます。', '{漢字|かんじ}が{三百|さんびゃく}ぐらい{書|か}けます。'), ['けます']);
  assert.deepEqual(markedTexts('〜れる / 〜られる（passive）', '部長に会議でほめられました。', '{部長|ぶちょう}に{会議|かいぎ}でほめられました。'), ['られました']);
  assert.deepEqual(markedTexts('〜せる / 〜させる', 'コーチは選手を毎日走らせた。', 'コーチは{選手|せんしゅ}を{毎日|まいにち}{走|はし}らせた。'), ['せた']);
  assert.deepEqual(markedTexts('〜せられる / 〜させられる', '子供の頃ピアノを練習させられた。', '{子供|こども}の{頃|ころ}ピアノを{練習|れんしゅう}させられた。'), ['させられた']);
  assert.deepEqual(markedTexts('〜おう / 〜よう', '少し休もう。', '{少|すこ}し{休|やす}もう。'), ['もう']);
  assert.deepEqual(markedTexts('〜え / 〜ろ', '早く起きろ！', '{早|はや}く{起|お}きろ！'), ['ろ']);
  assert.deepEqual(markedTexts('〜（よ）うと思う', '来年は資格を取ろうと思っています。', '{来年|らいねん}は{資格|しかく}を{取|と}ろうと{思|おも}っています。'), ['ろうと思っています']);
  assert.deepEqual(markedTexts('〜（よ）うではないか', 'みんなで協力して解決しようではないか。', 'みんなで{協力|きょうりょく}して{解決|かいけつ}しようではないか。'), ['ようではないか']);
});

test('ruby boundaries, compound-ruby suffix, kanji-kana furigana matching, and SSR markup', () => {
  const mae = resolveGrammarHighlights('〜前に', '出かける前に窓を閉めた。', '{出|で}かける{前|まえ}に{窓|まど}を{閉|し}めた。');
  assert.deepEqual(mae, [{ start: 4, end: 6 }]);
  const maeHtml = renderToStaticMarkup(
    createElement(Furigana, {
      japanese: '出かける前に窓を閉めた。',
      notation: '{出|で}かける{前|まえ}に{窓|まど}を{閉|し}めた。',
      highlights: mae,
    }),
  );
  assert.match(maeHtml, /<mark><ruby>前<rp>\(<\/rp><rt>まえ<\/rt><rp>\)<\/rp><\/ruby><\/mark><mark>に<\/mark>/);

  // Kanji in sentence matched via furigana reading against kana pattern
  const kotaete = resolveGrammarHighlights(
    '〜にこたえて',
    '期待に応えて結果を出した。',
    '{期待|きたい}に{応|こた}えて{結果|けっか}を{出|だ}した。',
  );
  assert.deepEqual(kotaete, [{ start: 2, end: 6 }]);

  // Single-kanji suffix inside a compound ruby unit
  const chuu = resolveGrammarHighlights(
    '〜中',
    '昨日は一日中雨が降った。',
    '{昨日|きのう}は{一日中|いちにちじゅう}{雨|あめ}が{降|ふ}った。',
  );
  assert.deepEqual(chuu, [{ start: 5, end: 6 }]);
  const chuuHtml = renderToStaticMarkup(
    createElement(Furigana, {
      japanese: '昨日は一日中雨が降った。',
      notation: '{昨日|きのう}は{一日中|いちにちじゅう}{雨|あめ}が{降|ふ}った。',
      highlights: chuu,
    }),
  );
  assert.match(chuuHtml, /<mark><ruby>一日中<rp>\(<\/rp><rt>いちにちじゅう<\/rt><rp>\)<\/rp><\/ruby><\/mark>/);
});

test('single-char and short-pattern disambiguation avoids false substring hits', () => {
  const kaRanges = resolveGrammarHighlights('〜か（question）', 'これはあなたのかばんですか。');
  assert.deepEqual(kaRanges, [{ start: 12, end: 13 }]);

  const naRanges = resolveGrammarHighlights('〜な（prohibition）', '危ないから、ここで走るな。', '{危|あぶ}ないから、ここで{走|はし}るな。');
  assert.deepEqual(naRanges, [{ start: 11, end: 12 }]);

  const taiRanges = resolveGrammarHighlights('〜たい', '冷たい水が飲みたいです。', '{冷|つめ}たい{水|みず}が{飲|の}みたいです。');
  assert.deepEqual(taiRanges, [{ start: 7, end: 11 }]);

  const niRanges = resolveGrammarHighlights('〜に（destination）', '七時に駅に着きました。', '{七時|しちじ}に{駅|えき}に{着|つ}きました。');
  assert.deepEqual(niRanges, [{ start: 4, end: 5 }]);
});

test('auditGrammarHighlight detects empty, out_of_bounds, overlapping, whole_sentence, and pattern_mismatch', () => {
  assert.equal(
    auditGrammarHighlight({ pattern: '〜ている', japanese: '本を読んでいる。', highlights: [] }).status,
    'none',
  );

  const emptyAudit = auditGrammarHighlight({
    pattern: '〜ている',
    japanese: '本を読んでいる。',
    highlights: [{ start: 4, end: 4 }],
  });
  assert.equal(emptyAudit.status, 'mismatch');
  assert.ok(emptyAudit.reasons.includes('empty'));

  const oobAudit = auditGrammarHighlight({
    pattern: '〜ている',
    japanese: '本を読んでいる。',
    highlights: [{ start: 3, end: 99 }],
  });
  assert.equal(oobAudit.status, 'mismatch');
  assert.ok(oobAudit.reasons.includes('out_of_bounds'));

  const overlapAudit = auditGrammarHighlight({
    pattern: 'あまり〜ない',
    japanese: 'あまり食べない。',
    highlights: [
      { start: 0, end: 4 },
      { start: 3, end: 7 },
    ],
  });
  assert.equal(overlapAudit.status, 'mismatch');
  assert.ok(overlapAudit.reasons.includes('overlapping'));

  const wholeAudit = auditGrammarHighlight({
    pattern: '〜ている',
    japanese: '読んでいる。',
    highlights: [{ start: 0, end: 5 }],
  });
  assert.equal(wholeAudit.status, 'mismatch');
  assert.ok(wholeAudit.reasons.includes('whole_sentence'));

  const wrongSpanAudit = auditGrammarHighlight({
    pattern: '〜ている',
    japanese: '図書館で本を読んでいます。',
    highlights: [{ start: 0, end: 3 }], // marks 図書館 instead of でいます
  });
  assert.equal(wrongSpanAudit.status, 'mismatch');
  assert.ok(wrongSpanAudit.reasons.includes('pattern_mismatch'));

  // Legacy false-positive hit on か inside かばん is flagged as pattern_mismatch
  const legacyKa = legacyFocusHighlights('〜か（question）', 'これはあなたのかばんですか。');
  assert.equal(legacyKa.length, 2);
  const legacyKaAudit = auditGrammarHighlight({
    pattern: '〜か（question）',
    japanese: 'これはあなたのかばんですか。',
    highlights: legacyKa,
  });
  assert.equal(legacyKaAudit.status, 'mismatch');
  assert.ok(legacyKaAudit.reasons.includes('pattern_mismatch'));
});

test('reportGrammarHighlights and reportGrammarExerciseGapsByLevel run read-only on synthetic DB', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`
      CREATE TABLE content_items (
        item_id TEXT PRIMARY KEY,
        source_hash TEXT,
        is_active INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE grammar (
        item_id TEXT PRIMARY KEY,
        pattern TEXT NOT NULL,
        level TEXT NOT NULL,
        formation_en TEXT
      );
      CREATE TABLE sentences (
        item_id TEXT PRIMARY KEY,
        text_ja TEXT NOT NULL,
        text_en TEXT,
        furigana_notation TEXT
      );
      CREATE TABLE item_sentences (
        item_id TEXT NOT NULL,
        sentence_id TEXT NOT NULL,
        position INTEGER NOT NULL
      );
    `);

    const insItem = db.prepare('INSERT INTO content_items (item_id, source_hash, is_active) VALUES (?, ?, 1)');
    const insGrammar = db.prepare('INSERT INTO grammar (item_id, pattern, level, formation_en) VALUES (?, ?, ?, ?)');
    const insSentence = db.prepare('INSERT INTO sentences (item_id, text_ja, text_en, furigana_notation) VALUES (?, ?, ?, ?)');
    const insLink = db.prepare('INSERT INTO item_sentences (item_id, sentence_id, position) VALUES (?, ?, ?)');

    insItem.run('g:n5:1', 'h1');
    insGrammar.run('g:n5:1', '〜ている', 'N5', 'Verb-te + いる');
    insItem.run('s:1', 'sh1');
    insSentence.run('s:1', '公園で本を読んでいます。', 'Reading a book in the park.', '{公園|こうえん}で{本|ほん}を{読|よ}んでいます。');
    insLink.run('g:n5:1', 's:1', 0);

    insItem.run('g:n4:1', 'h2');
    insGrammar.run('g:n4:1', '〜か（question）', 'N4', 'Sentence + か');
    insItem.run('s:2', 'sh2');
    insSentence.run('s:2', 'これはかばんですか。', 'Is this a bag?', null);
    insLink.run('g:n4:1', 's:2', 0);

    // Supplement adds a valid fixed highlight and an intentionally bad fixed highlight to test mismatch auditing
    const supplement = new Map([
      [
        'g:n5:1',
        {
          id: 'g:n5:1',
          hash: 'h1',
          examples: [
            {
              id: 'supp:ok',
              japanese: '窓の外を見ています。',
              furigana: '{窓|まど}の{外|そと}を{見|み}ています。',
              vietnamese: 'Đang nhìn ra ngoài cửa sổ.',
              english: 'Looking outside the window.',
              highlights: [{ start: 5, end: 9 }],
            },
          ],
        },
      ],
      [
        'g:n4:1',
        {
          id: 'g:n4:1',
          hash: 'h2',
          examples: [
            {
              id: 'supp:bad',
              japanese: '明日も晴れますか。',
              furigana: '{明日|あした}も{晴|は}れますか。',
              vietnamese: 'Ngày mai có nắng không?',
              english: 'Will it be sunny tomorrow too?',
              highlights: [{ start: 0, end: 2 }], // intentionally wrong (marks 明日)
            },
          ],
        },
      ],
    ]);

    const report = reportGrammarHighlights(db, supplement);
    assert.equal(report.legacy.ALL.examples, 4);
    assert.equal(report.legacy.N5.oldUnhighlighted, 1); // 読んでいます missed by legacy exact focus
    assert.equal(report.legacy.N4.oldMismatch, 1); // か inside かばん
    assert.equal(report.current.N5.highlighted, 2);
    assert.equal(report.current.N5.unhighlighted, 0);
    assert.equal(report.current.N4.oldHighlighted, 1);
    assert.equal(report.fixedSupplementAudit.total, 2);
    assert.equal(report.fixedSupplementAudit.ok, 1);
    assert.equal(report.fixedSupplementAudit.mismatch, 1);
    assert.equal(report.fixedSupplementAudit.mismatchIds[0].exampleId, 'supp:bad');
    const serialized = JSON.stringify(report);
    assert.ok(!serialized.includes('???????????'));
    assert.ok(!serialized.includes('????????'));

    const gaps = reportGrammarExerciseGapsByLevel(db, supplement);
    assert.equal(gaps.ALL.patterns, 2);
    assert.equal(gaps.N5.fewerThanThreeChoice, 1);
    assert.equal(gaps.N5.fewerThanThreeOrdering, 1);
  } finally {
    db.close();
  }
});

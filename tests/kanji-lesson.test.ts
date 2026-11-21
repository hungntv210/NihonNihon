import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { fixture } from './helpers.ts';
import { enqueueCard } from '../src/core/review.ts';
import type { KanjiLessonWord, LessonKanji } from '../src/app/(study)/vocab/lesson/kanji/model.ts';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('.css')) {
      return { url: 'data:text/javascript,export%20default%20%7B%7D;', shortCircuit: true };
    }
    if (specifier === 'next/navigation') {
      return {
        url: 'data:text/javascript,export%20function%20useRouter(){return{replace(){},refresh(){}};}',
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});

const {
  MAX_KANJI_LESSON_WORDS,
  isKanjiDictVn,
  safeKanjiMeaning,
  selectKanjiLessonWords,
  newLessonKanji,
} = await import('../src/app/(study)/vocab/lesson/kanji/model.ts');
const { KanjiCardBody, KanjiWordBody, KanjiCardReview, KanjiLessonDone } = await import(
  '../src/app/(study)/vocab/lesson/kanji/card-body.tsx'
);
const { KanjiLesson } = await import('../src/app/(study)/vocab/lesson/kanji/session.tsx');

function sampleWord(id: string, word: string, reading: string, level: string, vi: string | null): KanjiLessonWord {
  return {
    id,
    word,
    reading,
    level,
    english: ['sample'],
    meaning: vi
      ? {
          text: vi,
          sourceId: 'mt:test',
          sourceName: 'Synthetic',
          releaseId: 'r1',
          method: 'machine',
          model: 'synthetic-model',
          promptVersion: null,
          autoSelected: false,
        }
      : null,
    studied: false,
  };
}

function sampleKanji(character: string, words: KanjiLessonWord[]): LessonKanji {
  return {
    id: `openjlpt:kanji:${character}`,
    character,
    level: 'N5',
    strokes: 8,
    radical: '子',
    onyomi: ['ガク'],
    kunyomi: ['まな.ぶ'],
    english: ['study', 'learning'],
    meaning: {
      text: 'học, học tập',
      sourceId: 'mt:test',
      sourceName: 'OpenJLPT-VI',
      releaseId: 'r1',
      method: 'machine',
      model: 'synthetic-model',
      promptVersion: null,
      autoSelected: false,
    },
    hanViet: {
      text: 'học',
      sourceId: 'kanjidictvn',
      sourceName: 'KanjiDictVN',
      releaseId: 'r1',
      method: 'han_viet',
      model: null,
      promptVersion: null,
      autoSelected: false,
    },
    alternatives: [],
    words,
  };
}

test('selectKanjiLessonWords prioritizes same-level words containing the kanji (max 3) and rejects KanjiDictVN meanings', () => {
  assert.equal(MAX_KANJI_LESSON_WORDS, 3);
  const words = selectKanjiLessonWords(
    [
      sampleWord('v-n4', '大学', 'だいがく', 'N4', 'đại học'),
      sampleWord('v-other', '本', 'ほん', 'N5', 'sách'),
      sampleWord('v-n5-1', '学生', 'がくせい', 'N5', 'học sinh'),
      sampleWord('v-n5-1', '学生', 'がくせい', 'N5', 'học sinh'),
      sampleWord('v-n5-2', '学校', 'がっこう', 'N5', 'trường học'),
      sampleWord('v-n3', '科学', 'かがく', 'N3', 'khoa học'),
    ],
    'N5',
    '学',
  );
  assert.deepEqual(
    words.map((w) => w.word),
    ['学生', '学校', '大学'],
  );

  const kdvMeaning = {
    text: 'nghĩa Hán Việt cổ',
    sourceId: 'kanjidictvn',
    sourceName: 'KanjiDictVN',
    releaseId: 'r1',
    method: 'dictionary',
    model: null,
    promptVersion: null,
    autoSelected: false,
  };
  assert.equal(isKanjiDictVn(kdvMeaning), true);
  assert.equal(safeKanjiMeaning(kdvMeaning), null);

  const mtMeaning = {
    ...kdvMeaning,
    text: 'học tập',
    sourceId: 'mt:gemini',
    sourceName: 'Dịch từ OpenJLPT',
    method: 'machine',
  };
  assert.equal(isKanjiDictVn(mtMeaning), false);
  assert.equal(safeKanjiMeaning(mtMeaning)?.text, 'học tập');
});

test('Kanji lesson SSR renders bold Han-Viet, meaning with source label, On/Kun, strokes, related words, and handles empty related words cleanly', () => {
  const withWords = sampleKanji('学', [
    sampleWord('v1', '学生', 'がくせい', 'N5', 'học sinh, sinh viên'),
    sampleWord('v2', '学校', 'がっこう', 'N5', 'trường học'),
  ]);
  const withoutWords = {
    ...sampleKanji('日', []),
    strokes: 4,
    onyomi: ['ニチ', 'ジツ'],
    kunyomi: ['ひ'],
    hanViet: { ...sampleKanji('学', []).hanViet!, text: 'nhật' },
    meaning: { ...sampleKanji('学', []).meaning!, text: 'ngày, mặt trời' },
  };

  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    fetchCalls++;
    throw new Error('fetch must not run during render');
  }) as typeof fetch;

  try {
    const htmlWithWords = renderToStaticMarkup(
      createElement(KanjiLesson, {
        items: [
          {
            id: withWords.id,
            body: createElement(KanjiCardBody, { item: withWords }),
            words: withWords.words.map((word, index) => ({
              id: word.id,
              reading: word.reading,
              content: createElement(KanjiWordBody, { word, index }),
            })),
            review: createElement(KanjiCardReview, { item: withWords }),
          },
          {
            id: withoutWords.id,
            body: createElement(KanjiCardBody, { item: withoutWords }),
            words: [],
            review: createElement(KanjiCardReview, { item: withoutWords }),
          },
        ],
        done: createElement(KanjiLessonDone, { count: 2 }),
      }),
    );

    assert.match(htmlWithWords, /<h2[^>]*data-lesson-word=""[^>]*>学<\/h2>/);
    assert.match(htmlWithWords, /<strong[^>]*>học<\/strong>/);
    assert.match(htmlWithWords, /học, học tập/);
    assert.match(htmlWithWords, /Dịch máy · OpenJLPT-VI/);
    assert.match(htmlWithWords, /ガク/);
    assert.match(htmlWithWords, /まな\.ぶ/);
    assert.match(htmlWithWords, /8 nét/);
    assert.match(htmlWithWords, /学生/);
    assert.match(htmlWithWords, /学校/);
    assert.match(htmlWithWords, /Thêm vào ôn/);
    assert.match(htmlWithWords, /Kanji tiếp theo →/);
    assert.doesNotMatch(htmlWithWords, /Chưa có từ đi kèm trong thư viện hiện tại\./);
    assert.equal(fetchCalls, 0);

    const htmlWithoutWords = renderToStaticMarkup(
      createElement(KanjiLesson, {
        items: [
          {
            id: withoutWords.id,
            body: createElement(KanjiCardBody, { item: withoutWords }),
            words: [],
            review: createElement(KanjiCardReview, { item: withoutWords }),
          },
        ],
        done: createElement(KanjiLessonDone, { count: 1 }),
      }),
    );
    assert.match(htmlWithoutWords, /<strong[^>]*>nhật<\/strong>/);
    assert.match(htmlWithoutWords, /4 nét/);
    assert.match(htmlWithoutWords, /Chưa có từ đi kèm trong thư viện hiện tại\./);
    assert.match(htmlWithoutWords, /Kết thúc bài học/);
    assert.equal(fetchCalls, 0);

    const htmlDone = renderToStaticMarkup(createElement(KanjiLessonDone, { count: 2 }));
    assert.match(htmlDone, /href="\/vocab\/lesson"/);
    assert.match(htmlDone, /Quay về bài từ vựng/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('newLessonKanji does not write SRS on read and excludes kanji only after explicit Add-to-Review', (t) => {
  const { db, file } = fixture(t);
  const gaku = db
    .prepare("SELECT i.item_id, i.source_hash FROM content_items i JOIN kanji k USING(item_id) WHERE k.character='学'")
    .get()!;
  db.prepare(
    "INSERT INTO data_sources(source_id,name,url,license,attribution,usage_scope) VALUES('kanjidictvn','KanjiDictVN','https://example.invalid','Test','Test','private_only'),('mt:kanji-lesson','OpenJLPT-VI','https://example.invalid','Test','Test','private_only')",
  ).run();
  db.prepare(
    "INSERT INTO source_releases(release_id,source_id,version,checksum,artifact_url,retrieved_at,license,attribution,manifest_json) VALUES('kdv-rel','kanjidictvn','1',?,'local://kdv','2026-11-21','Test','Test','{}'),('mt-rel','mt:kanji-lesson','1',?,'local://mt','2026-11-21','Test','Test','{}')",
  ).run('a'.repeat(64), 'b'.repeat(64));
  db.prepare(
    "INSERT INTO vi_translations(translation_id,item_id,field,text_vi,method,source_id,release_id,source_record_key,base_content_hash,status,match_method,created_at) VALUES('hv-gaku',?,'han_viet','học','han_viet','kanjidictvn','kdv-rel','hv1',?,'selected','codepoint','2026-11-21')",
  ).run(gaku.item_id, gaku.source_hash);
  // Meaning from KanjiDictVN must be filtered out even if marked selected.
  db.prepare(
    "INSERT INTO vi_translations(translation_id,item_id,field,text_vi,method,source_id,release_id,source_record_key,base_content_hash,status,match_method,created_at) VALUES('m-kdv',?,'meaning','nghĩa không được dùng','dictionary','kanjidictvn','kdv-rel','m1',?,'selected','codepoint','2026-11-21')",
  ).run(gaku.item_id, gaku.source_hash);

  assert.equal(db.prepare('SELECT count(*) n FROM srs_cards').get()!.n, 0);
  const before = newLessonKanji(db);
  assert.equal(before.length, 4);
  // Reading the lesson must never create SRS cards automatically.
  assert.equal(db.prepare('SELECT count(*) n FROM srs_cards').get()!.n, 0);

  const gakuLesson = before.find((k) => k.character === '学')!;
  assert.equal(gakuLesson.hanViet?.text, 'học');
  assert.equal(gakuLesson.meaning, null);
  assert.deepEqual(
    gakuLesson.words.map((w) => w.word),
    ['学校', '学生'],
  );
  const dayLesson = before.find((k) => k.character === '日')!;
  assert.deepEqual(dayLesson.words, []);

  // Only explicit Add-to-Review action creates an SRS card for that kanji.
  const added = enqueueCard(file, String(gaku.item_id), 'recognition');
  assert.equal(added.created, true);
  assert.equal(db.prepare('SELECT count(*) n FROM srs_cards').get()!.n, 1);

  const after = newLessonKanji(db);
  assert.equal(after.length, 3);
  assert.equal(after.some((k) => k.character === '学'), false);
});

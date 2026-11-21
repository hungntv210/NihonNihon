import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { fixture } from './helpers.ts';
import type { Example } from '../src/app/(study)/vocab/data.ts';
import type { LessonWord } from '../src/app/(study)/vocab/lesson/model.ts';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('.css')) {
      return { url: 'data:text/javascript,export%20default%20%7B%7D;', shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const { MAX_LESSON_EXAMPLES, selectLessonExamples, newLessonVocabulary } = await import(
  '../src/app/(study)/vocab/lesson/model.ts'
);
const {
  EMPTY_EXAMPLE_PROGRESS,
  getExampleStepStatus,
  startExamplePlayback,
  finishExamplePlayback,
  stopExamplePlayback,
  markExampleRead,
  getExampleAudioState,
} = await import('../src/app/(study)/vocab/lesson/state.ts');
const { LessonExampleBody, LessonWordHead, LessonWordMeaning } = await import(
  '../src/app/(study)/vocab/lesson/example-body.tsx'
);
const { Lesson } = await import('../src/app/(study)/vocab/lesson/session.tsx');

function sampleExample(id: string, japanese: string, furigana: string | null, vi: string | null): Example {
  return {
    id,
    japanese,
    english: 'Sample English.',
    furigana,
    translation: vi
      ? {
          text: vi,
          method: 'tatoeba',
          sourceId: 'tatoeba',
          sourceName: 'Tatoeba',
          releaseId: 'r1',
          model: null,
          promptVersion: null,
          autoSelected: false,
        }
      : null,
    translationId: vi ? `tr-${id}` : null,
  };
}

function sampleWord(id = 'vocab-1', examples: Example[] = []): LessonWord {
  return {
    id,
    word: '学生',
    reading: 'がくせい',
    romaji: 'gakusei',
    level: 'N5',
    english: ['student'],
    pos: ['noun'],
    meaning: {
      text: 'Học sinh, sinh viên',
      method: 'dictionary',
      sourceId: 'dict',
      sourceName: 'Từ điển',
      releaseId: 'r1',
      model: null,
      promptVersion: null,
      autoSelected: false,
    },
    meaningId: 'm-1',
    hanViet: null,
    hanVietId: null,
    sourceName: 'OpenJLPT',
    queued: false,
    otherReadings: [],
    examples: selectLessonExamples(examples),
  };
}

test('selectLessonExamples handles 0, 1, 2, and >2 examples and parses furigana safely', () => {
  assert.equal(MAX_LESSON_EXAMPLES, 2);
  assert.deepEqual(selectLessonExamples([]), []);

  const e1 = sampleExample('s1', '私は学生です。', '{私|わたし}は{学生|がくせい}です。', 'Tôi là sinh viên.');
  const e2 = sampleExample('s2', '学生がいます。', null, 'Có sinh viên.');
  const e3 = sampleExample('s3', '新しい学生です。', '{別|べつ}です。', 'Là sinh viên mới.');

  const one = selectLessonExamples([e1]);
  assert.equal(one.length, 1);
  assert.deepEqual(one[0].segments, [
    { text: '私', reading: 'わたし' },
    { text: 'は' },
    { text: '学生', reading: 'がくせい' },
    { text: 'です。' },
  ]);

  const two = selectLessonExamples([e1, e2]);
  assert.equal(two.length, 2);
  assert.deepEqual(two[1].segments, [{ text: '学生がいます。' }]);

  const capped = selectLessonExamples([e1, e1, { ...e2, id: 'blank', japanese: '   ' }, e2, e3]);
  assert.deepEqual(
    capped.map((e) => e.id),
    ['s1', 's2'],
  );

  const mismatched = selectLessonExamples([e3]);
  assert.deepEqual(mismatched[0].segments, [{ text: '新しい学生です。' }]);
});

test('newLessonVocabulary loads 1-2 examples from existing detail tables and preserves missing-example words', (t) => {
  const { db, itemId } = fixture(t);
  const word = db.prepare('SELECT * FROM content_items WHERE item_id=?').get(itemId)!;
  const sentences = db
    .prepare('SELECT s.*, i.source_hash FROM sentences s JOIN content_items i USING(item_id) ORDER BY s.item_id')
    .all();
  assert.ok(sentences.length >= 2);

  for (let i = 0; i < Math.min(3, sentences.length); i++) {
    const s = sentences[i];
    db.prepare(
      "INSERT INTO item_sentences(item_id,sentence_id,position,source_id,release_id) VALUES(?,?,?,'openjlpt',?)",
    ).run(itemId, s.item_id, i, word.release_id);
  }
  db.prepare(
    "INSERT INTO vi_translations(translation_id,item_id,field,text_vi,method,source_id,release_id,source_record_key,base_content_hash,status,match_method,created_at) VALUES('lesson-ex-vi',?,'text','Tôi là sinh viên.','tatoeba','openjlpt',?,'k1',?,'selected','tatoeba_link','2026-11-21')",
  ).run(sentences[0].item_id, word.release_id, sentences[0].source_hash);

  const items = newLessonVocabulary(db);
  assert.ok(items.length > 0);
  const target = items.find((w) => w.id === itemId);
  assert.ok(target);
  assert.equal(target.examples.length, 2);
  assert.equal(target.examples[0].translation?.text, 'Tôi là sinh viên.');
  assert.ok(target.examples[0].segments.length > 0);

  const withoutExamples = items.find((w) => w.id !== itemId);
  assert.ok(withoutExamples);
  assert.deepEqual(withoutExamples.examples, []);
});

test('example audio and read-aloud state machine transitions cleanly across listen, replay, and Đã đọc', () => {
  const ids = ['ex1', 'ex2'];
  let state = EMPTY_EXAMPLE_PROGRESS;

  assert.equal(getExampleStepStatus(state, 'ex1'), 'idle');
  assert.deepEqual(getExampleAudioState(state, 'ex1'), {
    status: 'idle',
    primaryLabel: 'Nghe câu',
    showReplayButton: false,
    showReadAloudPrompt: false,
    isReadDone: false,
  });

  state = startExamplePlayback(state, 'ex1');
  assert.deepEqual(getExampleAudioState(state, 'ex1'), {
    status: 'playing',
    primaryLabel: 'Dừng đọc',
    showReplayButton: true,
    showReadAloudPrompt: false,
    isReadDone: false,
  });

  // Stopping early returns to idle without unlocking read-aloud prompt.
  const stopped = stopExamplePlayback(state);
  assert.equal(getExampleStepStatus(stopped, 'ex1'), 'idle');
  assert.equal(getExampleAudioState(stopped, 'ex1').showReadAloudPrompt, false);

  // Finishing playback shows replay and read-aloud prompt with "Đã đọc".
  state = finishExamplePlayback(state, 'ex1');
  assert.deepEqual(getExampleAudioState(state, 'ex1'), {
    status: 'read-aloud',
    primaryLabel: 'Phát lại',
    showReplayButton: false,
    showReadAloudPrompt: true,
    isReadDone: false,
  });

  // Marking first example read advances to remaining example without finishing the whole card.
  const step1 = markExampleRead(state, 'ex1', ids);
  state = step1.progress;
  assert.equal(step1.allRead, false);
  assert.equal(step1.nextExampleId, 'ex2');
  assert.deepEqual(getExampleAudioState(state, 'ex1'), {
    status: 'done',
    primaryLabel: 'Phát lại',
    showReplayButton: false,
    showReadAloudPrompt: false,
    isReadDone: true,
  });

  // Replaying an already-read example keeps done status after playback ends.
  state = startExamplePlayback(state, 'ex1');
  assert.equal(getExampleStepStatus(state, 'ex1'), 'playing');
  state = finishExamplePlayback(state, 'ex1');
  assert.equal(getExampleStepStatus(state, 'ex1'), 'done');

  // Finishing and reading the second example completes the card's read-aloud step.
  state = finishExamplePlayback(startExamplePlayback(state, 'ex2'), 'ex2');
  const step2 = markExampleRead(state, 'ex2', ids);
  assert.equal(step2.allRead, true);
  assert.equal(step2.nextExampleId, null);
  assert.equal(getExampleStepStatus(step2.progress, 'ex2'), 'done');
});

test('lesson card renders examples with furigana + Vietnamese meaning and handles missing examples without error', () => {
  const wordWithExamples = sampleWord('vocab-1', [
    sampleExample('ex1', '私は学生です。', '{私|わたし}は{学生|がくせい}です。', 'Tôi là sinh viên.'),
  ]);

  const htmlWithExamples = renderToStaticMarkup(
    createElement(Lesson, {
      items: [
        {
          id: wordWithExamples.id,
          reading: wordWithExamples.reading,
          head: createElement(LessonWordHead, { item: wordWithExamples }),
          meaning: createElement(LessonWordMeaning, { item: wordWithExamples }),
          examples: wordWithExamples.examples.map((example, index) => ({
            id: example.id,
            japanese: example.japanese,
            content: createElement(LessonExampleBody, {
              itemId: wordWithExamples.id,
              sourceName: wordWithExamples.sourceName,
              example,
              index,
            }),
          })),
        },
      ],
    }),
  );
  assert.match(htmlWithExamples, /Nghe phát âm/);
  assert.match(htmlWithExamples, /Câu ví dụ/);
  assert.match(htmlWithExamples, /<ruby>私<rp>（<\/rp><rt>わたし<\/rt><rp>）<\/rp><\/ruby>/);
  assert.match(htmlWithExamples, /Tôi là sinh viên\./);
  assert.match(htmlWithExamples, /Nghe câu/);
  assert.match(htmlWithExamples, /Mở nghĩa/);
  assert.doesNotMatch(htmlWithExamples, /Chưa có câu ví dụ/);

  const wordWithoutExamples = sampleWord('vocab-2', []);
  const htmlWithoutExamples = renderToStaticMarkup(
    createElement(Lesson, {
      items: [
        {
          id: wordWithoutExamples.id,
          reading: wordWithoutExamples.reading,
          head: createElement(LessonWordHead, { item: wordWithoutExamples }),
          meaning: createElement(LessonWordMeaning, { item: wordWithoutExamples }),
          examples: [],
        },
      ],
    }),
  );
  assert.match(htmlWithoutExamples, /Nghe phát âm/);
  assert.match(htmlWithoutExamples, /Chưa có câu ví dụ/);
  assert.doesNotMatch(htmlWithoutExamples, /Nghe câu/);
  assert.match(htmlWithoutExamples, /Mở nghĩa/);
});

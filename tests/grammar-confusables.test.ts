import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { fixture } from './helpers.ts';
import { openContentDatabase } from '../src/core/content.ts';
import { getGrammar, grammarHref } from '../src/app/(study)/grammar/repository.ts';
import {
  extractContrastEntries,
  extractViContrastSentence,
  type ActiveGrammarNoteRow,
} from '../src/app/(study)/grammar/confusables.ts';

let activeTestDbPath: string | null = null;

(globalThis as { __grammarConfusableCreateElement?: typeof createElement }).__grammarConfusableCreateElement =
  createElement;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('.css')) {
      return {
        url: 'data:text/javascript,export%20default%20new%20Proxy(%7B%7D,%7Bget:(_,k)=>String(k)%7D);',
        shortCircuit: true,
      };
    }
    if (specifier === 'next/link') {
      return {
        url: 'data:text/javascript,export%20default%20function%20Link(%7Bhref,children,...rest%7D)%7Breturn%20globalThis.__grammarConfusableCreateElement(%22a%22,%7Bhref,...rest%7D,children);%7D',
        shortCircuit: true,
      };
    }
    if (specifier === 'next/navigation') {
      return {
        url: 'data:text/javascript,export%20function%20notFound()%7Bthrow%20new%20Error(%22NEXT_NOT_FOUND%22);%7Dexport%20function%20useRouter()%7Breturn%7Breplace()%7B%7D,refresh()%7B%7D%7D;%7D',
        shortCircuit: true,
      };
    }
    if (specifier === 'server-only') {
      return {
        url: 'data:text/javascript,export%20%7B%7D;',
        shortCircuit: true,
      };
    }
    if (specifier.endsWith('/server/dal.ts')) {
      return {
        url: 'data:text/javascript,export%20async%20function%20withContentDatabase(fn)%7Breturn%20globalThis.__grammarConfusableTestQuery(fn);%7Dexport%20async%20function%20addToReview()%7Breturn%20null;%7D',
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});

(globalThis as { __grammarConfusableTestQuery?: <T>(fn: (db: DatabaseSync) => T) => T }).__grammarConfusableTestQuery =
  (fn) => {
    assert.ok(activeTestDbPath, 'test DB path must be set before rendering page');
    const db = openContentDatabase(activeTestDbPath);
    try {
      return fn(db);
    } finally {
      db.close();
    }
  };

const { default: GrammarDetailPage } = await import(
  '../src/app/(study)/grammar/[id]/page.tsx'
);

function seedConfusableFixtures(db: DatabaseSync) {
  const source = db
    .prepare("SELECT release_id, source_hash FROM content_items WHERE item_id='openjlpt:grammar:wa'")
    .get()! as { release_id: string; source_hash: string };

  const insertItem = db.prepare(
    "INSERT INTO content_items(item_id,kind,source_id,source_key,release_id,source_hash) VALUES(?,'grammar','openjlpt',?,?,?)",
  );
  const insertGrammar = db.prepare(
    "INSERT INTO grammar(item_id,pattern,romaji,level,meaning_en,formation_en,notes_en,tags) VALUES(?,?,?,?,?,?,?,'[]')",
  );

  const items = [
    {
      id: 'openjlpt:grammar:kanenai',
      key: 'kanenai',
      pattern: '〜かねない',
      romaji: '~kanenai',
      level: 'N2',
      meaning: 'might; there is a risk that',
      formation: 'Verb-masu stem + かねない',
      notes: "Always expresses an undesirable possibility. Don't confuse with 〜かねる (cannot).",
      notesVi: 'Luôn diễn tả khả năng không mong muốn. Không nhầm lẫn với 〜かねる (không thể).',
    },
    {
      id: 'openjlpt:grammar:kaneru',
      key: 'kaneru',
      pattern: '〜かねる',
      romaji: '~kaneru',
      level: 'N2',
      meaning: 'cannot; hesitate to',
      formation: 'Verb-masu stem + かねる',
      notes: 'Polite refusal or inability.',
      notesVi: 'Cách từ chối hoặc diễn tả sự không thể một cách lịch sự.',
    },
    {
      id: 'openjlpt:grammar:osore-ga-aru',
      key: 'osore-ga-aru',
      pattern: '〜おそれがある',
      romaji: '~osore ga aru',
      level: 'N2',
      meaning: 'there is a danger/fear that',
      formation: 'Verb-dict / Noun + の + おそれがある',
      notes: "Formal and objective (news, warnings). 〜かねない sounds more like the speaker's own judgment.",
      notesVi: 'Trang trọng và khách quan (tin tức, cảnh báo). 〜かねない nghe mang tính phán đoán của người nói hơn.',
    },
    {
      id: 'openjlpt:grammar:cooccur-only',
      key: 'cooccur-only',
      pattern: '〜ばかりだ',
      romaji: '~bakari da',
      level: 'N3',
      meaning: 'only getting worse',
      formation: 'Verb-dict + ばかりだ',
      notes: 'Often with 〜かねる or change verbs. Also compares with 〜存在しないパターン which is not in DB.',
      notesVi: null,
    },
  ];

  db.prepare(
    "INSERT INTO data_sources(source_id,name,url,license,attribution,usage_scope) VALUES('mt:synthetic','Synthetic MT','https://example.invalid','Synthetic','Synthetic','private_only')",
  ).run();
  db.prepare(
    "INSERT INTO source_releases(release_id,source_id,version,checksum,artifact_url,retrieved_at,license,attribution,manifest_json) VALUES('syn-rel','mt:synthetic','1',?,'local://syn','2026-11-10','Synthetic','Synthetic',?)",
  ).run('a'.repeat(64), JSON.stringify({ model: 'synthetic-model', prompt_version: 'test-1' }));

  const insertVi = db.prepare(
    "INSERT INTO vi_translations(translation_id,item_id,field,text_vi,method,source_id,release_id,source_record_key,base_content_hash,status,match_method,created_at) VALUES(?,?,'notes',?,'machine','mt:synthetic','syn-rel',?,?, 'selected','machine_context','2026-11-10')",
  );

  for (const item of items) {
    insertItem.run(item.id, item.key, source.release_id, source.source_hash);
    insertGrammar.run(
      item.id,
      item.pattern,
      item.romaji,
      item.level,
      item.meaning,
      item.formation,
      item.notes,
    );
    if (item.notesVi) {
      insertVi.run('vi-' + item.key, item.id, item.notesVi, item.key, source.source_hash);
    }
  }
}

test('grammar detail renders "Dễ nhầm với" block with exact links, single VI+EN sentence, and provenance', async (t) => {
  const { db, file } = fixture(t);
  seedConfusableFixtures(db);

  const item = getGrammar(db, 'openjlpt:grammar:kanenai')!;
  assert.equal(item.confusables.length, 2);

  // Outgoing entry first (〜かねる), incoming entry second (〜おそれがある)
  assert.equal(item.confusables[0].targetId, 'openjlpt:grammar:kaneru');
  assert.equal(item.confusables[0].direction, 'outgoing');
  assert.equal(item.confusables[0].href, '/grammar/openjlpt%3Agrammar%3Akaneru');
  assert.equal(item.confusables[0].noteEn, "Don't confuse with 〜かねる (cannot).");
  assert.equal(item.confusables[0].noteVi?.text, 'Không nhầm lẫn với 〜かねる (không thể).');

  assert.equal(item.confusables[1].targetId, 'openjlpt:grammar:osore-ga-aru');
  assert.equal(item.confusables[1].direction, 'incoming');
  assert.equal(item.confusables[1].href, '/grammar/openjlpt%3Agrammar%3Aosore-ga-aru');
  assert.equal(
    item.confusables[1].noteEn,
    "〜かねない sounds more like the speaker's own judgment.",
  );
  assert.equal(
    item.confusables[1].noteVi?.text,
    '〜かねない nghe mang tính phán đoán của người nói hơn.',
  );

  activeTestDbPath = file;
  const html = renderToStaticMarkup(
    await GrammarDetailPage({
      params: Promise.resolve({ id: encodeURIComponent('openjlpt:grammar:kanenai') }),
    }),
  );

  assert.ok(html.includes('id="confusables-title">Dễ nhầm với</h2>'));
  assert.ok(html.includes('href="/grammar/openjlpt%3Agrammar%3Akaneru"'));
  assert.ok(html.includes('href="/grammar/openjlpt%3Agrammar%3Aosore-ga-aru"'));
  assert.ok(html.includes('Không nhầm lẫn với 〜かねる (không thể).'));
  assert.ok(html.includes('〜かねない nghe mang tính phán đoán của người nói hơn.'));
  assert.ok(html.includes('Dịch máy · Synthetic MT · synthetic-model'));
  assert.ok(html.includes('Bản gốc: OpenJLPT'));
});

test('inactive or broken confusable targets are hidden and empty confusables omit the section', async (t) => {
  const { db, file } = fixture(t);
  seedConfusableFixtures(db);

  // Deactivate 〜かねる -> only 〜おそれがある remains on 〜かねない
  db.prepare("UPDATE content_items SET is_active=0 WHERE item_id='openjlpt:grammar:kaneru'").run();
  const partial = getGrammar(db, 'openjlpt:grammar:kanenai')!;
  assert.deepEqual(
    partial.confusables.map((c) => c.targetId),
    ['openjlpt:grammar:osore-ga-aru'],
  );

  activeTestDbPath = file;
  const partialHtml = renderToStaticMarkup(
    await GrammarDetailPage({
      params: Promise.resolve({ id: encodeURIComponent('openjlpt:grammar:kanenai') }),
    }),
  );
  assert.ok(partialHtml.includes('id="confusables-title">Dễ nhầm với</h2>'));
  assert.ok(!partialHtml.includes('openjlpt%3Agrammar%3Akaneru'));
  assert.ok(partialHtml.includes('href="/grammar/openjlpt%3Agrammar%3Aosore-ga-aru"'));

  // Deactivate 〜おそれがある too -> entire "Dễ nhầm với" block disappears
  db.prepare(
    "UPDATE content_items SET is_active=0 WHERE item_id='openjlpt:grammar:osore-ga-aru'",
  ).run();
  assert.equal(getGrammar(db, 'openjlpt:grammar:kanenai')!.confusables.length, 0);

  const emptyHtml = renderToStaticMarkup(
    await GrammarDetailPage({
      params: Promise.resolve({ id: encodeURIComponent('openjlpt:grammar:kanenai') }),
    }),
  );
  assert.ok(!emptyHtml.includes('Dễ nhầm với'));
  assert.ok(!emptyHtml.includes('confusables-title'));
});

test('patterns without confusable contrast notes omit the "Dễ nhầm với" block', async (t) => {
  const { db, file } = fixture(t);
  seedConfusableFixtures(db);

  // Standard demo pattern (〜は) and co-occurrence / broken-citation pattern (〜ばかりだ)
  assert.equal(getGrammar(db, 'openjlpt:grammar:wa')!.confusables.length, 0);
  assert.equal(getGrammar(db, 'openjlpt:grammar:cooccur-only')!.confusables.length, 0);

  activeTestDbPath = file;
  const waHtml = renderToStaticMarkup(
    await GrammarDetailPage({
      params: Promise.resolve({ id: encodeURIComponent('openjlpt:grammar:wa') }),
    }),
  );
  assert.ok(!waHtml.includes('Dễ nhầm với'));

  const cooccurHtml = renderToStaticMarkup(
    await GrammarDetailPage({
      params: Promise.resolve({ id: encodeURIComponent('openjlpt:grammar:cooccur-only') }),
    }),
  );
  assert.ok(!cooccurHtml.includes('Dễ nhầm với'));
  assert.ok(!cooccurHtml.includes('confusables-title'));
  assert.ok(!cooccurHtml.includes('href="/grammar/openjlpt%3Agrammar%3Akaneru"'));
});

test('extractContrastEntries skips co-occurrence notes and ambiguous forms while preserving contrast pairs', () => {
  const rows: ActiveGrammarNoteRow[] = [
    {
      id: 'g:a',
      pattern: '〜づらい',
      level: 'N3',
      notesEn: "〜にくい (N4) is more objective, describing a thing's nature. Formal N2: 〜がたい.",
      sourceName: 'OpenJLPT',
    },
    {
      id: 'g:b',
      pattern: '〜やすい / 〜にくい',
      level: 'N4',
      notesEn: 'Often with 〜がたい in lists.',
      sourceName: 'OpenJLPT',
    },
    {
      id: 'g:c',
      pattern: '〜がたい',
      level: 'N2',
      notesEn: 'Unlike 〜にくい, not for physical difficulty.',
      sourceName: 'OpenJLPT',
    },
    {
      id: 'g:dup1',
      pattern: '〜から（reason）',
      level: 'N5',
      notesEn: null,
      sourceName: 'OpenJLPT',
    },
    {
      id: 'g:dup2',
      pattern: '〜から（from）',
      level: 'N5',
      notesEn: null,
      sourceName: 'OpenJLPT',
    },
    {
      id: 'g:ambig',
      pattern: '〜ので',
      level: 'N4',
      notesEn: 'More polite than 〜から.',
      sourceName: 'OpenJLPT',
    },
  ];

  const entries = extractContrastEntries(rows);
  assert.deepEqual(
    entries.map((e) => `${e.sourceId}->${e.targetId}`),
    ['g:a->g:b', 'g:a->g:c', 'g:c->g:b'],
  );
  // Ambiguous 〜から (shared by g:dup1 and g:dup2) must NOT produce a broken/wrong link
  assert.ok(!entries.some((e) => e.sourceId === 'g:ambig'));
  // Co-occurrence note ("Often with 〜がたい") must NOT be treated as confusable
  assert.ok(!entries.some((e) => e.sourceId === 'g:b'));

  // Exact single-sentence Vietnamese extraction
  assert.equal(
    extractViContrastSentence(
      'Câu giải thích chung. Khác với 〜にくい, không dùng cho thể chất.',
      '〜にくい',
      '〜やすい / 〜にくい',
    ),
    'Khác với 〜にくい, không dùng cho thể chất.',
  );
  assert.equal(extractViContrastSentence(null, '〜にくい', '〜やすい / 〜にくい'), null);
  assert.equal(grammarHref('openjlpt:grammar:kaneru'), '/grammar/openjlpt%3Agrammar%3Akaneru');
});

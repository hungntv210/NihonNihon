import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { registerHooks } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { fixture } from './helpers.ts';
import { openContentDatabase } from '../src/core/content.ts';
import {
  getGrammar,
  grammarClipHref,
  grammarHref,
} from '../src/app/(study)/grammar/repository.ts';
import { decodeGrammarRouteId } from '../src/app/(study)/grammar/route-id.ts';
import { seedPrivateClipFixture } from '../src/app/(study)/shadowing/private-fixture.ts';
import { listShadowingClips } from '../src/app/(study)/shadowing/clips.ts';
import { resolveShadowingSelection } from '../src/app/(study)/shadowing/query.ts';

let activeTestDbPath: string | null = null;

(
  globalThis as { __grammarTicksCreateElement?: typeof createElement }
).__grammarTicksCreateElement = createElement;

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
        url: 'data:text/javascript,export%20default%20function%20Link(%7Bhref,children,...rest%7D)%7Breturn%20globalThis.__grammarTicksCreateElement(%22a%22,%7Bhref,...rest%7D,children);%7D',
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
        url: 'data:text/javascript,export%20async%20function%20withContentDatabase(fn)%7Breturn%20globalThis.__grammarTicksTestQuery(fn);%7Dexport%20async%20function%20addToReview()%7Breturn%20null;%7D',
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});

(
  globalThis as { __grammarTicksTestQuery?: <T>(fn: (db: DatabaseSync) => T) => T }
).__grammarTicksTestQuery = (fn) => {
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

function decodeHtmlAttr(raw: string): string {
  return raw.replaceAll('&amp;', '&');
}

function extractShadowingHrefs(html: string): string[] {
  const hrefs: string[] = [];
  for (const match of html.matchAll(/href="(\/shadowing\?[^"]+)"/g)) {
    hrefs.push(decodeHtmlAttr(match[1]));
  }
  return hrefs;
}

function extractSectionHrefs(html: string, labelledBy: string): string[] {
  const sectionMatch = html.match(
    new RegExp(`<section[^>]*aria-labelledby="${labelledBy}"[^>]*>([\\s\\S]*?)<\\/section>`),
  );
  if (!sectionMatch) return [];
  const hrefs: string[] = [];
  for (const match of sectionMatch[1].matchAll(/href="([^"]+)"/g)) {
    hrefs.push(decodeHtmlAttr(match[1]));
  }
  return hrefs;
}

function linkClipSegmentsToGrammar(
  db: DatabaseSync,
  grammarItemId: string,
  clipId: string,
  positions: readonly number[],
  releaseId: string,
) {
  const insert = db.prepare(
    `INSERT INTO item_sentences(item_id,sentence_id,position,source_id,release_id)
     VALUES(?,?,?,'user-media',?)`,
  );
  for (const [idx, pos] of positions.entries()) {
    const row = db
      .prepare('SELECT sentence_id FROM clip_segments WHERE clip_id=? AND position=?')
      .get(clipId, pos) as { sentence_id: string } | undefined;
    assert.ok(row, `clip_segment must exist at position ${pos}`);
    insert.run(grammarItemId, row.sentence_id, 100 + idx, releaseId);
  }
}

test('confusable notes only emit links to existing active grammar IDs and round-trip via route decoding', async (t) => {
  const { db, file } = fixture(t);
  const source = db
    .prepare("SELECT release_id, source_hash FROM content_items WHERE item_id='openjlpt:grammar:wa'")
    .get()! as { release_id: string; source_hash: string };

  const insertItem = db.prepare(
    "INSERT INTO content_items(item_id,kind,source_id,source_key,release_id,source_hash,is_active) VALUES(?,'grammar','openjlpt',?,?,?,?)",
  );
  const insertGrammar = db.prepare(
    "INSERT INTO grammar(item_id,pattern,romaji,level,meaning_en,formation_en,notes_en,tags) VALUES(?,?,?,?,?,?,?,'[]')",
  );

  const records = [
    {
      id: 'openjlpt:grammar:te-oku',
      key: 'te-oku',
      pattern: '〜ておく',
      romaji: '~te oku',
      level: 'N4',
      meaning: 'do something in advance',
      formation: 'Verb-te + おく',
      notes:
        'Unlike 〜てある (resulting state) and 〜てみる (try doing), this emphasizes advance preparation. Do not confuse with 〜存在しない.',
      active: 1,
    },
    {
      id: 'openjlpt:grammar:te-aru',
      key: 'te-aru',
      pattern: '〜てある',
      romaji: '~te aru',
      level: 'N4',
      meaning: 'is in a resulting state from an action',
      formation: 'Verb-te + ある',
      notes: 'Compare with 〜ている; 〜てある implies intentional prior action.',
      active: 1,
    },
    {
      id: 'openjlpt:grammar:te-miru',
      key: 'te-miru',
      pattern: '〜てみる',
      romaji: '~te miru',
      level: 'N4',
      meaning: 'try doing',
      formation: 'Verb-te + みる',
      notes: 'Inactive target must never receive a link.',
      active: 0,
    },
  ];

  for (const r of records) {
    insertItem.run(r.id, r.key, source.release_id, source.source_hash, r.active);
    insertGrammar.run(r.id, r.pattern, r.romaji, r.level, r.meaning, r.formation, r.notes);
  }

  const activeRows = db
    .prepare(
      'SELECT g.item_id id FROM grammar g JOIN content_items i USING(item_id) WHERE i.is_active=1',
    )
    .all() as { id: string }[];
  const activeIds = new Set(activeRows.map((r) => r.id));

  let totalLinks = 0;
  for (const { id } of activeRows) {
    const detail = getGrammar(db, id);
    assert.ok(detail, `active grammar ${id} must load`);
    for (const c of detail.confusables) {
      totalLinks++;
      assert.notEqual(c.targetId, id, 'confusable link must not self-link');
      assert.ok(activeIds.has(c.targetId), `target ${c.targetId} must be active`);
      assert.equal(c.href, grammarHref(c.targetId));
      const encodedSegment = c.href.slice('/grammar/'.length);
      const decodedId = decodeGrammarRouteId(encodedSegment);
      assert.equal(decodedId, c.targetId);
      assert.equal(getGrammar(db, decodedId!)?.id, c.targetId);
    }
  }
  assert.equal(totalLinks, 2, 'symmetric active pair te-oku <-> te-aru produces 2 valid links');

  const teOku = getGrammar(db, 'openjlpt:grammar:te-oku')!;
  assert.deepEqual(
    teOku.confusables.map((c) => c.targetId),
    ['openjlpt:grammar:te-aru'],
  );

  activeTestDbPath = file;
  const html = renderToStaticMarkup(
    await GrammarDetailPage({
      params: Promise.resolve({ id: encodeURIComponent('openjlpt:grammar:te-oku') }),
    }),
  );
  assert.deepEqual(extractSectionHrefs(html, 'confusables-title'), [
    '/grammar/openjlpt%3Agrammar%3Ate-aru',
  ]);
});

test('grammar detail clip links open the exact clip and segment via resolveShadowingSelection', async (t) => {
  const { db, file } = fixture(t);
  const directory = path.dirname(file);
  const seeded = seedPrivateClipFixture(file, directory);
  const linkedPositions = [0, 1, 5];
  linkClipSegmentsToGrammar(db, 'openjlpt:grammar:wa', seeded.id, linkedPositions, seeded.release);

  const item = getGrammar(db, 'openjlpt:grammar:wa')!;
  assert.deepEqual(
    item.clips,
    linkedPositions.map((position) => ({ id: seeded.id, position })),
  );

  activeTestDbPath = file;
  const html = renderToStaticMarkup(
    await GrammarDetailPage({
      params: Promise.resolve({ id: encodeURIComponent('openjlpt:grammar:wa') }),
    }),
  );
  assert.ok(html.includes('Câu này trong clip của bạn'));

  const renderedHrefs = extractShadowingHrefs(html);
  assert.deepEqual(
    renderedHrefs,
    linkedPositions.map((position) => grammarClipHref(seeded.id, position)),
  );

  const clips = listShadowingClips(file, path.join(directory, 'no-youtube.json'));
  const targetClip = clips.find((c) => c.id === seeded.id);
  assert.ok(targetClip, 'seeded private clip must be listed on /shadowing');

  for (const [idx, href] of renderedHrefs.entries()) {
    const expectedPos = linkedPositions[idx];
    const url = new URL(href, 'http://localhost');
    assert.equal(url.pathname, '/shadowing');
    const resolved = resolveShadowingSelection(clips, {
      clip: url.searchParams.get('clip') ?? undefined,
      segment: url.searchParams.get('segment') ?? undefined,
    });
    assert.equal(resolved.clipId, seeded.id);
    assert.equal(
      resolved.segmentIndex,
      expectedPos,
      `href ${href} must open 0-based segmentIndex ${expectedPos}, not off-by-one`,
    );
    assert.equal(
      targetClip.segments[resolved.segmentIndex].ja,
      seeded.metadata.segments[expectedPos].ja,
    );
  }
});

test('inactive clip, inactive clip sentence, missing video asset, and deleted clip produce no link', async (t) => {
  const { db, file } = fixture(t);
  const directory = path.dirname(file);
  const seeded = seedPrivateClipFixture(file, directory);
  linkClipSegmentsToGrammar(db, 'openjlpt:grammar:wa', seeded.id, [1, 3], seeded.release);
  assert.equal(getGrammar(db, 'openjlpt:grammar:wa')!.clips.length, 2);

  // 1. Deactivating one linked clip sentence removes only that sentence link
  const sentenceAt1 = (
    db
      .prepare('SELECT sentence_id FROM clip_segments WHERE clip_id=? AND position=1')
      .get(seeded.id) as { sentence_id: string }
  ).sentence_id;
  db.prepare('UPDATE content_items SET is_active=0 WHERE item_id=?').run(sentenceAt1);
  assert.deepEqual(getGrammar(db, 'openjlpt:grammar:wa')!.clips, [{ id: seeded.id, position: 3 }]);
  db.prepare('UPDATE content_items SET is_active=1 WHERE item_id=?').run(sentenceAt1);
  assert.equal(getGrammar(db, 'openjlpt:grammar:wa')!.clips.length, 2);

  // 2. Deactivating the clip itself removes all links and hides the clip section
  db.prepare('UPDATE content_items SET is_active=0 WHERE item_id=?').run(seeded.id);
  assert.deepEqual(getGrammar(db, 'openjlpt:grammar:wa')!.clips, []);

  activeTestDbPath = file;
  const inactiveHtml = renderToStaticMarkup(
    await GrammarDetailPage({
      params: Promise.resolve({ id: encodeURIComponent('openjlpt:grammar:wa') }),
    }),
  );
  assert.ok(!inactiveHtml.includes('Câu này trong clip của bạn'));
  assert.ok(!inactiveHtml.includes('/shadowing?clip='));

  // Re-activate clip, then delete its video media_asset -> no link (shadowing cannot load it)
  db.prepare('UPDATE content_items SET is_active=1 WHERE item_id=?').run(seeded.id);
  assert.equal(getGrammar(db, 'openjlpt:grammar:wa')!.clips.length, 2);
  db.prepare("DELETE FROM media_assets WHERE item_id=? AND asset_kind='video'").run(seeded.id);
  assert.deepEqual(getGrammar(db, 'openjlpt:grammar:wa')!.clips, []);

  // 3. Fully deleting clip_segments and clip content_items row -> no link
  db.prepare('DELETE FROM clip_segments WHERE clip_id=?').run(seeded.id);
  db.prepare('DELETE FROM content_items WHERE item_id=?').run(seeded.id);
  assert.deepEqual(getGrammar(db, 'openjlpt:grammar:wa')!.clips, []);

  const deletedHtml = renderToStaticMarkup(
    await GrammarDetailPage({
      params: Promise.resolve({ id: encodeURIComponent('openjlpt:grammar:wa') }),
    }),
  );
  assert.ok(!deletedHtml.includes('Câu này trong clip của bạn'));
  assert.ok(!deletedHtml.includes('/shadowing?clip='));
});

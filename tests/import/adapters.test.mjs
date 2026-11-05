import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.mjs';
import {loadArtifacts} from '../../tools/data/core.mjs';
import {parseArtifacts,xml} from '../../tools/data/adapters.mjs';
import {runImport} from '../../tools/data/import.mjs';
import {selectBatch} from '../../tools/data/cohort.mjs';

test('XML external entities are rejected and SVG labels are not parsed as strokes',async t=>{
  assert.throws(()=>xml('<!DOCTYPE x [<!ENTITY x SYSTEM "file:///private">]><x>&x;</x>'),/External XML/);
  const f=fixture(t);f.write('strokes.svg','<svg><path id="label" d="M0 0"/><path id="kvg:065e5-s1" d="M1 1 L2 2"/></svg>');f.save();
  const d=parseArtifacts(await loadArtifacts(f.manifestPath));assert.equal(d.strokes.length,1);
  f.write('strokes.svg','<svg><path id="kvg:065e5-s1" d="javascript:alert(1)"/></svg>');f.save();await assert.rejects(async()=>parseArtifacts(await loadArtifacts(f.manifestPath)),/Unsafe SVG/);
});
test('malformed KanjiDictVN tuples fail; many readings use field 1, never the meanings field',async t=>{
  const f=fixture(t);f.write('hv.json',[['日','nhựt nhật','','',['[x] must not become a reading'],{}]]);f.save();
  const d=parseArtifacts(await loadArtifacts(f.manifestPath));assert.equal(d.hv.get('日')[0].raw,'nhựt nhật');
  f.write('hv.json',[['日','a','','',[]]]);f.save();
  await assert.rejects(async()=>parseArtifacts(await loadArtifacts(f.manifestPath)),/six-field/);
});
test('Tatoeba uses only direct Japanese/Vietnamese links and retains author provenance',async t=>{
  const f=fixture(t);f.vocab[0].examples=[{ja:'日です。',en:'Synthetic sentence.',tatoeba_id:1}];f.grammar[0].examples=f.vocab[0].examples;
  f.write('vocab.json',f.vocab);f.write('grammar.json',f.grammar);
  f.source('tatoeba','tatoeba-details','sentences.tsv','1\tjpn\t日です。\tJapaneseAuthor\n2\tvie\tCâu tiếng Việt trực tiếp.\tVietnameseAuthor\n3\teng\tBridge.\tEnglishAuthor\n4\tvie\tKhông chọn qua cầu nối.\tOtherAuthor\n');
  f.source('tatoeba','tatoeba-links','links.tsv','1\t2\n1\t3\n3\t4\n');f.save();await runImport(f);
  const db=f.open(),row=db.prepare("SELECT * FROM vi_translations WHERE item_id='tatoeba:sentence:1'").get();
  assert.equal(row.text_vi,'Câu tiếng Việt trực tiếp.');assert.equal(JSON.parse(row.context_json).author,'VietnameseAuthor');
  assert.equal(db.prepare("SELECT count(*) n FROM vi_translations WHERE text_vi='Không chọn qua cầu nối.'").get().n,0);
});
test('curated cohort has exact quotas and mandatory multi-reading kanji; no random sampling',()=>{
  const vocab=['N5','N2'].flatMap((level,j)=>Array.from({length:j?25:90},(_,i)=>({id:`${j}${i.toString().padStart(9,'0')}`,word:i===0?'かな':i===1?'カナ':'試'+i,reading:'かな',level,meanings:['test'],examples:i?[]:[{}]})));
  const chars=[...new Set([...Array.from('大行長働日人生子'),...Array.from({length:70},(_,i)=>String.fromCodePoint(0x4e00+i))])];
  const datasets={vocab,kanji:chars.map(character=>({character})),grammar:Array.from({length:30},(_,i)=>({id:'g'+i,pattern:'〜'+'試'.repeat(i+1)}))};
  const a=selectBatch(datasets),b=selectBatch(datasets);
  assert.deepEqual(a,b);assert.equal(a.cohort.vocab_ids.filter(id=>id[0]==='0').length,80);assert.equal(a.cohort.vocab_ids.filter(id=>id[0]==='1').length,20);
  assert.equal(a.cohort.kanji_characters.length,50);assert.equal(a.cohort.grammar_ids.length,20);assert.ok(a.cohort.kanji_characters.includes('働'));
});

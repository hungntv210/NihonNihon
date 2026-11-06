import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { fixture } from '../../../../tests/helpers.ts';
import { getGrammar,listGrammar,fold } from './repository.ts';
import { choiceQuestions,orderingQuestions,correctOrder,focusOf } from './practice.ts';
import { rubySegments,Furigana } from './furigana.tsx';
import { saveGrammarReport } from './report-repository.ts';

test('grammar listing searches Japanese/romaji/English, filters levels, clamps pages and resists SQL payloads',t=>{
  const {db}=fixture(t);assert.equal(listGrammar(db).total,3);assert.equal(listGrammar(db,{q:'subject'}).total,1);assert.equal(listGrammar(db,{q:'〜は'}).items[0].id,'openjlpt:grammar:wa');assert.equal(listGrammar(db,{level:'N2'}).total,0);assert.equal(listGrammar(db,{level:'garbage',page:'-1'}).page,1);assert.equal(listGrammar(db,{q:"' OR 1=1 --"}).total,0);
  const source=db.prepare("SELECT * FROM content_items WHERE item_id='openjlpt:grammar:wa'").get()!;
  for(let i=0;i<20;i++){const id='openjlpt:grammar:synthetic-'+i;db.prepare("INSERT INTO content_items(item_id,kind,source_id,source_key,release_id,source_hash) VALUES(?,'grammar','openjlpt',?,?,?)").run(id,'synthetic-'+i,source.release_id,source.source_hash);db.prepare("INSERT INTO grammar(item_id,pattern,romaji,level,meaning_en,formation_en,tags) VALUES(?,?,'test','N4','Synthetic fixture','Synthetic fixture','[]')").run(id,'Synthetic '+i);}
  const result=listGrammar(db,{page:'9999'});assert.equal(result.total,23);assert.equal(result.page,2);assert.equal(result.items.length,11);db.prepare("UPDATE content_items SET is_active=0 WHERE item_id='openjlpt:grammar:wa'").run();assert.equal(listGrammar(db).total,22);
  assert.equal(fold('ĐỘNG ngữ pháp'),'dong ngu phap');assert.equal(fold('が'), 'が');assert.notEqual(fold('が'),fold('か'));
});
test('grammar detail joins ordered public examples, real related tags and returns no fabricated translations or clips',t=>{
  const {db}=fixture(t),item=getGrammar(db,'wa')!;assert.equal(item.pattern,'〜は');assert.equal(item.examples.length,3);assert.equal(item.examples[0].japanese,'私は学生です。');assert.equal(item.meaningVi,null);assert.equal(item.formationVi,null);assert.equal(item.notesVi,null);assert.equal(item.clips.length,0);assert.equal(item.related.length,2);assert.equal(getGrammar(db,'missing'),null);assert.equal(getGrammar(db,"' OR 1=1 --"),null);
});
test('choice practice uses the original marker only when unambiguous and does not change source sentences',t=>{
  const {db}=fixture(t),item=getGrammar(db,'wa')!,questions=choiceQuestions(item.pattern,item.examples,['〜が（subject）','〜を']);assert.equal(questions.length,3);assert.ok(questions.every(q=>q.choices.length===3&&q.choices.includes(q.answer)&&q.sentence.includes('＿＿')));assert.equal(questions[0].original,'私は学生です。');assert.equal(focusOf('〜が（subject）'),'が');assert.equal(focusOf('N + だ'),null);
  assert.equal(choiceQuestions(item.pattern,[{...item.examples[0],japanese:'私は学生ではありません。'}],['〜が','〜を']).length,0);assert.equal(choiceQuestions(item.pattern,item.examples,['〜が']).length,0);assert.equal(item.examples[0].japanese,'私は学生です。');
});
test('four-piece ordering reconstructs exact Japanese including punctuation and rejects duplicate or missing pieces',t=>{
  const {db}=fixture(t),item=getGrammar(db,'wa')!,questions=orderingQuestions(item.examples);assert.equal(questions.length,3);for(const q of questions){assert.equal(q.pieces.length,4);assert.ok(correctOrder(q,[0,1,2,3]));assert.ok(!correctOrder(q,[0,0,2,3]));assert.ok(!correctOrder(q,[0,1,2]));assert.ok(!correctOrder(q,[0,1,2,7]));assert.ok(!q.pieces.every((p,i)=>p.id===i));}
  assert.equal(orderingQuestions([{...item.examples[0],japanese:'はい。'}]).length,0);
});
test('furigana validates the source reconstruction and React escapes every source string',()=>{
  assert.deepEqual(rubySegments('私は学生です。','{私|わたし}は{学生|がくせい}です。').map(p=>p.text),['私','は','学生','です。']);assert.deepEqual(rubySegments('私です。','{偽物|にせもの}です。'),[{text:'私です。'}]);const html=renderToStaticMarkup(createElement(Furigana,{japanese:'<script>は',notation:null,focus:'は'}));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('<mark>は</mark>'));
});
test('selected grammar translations carry model and reports only accept fresh selected translations in this grammar',t=>{
  const {db,file}=fixture(t),grammar='openjlpt:grammar:wa',hash=String(db.prepare('SELECT source_hash FROM content_items WHERE item_id=?').get(grammar)!.source_hash);
  db.prepare("INSERT INTO data_sources(source_id,name,url,license,attribution,usage_scope) VALUES('mt:synthetic','Synthetic provider','https://example.invalid','Synthetic test','Synthetic test','private_only')").run();db.prepare("INSERT INTO source_releases(release_id,source_id,version,checksum,artifact_url,retrieved_at,license,attribution,manifest_json) VALUES('synthetic-release','mt:synthetic','1',?,'local://synthetic','2026-11-06','Synthetic test','Synthetic test',?)").run('b'.repeat(64),JSON.stringify({model:'synthetic-model',prompt_version:'test-1'}));
  const insert=db.prepare("INSERT INTO vi_translations(translation_id,item_id,field,text_vi,method,source_id,release_id,source_record_key,base_content_hash,status,match_method,created_at) VALUES(?,?,'meaning',?,'machine','mt:synthetic','synthetic-release',?,?,?,'machine_context','2026-11-06')");insert.run('candidate',grammar,'Không được hiện','candidate',hash,'candidate');assert.equal(listGrammar(db,{q:'khong duoc hien'}).total,0);
  insert.run('selected',grammar,'Chủ đề câu','selected',hash,'selected');const item=getGrammar(db,'wa')!;assert.equal(item.meaningVi!.model,'synthetic-model');assert.equal(item.meaningVi!.id,'selected');assert.equal(listGrammar(db,{q:'chu de cau'}).total,1);
  const first=saveGrammarReport(file,{grammarId:grammar,translationId:'selected',reason:'Nghĩa cần kiểm tra'}),second=saveGrammarReport(file,{grammarId:grammar,translationId:'selected',reason:'Nghĩa cần kiểm tra'.normalize('NFD')});assert.ok(first.created);assert.ok(!second.created);assert.equal(first.reportId,second.reportId);assert.equal(db.prepare('SELECT count(*) n FROM translation_reports').get()!.n,1);assert.equal(db.prepare("SELECT status FROM vi_translations WHERE translation_id='selected'").get()!.status,'selected');assert.throws(()=>saveGrammarReport(file,{grammarId:'openjlpt:grammar:o',translationId:'selected',reason:'Sai ngữ cảnh'}),/NOT_FOUND/);assert.throws(()=>saveGrammarReport(file,{grammarId:grammar,translationId:'candidate',reason:'Sai bản chọn'}),/NOT_FOUND/);
  db.prepare("UPDATE vi_translations SET needs_refresh=1 WHERE translation_id='selected'").run();assert.equal(getGrammar(db,'wa')!.meaningVi,null);assert.throws(()=>saveGrammarReport(file,{grammarId:grammar,translationId:'selected',reason:'Bản cũ'}),/NOT_FOUND/);assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
});

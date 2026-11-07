import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from '../../../../tests/helpers.ts';
import { searchContent,normalize,detailHref,reportQueue,progressData } from './repository.ts';
test('common search normalizes Vietnamese, kana, romaji and safely encodes canonical routes',t=>{
 const {db,itemId}=fixture(t);
 for(const q of ['学生','がくせい','ガクセイ','gakusei','student'])assert.ok(searchContent(db,q).items.some(i=>i.id===itemId),q);
 assert.equal(normalize('ĐẠI HỌC'.normalize('NFD')),normalize('dai hoc'));
 assert.notEqual(normalize('が'),normalize('か'));
 assert.equal(searchContent(db,"' OR 1=1--").total,0);
 assert.equal(searchContent(db,'%').total,0);
 assert.equal(detailHref('kanji','private:id','学'),'/kanji/%E5%AD%A6');
 assert.equal(detailHref('grammar','x/y%?#','title'),'/grammar/x%2Fy%25%3F%23');
 assert.equal(searchContent(db,'',-1).page,1);
});
test('selected Hán Việt and provenance search exclude stale/candidate/inactive values; queue retains real report flags',t=>{
 const {db,itemId}=fixture(t),i=db.prepare('SELECT * FROM content_items WHERE item_id=?').get(itemId)!;
 db.prepare("INSERT INTO vi_translations(translation_id,item_id,field,text_vi,method,source_id,release_id,source_record_key,base_content_hash,status,match_method,created_at) VALUES('common-test',?,'han_viet','Học sinh đại học','han_viet','openjlpt',?,'synthetic',?,'selected','codepoint','2026-11-07')").run(itemId,i.release_id,i.source_hash);
 assert.equal(searchContent(db,'hoc sinh dai hoc').items[0].hanViet!.sourceId,'openjlpt');
 assert.equal(searchContent(db,'học sinh đại học'.normalize('NFD')).total,1);
 db.prepare("INSERT INTO translation_reports VALUES('common-report','common-test','Cần xem lại','2026-11-07','open')").run();
 const queue=reportQueue(db);assert.equal(queue.length,1);assert.equal(queue[0].reason,'Cần xem lại');assert.equal(queue[0].model,null);
 for(const status of ['candidate','needs_review','rejected']){db.prepare("UPDATE vi_translations SET status=? WHERE translation_id='common-test'").run(status);assert.equal(searchContent(db,'hoc sinh dai hoc').total,0);}
 db.prepare("UPDATE vi_translations SET status='selected',needs_refresh=1 WHERE translation_id='common-test'").run();assert.equal(searchContent(db,'hoc sinh dai hoc').total,0);assert.ok(reportQueue(db)[0].stale);
 db.prepare("UPDATE vi_translations SET needs_refresh=0 WHERE translation_id='common-test'").run();db.prepare('UPDATE content_items SET is_active=0 WHERE item_id=?').run(itemId);assert.equal(searchContent(db,'hoc sinh dai hoc').total,0);
});
test('progress counts actual review events and distinct coverage in configured local dates',t=>{
 const {db,itemId}=fixture(t);
 db.prepare("INSERT INTO srs_cards VALUES('common-card',?,'recognition','{}','synthetic','2026-11-07','2026-11-07')").run(itemId);
 for(const id of ['one','two'])db.prepare("INSERT INTO srs_reviews VALUES(?,'common-card',3,'2026-11-06T18:00:00Z',100,'synthetic')").run(id);
 const result=progressData(db,'Asia/Ho_Chi_Minh',new Date('2026-11-07T12:00:00Z'));
 assert.equal(result.totalReviews,2);assert.equal(result.days.at(-1)!.count,2);assert.equal(result.coverage.find(r=>r.kind==='vocab')!.reviewed,1);assert.equal(result.due,1);
});

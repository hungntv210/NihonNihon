import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.mjs';
import {runImport} from '../../tools/data/import.mjs';

test('translation repair fills missing meanings without changing content, links, progress or accepted translations',async t=>{
 const f=fixture(t);await runImport(f);f.answerRequests();await runImport(f);
 const db=f.open(),snapshot=table=>db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all();
 db.exec("INSERT INTO srs_cards VALUES ('card','openjlpt:vocab:1111111111','recall','{}','test','2026-11-10','2026-11-10')");
 const tables=['content_items','item_sentences','kanji','kanji_strokes','srs_cards'],before=tables.map(snapshot),sources=snapshot('data_sources'),accepted=snapshot('vi_translations');
 f.source('bunchaway-javi','javi-csv','vi.csv','日,nghĩa mới\n');f.save();
 const scope={itemIds:['openjlpt:vocab:1111111111'],fields:['meaning'],onlyMissing:true};
 await runImport({...f,translationScope:scope,takeBackup:false});
 assert.deepEqual(snapshot('vi_translations'),accepted);
 // Simulate a genuinely missing translation, then repair through the same import path.
 db.prepare("DELETE FROM vi_translations WHERE item_id=? AND field='meaning'").run(scope.itemIds[0]);
 await runImport({...f,translationScope:scope,takeBackup:false});
 assert.equal(db.prepare("SELECT text_vi FROM vi_translations WHERE item_id=? AND field='meaning' AND status='selected'").get(scope.itemIds[0]).text_vi,'nghĩa mới');
 for(let i=0;i<tables.length;i++)assert.deepEqual(snapshot(tables[i]),before[i]);
 for(const source of sources)assert.deepEqual(db.prepare('SELECT * FROM data_sources WHERE source_id=?').get(source.source_id),source);
 assert.deepEqual(snapshot('vi_translations').filter(r=>r.item_id!==scope.itemIds[0]||r.field!=='meaning'),accepted.filter(r=>r.item_id!==scope.itemIds[0]||r.field!=='meaning'));
 f.vocab[0].meanings=['changed source'];f.write('vocab.json',f.vocab);f.save();
 await assert.rejects(()=>runImport({...f,translationScope:scope,takeBackup:false}),/Repair source hash mismatch/);
});

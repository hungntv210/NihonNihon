import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.mjs';
import {runImport} from '../../tools/data/import.mjs';
import {createPreviewServer} from '../../tools/data/preview.mjs';

test('loopback inspector reads imported data, supports lookup/reporting, and rejects foreign origins',async t=>{
  const f=fixture(t);await runImport(f);
  const server=createPreviewServer({dbPath:f.dbPath});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin=`http://127.0.0.1:${server.address().port}`;
  try {
    const items=await(await fetch(origin+'/api/items?kind=kanji')).json();assert.equal(items[0].label,'日');
    const detail=await(await fetch(origin+'/api/detail?id='+encodeURIComponent(items[0].item_id))).json();
    const primary=detail.translations.find(r=>r.field==='han_viet'&&r.status==='selected');assert.equal(primary.text_vi,'nhật');assert.equal(primary.method,'han_viet');
    assert.equal((await(await fetch(origin+'/api/lookup?text='+encodeURIComponent('日'))).json()).length,1);
    assert.equal((await(await fetch(origin+'/api/report')).json()).acceptance_status,'NOT_RUN');
    const body=JSON.stringify({translation_id:primary.translation_id,reason:'Báo sai thử nghiệm'});
    const denied=await fetch(origin+'/api/report-error',{method:'POST',headers:{origin:'https://example.invalid','Content-Type':'application/json'},body});assert.equal(denied.status,403);
    const accepted=await fetch(origin+'/api/report-error',{method:'POST',headers:{origin,'Content-Type':'application/json'},body});assert.equal(accepted.status,201);
    assert.equal((await fetch(origin+'/../package.json')).status,404);
    const db=f.open();assert.equal(db.prepare('SELECT translation_id FROM translation_reports').get().translation_id,primary.translation_id);
  } finally {await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});

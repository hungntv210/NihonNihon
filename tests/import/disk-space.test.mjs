import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fixture} from './helpers.mjs';
import {hash} from '../../tools/data/core.mjs';
import {assertDiskSpace,MIN_FREE_BYTES} from '../../tools/data/disk-space.mjs';
import {ensureDailyCampaignSnapshot} from '../../tools/data/campaign-review.mjs';
import {importCampaign,runCampaign} from '../../tools/data/translation-campaign.mjs';
import {runImport} from '../../tools/data/import.mjs';
const low=stage=>assertDiskSpace(stage,{getFreeBytes:()=>MIN_FREE_BYTES-1});

test('disk gate enforces below5GB and accepts the exact threshold',()=>{
 assert.equal(assertDiskSpace('import',{getFreeBytes:()=>MIN_FREE_BYTES}),MIN_FREE_BYTES);
 assert.throws(()=>low('snapshot'),e=>e.code==='disk_low'&&e.stage==='snapshot'&&e.free_bytes===MIN_FREE_BYTES-1);
 assert.throws(()=>assertDiskSpace('import',{getFreeBytes:()=>NaN}),/determine/);
});
test('low disk starts no snapshot and no campaign import, preserving DB bytes',async t=>{
 const f=fixture(t);await runImport(f);const before=hash(fs.readFileSync(f.dbPath)),root=f.dir+'/no-snapshot';
 await assert.rejects(()=>ensureDailyCampaignSnapshot(root,f.dbPath,Date.now(),low),e=>e.code==='disk_low');assert.ok(!fs.existsSync(root));
 await assert.rejects(()=>importCampaign({directory:f.dir+'/no-import',dbPath:f.dbPath,checkDisk:low}),e=>e.code==='disk_low');assert.ok(!fs.existsSync(f.dir+'/no-import'));
 assert.equal(hash(fs.readFileSync(f.dbPath)),before);
});
test('late import disk check prevents transaction writes if space drops while planning',async t=>{
 const f=fixture(t);await runImport(f);const before=hash(fs.readFileSync(f.dbPath));
 await assert.rejects(()=>runImport({...f,beforeApply:()=>low('import')}),e=>e.code==='disk_low');assert.equal(hash(fs.readFileSync(f.dbPath)),before);
});
test('worker persists disk_low and releases its lock before loading any translation profile',async t=>{
 const f=fixture(t),root=f.dir+'/campaign',config=f.dir+'/campaign-config.json';fs.writeFileSync(config,JSON.stringify({directory:root}));
 const state=await runCampaign(config,{checkDisk:low});assert.equal(state.status,'disk_low');assert.equal(state.disk_low.stage,'import');assert.equal(JSON.parse(fs.readFileSync(root+'/status.json')).status,'disk_low');assert.ok(!fs.existsSync(root+'/campaign.lock'));assert.ok(!fs.existsSync(root+'/backups'));
});

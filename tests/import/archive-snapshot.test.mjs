import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fixture} from './helpers.mjs';
import {runImport} from '../../tools/data/import.mjs';
import {copyVerifiedSnapshot,archiveFirstSnapshot} from '../../tools/data/archive-snapshot.mjs';
import {ensureDailyCampaignSnapshot} from '../../tools/data/campaign-review.mjs';

test('verified archive preserves first snapshot off-project and daily retention keeps only latest local snapshot',async t=>{
 const f=fixture(t);await runImport(f);const root=f.dir+'/campaign',day=Date.parse('2026-11-09T08:00:00Z');
 const first=await ensureDailyCampaignSnapshot(root,f.dbPath,day),archived=await archiveFirstSnapshot({directory:root,source:first.path,destinationDirectory:f.dir+'/external'});
 assert.equal(archived.source_removed,true);assert.equal(archived.integrity,'ok');assert.ok(fs.existsSync(archived.destination));assert.ok(!fs.existsSync(first.path));assert.match(fs.readFileSync(archived.destination+'.sha256','utf8'),new RegExp(archived.sha256));
 assert.equal((await ensureDailyCampaignSnapshot(root,f.dbPath,day)).path,archived.destination);
 await ensureDailyCampaignSnapshot(root,f.dbPath,day+86400000);const last=await ensureDailyCampaignSnapshot(root,f.dbPath,day+2*86400000);
 assert.deepEqual(fs.readdirSync(root+'/backups'),[path.basename(last.path)]);assert.ok(fs.existsSync(archived.destination));
 const deleted=fs.readFileSync(root+'/backup-deletions.jsonl','utf8').trim().split('\n').map(line=>JSON.parse(line));assert.ok(deleted.some(r=>r.file===first.path&&r.archive===archived.destination&&r.sha256===archived.sha256));
});

test('archive refuses differing existing destination and leaves source intact',async t=>{
 const f=fixture(t);await runImport(f);fs.mkdirSync(f.dir+'/external');fs.writeFileSync(f.dir+'/external/'+path.basename(f.dbPath),'different');
 await assert.rejects(()=>copyVerifiedSnapshot(f.dbPath,f.dir+'/external'),/differs/);assert.ok(fs.existsSync(f.dbPath));assert.equal(fs.readFileSync(f.dir+'/external/'+path.basename(f.dbPath),'utf8'),'different');
});

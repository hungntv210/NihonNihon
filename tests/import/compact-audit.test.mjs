import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {fixture} from './helpers.mjs';
import {runImport} from '../../tools/data/import.mjs';
import {compactKanjiVGAudit} from '../../tools/data/compact-audit.mjs';

test('audit compaction verifies a full backup, deletes only duplicate KanjiVG runs and keeps all other data',async t=>{
 const f=fixture(t);await runImport(f);let db=new DatabaseSync(f.dbPath);const original=db.prepare("SELECT * FROM import_runs WHERE source_id='kanjivg'").get();assert.ok(original);
 const insert=db.prepare('INSERT INTO import_runs VALUES (?,?,?,?,?,?,?)');for(let i=0;i<2;i++)insert.run('duplicate-'+i,original.source_id,original.release_id,original.started_at,original.finished_at,original.status,original.report_json);db.close();
 const report=await compactKanjiVGAudit({dbPath:f.dbPath,backupDirectory:f.dir+'/safe-copy',reportPath:f.dir+'/compact-report.json'});
 assert.equal(report.status,'COMPLETE');assert.equal(report.deletions.length,2);assert.equal(report.after.kanjivg_audit_rows,1);assert.equal(report.after.non_audit_data_unchanged,true);assert.ok(fs.existsSync(report.backup.path));
 db=new DatabaseSync(report.backup.path,{readOnly:true});assert.equal(db.prepare("SELECT count(*) n FROM import_runs WHERE source_id='kanjivg'").get().n,3);db.close();
});

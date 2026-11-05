import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {hash} from '../../tools/data/core.mjs';

export function fixture(t) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'nihon-import-'));
  const databases=[];
  t.after(()=>{for(const db of databases){try{db.close();}catch{}}assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('nihon-import-'));fs.rmSync(dir,{recursive:true,force:true,maxRetries:3,retryDelay:100});});
  const manifest={version:1,profile:'synthetic-test',expected_counts:{vocab:1,kanji:1,grammar:1,clips:0},sources:[],mt:{source_id:'mt:test',model:'synthetic',prompt_version:'1',prompt_sha256:'a'.repeat(64),max_attempts:2}};
  const descriptors=new Map();
  function source(source_id,format,name,body,extra={}) {
    let s=manifest.sources.find(s=>s.source_id===source_id);
    if(!s) {s={source_id,name:source_id,url:'https://example.invalid/'+source_id,license:'synthetic-test-only',version:'1',attribution:'Original synthetic test fixture',usage_scope:['kanjidictvn','user-media'].includes(source_id)?'private_only':'redistributable',files:[]};manifest.sources.push(s);}
    const file={path:name,format,...extra};s.files.push(file);descriptors.set(name,file);
    write(name,body);return file;
  }
  function write(name,body) {
    const bytes=Buffer.from(typeof body==='string'?body:JSON.stringify(body));fs.writeFileSync(path.join(dir,name),bytes);
    if(descriptors.has(name))descriptors.get(name).sha256=hash(bytes);
  }
  const vocab=[{id:'1111111111',word:'日',reading:'ひ',romaji:'hi',meanings:['synthetic day'],level:'N5',examples:[{ja:'日です。',en:'Synthetic sentence.'}]}];
  const kanji=[{character:'日',level:'N5',strokes:4,grade:1,freq:1,radical:'日',radical_number:72,onyomi:['ニチ'],kunyomi:['ひ'],meanings:['synthetic day'],words:['日']}];
  const grammar=[{id:'te-mo-ii',pattern:'〜てもいい',romaji:'te mo ii',level:'N5',meaning:'synthetic permission',formation:'Verb-te + もいい',tags:['permission'],examples:[{ja:'日です。',en:'Synthetic sentence.'}]}];
  source('openjlpt','openjlpt-vocab','vocab.json',vocab,{level:'N5'});
  source('openjlpt','openjlpt-kanji','kanji.json',kanji,{level:'N5'});
  source('openjlpt','openjlpt-grammar','grammar.json',grammar,{level:'N5'});
  source('kanjidictvn','kanjidictvn','hv.json',[['日','nhựt nhật','','',[],{}]]);
  source('kanjivg','kanjivg','strokes.svg','<svg><g>'+Array.from({length:4},(_,i)=>`<path id="kvg:065e5-s${i+1}" d="M1 1 L2 2"/>`).join('')+'</g></svg>');
  source('mt:test','mt-results','mt.json',[]);
  const manifestPath=path.join(dir,'manifest.json'),dbPath=path.join(dir,'batch.sqlite'),reportPath=path.join(dir,'report.json'),requestsPath=path.join(dir,'requests.json');
  const save=()=>write('manifest.json',manifest);save();
  function answerRequests() {
    const requests=JSON.parse(fs.readFileSync(requestsPath,'utf8')).requests;
    write('mt.json',requests.map(r=>({request_id:r.request_id,output:{text_vi:'nghĩa tiếng Việt thử nghiệm'.normalize('NFD')}})));save();return requests.length;
  }
  const track=db=>{databases.push(db);return db;};
  const open=()=>track(new DatabaseSync(dbPath));
  return {dir,manifest,source,write,save,vocab,kanji,grammar,manifestPath,dbPath,reportPath,requestsPath,answerRequests,open,track};
}

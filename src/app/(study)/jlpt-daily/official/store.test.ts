import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {approvedItems,score,saveResult,lastResults,type Item} from './store.ts';

test('private approval binds the exact bank; repeated form submission creates a single independent result',()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'nihon-official-'));
  try{
    const q:Item={id:'N5V-1',level:'N5',section:'V',number:1,page:1,key:3,asset:'N5V-1.png',target:'架空語'};
    const bytes=JSON.stringify([q]);
    writeFileSync(path.join(dir,'bank.json'),bytes);
    assert.deepEqual(approvedItems(dir),[]);
    writeFileSync(path.join(dir,'approval.json'),JSON.stringify({enabled:true,reviewer:'fixture',sha256:createHash('sha256').update(bytes).digest('hex')}));
    assert.deepEqual(approvedItems(dir),[q]);
    const form=new FormData();
    assert.throws(()=>score([q],form));
    form.set(q.id,'1');
    const target=path.join(dir,'results'),token=randomUUID();
    saveResult([q],form,token,[],target);
    saveResult([q],form,token,[],target);
    assert.equal(lastResults(target).length,1);
    assert.equal(lastResults(target)[0].answers[0].correct,false);
    writeFileSync(path.join(dir,'bank.json'),bytes+' ');
    assert.deepEqual(approvedItems(dir),[]);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

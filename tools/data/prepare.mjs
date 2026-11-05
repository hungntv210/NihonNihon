import fs from 'node:fs';
import path from 'node:path';
import { args,hash,need,privateWrite } from './core.mjs';
import {selectBatch} from './cohort.mjs';

try {
  const a=args(['openjlpt','out','levels','batch']);
  need(a.openjlpt&&a.out,'Usage: --openjlpt PATH_TO_CHECKOUT --out data/private/manifest.json [--levels N5,N4,N3,N2]');
  need(!fs.existsSync(a.out),'Refusing to overwrite an existing manifest');
  const root=path.resolve(a.openjlpt),meta=JSON.parse(fs.readFileSync(path.join(root,'data/json/meta.json'),'utf8'));
  const levels=(a.levels || 'N5,N4,N3,N2').split(',');need(levels.every(l=>/^N[1-5]$/.test(l))&&new Set(levels).size===levels.length,'Invalid/duplicate levels');
  const files=[],datasets={vocab:[],kanji:[],grammar:[]};
  for(const kind of ['vocab','kanji','grammar'])for(const level of levels) {
    const file=path.join(root,`data/json/${kind}/${level.toLowerCase()}.json`);
    files.push({path:file,format:`openjlpt-${kind}`,level,sha256:hash(fs.readFileSync(file))});
    datasets[kind].push(...JSON.parse(fs.readFileSync(file,'utf8')));
  }
  privateWrite(a.out,JSON.stringify({version:1,profile:a.batch?'g0-batch':'custom',...(a.batch?selectBatch(datasets):{}),sources:[{source_id:'openjlpt',name:'OpenJLPT',url:'https://github.com/evanclan/OpenJLPT',license:meta.license,version:meta.version,attribution:'OpenJLPT contributors; JMdict/KANJIDIC2 (EDRDG); Jonathan Waller; Tatoeba. See upstream NOTICE.md.',usage_scope:'redistributable',files}]},null,2)+'\n');
  console.log('Manifest created. Add the explicit batch cohort and supplementary source files before acceptance testing.');
}catch(error){console.error(error.message);process.exitCode=1;}

import test from 'node:test';import assert from 'node:assert/strict';import {kanjiMeaningIssues} from '../../tools/data/kanji-meaning-qa.mjs';
import {createMT} from '../../tools/data/han-viet.mjs';import {sha} from '../../tools/data/core.mjs';
test('task-specific profiles take precedence over generic learning for importer requests',()=>{
 const source={source_id:'mt:test',license:'test',attribution:'test'},make=route=>({source_id:source.source_id,model:'test',prompt_version:'test',prompt_sha256:'a'.repeat(64),config:{route}}),configs=['learning','han_viet','meaning'].map(make),mt=createMT({manifest:{mt_profiles:configs,sources:[source]},artifacts:[]},{responses:[]});
 mt.ask('han_viet',{character:'自'},()=>{});mt.ask('translate',{item_id:'kanji',field:'meaning'},()=>{});
 const requests=[...mt.requests.values()];assert.equal(requests[0].mt_release_id,'mt:test:config:'+sha(configs[1]).slice(0,32));assert.equal(requests[1].mt_release_id,'mt:test:config:'+sha(configs[2]).slice(0,32));
});
test('meaning QA rejects readings across accents/case and requires min(English meanings,3) distinct comma-separated senses',()=>{
 for(const [character,reading]of [['自','tự'],['京','kinh'],['方','phương'],['会','hội'],['発','phát'],['立','lập'],['場','trường']])assert.ok(kanjiMeaningIssues({text_vi:reading.toUpperCase().normalize('NFD')},{character,field:'meaning',meanings_en:['one']},[{reading}]).includes('han_viet_as_meaning'));
 const input={character:'自',field:'meaning',meanings_en:['oneself','self','own','personal']};
 assert.match(kanjiMeaningIssues({text_vi:'bản thân'},input,[]).join(';'),/expected >=3, got 1/);
 assert.match(kanjiMeaningIssues({text_vi:'bản thân, BẢN THÂN, ban than'},input,[]).join(';'),/got 1/);
 assert.deepEqual(kanjiMeaningIssues({text_vi:'bản thân, chính mình, của riêng'},input,[{reading:'tự'}]),[]);
 assert.deepEqual(kanjiMeaningIssues({text_vi:'cha'},{character:'父',field:'meaning',meanings_en:['father']},[{reading:'phụ'}]),[]);
 assert.deepEqual(kanjiMeaningIssues({text_vi:'tự'},{character:'自',field:'han_viet',meanings_en:['self']},[{reading:'tự'}]),[]);
});

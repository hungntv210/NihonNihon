import {need} from './core.mjs';

export function selectBatch(datasets) {
  const vocab=datasets.vocab,kanji=datasets.kanji,grammar=datasets.grammar;
  const readings=new Map();for(const v of vocab){if(!readings.has(v.word))readings.set(v.word,new Set());readings.get(v.word).add(v.reading);}
  const ids=[],notes=[];
  for(const [level,quota]of [['N5',80],['N2',20]]) {
    const pool=vocab.filter(v=>v.level===level).sort((a,b)=>a.id.localeCompare(b.id)),selected=new Map();
    need(pool.length>=quota,`Not enough ${level} vocabulary for curated batch`);
    for(const [reason,predicate]of [
      ['kana-only',v=>/^[ぁ-ゖー]+$/u.test(v.word)],['katakana',v=>/^[ァ-ヺー]+$/u.test(v.word)],
      ['suru',v=>v.word.endsWith('する')||(v.pos || []).some(p=>p.startsWith('vs'))],
      ['ambiguous-headword',v=>readings.get(v.word).size>1],['other-forms',v=>v.other_forms?.length],
      ['no-example',v=>!v.examples?.length],['multiple-meanings',v=>v.meanings.length>1],
    ]) {
      const found=pool.find(predicate);notes.push({level,reason,id:found?.id ?? null});if(found)selected.set(found.id,found);
    }
    for(const v of pool){if(selected.size>=quota)break;selected.set(v.id,v);}ids.push(...selected.keys());
  }
  const selectedKanji=new Set(),required=['大','行','長','働','日','人','生','子'];
  for(const c of required){need(kanji.some(k=>k.character===c),`Required batch kanji missing: ${c}`);selectedKanji.add(c);}
  for(const k of [...kanji].sort((a,b)=>a.character.codePointAt(0)-b.character.codePointAt(0))){if(selectedKanji.size>=50)break;selectedKanji.add(k.character);}
  need(selectedKanji.size===50&&grammar.length>=20,'Not enough kanji/grammar for batch');
  const selectedGrammar=new Set();
  for(const g of [...grammar].sort((a,b)=>a.pattern.length-b.pattern.length).slice(0,5))selectedGrammar.add(g.id);
  for(const g of [...grammar].sort((a,b)=>b.pattern.length-a.pattern.length).slice(0,5))selectedGrammar.add(g.id);
  for(const g of [...grammar].sort((a,b)=>a.id.localeCompare(b.id))){if(selectedGrammar.size>=20)break;selectedGrammar.add(g.id);}
  return {cohort:{vocab_ids:ids,kanji_characters:[...selectedKanji],grammar_ids:[...selectedGrammar]},selection_notes:notes,expected_counts:{vocab:100,kanji:50,grammar:20,clips:3}};
}

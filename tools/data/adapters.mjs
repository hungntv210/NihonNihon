import fs from 'node:fs';
import Ajv from 'ajv';
import { parse } from 'csv-parse/sync';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { need,nfc,list,text,nonempty,sha,itemId,keyFor } from './core.mjs';

const ajv = new Ajv({allErrors:true,strict:false});
const validators = Object.fromEntries(['vocab','kanji','grammar'].map(kind => {
  const schema=JSON.parse(fs.readFileSync(new URL(`schemas/${kind}.schema.json`,import.meta.url),'utf8'));
  return [kind,ajv.compile(schema)];
}));
const xmlParser = new XMLParser({ignoreAttributes:false,processEntities:false,parseTagValue:false});
export function xml(body) {
  need(!/<!ENTITY\s+[^>]*(?:SYSTEM|PUBLIC)/i.test(body),'External XML entities are forbidden');
  need(XMLValidator.validate(body)===true,'Malformed XML');
  return xmlParser.parse(body);
}
function rows(body) { const v=nfc(JSON.parse(body)); need(Array.isArray(v),'Expected JSON array'); return v; }
function addUnique(map,key,value,label) {
  if(map.has(key)) need(sha(map.get(key).row)===sha(value.row),`Conflicting ${label}: ${key}`);
  else map.set(key,value);
}
export function parseArtifacts(loaded) {
  const d = {vocab:new Map(),kanji:new Map(),grammar:new Map(),allVocab:[],hv:new Map(),javi:new Map(),cvdict:new Map(),unihan:new Map(),furigana:[],components:[],strokes:[],jmdict:new Map(),tatoeba:new Map(),links:new Map(),responses:[],clips:[],warnings:[]};
  const jsonFormats = new Set(['kanjidictvn','jmdict-furigana','mt-results','user-clips']);
  for(const a of loaded.artifacts) {
    const {format}=a.file, sid=a.source.source_id;
    if(format.startsWith('openjlpt-')) {
      const kind=format.slice(9); need(validators[kind] && sid==='openjlpt','Unknown OpenJLPT format/source');
      for(const row of rows(a.body)) {
        need(validators[kind](row),`Invalid OpenJLPT ${kind}: ${ajv.errorsText(validators[kind].errors)}`);
        if(a.file.level) need(row.level===a.file.level,'Level differs from manifest');
        if(kind==='kanji') need(Array.from(row.character).length===1,'Kanji must be one Unicode codepoint');
        const entry={row,a}; addUnique(d[kind],itemId(kind,row),entry,kind);
      }
    } else if(jsonFormats.has(format)) {
      for(const [i,row] of rows(a.body).entries()) {
        const ref={a,key:`${a.file.path}#${i}`};
        if(format==='kanjidictvn') {
          need(sid==='kanjidictvn' && a.source.usage_scope==='private_only','KanjiDictVN must remain private');
          need(Array.isArray(row) && row.length===6 && nonempty(row[0]) && typeof row[1]==='string' && row[2]==='' && row[3]==='' && Array.isArray(row[4]) && row[5] && typeof row[5]==='object' && !Array.isArray(row[5]),'Invalid KanjiDictVN six-field tuple');
          if(!d.hv.has(row[0])) d.hv.set(row[0],[]);
          d.hv.get(row[0]).push({...ref,raw:row[1],meanings:row[4]});
        } else if(format==='jmdict-furigana') {
          need(nonempty(row.text) && nonempty(row.reading) && Array.isArray(row.furigana),'Invalid furigana entry');
          need(row.furigana.every(s=>nonempty(s.ruby) && (s.rt===undefined || nonempty(s.rt))) && row.furigana.map(s=>s.ruby).join('')===row.text,'Furigana does not reconstruct word');
          d.furigana.push({...ref,row});
        } else if(format==='mt-results') {
          need(sid.startsWith('mt:') && nonempty(row.request_id),'MT result requires provider source and request_id');
          d.responses.push({...ref,row});
        } else {
          need(sid==='user-media' && a.source.usage_scope==='private_only','User clips must be private user-media');
          need(nonempty(row.id) && nonempty(row.title) && row.origin && ['file','youtube'].includes(row.origin.kind),'Invalid user clip');
          need(Number.isSafeInteger(row.duration_ms) && row.duration_ms>0 && Array.isArray(row.segments) && row.segments.length>0,'Clip duration/segments required');
          const segmentIds=new Set(); let previousEnd=0;
          for(const s of row.segments) {
            need(nonempty(s.id) && !segmentIds.has(s.id) && nonempty(s.ja),'Clip sentence IDs/text required'); segmentIds.add(s.id);
            need(Number.isSafeInteger(s.start_ms) && Number.isSafeInteger(s.end_ms) && s.start_ms>=previousEnd && s.end_ms>s.start_ms && s.end_ms<=row.duration_ms,'Invalid/overlapping clip segment times'); previousEnd=s.end_ms;
          }
          if(row.origin.kind==='youtube') need(/^[A-Za-z0-9_-]{11}$/.test(row.origin.video_id || ''),'Invalid YouTube ID');
          else need(nonempty(row.origin.path) && /^[0-9a-f]{64}$/.test(row.origin.sha256 || ''),'Private file path/checksum required');
          need(!d.clips.some(c=>c.row.id===row.id),'Duplicate clip ID'); d.clips.push({...ref,row});
        }
      }
    } else if(format==='javi-csv') {
      const parsed=parse(a.body,{bom:true,skip_empty_lines:true});
      const start=a.file.header===true?1:0;
      for(const [i,r] of parsed.slice(start).entries()) {
        need(r.length===2 && nonempty(r[0]) && nonempty(r[1]),'Japanese-Vietnamese CSV must have two nonempty fields');
        const [word,meaning]=r.map(v=>v.normalize('NFC').trim());
        if(!d.javi.has(word)) d.javi.set(word,[]);
        const found=d.javi.get(word); if(!found.some(e=>e.meaning===meaning)) found.push({meaning,a,key:`${a.file.path}#${i+start}`});
      }
    } else if(format==='cvdict') {
      need(sid==='cvdict','CVDICT source mismatch');
      for(const [i,line] of a.body.split(/\r?\n/).entries()) {
        if(!line.trim() || line.startsWith('#')) continue;
        const m=line.normalize('NFC').match(/^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.*)\/$/); need(m,`Invalid CVDICT line ${i+1}`);
        const entry={traditional:m[1],simplified:m[2],pinyin:m[3],glosses:m[4].split('/'),a,key:`${a.file.path}#${i+1}`};
        for(const w of new Set([m[1],m[2]])) {if(!d.cvdict.has(w)) d.cvdict.set(w,[]);d.cvdict.get(w).push(entry);}
      }
    } else if(format==='unihan' || format==='kradfile' || format.startsWith('tatoeba-')) {
      for(const [i,line] of a.body.split(/\r?\n/).entries()) {
        if(!line.trim() || line.startsWith('#')) continue;
        const ref={a,key:`${a.file.path}#${i+1}`};
        if(format==='unihan') {
          const m=line.match(/^U\+([0-9A-F]+)\tkVietnamese\t(.+)$/i);
          if(m) d.unihan.set(String.fromCodePoint(parseInt(m[1],16)),{...ref,raw:m[2].normalize('NFC')});
        } else if(format==='kradfile') {
          const [character,parts]=line.split(' : '); need(nonempty(character)&&nonempty(parts),'Invalid KRADFILE line');
          d.components.push({...ref,character,parts:parts.trim().split(/\s+/u)});
        } else if(format==='tatoeba-details') {
          const [id,lang,sentence,author]=line.split('\t'); need(/^\d+$/.test(id)&&nonempty(lang)&&nonempty(sentence),'Invalid Tatoeba detail row');
          d.tatoeba.set(Number(id),{...ref,id:Number(id),lang,text:sentence.normalize('NFC'),author:author || ''});
        } else if(format==='tatoeba-links') {
          const pair=line.split('\t').map(Number); need(pair.length===2 && pair.every(v=>Number.isSafeInteger(v)&&v>0),'Invalid Tatoeba link');
          for(const [from,to] of [pair,[pair[1],pair[0]]]) {if(!d.links.has(from)) d.links.set(from,new Set()); d.links.get(from).add(to);}
        } else throw Error('Unknown Tatoeba format');
      }
    } else if(format==='jmdict') {
      const parsed=xml(a.body);
      for(const entry of list(parsed.JMdict?.entry)) {
        need(/^\d+$/.test(text(entry.ent_seq)),'Invalid JMdict ent_seq');
        d.jmdict.set(Number(text(entry.ent_seq)),{...entry,a});
      }
    } else if(format==='kanjivg') {
      const parsed=xml(a.body);
      const walk=v=>{
        if(Array.isArray(v)) {v.forEach(walk);return;}
        if(!v || typeof v!=='object')return;
        if(v['@_d']!==undefined) {
          const m=String(v['@_id'] || '').match(/([0-9a-fA-F]{5,6})(?:-([A-Za-z0-9_-]+))?-s(\d+)$/);
          if(m) {
            need(/^[MmZzLlHhVvCcSsQqTtAaEe0-9,.\s+-]+$/.test(v['@_d']),'Unsafe SVG path');
            d.strokes.push({character:String.fromCodePoint(parseInt(m[1],16)),variant:a.file.variant ?? m[2] ?? '',no:Number(m[3]),path:v['@_d'],a});
          }
        }
        Object.values(v).forEach(walk);
      }; walk(parsed);
    } else throw Error(`Unsupported artifact format: ${format}`);
  }
  d.allVocab=[...d.vocab.values()];
  // Ambiguity is computed before selecting the batch, using all supplied levels.
  d.ambiguous = new Set(); const readings=new Map();
  for(const {row:v} of d.allVocab){if(!readings.has(v.word))readings.set(v.word,new Set());readings.get(v.word).add(v.reading);}
  for(const [word,r]of readings)if(r.size>1)d.ambiguous.add(word);
  const cohort=loaded.manifest.cohort || {};
  for(const [kind,field] of [['vocab','vocab_ids'],['kanji','kanji_characters'],['grammar','grammar_ids']]) {
    if(cohort[field]) {
      need(Array.isArray(cohort[field]) && new Set(cohort[field]).size===cohort[field].length,`Invalid cohort ${field}`);
      const wanted=new Set(cohort[field]), found=new Set();
      for(const [id,e]of d[kind]) {const k=kind==='kanji'?e.row.character:e.row.id;if(wanted.has(k))found.add(k);else d[kind].delete(id);}
      need(found.size===wanted.size,`Missing ${kind} IDs in cohort`);
    }
  }
  if(cohort.clip_ids) {const wanted=new Set(cohort.clip_ids);d.clips=d.clips.filter(e=>wanted.has(e.row.id));need(d.clips.length===wanted.size,'Missing clip IDs in cohort');}
  return d;
}

export function jmdictForms(row,entry) {
  if(!entry)return [];
  const matching=list(entry.r_ele).filter(r=>text(r.reb)===row.reading);
  const forms=list(entry.k_ele).map(k=>text(k.keb)).filter(w=>matching.some(r=>!r.re_restr || list(r.re_restr).map(text).includes(w)));
  return forms.filter(form=>list(entry.sense).some(s=>
    (!s.stagr || list(s.stagr).map(text).includes(row.reading)) && (!s.stagk || list(s.stagk).map(text).includes(form)) &&
    list(s.gloss).some(g=>(!g['@_xml:lang'] || g['@_xml:lang']==='eng') && row.meanings.some(m=>m.toLowerCase()===text(g).toLowerCase()))));
}

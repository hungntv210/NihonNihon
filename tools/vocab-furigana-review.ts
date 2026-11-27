import { furiganaMatches } from '../src/core/content-supplement.ts';
import { alignTokenFurigana, katakanaToHiragana, type RichToken } from '../src/app/(study)/shadowing/auto-meta-server.ts';

export type TargetReading = { word: string; reading: string };
type Unit = { from: number; to: number; base: string; reading?: string; markup: string };
type Edit = { from: number; to: number; markup: string };
const han = /\p{Script=Han}/u;
const kana = /^[\p{Script=Hiragana}ー]+$/u;
const ambiguous = /^[何方間上下人後今時行本匹回分日月年階杯]$/u;
const numberRun = /[0-9０-９〇零一二三四五六七八九十百千万億兆]+/gu;
const supported = /^[時行人本匹回分日月年階杯]$/u;
const digits = ['れい','いち','に','さん','よん','ご','ろく','なな','はち','きゅう'];
const kanjiDigits = '〇一二三四五六七八九';
const fixedNippon = /^(?:日本銀行|日本放送協会|日本郵便)/u;
const fixedIma = /^(?:今朝|今晩|今夜|今日|今月|今年|今度|今週|今期|今回|今学期|今世紀|今昔|今時|今更|今頃|今後|今般|今季)/u;

function dayReading(word: string, before: string, after: string) {
  switch (word) {
    case '今日':
      if (/^(?:では[、，]|あるの[はが]|の(?:社会|日本)(?!語)|の会社にした)/u.test(after)) return 'こんにち';
      if (/^(?:は|わ)[！!。]?[」』]?$/.test(after) && /(?:^|[「『])$/u.test(before)) return 'こんにち';
      if (/^の(?!(?:朝|昼|夜|午前|午後|夕方|天気|予定|授業|仕事|催し|社説|あなた))/u.test(after)) return null;
      return 'きょう';
    case '明日':
    case '昨日':
      if (/^付(?:け|で)/u.test(after)) return word === '明日' ? 'あす' : 'さくじつ';
      if (word === '明日' && /^の(?:社会|日本|世界)/u.test(after)) return null;
      return word === '明日' ? 'あした' : 'きのう';
    case '一日':
      if (/月$/u.test(before) || /^付(?:け|で)/u.test(after)) return 'ついたち';
      if (/^(?:中|間|かけて|もかから|で終|じゅう)/u.test(after) || /丸$/u.test(before)) return 'いちにち';
      return null;
    default: return null;
  }
}

function parseUnits(notation: string) {
  const units: Unit[] = [];
  let from = 0;
  for (const match of notation.matchAll(/\{([^{}|]+)\|([^{}|]+)\}|[\s\S]/gu)) {
    const [markup, written, reading] = match;
    const base = written ?? markup;
    const to = from + base.length;
    units.push({ from, to, base, reading, markup });
    from = to;
  }
  return units;
}

function numberValue(raw: string) {
  const value = raw.normalize('NFKC');
  if (/^[0-9]{1,2}$/.test(value) && (value.length === 1 || value[0] !== '0')) return Number(value);
  if (/^[一二三四五六七八九]$/u.test(value)) return kanjiDigits.indexOf(value);
  const tens = /^([二三四五六七八九])?十([一二三四五六七八九])?$/u.exec(value);
  return tens ? (tens[1] ? kanjiDigits.indexOf(tens[1]) : 1)*10 + (tens[2] ? kanjiDigits.indexOf(tens[2]) : 0) : null;
}

function counterReading(n: number, counter: string, before: string, after: string) {
  const unit = n % 10;
  const tens = Math.floor(n / 10);
  const prefix = tens ? (tens === 1 ? '' : digits[tens]) + 'じゅう' : '';
  const basic = prefix + (unit || !tens ? digits[unit] : '');
  const base = (ending: string, variants: Record<number,string> = {}) =>
    unit && variants[unit] ? prefix + variants[unit] : basic + ending;
  const geminate = (ending: string, endings: Record<number,string>, ten: string) =>
    !unit && tens ? (tens === 1 ? '' : digits[tens]) + ten : base(ending, endings);
  switch (counter) {
    case '時': return n <= 24 ? base('じ',{4:'よじ',7:'しちじ',9:'くじ'}) : null;
    case '行': return n !== 1 || /第$/u.test(before) || /^(?:に|ずつ|目|引用|書|読|空)/u.test(after) ? base('ぎょう') : null;
    case '人': return n === 1 ? 'ひとり' : n === 2 ? 'ふたり' : base('にん',{4:'よにん'});
    case '本': return geminate('ほん',{1:'いっぽん',3:'さんぼん',6:'ろっぽん',8:'はっぽん'},'じゅっぽん');
    case '匹': return geminate('ひき',{1:'いっぴき',3:'さんびき',6:'ろっぴき',8:'はっぴき'},'じゅっぴき');
    case '杯': return geminate('はい',{1:'いっぱい',3:'さんばい',6:'ろっぱい',8:'はっぱい'},'じゅっぱい');
    case '回': return geminate('かい',{1:'いっかい',6:'ろっかい',8:'はっかい'},'じゅっかい');
    case '階': return geminate('かい',{1:'いっかい',3:'さんがい',6:'ろっかい',8:'はっかい'},'じゅっかい');
    case '分': return /^(?:の|け|割|類|析)/u.test(after) ? null : geminate('ふん',{1:'いっぷん',3:'さんぷん',4:'よんぷん',6:'ろっぷん',8:'はっぷん'},'じゅっぷん');
    case '年': return base('ねん',{4:'よねん'});
    case '月': return n >= 1 && n <= 12 && !/^(?:間|後|ほど|が経)/u.test(after) ? base('がつ',{4:'しがつ',7:'しちがつ',9:'くがつ'}) : null;
    case '日': {
      if (/^(?:月|市|町|村)/u.test(after)) return null;
      if (n === 1) return dayReading('一日', before, after);
      const days: Record<number,string> = {2:'ふつか',3:'みっか',4:'よっか',5:'いつか',6:'むいか',7:'なのか',8:'ようか',9:'ここのか',10:'とおか',14:'じゅうよっか',20:'はつか',24:'にじゅうよっか'};
      return days[n] ?? (n >= 11 ? base('にち',{9:'くにち'}) : null);
    }
    default: return null;
  }
}

export function reviewVocabFurigana(japanese: string, notation: string, tokens: readonly RichToken[], targets: readonly TargetReading[] = []) {
  const units = parseUnits(notation);
  const reasons = new Set<string>(), changes: Record<string,number> = {};
  if (units.map(u=>u.base).join('') !== japanese) return { furigana: notation, reasons: ['surface-mismatch'], changes };
  const edits: Edit[] = [], resolved: {from:number;to:number}[] = [];
  const starts = new Map(units.map((u,i)=>[u.from,i]));
  starts.set(japanese.length,units.length);
  const boundaries = new Set([0, ...tokens.flatMap(t => [t.start, t.end])]);
  const overlap = (from:number,to:number) => resolved.some(span=>span.from<to && span.to>from);
  function apply(from:number,to:number,markup:string,rule:string) {
    const first=starts.get(from), last=starts.get(to);
    if(first===undefined || last===undefined || overlap(from,to)) return false;
    const previous=units.slice(first,last);
    resolved.push({from,to});
    const oldReading=previous.map(u=>u.reading??u.base).join('');
    const newReading=parseUnits(markup).map(u=>u.reading??u.base).join('');
    if(oldReading!==newReading || previous.some(u=>!u.reading && han.test(u.base)) && markup.includes('{')) {
      edits.push({from,to,markup});
      changes[rule]=(changes[rule]??0)+1;
    }
    return true;
  }

  for(const match of japanese.matchAll(numberRun)) {
    const from=match.index, end=from+match[0].length, counter=japanese[end]??'';
    const sourceUnit=units[starts.get(from)??-1];
    if (!supported.test(counter)) {
      if (/^[0-9０-９]/u.test(match[0]) || sourceUnit?.base===match[0]) reasons.add('unsupported-number');
      continue;
    }
    const after=japanese.slice(end+1), before=japanese.slice(0,from);
    const n=numberValue(match[0]);
    if (n===null || (n===0 && counter!=='時') || /[.,．，点±−+-]$/u.test(before) || /^[々]/u.test(after)) {
      reasons.add('ambiguous-counter:'+counter);
      continue;
    }
    const reading=counterReading(n,counter,before,after);
    const to=end+1, surface=japanese.slice(from,to);
    if(!reading || !apply(from,to,'{'+surface+'|'+reading+'}',surface === '一日' ? 'day-一日' : 'counter-'+counter)) {
      reasons.add('ambiguous-counter:'+counter);
      if (surface === '一日') {
        reasons.add('ambiguous-reading:一日');
        resolved.push({from,to});
      }
      continue;
    }
    if(counter==='時' && after.startsWith('の間に') && !apply(to+1,to+2,'{間|あいだ}','clock-interval')) reasons.add('ambiguous-reading:間');
  }

  for (const match of japanese.matchAll(/今日|明日|昨日/gu)) {
    const word = match[0], from = match.index, to = from + word.length;
    const after = japanese.slice(to);
    const exactUnit = units[starts.get(from) ?? -1]?.base === word;
    const separate = boundaries.has(from) && boundaries.has(to) || exactUnit;
    const name = word === '明日' && after.startsWith('香') || word === '今日' && after.startsWith('子');
    const reading = separate && !name ? dayReading(word, japanese.slice(0, from), after) : null;
    if (!reading || !apply(from, to, '{' + word + '|' + reading + '}', 'day-' + word)) {
      reasons.add('ambiguous-reading:' + word);
      resolved.push({from,to});
    }
  }

  for(const u of units) {
    if(overlap(u.from,u.to) || !u.reading) continue;
    const tail=japanese.slice(u.from), before=japanese.slice(0,u.from);
    if(u.base.startsWith('日本') && /^に(?:っぽん|ほん)/u.test(u.reading)) {
      if(tail.startsWith('日本橋')) { reasons.add('place-name:日本橋'); continue; }
      const fixed=fixedNippon.test(tail);
      const reading=u.reading.replace(/^に(?:っぽん|ほん)/u,fixed?'にっぽん':'にほん');
      apply(u.from,u.to,'{'+u.base+'|'+reading+'}','nihon');
    } else if(u.base==='後' && /[ただ]$/u.test(before)) {
      const past=tokens.findIndex(t=>t.end===u.from && /^(?:た|だ)$/u.test(t.surface) && t.pos==='助動詞');
      if(past>0 && ['動詞','助動詞'].includes(tokens[past-1].pos)) apply(u.from,u.to,'{後|あと}','after-past');
    } else if(u.base==='今') {
      if(fixedIma.test(tail)) resolved.push({from:u.from,to:u.to});
      else apply(u.from,u.to,'{今|いま}','ima');
    }
  }

  const forms=new Map<string,Set<string>>();
  for(const {word,reading} of targets) {
    const hira=katakanaToHiragana(reading.normalize('NFKC'));
    if(!han.test(word)||!kana.test(hira)) continue;
    const readings=forms.get(word)??new Set();
    readings.add(hira);
    forms.set(word,readings);
  }
  for(const [word,readings] of [...forms].sort((a,b)=>b[0].length-a[0].length)) {
    for(let from=japanese.indexOf(word);from!==-1;from=japanese.indexOf(word,from+word.length)) {
      const to=from+word.length;
      if(overlap(from,to) || !boundaries.has(from) || !boundaries.has(to)) continue;
      if(readings.size!==1) { reasons.add('target-reading-conflict:'+word); continue; }
      const [reading]=readings;
      const ruby=alignTokenFurigana(word,reading);
      if(!furiganaMatches(word,ruby)||!apply(from,to,ruby,'target-reading')) reasons.add('target-alignment:'+word);
    }
  }

  for(const u of units) {
    if(ambiguous.test(u.base) && !overlap(u.from,u.to)) reasons.add('ambiguous-reading:'+u.base);
  }
  let cursor=0;
  const furigana=edits.sort((a,b)=>a.from-b.from).map(({from,to,markup})=>{
    const prefix=units.slice(starts.get(cursor),starts.get(from)).map(u=>u.markup).join('');
    cursor=to;
    return prefix+markup;
  }).join('')+units.slice(starts.get(cursor)).map(u=>u.markup).join('');
  if(!furiganaMatches(japanese,furigana) || /\{[^{}|]*[\p{Script=Hiragana}\p{Script=Katakana}?]\|/u.test(furigana)) reasons.add('unresolved-notation');
  return {furigana,reasons:[...reasons].sort(),changes};
}

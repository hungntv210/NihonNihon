import {randomInt} from 'node:crypto';import {need} from './core.mjs';
export function stratifiedSample(rows,quotas={N5:8,N4:8,N3:7,N2:7},choose=randomInt){
 const result=[],seen=new Set();for(const [level,count]of Object.entries(quotas)){
 const pool=rows.filter(r=>r.level===level).filter((r,i,a)=>a.findIndex(v=>v.ja.normalize('NFC')===r.ja.normalize('NFC'))===i);need(pool.length>=count,`Not enough reviewed sentences for ${level}`);
 for(let i=pool.length-1;i>0;i--){const j=choose(i+1);[pool[i],pool[j]]=[pool[j],pool[i]];}
 for(const row of pool.slice(0,count)){const key=row.ja.normalize('NFC');need(!seen.has(key),'Duplicate sentence across sample strata');seen.add(key);result.push(row);}}
 return result;
}

import fs from 'node:fs';
import path from 'node:path';
import { defaults, validDate, type Settings } from './model.ts';
// shortcut: route-local adapter until foundation's authenticated preferences reader is merged.
export function readTodaySettings(file = path.resolve(process.env.NIHON_SETTINGS_PATH || 'data/settings.json')): Settings {
 let input: Record<string, unknown>;
 try { if(fs.statSync(file).size>65536)throw Error('INVALID_SETTINGS');input=JSON.parse(fs.readFileSync(file,'utf8')); }
 catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return {...defaults};throw error;}
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('INVALID_SETTINGS');
 const p={...defaults,...input} as Settings;
 if(!validDate(p.startDate)||!validDate(p.examDate)||p.examDate<=p.startDate||typeof p.eveningTime!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.eveningTime)||!Number.isInteger(p.studyMinutes)||p.studyMinutes<5||p.studyMinutes>180||typeof p.timeZone!=='string'||p.timeZone.length>80||!Array.isArray(p.shadowingDays)||p.shadowingDays.length<2||p.shadowingDays.some(d=>!Number.isInteger(d)||d<0||d>6)||new Set(p.shadowingDays).size!==p.shadowingDays.length||!Number.isInteger(p.newCardsPerDay)||p.newCardsPerDay<0||p.newCardsPerDay>100)throw Error('INVALID_SETTINGS');
 new Intl.DateTimeFormat('en',{timeZone:p.timeZone});
 return {startDate:p.startDate,examDate:p.examDate,eveningTime:p.eveningTime,studyMinutes:p.studyMinutes,timeZone:p.timeZone,shadowingDays:p.shadowingDays,newCardsPerDay:p.newCardsPerDay};
}


import 'server-only';
import { saveDailyBackup } from '../core/backup.ts';
let started=false;
export function startDailyBackups(){if(started)return;started=true;const run=()=>void saveDailyBackup().catch(error=>console.error('Daily G1 backup failed:',error instanceof Error?error.message:'unknown'));run();setInterval(run,60*60*1000).unref();}

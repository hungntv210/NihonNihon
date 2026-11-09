import fs from 'node:fs';
import path from 'node:path';
import {need} from './core.mjs';

export const MIN_FREE_BYTES=5_000_000_000;
export const DISK_VOLUME=process.platform==='win32'?'C:\\':path.parse(process.cwd()).root;
export function freeDiskBytes(volume=DISK_VOLUME){const stat=fs.statfsSync(volume,{bigint:true});return Number(stat.bavail*stat.bsize);}
export function assertDiskSpace(stage,{getFreeBytes=freeDiskBytes}={}){
 const free_bytes=getFreeBytes(DISK_VOLUME);need(Number.isFinite(free_bytes)&&free_bytes>=0,'Cannot determine free disk space');
 if(free_bytes<MIN_FREE_BYTES){const error=new Error('Free disk space is below 5 GB');Object.assign(error,{code:'disk_low',stage,volume:DISK_VOLUME,free_bytes,min_free_bytes:MIN_FREE_BYTES});throw error;}
 return free_bytes;
}

import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {openContentDatabase} from '../../../core/content.ts';import {databasePath} from '../../../core/config.ts';
import {parsePrivateClip,parseYoutubeClip,syntheticClip,type Clip} from './clip-model.ts';
const sql="SELECT c.item_id id,r.manifest_json,m.storage_ref,m.private_only FROM content_items c JOIN source_releases r ON r.release_id=c.release_id JOIN media_assets m ON m.item_id=c.item_id WHERE c.kind='clip' AND c.source_id='user-media' AND c.is_active=1 AND m.asset_kind='video' AND m.private_only=1";
export function listShadowingClips(file=databasePath(),youtubeFile=process.env.NIHON_YOUTUBE_CLIP_PATH||path.resolve('data/private/youtube-clip.json')):Clip[]{const db=openContentDatabase(file);try{return [syntheticClip,...(fs.existsSync(youtubeFile)?[parseYoutubeClip(JSON.parse(fs.readFileSync(youtubeFile,'utf8')))]:[]),...db.prepare(sql+' ORDER BY c.item_id').all().map(r=>parsePrivateClip(String(r.id),JSON.parse(String(r.manifest_json))))];}finally{db.close();}}
const verified=new Map<string,string>();
export async function privateClipMedia(id:string,file=databasePath()){
 const db=openContentDatabase(file);let row;try{row=db.prepare(sql+' AND c.item_id=?').get(id);}finally{db.close();}if(!row)throw Error('CLIP_NOT_FOUND');
 const metadata=JSON.parse(String(row.manifest_json));parsePrivateClip(id,metadata);const actual=fs.realpathSync(String(row.storage_ref)),stat=fs.statSync(actual),root=process.env.NIHON_SHADOWING_MEDIA_ROOT;
 if(!stat.isFile())throw Error('INVALID_MEDIA_FILE');if(root){const relative=path.relative(fs.realpathSync(root),actual);if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('MEDIA_OUTSIDE_PRIVATE_ROOT');}
 const mime={'.mp4':'video/mp4','.webm':'video/webm'}[path.extname(actual).toLowerCase()];if(!mime)throw Error('UNSUPPORTED_MEDIA_TYPE');
 const key=actual+':'+stat.size+':'+stat.mtimeMs+':'+metadata.origin.sha256;
 if(!verified.has(key)){const hash=createHash('sha256');for await(const bytes of fs.createReadStream(actual))hash.update(bytes);if(hash.digest('hex')!==metadata.origin.sha256)throw Error('PRIVATE_MEDIA_HASH_MISMATCH');verified.set(key,metadata.origin.sha256);}
 return {path:actual,size:stat.size,mime};
}

import type {NextApiRequest,NextApiResponse} from 'next';
import {createReadStream} from 'node:fs';import {stat} from 'node:fs/promises';import path from 'node:path';import {pipeline} from 'node:stream/promises';
import {authConfig} from '../../core/config.ts';import {verifySession,SESSION_COOKIE} from '../../core/session.ts';
import {privateClipMedia} from '../../app/(study)/shadowing/clips.ts';import {mediaRange} from '../../app/(study)/shadowing/demo.ts';
// The App Router sendResponse adapter strips Content-Length. Node's response retains it for iOS ranges.
export const config={api:{responseLimit:false,bodyParser:false}};
export default async function media(req:NextApiRequest,res:NextApiResponse){
 res.setHeader('Cache-Control','private, no-store, no-transform');res.setHeader('X-Content-Type-Options','nosniff');
 let signedIn=false;try{signedIn=verifySession(req.cookies[SESSION_COOKIE],authConfig().secret);}catch{res.statusCode=503;res.end();return;}
 if(!signedIn){res.statusCode=401;res.end();return;}
 if(req.method!=='GET'&&req.method!=='HEAD'){res.setHeader('Allow','GET, HEAD');res.statusCode=405;res.end();return;}
 let file;try{const clip=req.query.clip;if(clip!==undefined&&typeof clip!=='string')throw Error('INVALID_CLIP');if(clip){file=await privateClipMedia(clip);}else{const demo=path.resolve('src/app/(study)/shadowing/demo.webm');file={path:demo,size:(await stat(demo)).size,mime:'video/webm'};}}catch{res.statusCode=404;res.end();return;}
 res.setHeader('Content-Type',file.mime);res.setHeader('Accept-Ranges','bytes');
 let range;try{range=mediaRange(typeof req.headers.range==='string'?req.headers.range:null,file.size);}catch{res.statusCode=416;res.setHeader('Content-Range','bytes */'+file.size);res.setHeader('Content-Length','0');res.end();return;}
 const start=range?.start??0,end=range?.end??file.size-1;res.statusCode=range?206:200;res.setHeader('Content-Length',String(end-start+1));if(range)res.setHeader('Content-Range','bytes '+start+'-'+end+'/'+file.size);
 if(req.method==='HEAD'){res.end();return;}
 try{await pipeline(createReadStream(file.path,{start,end}),res);}catch{if(!res.destroyed)res.destroy();}
}

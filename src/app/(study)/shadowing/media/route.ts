import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {createReadStream} from 'node:fs';import {Readable} from 'node:stream';import {privateClipMedia} from '../clips.ts';
import { requireSession } from '../../../../server/auth.ts';
import { mediaRange } from '../demo.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  await requireSession();
  const clip=new URL(request.url).searchParams.get('clip');
  if(clip){let media;try{media=await privateClipMedia(clip);}catch{return new Response(null,{status:404});}const headers={'Content-Type':media.mime,'Accept-Ranges':'bytes','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
    let range;try{range=mediaRange(request.headers.get('range'),media.size);}catch{return new Response(null,{status:416,headers:{...headers,'Content-Range':`bytes */${media.size}`}});}
    const start=range?.start??0,end=range?.end??media.size-1,stream=createReadStream(media.path,{start,end,signal:request.signal});return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>,{status:range?206:200,headers:{...headers,'Content-Length':String(end-start+1),...(range?{'Content-Range':`bytes ${start}-${end}/${media.size}`}:{})}});
  }
  const bytes = await readFile(path.join(process.cwd(), 'src/app/(study)/shadowing/demo.webm'));
  const headers = { 'Content-Type': 'video/webm', 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  try {
    const range = mediaRange(request.headers.get('range'), bytes.length);
    if (range) return new Response(bytes.subarray(range.start, range.end + 1), { status: 206, headers: { ...headers, 'Content-Range': `bytes ${range.start}-${range.end}/${bytes.length}`, 'Content-Length': String(range.end - range.start + 1) } });
    return new Response(bytes, { headers: { ...headers, 'Content-Length': String(bytes.length) } });
  } catch {
    return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${bytes.length}` } });
  }
}

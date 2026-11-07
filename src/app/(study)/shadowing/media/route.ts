import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { requireSession } from '../../../../server/auth.ts';
import { mediaRange } from '../demo.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  await requireSession();
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

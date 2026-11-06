import 'server-only';
import { authConfig } from '../core/config.ts';

export function sameOrigin(request: Request) {
  return request.headers.get('origin') === authConfig().origin;
}
export async function boundedBody(request: Request) {
  if (Number(request.headers.get('content-length') || 0) > 4096) throw new Error('BODY_TOO_LARGE');
  const reader = request.body?.getReader();
  if (!reader) return '';
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        throw new Error('BODY_TOO_LARGE');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString('utf8');
}

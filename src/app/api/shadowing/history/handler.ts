import {
  MAX_PIN_AUDIO_BYTES,
  summarizeAllClips,
  summarizeClipHistory,
} from '../../../(study)/shadowing/history-model.ts';
import {
  pinBestRecording,
  readPinnedAudio,
  readShadowingHistory,
  recordShadowingTurn,
  unpinBestRecording,
} from '../../../(study)/shadowing/history-store.ts';
import type { Clip } from '../../../(study)/shadowing/clip-model.ts';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
};

export type ShadowingHistoryHandlerDeps = {
  isAuthenticated: () => Promise<boolean>;
  sameOriginCheck: (request: Request) => boolean;
  clips: () => Clip[];
  historyPath: string;
  recordingsDir: string;
  timeZone?: string;
  now?: () => Date;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...PRIVATE_HEADERS,
    },
  });
}

function findClip(clips: Clip[], clipId: string): Clip | null {
  return clips.find((c) => c.id === clipId) ?? null;
}

function parseByteRange(header: string | null, total: number): { start: number; end: number } | 'invalid' | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return 'invalid';
  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return 'invalid';
  let start: number;
  let end: number;
  if (!rawStart) {
    const suffix = Number(rawEnd);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return 'invalid';
    start = Math.max(0, total - suffix);
    end = total - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd ? Math.min(total - 1, Number(rawEnd)) : total - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= total || end < start) {
    return 'invalid';
  }
  return { start, end };
}

export async function handleShadowingHistoryGet(
  request: Request,
  deps: ShadowingHistoryHandlerDeps,
): Promise<Response> {
  if (!(await deps.isAuthenticated())) {
    return jsonResponse({ error: 'Cần đăng nhập.' }, 401);
  }
  const url = new URL(request.url);
  const audioId = url.searchParams.get('audio');
  const clipId = url.searchParams.get('clip');
  const segmentId = url.searchParams.get('segment');

  if (audioId !== null) {
    if (!clipId || !segmentId || !audioId) {
      return jsonResponse({ error: 'Thiếu thông tin bản ghi.' }, 400);
    }
    const found = readPinnedAudio({
      historyPath: deps.historyPath,
      recordingsDir: deps.recordingsDir,
      clipId,
      segmentId,
      pinId: audioId,
    });
    if (!found) {
      return jsonResponse({ error: 'Không tìm thấy bản ghi đã ghim.' }, 404);
    }
    const range = parseByteRange(request.headers.get('range'), found.bytes.length);
    if (range === 'invalid') {
      return new Response(null, {
        status: 416,
        headers: {
          'Content-Range': `bytes */${found.bytes.length}`,
          ...PRIVATE_HEADERS,
        },
      });
    }
    if (range) {
      const slice = found.bytes.subarray(range.start, range.end + 1);
      return new Response(new Uint8Array(slice), {
        status: 206,
        headers: {
          'Content-Type': found.mime,
          'Content-Length': String(slice.length),
          'Content-Range': `bytes ${range.start}-${range.end}/${found.bytes.length}`,
          'Accept-Ranges': 'bytes',
          ...PRIVATE_HEADERS,
        },
      });
    }
    return new Response(new Uint8Array(found.bytes), {
      status: 200,
      headers: {
        'Content-Type': found.mime,
        'Content-Length': String(found.bytes.length),
        'Accept-Ranges': 'bytes',
        ...PRIVATE_HEADERS,
      },
    });
  }

  const clips = deps.clips();
  const store = readShadowingHistory(deps.historyPath);
  if (clipId) {
    const clip = findClip(clips, clipId);
    if (!clip) return jsonResponse({ error: 'Không tìm thấy clip.' }, 404);
    return jsonResponse({ summary: summarizeClipHistory(store, clip.id) }, 200);
  }
  return jsonResponse({ clips: summarizeAllClips(store, clips.map((c) => c.id)) }, 200);
}

export async function handleShadowingHistoryPost(
  request: Request,
  deps: ShadowingHistoryHandlerDeps,
): Promise<Response> {
  if (!(await deps.isAuthenticated())) {
    return jsonResponse({ error: 'Cần đăng nhập.' }, 401);
  }
  if (!deps.sameOriginCheck(request)) {
    return jsonResponse({ error: 'Nguồn yêu cầu không hợp lệ.' }, 403);
  }

  const contentType = (request.headers.get('content-type') ?? '').toLowerCase();
  const clips = deps.clips();
  const now = deps.now ? deps.now() : new Date();
  const timeZone = deps.timeZone ?? 'Asia/Ho_Chi_Minh';

  if (contentType.includes('multipart/form-data')) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return jsonResponse({ error: 'Dữ liệu tải lên không hợp lệ.' }, 400);
    }
    const clipId = String(form.get('clipId') ?? '');
    const segmentId = String(form.get('segmentId') ?? '');
    const durationMs = Number(form.get('durationMs'));
    const file = form.get('audio');
    const clip = findClip(clips, clipId);
    if (!clip || !clip.segments.some((s) => s.id === segmentId)) {
      return jsonResponse({ error: 'Clip hoặc câu không hợp lệ.' }, 400);
    }
    if (!(file instanceof Blob) || file.size <= 0 || file.size > MAX_PIN_AUDIO_BYTES) {
      return jsonResponse({ error: 'Kích thước bản ghi không hợp lệ (tối đa 2 MB).' }, 400);
    }
    const audioBytes = Buffer.from(await file.arrayBuffer());
    const audioMime = String(form.get('audioMime') || file.type || 'audio/webm');
    try {
      const result = pinBestRecording({
        historyPath: deps.historyPath,
        recordingsDir: deps.recordingsDir,
        clipId: clip.id,
        segmentId,
        durationMs,
        audioBytes,
        audioMime,
        now,
      });
      return jsonResponse(result, 200);
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      const status = msg === 'HISTORY_BUSY' ? 503 : 400;
      return jsonResponse({ error: status === 503 ? 'Đang lưu, thử lại.' : 'Không ghim được bản ghi.' }, status);
    }
  }

  let body: Record<string, unknown>;
  try {
    const text = await request.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_PIN_AUDIO_BYTES * 2) {
      return jsonResponse({ error: 'Dữ liệu quá lớn.' }, 413);
    }
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'Dữ liệu JSON không hợp lệ.' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonResponse({ error: 'Dữ liệu không hợp lệ.' }, 400);
  }

  const action = body.action;
  const clipId = typeof body.clipId === 'string' ? body.clipId : '';
  const clip = findClip(clips, clipId);
  if (!clip) {
    return jsonResponse({ error: 'Clip không hợp lệ.' }, 400);
  }

  if (action === 'turn') {
    const segmentId =
      body.segmentId === null || body.segmentId === undefined
        ? null
        : typeof body.segmentId === 'string'
          ? body.segmentId
          : null;
    if (segmentId !== null && !clip.segments.some((s) => s.id === segmentId)) {
      return jsonResponse({ error: 'Câu không hợp lệ.' }, 400);
    }
    const durationMs = Number(body.durationMs);
    if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > 3_600_000) {
      return jsonResponse({ error: 'Thời lượng không hợp lệ.' }, 400);
    }
    const recordedSegments = Number(body.recordedSegments ?? 0);
    const totalSegments = Number(body.totalSegments ?? clip.segments.length);
    try {
      const result = recordShadowingTurn({
        historyPath: deps.historyPath,
        recordingsDir: deps.recordingsDir,
        clipId: clip.id,
        segmentId,
        durationMs,
        recordedSegments: Number.isFinite(recordedSegments) ? recordedSegments : 0,
        totalSegments: Number.isFinite(totalSegments) ? totalSegments : clip.segments.length,
        now,
        timeZone,
      });
      return jsonResponse(result, 200);
    } catch (error) {
      const busy = error instanceof Error && error.message === 'HISTORY_BUSY';
      return jsonResponse({ error: busy ? 'Đang lưu, thử lại.' : 'Không lưu được lượt luyện.' }, busy ? 503 : 400);
    }
  }

  if (action === 'pin') {
    const segmentId = typeof body.segmentId === 'string' ? body.segmentId : '';
    if (!clip.segments.some((s) => s.id === segmentId)) {
      return jsonResponse({ error: 'Câu không hợp lệ.' }, 400);
    }
    const durationMs = Number(body.durationMs);
    const audioBase64 = typeof body.audioBase64 === 'string' ? body.audioBase64 : '';
    const audioMime = typeof body.audioMime === 'string' ? body.audioMime : 'audio/webm';
    if (!audioBase64) return jsonResponse({ error: 'Thiếu dữ liệu âm thanh.' }, 400);
    const audioBytes = Buffer.from(audioBase64, 'base64');
    try {
      const result = pinBestRecording({
        historyPath: deps.historyPath,
        recordingsDir: deps.recordingsDir,
        clipId: clip.id,
        segmentId,
        durationMs,
        audioBytes,
        audioMime,
        now,
      });
      return jsonResponse(result, 200);
    } catch (error) {
      const busy = error instanceof Error && error.message === 'HISTORY_BUSY';
      return jsonResponse({ error: busy ? 'Đang lưu, thử lại.' : 'Không ghim được bản ghi.' }, busy ? 503 : 400);
    }
  }

  return jsonResponse({ error: 'Hành động không hợp lệ.' }, 400);
}

export async function handleShadowingHistoryDelete(
  request: Request,
  deps: ShadowingHistoryHandlerDeps,
): Promise<Response> {
  if (!(await deps.isAuthenticated())) {
    return jsonResponse({ error: 'Cần đăng nhập.' }, 401);
  }
  if (!deps.sameOriginCheck(request)) {
    return jsonResponse({ error: 'Nguồn yêu cầu không hợp lệ.' }, 403);
  }
  const url = new URL(request.url);
  const clipId = url.searchParams.get('clip') ?? '';
  const segmentId = url.searchParams.get('segment') ?? '';
  const clip = findClip(deps.clips(), clipId);
  if (!clip || !clip.segments.some((s) => s.id === segmentId)) {
    return jsonResponse({ error: 'Clip hoặc câu không hợp lệ.' }, 400);
  }
  try {
    const result = unpinBestRecording({
      historyPath: deps.historyPath,
      recordingsDir: deps.recordingsDir,
      clipId: clip.id,
      segmentId,
      now: deps.now ? deps.now() : new Date(),
    });
    return jsonResponse(result, 200);
  } catch (error) {
    const busy = error instanceof Error && error.message === 'HISTORY_BUSY';
    return jsonResponse({ error: busy ? 'Đang lưu, thử lại.' : 'Không bỏ ghim được.' }, busy ? 503 : 400);
  }
}

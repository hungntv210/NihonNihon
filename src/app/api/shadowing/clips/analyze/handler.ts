import { MAX_CLIP_SEGMENTS } from '../../../../(study)/shadowing/clip-maker-model.ts';
import type { ClipAutoMetaResult } from '../../../../(study)/shadowing/auto-meta-model.ts';
import { analyzeClipMetadata } from '../../../../(study)/shadowing/auto-meta-server.ts';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
};

const MAX_ANALYZE_BODY_BYTES = 64 * 1024;
const MAX_SENTENCE_LENGTH = 400;

export type ShadowingAnalyzeHandlerDeps = {
  isAuthenticated: () => Promise<boolean>;
  sameOriginCheck: (request: Request) => boolean;
  dbFile?: string;
  startDate?: string;
  analyze?: (
    sentences: readonly string[],
    options: { dbFile?: string; startDate?: string },
  ) => Promise<ClipAutoMetaResult>;
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

export async function handleShadowingClipsAnalyzePost(
  request: Request,
  deps: ShadowingAnalyzeHandlerDeps,
): Promise<Response> {
  if (!(await deps.isAuthenticated())) {
    return jsonResponse({ error: 'Cần đăng nhập.' }, 401);
  }
  if (!deps.sameOriginCheck(request)) {
    return jsonResponse({ error: 'Nguồn yêu cầu không hợp lệ.' }, 403);
  }

  let parsed: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, 'utf8') > MAX_ANALYZE_BODY_BYTES) {
      return jsonResponse({ error: 'Nội dung phân tích quá lớn.' }, 413);
    }
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return jsonResponse({ error: 'Dữ liệu JSON không hợp lệ.' }, 400);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return jsonResponse({ error: 'Thiếu danh sách câu tiếng Nhật.' }, 400);
  }

  const rawSentences = (parsed as { sentences?: unknown }).sentences;
  if (!Array.isArray(rawSentences) || rawSentences.length === 0) {
    return jsonResponse({ error: 'Cần ít nhất 1 câu tiếng Nhật để phân tích.' }, 400);
  }
  if (rawSentences.length > MAX_CLIP_SEGMENTS) {
    return jsonResponse({ error: `Tối đa ${MAX_CLIP_SEGMENTS} câu cho mỗi lần phân tích.` }, 400);
  }

  const sentences: string[] = [];
  for (let i = 0; i < rawSentences.length; i++) {
    const item = rawSentences[i];
    if (typeof item !== 'string') {
      return jsonResponse({ error: `Câu ${i + 1} không hợp lệ.` }, 400);
    }
    const trimmed = item.normalize('NFC').trim();
    if (!trimmed || trimmed.length > MAX_SENTENCE_LENGTH) {
      return jsonResponse(
        { error: `Câu ${i + 1} cần có nội dung tiếng Nhật (1–${MAX_SENTENCE_LENGTH} ký tự).` },
        400,
      );
    }
    sentences.push(trimmed);
  }

  try {
    const runAnalyze = deps.analyze ?? analyzeClipMetadata;
    const result = await runAnalyze(sentences, {
      dbFile: deps.dbFile,
      startDate: deps.startDate,
    });
    return jsonResponse(result, 200);
  } catch {
    return jsonResponse({ error: 'Không thể phân tích tự động lúc này.' }, 500);
  }
}

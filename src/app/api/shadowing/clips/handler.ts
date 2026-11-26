import type { Clip } from '../../../(study)/shadowing/clip-model.ts';
import type { ClipMetaSummary } from '../../../(study)/shadowing/clip-meta.ts';
import {
  MAX_CLIP_UPLOAD_BYTES,
  validateClipDraft,
  validateUploadInput,
  type ClipDraftInput,
} from '../../../(study)/shadowing/clip-maker-model.ts';
import {
  USER_CLIP_PREFIX,
  createUserFileClip,
  createUserYoutubeClip,
  deleteUserClip,
  listUserShadowingClips,
} from '../../../(study)/shadowing/clip-maker-store.ts';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
};

const MAX_JSON_BODY_BYTES = 256 * 1024;

export type ShadowingClipsHandlerDeps = {
  isAuthenticated: () => Promise<boolean>;
  sameOriginCheck: (request: Request) => boolean;
  dbFile?: string;
  storePath: string;
  mediaDir: string;
  whisperAvailable: boolean;
  enrichClip?: (clip: Clip) => Promise<{ clip: Clip; meta?: ClipMetaSummary }>;
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

function errorStatusForCode(code: string): number {
  if (code === 'UPLOAD_TOO_LARGE') return 413;
  if (code === 'UNSUPPORTED_MEDIA_MIME' || code === 'MEDIA_SIGNATURE_MISMATCH') return 415;
  if (code === 'CLIP_STORE_BUSY') return 503;
  if (code === 'CLIP_LIMIT_REACHED') return 409;
  return 400;
}

export async function handleShadowingClipsGet(
  _request: Request,
  deps: ShadowingClipsHandlerDeps,
): Promise<Response> {
  if (!(await deps.isAuthenticated())) {
    return jsonResponse({ error: 'Cần đăng nhập.' }, 401);
  }
  const clips = listUserShadowingClips(deps.dbFile, deps.storePath);
  return jsonResponse({ clips, whisperAvailable: deps.whisperAvailable }, 200);
}

export async function handleShadowingClipsPost(
  request: Request,
  deps: ShadowingClipsHandlerDeps,
): Promise<Response> {
  if (!(await deps.isAuthenticated())) {
    return jsonResponse({ error: 'Cần đăng nhập.' }, 401);
  }
  if (!deps.sameOriginCheck(request)) {
    return jsonResponse({ error: 'Nguồn yêu cầu không hợp lệ.' }, 403);
  }

  const contentType = (request.headers.get('content-type') ?? '').toLowerCase();
  const now = deps.now ? deps.now() : new Date();

  if (contentType.includes('multipart/form-data')) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return jsonResponse({ error: 'Dữ liệu tải lên không hợp lệ.' }, 400);
    }

    const file = form.get('file');
    if (!(file instanceof Blob)) {
      return jsonResponse({ error: 'Thiếu tệp âm thanh hoặc video.' }, 400);
    }
    if (file.size <= 0) {
      return jsonResponse({ error: 'Tệp tải lên đang trống.' }, 400);
    }
    if (file.size > MAX_CLIP_UPLOAD_BYTES) {
      return jsonResponse(
        { error: `Tệp vượt giới hạn ${MAX_CLIP_UPLOAD_BYTES / (1024 * 1024)} MB.` },
        413,
      );
    }

    const rawMeta = form.get('metadata');
    if (typeof rawMeta !== 'string' || Buffer.byteLength(rawMeta, 'utf8') > MAX_JSON_BODY_BYTES) {
      return jsonResponse({ error: 'Thiếu hoặc sai siêu dữ liệu clip.' }, 400);
    }
    let parsedMeta: Record<string, unknown>;
    try {
      const parsed = JSON.parse(rawMeta) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return jsonResponse({ error: 'Siêu dữ liệu clip không hợp lệ.' }, 400);
      }
      parsedMeta = parsed as Record<string, unknown>;
    } catch {
      return jsonResponse({ error: 'Siêu dữ liệu JSON không hợp lệ.' }, 400);
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const declaredMime = String(form.get('mime') || file.type || '');
    const uploadCheck = validateUploadInput({ mime: declaredMime, size: bytes.length, bytes });
    if (!uploadCheck.ok) {
      return jsonResponse({ error: uploadCheck.message, code: uploadCheck.code }, errorStatusForCode(uploadCheck.code));
    }

    const draftInput: ClipDraftInput = {
      kind: 'file',
      title: String(parsedMeta.title ?? ''),
      level: typeof parsedMeta.level === 'string' ? parsedMeta.level : 'N5',
      topic: typeof parsedMeta.topic === 'string' ? parsedMeta.topic : '',
      durationMs: Number(parsedMeta.durationMs),
      clipStartMs: Number(parsedMeta.clipStartMs),
      clipEndMs: Number(parsedMeta.clipEndMs),
      segments: Array.isArray(parsedMeta.segments) ? (parsedMeta.segments as ClipDraftInput['segments']) : [],
    };
    const draftCheck = validateClipDraft(draftInput);
    if (!draftCheck.ok) {
      return jsonResponse({ error: draftCheck.message, code: draftCheck.code }, 400);
    }

    try {
      const created = createUserFileClip({
        draft: draftInput,
        bytes,
        mime: uploadCheck.value.mime,
        dbFile: deps.dbFile,
        storePath: deps.storePath,
        mediaDir: deps.mediaDir,
        now,
      });
      const enriched = deps.enrichClip ? await deps.enrichClip(created.clip) : { clip: created.clip };
      return jsonResponse({ clip: enriched.clip, meta: enriched.meta }, 201);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'CREATE_FAILED';
      const status = errorStatusForCode(code);
      return jsonResponse(
        { error: status === 503 ? 'Đang lưu clip, thử lại sau.' : 'Không lưu được clip.', code },
        status,
      );
    }
  }

  let body: Record<string, unknown>;
  try {
    const text = await request.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_JSON_BODY_BYTES) {
      return jsonResponse({ error: 'Dữ liệu quá lớn.' }, 413);
    }
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return jsonResponse({ error: 'Dữ liệu không hợp lệ.' }, 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'Dữ liệu JSON không hợp lệ.' }, 400);
  }

  if (body.kind !== 'youtube') {
    return jsonResponse({ error: 'Nguồn YouTube cần gửi kind="youtube".' }, 400);
  }

  const draftInput: ClipDraftInput = {
    kind: 'youtube',
    title: String(body.title ?? ''),
    level: typeof body.level === 'string' ? body.level : 'N5',
    topic: typeof body.topic === 'string' ? body.topic : '',
    durationMs: Number(body.durationMs),
    clipStartMs: Number(body.clipStartMs),
    clipEndMs: Number(body.clipEndMs),
    youtubeUrlOrId: typeof body.youtubeUrlOrId === 'string' ? body.youtubeUrlOrId : String(body.youtubeId ?? ''),
    segments: Array.isArray(body.segments) ? (body.segments as ClipDraftInput['segments']) : [],
  };
  const draftCheck = validateClipDraft(draftInput);
  if (!draftCheck.ok) {
    return jsonResponse({ error: draftCheck.message, code: draftCheck.code }, 400);
  }

  try {
    const created = createUserYoutubeClip({
      draft: draftInput,
      dbFile: deps.dbFile,
      storePath: deps.storePath,
      now,
    });
    const enriched = deps.enrichClip ? await deps.enrichClip(created.clip) : { clip: created.clip };
    return jsonResponse({ clip: enriched.clip, meta: enriched.meta }, 201);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'CREATE_FAILED';
    const status = errorStatusForCode(code);
    return jsonResponse(
      { error: status === 503 ? 'Đang lưu clip, thử lại sau.' : 'Không lưu được clip YouTube.', code },
      status,
    );
  }
}

export async function handleShadowingClipsDelete(
  request: Request,
  deps: ShadowingClipsHandlerDeps,
): Promise<Response> {
  if (!(await deps.isAuthenticated())) {
    return jsonResponse({ error: 'Cần đăng nhập.' }, 401);
  }
  if (!deps.sameOriginCheck(request)) {
    return jsonResponse({ error: 'Nguồn yêu cầu không hợp lệ.' }, 403);
  }
  const url = new URL(request.url);
  const id = url.searchParams.get('id') ?? '';
  if (!id || !id.startsWith(USER_CLIP_PREFIX)) {
    return jsonResponse({ error: 'Mã clip không hợp lệ.' }, 400);
  }
  try {
    const deleted = deleteUserClip({
      id,
      dbFile: deps.dbFile,
      storePath: deps.storePath,
      mediaDir: deps.mediaDir,
    });
    if (!deleted) {
      return jsonResponse({ error: 'Không tìm thấy clip tự tạo.' }, 404);
    }
    return jsonResponse({ deleted: true, id }, 200);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'DELETE_FAILED';
    return jsonResponse(
      { error: code === 'CLIP_STORE_BUSY' ? 'Đang lưu, thử lại.' : 'Không xóa được clip.' },
      code === 'CLIP_STORE_BUSY' ? 503 : 400,
    );
  }
}

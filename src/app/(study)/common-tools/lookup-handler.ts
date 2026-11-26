import { NextResponse } from 'next/server';
import { openContentDatabase } from '../../../core/content.ts';
import type { CardType } from '../../../core/review.ts';
import { lookupWord } from './lookup.ts';
import type { LookupSaveSource } from './lookup-popup-model.ts';
import {
  getSavedSentenceForItem,
  saveLookupItemToNotebook,
  saveLookupItemToSrs,
} from './lookup-store.ts';
import { tokenizeJapaneseSentence } from './tokenize.ts';

export type LookupHandlerDeps = {
  isAuthenticated: () => Promise<boolean>;
  sameOriginCheck: (request: Request) => boolean;
  readBody: (request: Request) => Promise<string>;
  dbPath: string;
  contextPath: string;
  jmdictPath?: string;
  now?: () => Date;
};

const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
};

export async function handleLookupGet(request: Request, deps: LookupHandlerDeps) {
  if (!(await deps.isAuthenticated())) {
    return NextResponse.json(
      { error: 'Cần đăng nhập.' },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }
  const url = new URL(request.url);
  if (url.searchParams.has('tokenize')) {
    const rawText = url.searchParams.get('tokenize') ?? '';
    const text = rawText.normalize('NFC');
    if (text.includes('\0') || !text.trim() || text.length > 2200) {
      return NextResponse.json(
        { error: 'Câu cần tách từ không hợp lệ.' },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }
    const tokens = await tokenizeJapaneseSentence(text);
    return NextResponse.json({ text, tokens }, { status: 200, headers: NO_STORE_HEADERS });
  }
  const rawQuery = url.searchParams.get('q') ?? '';
  const rawBase = url.searchParams.get('base');
  if (rawQuery.includes('\0') || !rawQuery.normalize('NFC').trim()) {
    return NextResponse.json(
      { error: 'Thiếu từ cần tra.' },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }
  const db = openContentDatabase(deps.dbPath);
  try {
    const payload = lookupWord(
      db,
      rawQuery,
      rawBase,
      (itemId) => getSavedSentenceForItem(itemId, deps.contextPath),
      deps.jmdictPath !== undefined ? { jmdictPath: deps.jmdictPath } : undefined,
    );
    return NextResponse.json(payload, { status: 200, headers: NO_STORE_HEADERS });
  } finally {
    db.close();
  }
}

export async function handleLookupPost(request: Request, deps: LookupHandlerDeps) {
  if (!(await deps.isAuthenticated())) {
    return NextResponse.json(
      { error: 'Cần đăng nhập.' },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }
  if (!deps.sameOriginCheck(request)) {
    return NextResponse.json(
      { error: 'Nguồn yêu cầu không hợp lệ.' },
      { status: 403, headers: NO_STORE_HEADERS },
    );
  }
  let input: unknown;
  try {
    input = JSON.parse(await deps.readBody(request));
  } catch {
    return NextResponse.json(
      { error: 'Dữ liệu không hợp lệ.' },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return NextResponse.json(
      { error: 'Dữ liệu không hợp lệ.' },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }
  const body = input as Record<string, unknown>;
  if (typeof body.itemId !== 'string' || !body.itemId.trim()) {
    return NextResponse.json(
      { error: 'Thiếu mã nội dung cần lưu.' },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }
  const notebookOnly = body.notebookOnly === true;
  const sourceKind =
    typeof body.sourceKind === 'string' ? (body.sourceKind as LookupSaveSource) : undefined;
  const jlptDate = typeof body.jlptDate === 'string' ? body.jlptDate : null;
  const jlptQuestionId = typeof body.jlptQuestionId === 'string' ? body.jlptQuestionId : null;
  const jlptQuestionNumber =
    typeof body.jlptQuestionNumber === 'number' ? body.jlptQuestionNumber : null;

  if (!notebookOnly && (typeof body.sentenceJa !== 'string' || !body.sentenceJa.trim())) {
    return NextResponse.json(
      { error: 'Thiếu câu gốc để lưu kèm.' },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }
  const cardType = typeof body.cardType === 'string' ? (body.cardType as CardType) : 'recognition';
  try {
    const result = notebookOnly
      ? saveLookupItemToNotebook({
          dbPath: deps.dbPath,
          contextPath: deps.contextPath,
          jmdictPath: deps.jmdictPath,
          itemId: body.itemId,
          sentenceJa: typeof body.sentenceJa === 'string' ? body.sentenceJa : null,
          sentenceVi: typeof body.sentenceVi === 'string' ? body.sentenceVi : null,
          sourceClipId: typeof body.sourceClipId === 'string' ? body.sourceClipId : null,
          sourceKind,
          jlptDate,
          jlptQuestionId,
          jlptQuestionNumber,
          now: deps.now?.(),
        })
      : saveLookupItemToSrs({
          dbPath: deps.dbPath,
          contextPath: deps.contextPath,
          jmdictPath: deps.jmdictPath,
          itemId: body.itemId,
          cardType,
          sentenceJa: String(body.sentenceJa),
          sentenceVi: typeof body.sentenceVi === 'string' ? body.sentenceVi : null,
          sourceClipId: typeof body.sourceClipId === 'string' ? body.sourceClipId : null,
          sourceKind,
          jlptDate,
          jlptQuestionId,
          jlptQuestionNumber,
          now: deps.now?.(),
        });
    return NextResponse.json(result, {
      status: result.created ? 201 : 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const status =
      code === 'ITEM_NOT_FOUND'
        ? 404
        : code === 'INVALID_CARD' || code === 'INVALID_SENTENCE' || code === 'INVALID_SOURCE'
          ? 400
          : 503;
    const message =
      status === 404
        ? 'Không tìm thấy mục cần lưu.'
        : status === 400
          ? 'Nội dung, nguồn hoặc câu gốc không hợp lệ.'
          : 'Chưa thể lưu từ lúc này. Thử lại sau.';
    return NextResponse.json({ error: message }, { status, headers: NO_STORE_HEADERS });
  }
}

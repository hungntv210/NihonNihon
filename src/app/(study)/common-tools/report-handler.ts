import { NextResponse } from 'next/server';
import { markTranslationReport } from './report-store.ts';

export type ReportHandlerDeps = {
  isAuthenticated: () => Promise<boolean>;
  sameOriginCheck: (request: Request) => boolean;
  readBody: (request: Request) => Promise<string>;
  dbPath: string;
  now?: () => Date;
};

const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
};

export async function handleReportPost(request: Request, deps: ReportHandlerDeps) {
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

  let rawBody: string;
  try {
    rawBody = await deps.readBody(request);
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    return NextResponse.json(
      { error: code === 'BODY_TOO_LARGE' ? 'Dữ liệu quá lớn.' : 'Dữ liệu không hợp lệ.' },
      { status: code === 'BODY_TOO_LARGE' ? 413 : 400, headers: NO_STORE_HEADERS },
    );
  }

  let input: unknown;
  try {
    input = JSON.parse(rawBody);
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
  try {
    const result = markTranslationReport(
      deps.dbPath,
      body.translationId,
      body.reason,
      deps.now?.(),
    );
    return NextResponse.json(result, {
      status: result.created ? 201 : 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    const status =
      code === 'TRANSLATION_NOT_FOUND' ? 404 : code === 'INVALID_REPORT' ? 400 : 503;
    const message =
      status === 404
        ? 'Không tìm thấy bản dịch đang hoạt động để đánh dấu.'
        : status === 400
          ? 'Yêu cầu đánh dấu không hợp lệ.'
          : 'Chưa thể đánh dấu lúc này. Thử lại sau.';
    return NextResponse.json({ error: message }, { status, headers: NO_STORE_HEADERS });
  }
}

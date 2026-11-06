import { NextResponse } from 'next/server';
import { requireSession } from '../../../../server/auth.ts';
import { boundedBody, sameOrigin } from '../../../../server/http.ts';
import { databasePath } from '../../../../core/config.ts';
import { reportKanjiTranslation } from '../reporting.ts';
export async function POST(request: Request) {
  await requireSession();
  if (!sameOrigin(request))
    return NextResponse.json({ error: 'Nguồn yêu cầu không hợp lệ.' }, { status: 403 });
  let value;
  try {
    value = JSON.parse(await boundedBody(request));
  } catch {
    return NextResponse.json({ error: 'Báo cáo không hợp lệ.' }, { status: 400 });
  }
  try {
    const result = reportKanjiTranslation(databasePath(), value?.translationId, value?.reason);
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    return NextResponse.json(
      {
        error:
          code === 'STALE_TRANSLATION'
            ? 'Bản dịch đã thay đổi. Tải lại trang trước khi báo sai.'
            : code === 'INVALID_REPORT'
              ? 'Nhập lý do từ 3 đến 500 ký tự.'
              : 'Chưa lưu được báo cáo. Hãy thử lại.',
      },
      { status: code === 'STALE_TRANSLATION' ? 409 : code === 'INVALID_REPORT' ? 400 : 503 },
    );
  }
}

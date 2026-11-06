import { NextResponse } from 'next/server';
import { requireSession } from '../../../../server/auth.ts';
import { boundedBody, sameOrigin } from '../../../../server/http.ts';
import { databasePath } from '../../../../core/config.ts';
import { reportTranslation } from '../report-data.ts';
export async function POST(request: Request) {
  await requireSession();
  if (!sameOrigin(request))
    return NextResponse.json({ error: 'Nguồn yêu cầu không hợp lệ.' }, { status: 403 });
  let input;
  try {
    input = JSON.parse(await boundedBody(request));
  } catch {
    return NextResponse.json({ error: 'Dữ liệu không hợp lệ.' }, { status: 400 });
  }
  if (
    !input ||
    typeof input.itemId !== 'string' ||
    typeof input.translationId !== 'string' ||
    typeof input.reason !== 'string'
  )
    return NextResponse.json({ error: 'Hãy nhập lý do báo sai.' }, { status: 400 });
  try {
    const result = reportTranslation(
      databasePath(),
      input.itemId,
      input.translationId,
      input.reason,
    );
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return NextResponse.json(
      {
        error:
          message === 'REPORT_NOT_FOUND'
            ? 'Bản dịch đã thay đổi. Hãy tải lại trang.'
            : message === 'INVALID_REPORT'
              ? 'Lý do cần từ 5 đến 1.000 ký tự.'
              : 'Chưa gửi được báo sai. Bạn thử lại sau.',
      },
      { status: message === 'REPORT_NOT_FOUND' ? 404 : message === 'INVALID_REPORT' ? 400 : 503 },
    );
  }
}

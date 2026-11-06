import { NextResponse } from 'next/server';
import { requireSession } from '../../../../server/auth.ts';
import { sameOrigin, boundedBody } from '../../../../server/http.ts';
import { databasePath } from '../../../../core/config.ts';
import { recordReview } from '../repository.ts';
export async function POST(request: Request) {
  await requireSession();
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Nguồn yêu cầu không hợp lệ.' }, { status: 403 });
  let event;try { event = JSON.parse(await boundedBody(request)); } catch { return NextResponse.json({ error: 'Dữ liệu không hợp lệ.' }, { status: 400 }); }
  try { return NextResponse.json(await recordReview(databasePath(), event)); }
  catch (e) { const code = e instanceof Error ? e.message : '';const status = code === 'CARD_NOT_FOUND' ? 404 : ['REVIEW_CONFLICT','REVIEW_ID_REUSED'].includes(code) ? 409 : ['INVALID_REVIEW','INVALID_TIME','INVALID_RATING','UNSUPPORTED_SCHEDULER','UNSUPPORTED_CARD','INVALID_STATE'].includes(code) ? 400 : 503;return NextResponse.json({ error: status === 409 ? 'Thẻ đã thay đổi ở phiên khác. Giữ lượt ôn này để kiểm tra.' : status === 503 ? 'Chưa lưu được lượt ôn. Hãy thử lại.' : 'Lượt ôn không hợp lệ.' }, { status }); }
}

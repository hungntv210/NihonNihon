import { NextResponse } from 'next/server';
import { addToReview } from '../../../../server/dal.ts';
import { boundedBody, sameOrigin } from '../../../../server/http.ts';
import { requireSession } from '../../../../server/auth.ts';
import type { CardType } from '../../../../core/review.ts';

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
  if (!input || typeof input.itemId !== 'string' || typeof input.cardType !== 'string')
    return NextResponse.json({ error: 'Thiếu nội dung hoặc loại thẻ.' }, { status: 400 });
  try {
    const result = await addToReview(input.itemId, input.cardType as CardType);
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = message === 'ITEM_NOT_FOUND' ? 404 : message === 'INVALID_CARD' ? 400 : 503;
    return NextResponse.json(
      {
        error:
          status === 503
            ? 'Chưa thể lưu thẻ. Thử lại sau.'
            : 'Nội dung hoặc loại thẻ không hợp lệ.',
      },
      { status },
    );
  }
}

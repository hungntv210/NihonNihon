import { NextResponse } from 'next/server';
import { readVapidConfig } from '../../../../core/push.ts';
import {
  deletePushSubscription,
  listPushSubscriptions,
  savePushSubscription,
} from '../../../../server/dal.ts';
import { boundedBody, sameOrigin } from '../../../../server/http.ts';

export async function GET() {
  const subs = await listPushSubscriptions();
  const vapid = readVapidConfig();
  return NextResponse.json({
    configured: vapid !== null,
    vapidPublicKey: vapid?.publicKey ?? null,
    subscriptionCount: subs.length,
    endpoints: subs.map(s => s.endpoint),
  });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'Nguồn yêu cầu không hợp lệ.' }, { status: 403 });
  }
  try {
    const body = JSON.parse(await boundedBody(request));
    await savePushSubscription(body, request.headers.get('user-agent') ?? '');
    const subs = await listPushSubscriptions();
    return NextResponse.json({ saved: true, subscriptionCount: subs.length }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Đăng ký thông báo không hợp lệ.' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: 'Nguồn yêu cầu không hợp lệ.' }, { status: 403 });
  }
  let endpoint: string | undefined;
  try {
    const raw = await boundedBody(request);
    if (raw.trim()) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed && typeof parsed.endpoint === 'string' && parsed.endpoint.length <= 2048) {
        endpoint = parsed.endpoint;
      }
    }
  } catch {
    return NextResponse.json({ error: 'Dữ liệu hủy đăng ký không hợp lệ.' }, { status: 400 });
  }
  await deletePushSubscription(endpoint);
  const subs = await listPushSubscriptions();
  return NextResponse.json({ deleted: true, subscriptionCount: subs.length });
}

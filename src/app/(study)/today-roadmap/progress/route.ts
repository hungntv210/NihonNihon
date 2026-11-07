import { NextResponse } from 'next/server';
import { requireSession } from '../../../../server/auth.ts';
import { sameOrigin, boundedBody } from '../../../../server/http.ts';
import { getTodaySettings } from '../server.ts';
import { localClock, lessonAccess, tasks, type Progress } from '../model.ts';
import { roadmapPath, updateProgress } from '../repository.ts';
export async function POST(request: Request) {
  await requireSession();
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Nguồn yêu cầu không hợp lệ.' }, { status: 403 });
  let body: Record<string, unknown>;
  try { body = JSON.parse(await boundedBody(request));if (!body || Array.isArray(body) || typeof body !== 'object') throw Error(); }
  catch { return NextResponse.json({ error: 'Dữ liệu không hợp lệ.' }, { status: 400 }); }
  const settings = await getTodaySettings(), date = localClock(new Date(), settings.timeZone).date;
  try {
    updateProgress(roadmapPath(), p => {
      if (body.action === 'short') { p.shortDays = [...new Set([...p.shortDays, date])]; }
      else if (body.action === 'start' && typeof body.task === 'string' && Object.hasOwn(tasks, body.task)) { if (['new', 'grammar'].includes(body.task) && lessonAccess(p, date, settings.startDate).locked) throw Error('INVALID_PROGRESS');p.activeTask = body.task; }
      else if (body.action === 'done') { p.activeTask = null;p.activity = [...new Set([...p.activity, date])]; }
      else if (body.action === 'shadow' && body.confirmed === true && (body.kind === 'regular' || body.kind === 'makeup') && typeof body.minutes === 'number' && Array.isArray(body.clips)) {
        if (p.shadow.some(s => s.date === date && s.kind === body.kind)) throw Error('DUPLICATE_SHADOW');
        const entry = { date, kind: body.kind, minutes: body.minutes, clips: body.clips.map(c => typeof c === 'string' ? c.trim() : c), method: 'manual' } as Progress['shadow'][number];
        p.shadow.push(entry);p.activity = [...new Set([...p.activity, date])];
      } else throw Error('INVALID_PROGRESS');
      return p;
    });
    return NextResponse.json({ saved: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = ['INVALID_PROGRESS', 'DUPLICATE_SHADOW'].includes(message) ? 400 : 503;
    return NextResponse.json({ error: status === 400 ? 'Kiểm tra thời lượng, clip và xác nhận. Mỗi loại buổi chỉ ghi một lần/ngày.' : 'Chưa lưu được tiến độ. Hãy thử lại; dữ liệu cũ được giữ nguyên.' }, { status });
  }
}


import { NextResponse } from 'next/server';
import { boundedBody, sameOrigin } from '../../../server/http.ts';
import { getStudyPreferences, saveStudyPreferences } from '../../../server/preferences.ts';
export async function GET() { return NextResponse.json(await getStudyPreferences()); }
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({error:'Nguồn yêu cầu không hợp lệ.'}, {status:403});
  try { return NextResponse.json(await saveStudyPreferences(JSON.parse(await boundedBody(request)))); }
  catch (error) {
    const code = error instanceof Error ? error.message : '';
    const message = code === 'INVALID_BREAK_TIMES'
      ? 'Hãy chọn 2–3 giờ nghỉ ban ngày khác nhau và trước giờ học tối.'
      : 'Cài đặt không hợp lệ.';
    return NextResponse.json({error:message}, {status:400});
  }
}

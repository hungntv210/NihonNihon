import { NextResponse } from 'next/server';
import { boundedBody, sameOrigin } from '../../../server/http.ts';
import { getStudyPreferences, saveStudyPreferences } from '../../../server/preferences.ts';
export async function GET() { return NextResponse.json(await getStudyPreferences()); }
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({error:'Nguồn yêu cầu không hợp lệ.'}, {status:403});
  try { return NextResponse.json(await saveStudyPreferences(JSON.parse(await boundedBody(request)))); }
  catch { return NextResponse.json({error:'Cài đặt không hợp lệ.'}, {status:400}); }
}

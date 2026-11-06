import { NextResponse } from 'next/server';
import { requireSession } from '../../../../server/auth.ts';
import { sameOrigin,boundedBody } from '../../../../server/http.ts';
import { databasePath } from '../../../../core/config.ts';
import { saveGrammarReport } from '../report-repository.ts';
export async function POST(request:Request){
  await requireSession();if(!sameOrigin(request))return NextResponse.json({error:'Nguồn yêu cầu không hợp lệ.'},{status:403});
  let input;try{input=JSON.parse(await boundedBody(request));}catch{return NextResponse.json({error:'Dữ liệu không hợp lệ.'},{status:400});}
  if(!input||typeof input.grammarId!=='string'||typeof input.translationId!=='string'||typeof input.reason!=='string')return NextResponse.json({error:'Thiếu thông tin báo sai.'},{status:400});
  try{const result=saveGrammarReport(databasePath(),input);return NextResponse.json(result,{status:result.created?201:200});}catch(error){const status=error instanceof Error&&error.message==='INVALID_REPORT'?400:error instanceof Error&&error.message==='REPORT_NOT_FOUND'?404:503;return NextResponse.json({error:status===503?'Chưa thể lưu báo sai.':'Bản dịch hoặc nội dung báo sai không hợp lệ.'},{status});}
}

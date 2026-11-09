import { NextResponse } from 'next/server';import { requireSession } from '../../../../server/auth.ts';import { sameOrigin,boundedBody } from '../../../../server/http.ts';import { dailyContext } from '../server-context.ts';import { gradeAnswer } from '../repository.ts';
export async function POST(request:Request){
 await requireSession();if(!sameOrigin(request))return NextResponse.json({error:'Nguồn yêu cầu không hợp lệ.'},{status:403});
 try{const input=JSON.parse(await boundedBody(request));if(typeof input.questionId!=='string'||!Number.isInteger(input.choice))return NextResponse.json({error:'Câu trả lời không hợp lệ.'},{status:400});const context=await dailyContext();return NextResponse.json(gradeAnswer(input,context,context.catalog));}
 catch(e){const code=e instanceof Error?e.message:'';return NextResponse.json({error:code==='STORE_BUSY'?'Đang lưu lượt trước, hãy thử lại.':'Chưa thể chấm câu này. Tải lại để kiểm tra nội dung.'},{status:code==='STORE_BUSY'?503:409});}
}

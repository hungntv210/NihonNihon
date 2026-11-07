import { NextResponse } from 'next/server';
import { requireSession } from '../../../server/auth.ts';
import { sameOrigin } from '../../../server/http.ts';
import { createBackup, restoreBackup } from '../../../core/backup.ts';
export const runtime='nodejs';
export async function GET() {await requireSession();try{return new Response(new Uint8Array(await createBackup()),{headers:{'Content-Type':'application/json','Content-Disposition':'attachment; filename="nihon-backup.json"','Cache-Control':'private, no-store'}});}catch{return NextResponse.json({error:'Sao lưu cần database G1 hoặc snapshot được cấu hình rõ ràng.'},{status:503});}}
export async function POST(request:Request) {
 await requireSession();if(!sameOrigin(request))return NextResponse.json({error:'Nguồn yêu cầu không hợp lệ.'},{status:403});
 const max=128*1024*1024;if(Number(request.headers.get('content-length')||0)>max)return new Response(null,{status:413});
 const chunks:Uint8Array[]=[];let size=0;const reader=request.body?.getReader();if(!reader)return new Response(null,{status:400});
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();return new Response(null,{status:413});}chunks.push(value);}await restoreBackup(Buffer.concat(chunks));return NextResponse.json({restored:true});}catch(error){if(error instanceof AggregateError)return NextResponse.json({error:'Khôi phục gặp lỗi phục hồi file. Bản cũ được giữ trên máy chủ; dừng ghi và kiểm tra trước khi thử lại.'},{status:500});return NextResponse.json({error:'Bản sao không hợp lệ hoặc chưa thể khôi phục.'},{status:400});}finally{reader.releaseLock();}
}

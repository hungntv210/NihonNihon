import fs from 'node:fs/promises';
import path from 'node:path';
import {requireSession} from '../../../../../../server/auth.ts';
import {approvedItems,directory} from '../../store.ts';
export async function GET(_:Request,{params}:{params:Promise<{name:string}>}){
  await requireSession();
  const {name}=await params;
  if(!approvedItems().some(q=>q.asset===name || q.passage===name)) return new Response(null,{status:404});
  return new Response(await fs.readFile(path.join(directory(),name)),{headers:{'Content-Type':'image/png','Cache-Control':'private, no-store'}});
}

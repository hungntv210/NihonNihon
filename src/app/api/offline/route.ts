import { NextResponse } from 'next/server';
import { requireSession } from '../../../server/auth.ts';
import { sameOrigin, boundedBody } from '../../../server/http.ts';
import { authConfig } from '../../../core/config.ts';
import { verifyPassword } from '../../../core/session.ts';
export async function POST(request:Request){await requireSession();if(!sameOrigin(request))return new Response(null,{status:403});try{const {password}=JSON.parse(await boundedBody(request));return NextResponse.json({ok:typeof password==='string'&&verifyPassword(password,authConfig().passwordHash)},{headers:{'Cache-Control':'no-store'}});}catch{return new Response(null,{status:400});}}

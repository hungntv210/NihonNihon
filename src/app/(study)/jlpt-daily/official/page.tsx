import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {createHash,randomUUID} from 'node:crypto';
import {requireSession} from '../../../../server/auth.ts';
import {withContentDatabase} from '../../../../server/dal.ts';
import {sourceCatalog} from '../catalog.ts';
import {approvedItems,lastResults,saveResult} from './store.ts';

export default async function Official({searchParams}:{searchParams:Promise<{level?:string}>}){
  await requireSession();
  const bank=approvedItems();
  if(!bank.length) notFound();
  const {level}=await searchParams;
  const items=bank.filter(q=>q.level===level);
  const token=randomUUID();
  const revision=createHash('sha256').update(JSON.stringify(items)).digest('hex');
  async function submit(form:FormData){
    'use server';
    await requireSession();
    const current=approvedItems().filter(q=>q.level===level);
    if(!current.length || createHash('sha256').update(JSON.stringify(current)).digest('hex')!==revision) notFound();
    saveResult(current,form,token,await withContentDatabase(sourceCatalog));
    redirect('/jlpt-daily/official#ket-qua');
  }
  return <section><Link href="/jlpt-daily">JLPT mỗi tối</Link><h1>Đề chuẩn</h1>
    <p>Bộ đề mẫu chính thức 2018 · The Japan Foundation / JEES. <a href="https://www.jlpt.jp/e/samples/sampleindex.html">Nguồn JLPT</a></p>
    <nav aria-label="Chọn bộ đề">{Array.from(new Set(bank.map(q=>q.level))).sort().reverse().map(l=><Link key={l} className="button" href={'?level='+l}>{l}</Link>)}</nav>
    {!!items.length && <form action={submit}><h2>Bộ {level} · {items.length} câu</h2>
      {items.map((q,i)=><fieldset key={q.id}><legend>{q.section==='V'?'Từ vựng':'Ngữ pháp'} · Câu {q.number}</legend><p>{q.instruction}</p>
      {q.passage && items[i-1]?.passage!==q.passage && <img src={'/jlpt-daily/official/media/'+q.passage} style={{maxWidth:'100%'}} alt="Đoạn văn dùng chung cho nhóm câu sau"/>}
      <img src={'/jlpt-daily/official/media/'+q.asset} alt={'Câu '+q.number+' và bốn lựa chọn trên trang '+q.page} style={{maxWidth:'100%',display:'block'}}/>
      {[1,2,3,4].map(n=><label key={n} className="button"><input type="radio" name={q.id} value={n} required/>{n}</label>)}</fieldset>)}
      <button className="button primary" type="submit">Chấm bài</button></form>}
    <h2 id="ket-qua">Kết quả đề chuẩn</h2>{lastResults().map(r=><details key={r.at}><summary>{r.level} · {new Date(r.at).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})} · {(['V','G'] as const).map(s=>{const a=r.answers.filter(q=>q.section===s);return (s==='V'?'Từ vựng ':'Ngữ pháp ')+a.filter(q=>q.correct).length+'/'+a.length;}).join(' · ')}</summary><ol>{r.answers.map(a=>{const q=bank.find(item=>item.id===a.id);return q && <li key={a.id}>{q.section} {q.number} · {a.correct?'Đúng':'Sai'} · Đáp án {q.key}{q.explanation && <p>{q.explanation}</p>}</li>;})}</ol></details>)}
  </section>;
}

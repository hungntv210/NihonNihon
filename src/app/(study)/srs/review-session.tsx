'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toHiragana } from 'wanakana';
import { JaText, ViText } from '../../../components/text.tsx';
import { SourceLabel } from '../../../components/source-label.tsx';
import { scheduler, previews, intervalLabel, type Engine, type StudySession } from './model.ts';
import { queueReview, pendingReviews, acknowledge } from './outbox.ts';
import css from './srs.module.css';
const labels = ['Quên', 'Khó', 'Được', 'Dễ'];

export function ReviewSession({ initial }: { initial: StudySession }) {
  const [session,setSession] = useState(initial), [seen,setSeen] = useState<string[]>([]), [revealed,setRevealed] = useState(false), [answer,setAnswer] = useState(''), [engine,setEngine] = useState<Engine>(), [ready,setReady] = useState(false), [busy,setBusy] = useState(false), [pendingCount,setPendingCount] = useState(0), [message,setMessage] = useState(''), [online,setOnline] = useState(true), [paused,setPaused] = useState(false), [voice,setVoice] = useState<SpeechSynthesisVoice>();
  const [gestures,setGestures] = useState(false);
  const syncing=useRef(false), touch=useRef<{ x:number;y:number }|null>(null), offset=useRef(Date.parse(initial.serverNow)-Date.now()), started=useRef(Date.now());
  const cacheKey='nihon:srs:session:'+initial.mode;
  useEffect(()=>{let alive=true;offset.current=Date.parse(initial.serverNow)-Date.now();setGestures(false);void scheduler().then(s=>{if(alive)setEngine(s);}).catch(()=>setMessage('Chưa khởi tạo được lịch ôn. Hãy tải lại khi có mạng.'));
    void pendingReviews().then(events=>{if(!alive)return;setPendingCount(events.length);try{const saved=JSON.parse(localStorage.getItem(cacheKey)||'null');if(saved?.version===1&&saved.session?.mode===initial.mode&&Array.isArray(saved.session.cards)&&Array.isArray(saved.seen)&&saved.seen.length<saved.session.cards.length){setSession(saved.session);setSeen([...new Set([...saved.seen,...events.map(e=>e.cardId)])] as string[]);}else{setSession(initial);setSeen(events.map(e=>e.cardId));}}catch{setSession(initial);setMessage('Không khôi phục được phiên cũ; các lượt đã chấm vẫn được giữ trong hàng đồng bộ.');}setReady(true);}).catch(()=>setMessage('Trình duyệt chưa cho phép lưu lượt ôn trên thiết bị.'));
    const connection=()=>setOnline(navigator.onLine);connection();window.addEventListener('online',connection);window.addEventListener('offline',connection);
    const voices=()=>setVoice(window.speechSynthesis?.getVoices().find(v=>v.lang.startsWith('ja')&&v.localService));voices();window.speechSynthesis?.addEventListener('voiceschanged',voices);
    return()=>{alive=false;window.removeEventListener('online',connection);window.removeEventListener('offline',connection);window.speechSynthesis?.removeEventListener('voiceschanged',voices);window.speechSynthesis?.cancel();};
  },[cacheKey,initial]);
  useEffect(()=>{if(ready){try{localStorage.setItem(cacheKey,JSON.stringify({version:1,session,seen}));}catch{/* The durable review outbox is separate from the optional session snapshot. */}}},[cacheKey,ready,session,seen]);
  async function sync() {
    if(syncing.current||!navigator.onLine)return;syncing.current=true;
    try{for(const event of await pendingReviews()){
      const response=await fetch('/srs/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(event)});
      if(response.redirected||response.status===401){setMessage('Đăng nhập lại để đồng bộ; lượt ôn vẫn được giữ trên thiết bị.');break;}
      if(!response.ok){setMessage(response.status===409?'Có thẻ đã thay đổi ở phiên khác. Lượt ôn được giữ lại để kiểm tra.':'Chưa đồng bộ được. Lượt ôn vẫn được giữ trên thiết bị.');break;}
      const receipt=await response.json();if(receipt.reviewId!==event.reviewId)throw Error('Receipt mismatch');await acknowledge(event.reviewId);
    }}catch{setMessage('Mất kết nối. Các lượt đã chấm sẽ đồng bộ khi có mạng.');}finally{setPendingCount((await pendingReviews()).length);syncing.current=false;}
  }
  useEffect(()=>{if(ready&&online)void sync();},[ready,online,pendingCount]);
  const card=session.cards.find(c=>!seen.includes(c.cardId)), now=Date.now()+offset.current;
  let choices:{rating:number;dueAt:string}[]=[];try{if(card&&engine)choices=previews(card,new Date(now),engine);}catch{}
  async function rate(rating:number) {
    if(!card||!revealed||busy||!ready||!engine)return;setBusy(true);
    try{await queueReview({reviewId:crypto.randomUUID(),cardId:card.cardId,rating,reviewedAt:new Date(Date.now()+offset.current).toISOString(),baseUpdatedAt:card.updatedAt,elapsedMs:Math.min(3600000,Math.max(0,Date.now()-started.current))});setPendingCount((await pendingReviews()).length);setSeen(previous=>[...previous,card.cardId]);setRevealed(false);setAnswer('');started.current=Date.now();setMessage('Đã lưu lượt ôn trên thiết bị.');void sync();}catch{setMessage('Chưa lưu được lượt ôn. Giữ phiên mở và thử lại; thẻ chưa bị bỏ qua.');}finally{setBusy(false);}
  }
  function speak(){if(!card||!voice)return;const utterance=new SpeechSynthesisUtterance(card.reading||card.title);utterance.lang='ja-JP';utterance.voice=voice;speechSynthesis.cancel();speechSynthesis.speak(utterance);}
  const readingMode=card?.type==='reading'&&card.kind==='vocab'&&session.mode==='full';
  const correct=card?.reading&&toHiragana(answer.trim().normalize('NFC'))===toHiragana(card.reading);
  return <section className={css.root}><div className={css.toolbar}><nav aria-label="Chế độ ôn"><Link href="/srs?mode=full" aria-current={initial.mode==='full'?'page':undefined}>Buổi ôn · 20 thẻ</Link><Link href="/srs?mode=quick" aria-current={initial.mode==='quick'?'page':undefined}>Ôn nhanh · 15 thẻ</Link></nav><span>{online?'Có mạng':'Đang offline'} · {pendingCount} lượt chờ đồng bộ</span></div>
    {initial.mode==='quick'&&<button className="button button-small" aria-pressed={gestures} onClick={()=>setGestures(g=>!g)}>{gestures?'Tắt vuốt một tay':'Bật vuốt một tay'}</button>}
    {session.unsupported>0&&<p className={css.notice}>{session.unsupported} thẻ có loại hoặc trạng thái lịch chưa được hỗ trợ; lịch cũ được giữ nguyên.</p>}
    {session.due>200&&<p className={css.notice}>Hàng ôn đang nhiều. Nên giảm một nửa bài mới đến khi còn dưới 150 thẻ; bạn vẫn luôn ôn được.</p>}
    <div className={css.progress}><span>Đã ôn {session.cards.filter(c=>seen.includes(c.cardId)).length}/{session.cards.length}</span><progress max={Math.max(1,session.cards.length)} value={session.cards.filter(c=>seen.includes(c.cardId)).length} /><button className="quiet-button" onClick={()=>setPaused(p=>!p)}>{paused?'Tiếp tục':'Tạm dừng'}</button></div>
    {!ready||!engine?<p role="status">Đang chuẩn bị lịch ôn…</p>:paused?<div className={css.card}><h2>Đã tạm dừng.</h2><p>Lượt đã chấm được lưu trên thiết bị. Bạn có thể quay lại sau.</p><button className="button button-primary" onClick={()=>setPaused(false)}>Tiếp tục ôn</button></div>:card?<article className={`${css.card} ${gestures?css.gestureOn:''}`} onTouchStart={e=>{if(!gestures||e.touches.length!==1||(e.target as HTMLElement).closest('button,input,a')){touch.current=null;return;}touch.current={x:e.touches[0].clientX,y:e.touches[0].clientY};}} onTouchCancel={()=>{touch.current=null;}} onTouchEnd={e=>{const start=touch.current;touch.current=null;if(!gestures||!start||!revealed||busy)return;const dx=e.changedTouches[0].clientX-start.x,dy=e.changedTouches[0].clientY-start.y;if(Math.max(Math.abs(dx),Math.abs(dy))<85)return;if(Math.abs(dx)>Math.abs(dy))void rate(dx<0?1:3);else if(dy<0)void rate(4);}}>
      <div className={css.cardTop}><span>{card.kind==='kanji'?'KANJI':card.kind==='grammar'?'NGỮ PHÁP':'TỪ VỰNG'}</span><span>FSRS · mục tiêu 90%</span></div>
      <p className={css.prompt}>{readingMode?'Gõ cách đọc hiragana':card.type==='recall'&&session.mode==='full'?'Nhớ từ tiếng Nhật':'Nhớ cách đọc và nghĩa'}</p>
      {card.type==='recall'&&session.mode==='full'?<p className={css.recall}>{card.vietnamese?.text??card.english}</p>:card.type==='listening'&&session.mode==='full'&&!revealed?<button className="button" onClick={speak} disabled={!voice}>Nghe tiếng Nhật</button>:<JaText as="h2" className={css.title}>{card.title}</JaText>}
      {readingMode&&!revealed&&<label className={css.input}>Cách đọc<input value={answer} onChange={e=>setAnswer(toHiragana(e.target.value,{IMEMode:true}).normalize('NFC'))} autoComplete="off" aria-label="Cách đọc hiragana" /></label>}
      {!revealed?<button className="button button-primary" onClick={()=>setRevealed(true)}>Hiện đáp án</button>:<div className={css.answer}>{card.type==='recall'&&<JaText as="p" className={css.title}>{card.title}</JaText>}{card.reading&&<JaText as="p" className={css.reading}>{card.reading}</JaText>}{readingMode&&answer&&<p>{correct?'Cách đọc trùng khớp.':'Cách đọc chưa trùng. Hãy đối chiếu đáp án rồi tự đánh giá.'}</p>}{card.hanViet&&<><ViText as="strong">{card.hanViet.text}</ViText><SourceLabel translation={card.hanViet} /></>}{card.vietnamese&&<ViText as="p" className={css.meaning}>{card.vietnamese.text}</ViText>}<p lang="en">{card.english}</p><SourceLabel translation={card.vietnamese} /><button className="button button-small" disabled={!voice} onClick={speak}>Nghe cách đọc</button>{!voice&&<small>Thiết bị chưa có giọng Nhật cục bộ. Không tự phát âm thanh.</small>}</div>}
      {revealed&&<div className={css.grades}>{choices.map(choice=><button key={choice.rating} disabled={busy} onClick={()=>void rate(choice.rating)}><strong>{labels[choice.rating-1]}</strong><small>{intervalLabel(choice.dueAt,now)}</small></button>)}</div>}
      <p className={css.hint}>{gestures?'Đang bật vuốt: trái Quên · phải Được · lên Dễ. Khó dùng nút.':'Mở đáp án rồi chọn một trong bốn mức tự đánh giá.'}</p>
    </article>:<div className={css.card}><span className={css.done}>✓</span><h2>{session.cards.length?'Xong một phiên nhỏ.':'Chưa có thẻ đến hạn.'}</h2><p>Còn {Math.max(0,session.due-session.cards.length)} thẻ đến hạn ngoài phiên này.</p><Link className="button button-primary" href="/srs">Mở phiên tiếp theo</Link><Link className="text-link" href="/vocab">Chọn từ để ôn →</Link></div>}
    <div role="status" className={css.status}>{message}{pendingCount>0&&<button className="button button-small" disabled={!online} onClick={()=>void sync()}>Đồng bộ lại</button>}</div>
    <section className={css.forecast} aria-labelledby="forecast"><h2 id="forecast">Dự báo 7 ngày</h2><div>{session.forecast.map(day=><p key={day.day}><time dateTime={day.day}>{day.day.slice(5).split('-').reverse().join('/')}</time><strong>{day.count}</strong><small>thẻ</small></p>)}</div></section>
    <p className={css.note}>Mở phiên khi có mạng để tải thẻ. Phiên đang mở vẫn lưu lượt chấm khi offline và tự đồng bộ lại; mở app hoàn toàn offline sẽ cần nền PWA ở bước sau.</p>
  </section>;
}

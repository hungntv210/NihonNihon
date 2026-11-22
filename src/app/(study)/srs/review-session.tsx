'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {animateUI,snapshotCard,swapCards} from '../../../components/motion/animate.ts';
import {MotionProgress} from '../../../components/motion/data-motion.tsx';
import Link from 'next/link';
import { JaText, ViText } from '../../../components/text.tsx';
import { SourceLabel } from '../../../components/source-label.tsx';
import { ReportViButton } from '../common-tools/report-vi-button.tsx';
import { isCompatibleSessionCache, normalizeRetention, scheduler, previews, intervalLabel, type Engine, type StudySession } from './model.ts';
import { queueReview, pendingReviews, acknowledge } from './outbox.ts';
import { syncReviews } from './sync.ts';
import type { ReviewEvent } from './model.ts';
import css from './srs.module.css';
import {remainingDue} from '../../../components/pixel-scenes/model.ts';
import {Mascot} from '../../../components/mascot.tsx';
const labels = ['Quên', 'Khó', 'Được', 'Dễ'];
export type ToHiragana = (input?: string, options?: { IMEMode?: boolean }) => string;
type WanakanaModule = { toHiragana?: ToHiragana; default?: { toHiragana?: ToHiragana } };
export function createWanakanaLoader(importer: () => Promise<WanakanaModule> = () => import('wanakana')) {
  let cached: ToHiragana | null = null;
  let pending: Promise<ToHiragana> | null = null;
  const load = (): Promise<ToHiragana> => {
    if (cached) return Promise.resolve(cached);
    if (!pending) {
      pending = importer().then(
        mod => {
          const fn = mod.toHiragana ?? mod.default?.toHiragana;
          if (typeof fn !== 'function') throw new Error('wanakana toHiragana missing');
          cached = fn;
          return fn;
        },
        err => {
          pending = null;
          throw err;
        },
      );
    }
    return pending;
  };
  return {
    getCached: () => cached,
    load,
    async convertIme(value: string) {
      const fn = cached ?? await load();
      return fn(value, { IMEMode: true }).normalize('NFC');
    },
    async isReadingMatch(answer: string, reading: string) {
      const fn = cached ?? await load();
      return fn(answer.trim().normalize('NFC')) === fn(reading);
    },
  };
}
const wanakana = createWanakanaLoader();
export function dispatchSceneDueIfChanged(tracker:{initial:{due:number;cards:{cardId:string}[]};due:number},initial:{due:number;cards:{cardId:string}[]},seen:string[],target:Pick<EventTarget,'dispatchEvent'>=window){
  if(tracker.initial!==initial){tracker.initial=initial;tracker.due=remainingDue(initial,[]);}
  const remaining=remainingDue(initial,seen);
  if(remaining===tracker.due)return false;
  tracker.due=remaining;target.dispatchEvent(new CustomEvent('nihon-scene-due',{detail:remaining}));return true;
}

export function ReviewSession({ initial }: { initial: StudySession }) {
  const [session,setSession] = useState(initial), [seen,setSeen] = useState<string[]>([]), [revealed,setRevealed] = useState(false), [answer,setAnswer] = useState(''), [checking,setChecking] = useState(false), [readingMatch,setReadingMatch] = useState<boolean|null>(null), [engine,setEngine] = useState<Engine>(), [ready,setReady] = useState(false), [busy,setBusy] = useState(false), [pendingCount,setPendingCount] = useState(0), [message,setMessage] = useState(''), [online,setOnline] = useState(true), [paused,setPaused] = useState(false), [voice,setVoice] = useState<SpeechSynthesisVoice>();
  const [gestures,setGestures] = useState(false);
  const [conflicts,setConflicts] = useState<ReviewEvent[]>([]);
  const syncing=useRef(false), touch=useRef<{ x:number;y:number }|null>(null), offset=useRef(Date.parse(initial.serverNow)-Date.now()), started=useRef(Date.now()), sceneDue=useRef({initial,due:remainingDue(initial,[])});
  const article=useRef<HTMLElement>(null),oldCard=useRef<HTMLElement|null>(null),inputKeyboard=useRef(false),answerPointer=useRef(false),activeCard=useRef<string|undefined>(undefined),revealedRef=useRef(false),revealSeq=useRef(0);
  const cacheKey='nihon:srs:session:'+initial.mode;
  const retention = normalizeRetention(session.desiredRetention);
  useEffect(()=>{let alive=true;const initialRetention=normalizeRetention(initial.desiredRetention);offset.current=Date.parse(initial.serverNow)-Date.now();setGestures(false);void scheduler(initialRetention).then(s=>{if(alive)setEngine(s);}).catch(()=>setMessage('Chưa khởi tạo được lịch ôn. Hãy tải lại khi có mạng.'));
    void pendingReviews().then(events=>{if(!alive)return;setPendingCount(events.length);try{const saved=JSON.parse(localStorage.getItem(cacheKey)||'null');if(isCompatibleSessionCache(saved,initial)){setSession(saved.session);setSeen([...new Set([...saved.seen,...events.map(e=>e.cardId)])] as string[]);}else{setSession(initial);const next=events.map(e=>e.cardId);setSeen(prev=>next.length===0&&prev.length===0?prev:next);}}catch{setSession(initial);setMessage('Không khôi phục được phiên cũ; các lượt đã chấm vẫn được giữ trong hàng đồng bộ.');}setReady(true);}).catch(()=>setMessage('Trình duyệt chưa cho phép lưu lượt ôn trên thiết bị.'));
    const connection=()=>setOnline(navigator.onLine);connection();window.addEventListener('online',connection);window.addEventListener('offline',connection);
    const voices=()=>setVoice(window.speechSynthesis?.getVoices().find(v=>v.lang.startsWith('ja')&&v.localService));voices();window.speechSynthesis?.addEventListener('voiceschanged',voices);
    return()=>{alive=false;window.removeEventListener('online',connection);window.removeEventListener('offline',connection);window.speechSynthesis?.removeEventListener('voiceschanged',voices);window.speechSynthesis?.cancel();};
  },[cacheKey,initial]);
  useEffect(()=>{if(ready){try{localStorage.setItem(cacheKey,JSON.stringify({version:1,session,seen}));}catch{/* The durable review outbox is separate from the optional session snapshot. */}}},[cacheKey,ready,session,seen]);
  useEffect(()=>{dispatchSceneDueIfChanged(sceneDue.current,initial,seen);},[initial,seen]);
  async function sync() {
    if(syncing.current||!navigator.onLine)return;syncing.current=true;
    try{const result=await syncReviews(await pendingReviews(),event=>fetch('/srs/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(event)}),acknowledge);setConflicts(result.conflicts);if(result.stopped==='auth')setMessage('Đăng nhập lại để đồng bộ; lượt ôn vẫn được giữ trên thiết bị.');else if(result.conflicts.length)setMessage('Có lượt cần kiểm tra; các thẻ độc lập vẫn tiếp tục đồng bộ.');else if(result.stopped)setMessage('Chưa đồng bộ được; lượt ôn vẫn được giữ trên thiết bị.');
    }catch{setMessage('Mất kết nối. Các lượt đã chấm sẽ đồng bộ khi có mạng.');}finally{try{setPendingCount((await pendingReviews()).length);}finally{syncing.current=false;}}
  }
  useEffect(()=>{if(ready&&online)void sync();},[ready,online,pendingCount]);
  const card=session.cards.find(c=>!seen.includes(c.cardId)), now=Date.now()+offset.current;
  activeCard.current=card?.cardId;revealedRef.current=revealed;
  let choices:{rating:number;dueAt:string}[]=[];try{if(card&&engine)choices=previews(card,new Date(now),engine);}catch{}
  useLayoutEffect(()=>{const departing=oldCard.current;if(departing){swapCards(departing,article.current,inputKeyboard.current);oldCard.current=null;}return()=>{departing?.getAnimations().forEach(a=>a.cancel());departing?.remove();article.current?.getAnimations().forEach(a=>a.cancel());};},[card?.cardId]);
  useLayoutEffect(()=>{if(revealed&&answerPointer.current)animateUI(article.current?.querySelector('[data-srs-answer]')??null,[{opacity:0,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],160,false);},[revealed]);
  useEffect(()=>{revealSeq.current+=1;setChecking(false);setReadingMatch(null);},[card?.cardId]);
  useEffect(()=>()=>{revealSeq.current+=1;oldCard.current?.remove();},[]);
  async function rate(rating:number,keyboard=false) {
    if(!card||!revealed||busy||!ready||!engine)return;setBusy(true);
    try{await queueReview({reviewId:crypto.randomUUID(),cardId:card.cardId,rating,reviewedAt:new Date(Date.now()+offset.current).toISOString(),baseUpdatedAt:card.updatedAt,elapsedMs:Math.min(3600000,Math.max(0,Date.now()-started.current))});setPendingCount((await pendingReviews()).length);inputKeyboard.current=keyboard;oldCard.current=snapshotCard(keyboard?null:article.current);setSeen(previous=>[...previous,card.cardId]);setRevealed(false);setAnswer('');setReadingMatch(null);started.current=Date.now();setMessage('Đã lưu lượt ôn trên thiết bị.');void sync();}catch{setMessage('Chưa lưu được lượt ôn. Giữ phiên mở và thử lại; thẻ chưa bị bỏ qua.');}finally{setBusy(false);}
  }
  function speak(){if(!card||!voice)return;const utterance=new SpeechSynthesisUtterance(card.reading||card.title);utterance.lang='ja-JP';utterance.voice=voice;speechSynthesis.cancel();speechSynthesis.speak(utterance);}
  const readingMode=card?.type==='reading'&&card.kind==='vocab'&&session.mode==='full';
  function onAnswerChange(raw:string){
    const fn=wanakana.getCached();
    if(fn){setAnswer(fn(raw,{IMEMode:true}).normalize('NFC'));return;}
    const targetCardId=card?.cardId;
    setAnswer(raw.normalize('NFC'));
    void wanakana.load().then(loaded=>{
      if(activeCard.current!==targetCardId||revealedRef.current)return;
      setAnswer(prev=>{if(!prev)return prev;const next=loaded(prev,{IMEMode:true}).normalize('NFC');return next===prev?prev:next;});
    }).catch(()=>{});
  }
  async function reveal(pointer:boolean){
    if(!card||revealed||checking)return;
    answerPointer.current=pointer;
    if(!readingMode||!card.reading||!answer){setReadingMatch(null);setRevealed(true);return;}
    const fn=wanakana.getCached();
    if(fn){setReadingMatch(fn(answer.trim().normalize('NFC'))===fn(card.reading));setRevealed(true);return;}
    const seq=++revealSeq.current,targetCardId=card.cardId,submitted=answer,expected=card.reading;
    setChecking(true);
    try{
      const matched=await wanakana.isReadingMatch(submitted,expected);
      if(revealSeq.current!==seq||activeCard.current!==targetCardId)return;
      setReadingMatch(matched);setRevealed(true);
    }catch{
      if(revealSeq.current!==seq||activeCard.current!==targetCardId)return;
      setReadingMatch(submitted.trim().normalize('NFC')===expected.normalize('NFC'));setRevealed(true);
    }finally{if(revealSeq.current===seq)setChecking(false);}
  }
  return <section className={css.root} data-srs-session><div className={css.toolbar}><nav aria-label="Chế độ ôn"><Link href="/srs?mode=full" prefetch={false} aria-current={initial.mode==='full'?'page':undefined}>Buổi ôn · 20 thẻ</Link><Link href="/srs?mode=quick" prefetch={false} aria-current={initial.mode==='quick'?'page':undefined}>Ôn nhanh · 15 thẻ</Link></nav><span>{online?'Có mạng':'Đang offline'} · {pendingCount} lượt chờ đồng bộ</span></div>
    {initial.mode==='quick'&&<button className="button button-small" aria-pressed={gestures} onClick={()=>setGestures(g=>!g)}>{gestures?'Tắt vuốt một tay':'Bật vuốt một tay'}</button>}
    {session.unsupported>0&&<p className={css.notice}>{session.unsupported} thẻ có loại hoặc trạng thái lịch chưa được hỗ trợ; lịch cũ được giữ nguyên.</p>}
    {session.due>200&&<p className={css.notice}>Hàng ôn đang nhiều. Nên giảm một nửa bài mới đến khi còn dưới 150 thẻ; bạn vẫn luôn ôn được.</p>}
    <div className={css.progress}><span>Đã ôn {session.cards.filter(c=>seen.includes(c.cardId)).length}/{session.cards.length}</span><MotionProgress label="Tiến độ ôn" max={Math.max(1,session.cards.length)} value={session.cards.filter(c=>seen.includes(c.cardId)).length}/><button className="quiet-button" onClick={()=>setPaused(p=>!p)}>{paused?'Tiếp tục':'Tạm dừng'}</button></div>
    {!ready||!engine?<p role="status">Đang chuẩn bị lịch ôn…</p>:paused?<div className={css.card}><h2>Đã tạm dừng.</h2><p>Lượt đã chấm được lưu trên thiết bị. Bạn có thể quay lại sau.</p><button className="button button-primary" onClick={()=>setPaused(false)}>Tiếp tục ôn</button></div>:card?<article ref={article} data-srs-card={card.cardId} className={`${css.card} ${gestures?css.gestureOn:''}`} onTouchStart={e=>{if(!gestures||e.touches.length!==1||(e.target as HTMLElement).closest('button,input,a')){touch.current=null;return;}touch.current={x:e.touches[0].clientX,y:e.touches[0].clientY};}} onTouchCancel={()=>{touch.current=null;}} onTouchEnd={e=>{const start=touch.current;touch.current=null;if(!gestures||!start||!revealed||busy)return;const dx=e.changedTouches[0].clientX-start.x,dy=e.changedTouches[0].clientY-start.y;if(Math.max(Math.abs(dx),Math.abs(dy))<85)return;if(Math.abs(dx)>Math.abs(dy))void rate(dx<0?1:3);else if(dy<0)void rate(4);}}>
      <div className={css.cardTop}><span>{card.kind==='kanji'?'KANJI':card.kind==='grammar'?'NGỮ PHÁP':'TỪ VỰNG'}</span><span>FSRS · mục tiêu {Math.round(retention*100)}%</span></div>
      <p className={css.prompt}>{readingMode?'Gõ cách đọc hiragana':card.type==='recall'&&session.mode==='full'?'Nhớ từ tiếng Nhật':'Nhớ cách đọc và nghĩa'}</p>
      {card.type==='recall'&&session.mode==='full'?<p className={css.recall}>{card.vietnamese?.text??card.english}</p>:card.type==='listening'&&session.mode==='full'&&!revealed?<button className="button" onClick={speak} disabled={!voice}>Nghe tiếng Nhật</button>:<JaText as="h2" className={css.title}>{card.title}</JaText>}
      {readingMode&&!revealed&&<label className={css.input}>Cách đọc<input value={answer} disabled={checking} onFocus={()=>{void wanakana.load().catch(()=>{});}} onChange={e=>onAnswerChange(e.target.value)} autoComplete="off" aria-label="Cách đọc hiragana" /></label>}
      {!revealed?<button className="button button-primary" disabled={checking} onClick={e=>void reveal(e.detail>0)}>Hiện đáp án</button>:<div className={css.answer} data-srs-answer>{card.type==='recall'&&<JaText as="p" className={css.title}>{card.title}</JaText>}{card.reading&&<JaText as="p" className={css.reading}>{card.reading}</JaText>}{readingMode&&answer&&<p>{readingMatch?'Cách đọc trùng khớp.':'Cách đọc chưa trùng. Hãy đối chiếu đáp án rồi tự đánh giá.'}</p>}{card.hanViet&&<><ViText as="strong">{card.hanViet.text}</ViText><SourceLabel translation={card.hanViet} />{online&&card.hanViet.translationId&&<ReportViButton translationId={card.hanViet.translationId} label="Hán Việt" />}</>}{card.vietnamese&&<ViText as="p" className={css.meaning}>{card.vietnamese.text}</ViText>}<p lang="en">{card.english}</p><SourceLabel translation={card.vietnamese} />{online&&card.vietnamese?.translationId&&<ReportViButton translationId={card.vietnamese.translationId} label="nghĩa Việt" />}<button className="button button-small" disabled={!voice} onClick={speak}>Nghe cách đọc</button>{!voice&&<small>Thiết bị chưa có giọng Nhật cục bộ. Không tự phát âm thanh.</small>}</div>}
      {revealed&&<div className={css.grades}>{choices.map(choice=><button key={choice.rating} disabled={busy} onClick={e=>void rate(choice.rating,e.detail===0)}><strong>{labels[choice.rating-1]}</strong><small>{intervalLabel(choice.dueAt,now)}</small></button>)}</div>}
      <p className={css.hint}>{gestures?'Đang bật vuốt: trái Quên · phải Được · lên Dễ. Khó dùng nút.':'Mở đáp án rồi chọn một trong bốn mức tự đánh giá.'}</p>
    </article>:<div className={css.card}><Mascot species="tanuki" pose="cheer" size={112}/><span className={css.done}>✓</span><h2>{session.cards.length?'Xong một phiên nhỏ.':'Chưa có thẻ đến hạn.'}</h2><p>Còn {Math.max(0,session.due-session.cards.length)} thẻ đến hạn ngoài phiên này.</p><Link className="button button-primary" href="/srs">Mở phiên tiếp theo</Link><Link className="text-link" href="/vocab">Chọn từ để ôn →</Link></div>}
    <div role="status" className={css.status}>{message}{pendingCount>0&&<button className="button button-small" disabled={!online} onClick={()=>void sync()}>Đồng bộ lại</button>}</div>
    {conflicts.length>0&&<details className={css.notice}><summary>{conflicts.length} lượt ôn cần xử lý</summary>{conflicts.map(event=><div key={event.reviewId}><p>Thẻ {event.cardId} · mức {labels[event.rating-1]} · {event.reviewedAt}</p><button className="button button-small" onClick={async()=>{if(!window.confirm('Bỏ lượt chưa đồng bộ này trên thiết bị? Lịch và lịch sử đã lưu trên máy chủ được giữ nguyên.'))return;await acknowledge(event.reviewId);setConflicts(previous=>previous.filter(e=>e.reviewId!==event.reviewId));setPendingCount((await pendingReviews()).length);}}>Bỏ lượt chưa đồng bộ này</button></div>)}</details>}
    <section className={css.forecast} aria-labelledby="forecast"><h2 id="forecast">Dự báo 7 ngày</h2><div>{session.forecast.map(day=><p key={day.day}><time dateTime={day.day}>{day.day.slice(5).split('-').reverse().join('/')}</time><strong>{day.count}</strong><small>thẻ</small></p>)}</div></section>
    <p className={css.note}>Mở phiên khi có mạng để tải thẻ. Phiên đang mở vẫn lưu lượt chấm khi offline và tự đồng bộ lại; mở app hoàn toàn offline sẽ cần nền PWA ở bước sau.</p>
  </section>;
}

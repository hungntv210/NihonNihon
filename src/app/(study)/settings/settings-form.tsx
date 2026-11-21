'use client';
import { useEffect, useState, type FormEvent } from 'react';
import {
  FSRS_RETENTION_STEP,
  MAX_FSRS_RETENTION,
  MAX_NEW_CARDS_PER_DAY,
  MIN_FSRS_RETENTION,
  MIN_NEW_CARDS_PER_DAY,
  parseSrsSettingsInput,
  type StudyPreferences,
} from '../../../core/preferences.ts';
export function SettingsForm({initial}:{initial:StudyPreferences}) {
 const [p,setP] = useState(initial), [newCardsInput,setNewCardsInput] = useState(String(initial.newCardsPerDay)), [retentionInput,setRetentionInput] = useState(initial.fsrsRetention.toFixed(2)), [message,setMessage] = useState(''), [busy,setBusy] = useState(false), [voices,setVoices] = useState<SpeechSynthesisVoice[]>([]);
 useEffect(()=>{ if (!('speechSynthesis' in window)) return; const load=()=>setVoices(speechSynthesis.getVoices().filter(v=>v.lang.startsWith('ja'))); load(); speechSynthesis.addEventListener('voiceschanged',load); return ()=>speechSynthesis.removeEventListener('voiceschanged',load); },[]);
 const change = (key:keyof StudyPreferences,value:unknown)=>setP({...p,[key]:value});
 async function submit(e:FormEvent) {
  e.preventDefault();
  const parsed = parseSrsSettingsInput(newCardsInput, retentionInput);
  if (!parsed.ok) { setMessage(parsed.error); return; }
  const next: StudyPreferences = { ...p, newCardsPerDay: parsed.newCardsPerDay, fsrsRetention: parsed.fsrsRetention };
  setBusy(true);
  try {
   const r=await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(next)});
   if(!r.ok) {
    let errorMessage = 'Cài đặt không hợp lệ.';
    try { const body = await r.json(); if (body?.error) errorMessage = String(body.error); } catch {}
    setMessage(errorMessage);
    return;
   }
   const saved = await r.json() as StudyPreferences;
   setP(saved);
   setNewCardsInput(String(saved.newCardsPerDay));
   setRetentionInput(saved.fsrsRetention.toFixed(2));
   window.dispatchEvent(new CustomEvent('nihon-preferences',{detail:saved}));
   setMessage('Đã lưu cài đặt.');
  }catch{setMessage('Chưa lưu được. Kiểm tra kết nối và thử lại.');}finally{setBusy(false);}
 }
 return <><form className="settings-form" onSubmit={submit}>
 <label>Giờ học tối<input type="time" required value={p.eveningTime} onChange={e=>change('eveningTime',e.target.value)}/></label>
 <label>Phút học mỗi tối<input type="number" min="5" max="180" required value={p.studyMinutes} onChange={e=>change('studyMinutes',Number(e.target.value))}/></label>
 <label>Ngày bắt đầu<input type="date" required value={p.startDate} onChange={e=>change('startDate',e.target.value)}/></label>
 <label>Ngày thi N2<input type="date" required value={p.examDate} onChange={e=>change('examDate',e.target.value)}/></label>
 <label>Múi giờ<input required value={p.timeZone} onChange={e=>change('timeZone',e.target.value)}/></label>
 <label>Thẻ mới mỗi ngày<input type="number" required min={MIN_NEW_CARDS_PER_DAY} max={MAX_NEW_CARDS_PER_DAY} step={1} inputMode="numeric" value={newCardsInput} onChange={e=>{const raw=e.target.value;setNewCardsInput(raw);const n=Number(raw);if(raw!==''&&Number.isInteger(n))change('newCardsPerDay',n);}}/><small>Số nguyên 0–100; giới hạn thẻ mới vào hàng ôn mỗi ngày.</small></label>
 <label>Mức ghi nhớ mong muốn<input type="number" required min={MIN_FSRS_RETENTION} max={MAX_FSRS_RETENTION} step={FSRS_RETENTION_STEP} inputMode="decimal" value={retentionInput} onChange={e=>{const raw=e.target.value;setRetentionInput(raw);const n=Number(raw);if(raw!==''&&Number.isFinite(n))change('fsrsRetention',n);}}/><small>Từ 0.80 đến 0.97 (bước 0.01, mặc định 0.90). Mức cao hơn sẽ ôn dày hơn.</small></label>
 <fieldset><legend>Ngày shadowing</legend>{['Chủ nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'].map((d,i)=><label key={d}><input type="checkbox" checked={p.shadowingDays.includes(i)} onChange={e=>change('shadowingDays',e.target.checked?[...p.shadowingDays,i]:p.shadowingDays.filter(x=>x!==i))}/>{d}</label>)}</fieldset>
 <label><input type="checkbox" checked={p.furigana} onChange={e=>change('furigana',e.target.checked)}/>Hiện furigana mặc định</label>
 <label>Giọng đọc tiếng Nhật<select value={p.ttsVoice} onChange={e=>change('ttsVoice',e.target.value)}><option value="">Giọng mặc định của thiết bị</option>{voices.map(v=><option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}</select></label>
 <button type="button" className="quiet-button" onClick={()=>{if(!('speechSynthesis' in window)) return; const u=new SpeechSynthesisUtterance('日本語を勉強しています。');u.lang='ja-JP';u.voice=voices.find(v=>v.voiceURI===p.ttsVoice)||null;speechSynthesis.speak(u);}}>Nghe thử</button>
 <label>Giao diện<select value={p.theme} onChange={e=>change('theme',e.target.value)}><option value="system">Theo giờ Việt Nam</option><option value="light">Sáng</option><option value="dark">Tối</option></select></label>
 <label><input type="checkbox" checked={p.motion} onChange={e=>change('motion',e.target.checked)}/>Chuyển động<small>Luôn tôn trọng giảm chuyển động của thiết bị.</small></label>
 <button className="button button-primary" disabled={busy}>{busy?'Đang lưu…':'Lưu cài đặt'}</button><p role="status">{message}</p></form>
 <section className="settings-form"><h2>Sao lưu riêng tư</h2><p>Gồm database, bản ghi âm và cài đặt. Giữ file ở nơi an toàn.</p><a className="button" href="/api/backup">Tải bản sao lưu</a><form onSubmit={async e=>{e.preventDefault(); const f=new FormData(e.currentTarget).get('backup');if(!(f instanceof File))return; if(!confirm('Khôi phục sẽ thay thế dữ liệu hiện tại. Một bản sao an toàn sẽ được tạo trước khi khôi phục. Tiếp tục?'))return;setBusy(true);try{const r=await fetch('/api/backup',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:f});setMessage(r.ok?'Đã khôi phục. Tải lại trang để đọc dữ liệu mới.':(await r.json()).error||'Không thể khôi phục file này.');}catch{setMessage('Khôi phục chưa hoàn tất. Kiểm tra kết nối.');}finally{setBusy(false);}}}><label>File sao lưu<input type="file" name="backup" required accept=".json"/></label><button disabled={busy} className="button">Khôi phục</button></form></section></>;
}

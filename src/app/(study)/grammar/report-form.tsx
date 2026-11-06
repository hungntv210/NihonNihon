'use client';
import { useState } from 'react';
import styles from './grammar.module.css';
export function ReportForm({ grammarId,translationId }: { grammarId: string;translationId: string }) {
  const [open,setOpen]=useState(false),[reason,setReason]=useState(''),[status,setStatus]=useState<'idle'|'saving'|'saved'|'error'>('idle');
  async function submit(event: React.FormEvent) {event.preventDefault();setStatus('saving');try{const response=await fetch('/grammar/report',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({grammarId,translationId,reason:reason.normalize('NFC')})});if(!response.ok)throw Error();setStatus('saved');}catch{setStatus('error');}}
  return <div className={styles.report}><button className={styles.reportToggle} type="button" onClick={()=>setOpen(!open)} aria-expanded={open}>Báo sai bản Việt</button>{open&&<form onSubmit={submit}><label>Nội dung cần xem lại<textarea value={reason} onChange={event=>setReason(event.target.value)} minLength={3} maxLength={1000} required disabled={status==='saving'||status==='saved'} /></label><button className="button button-small" disabled={status==='saving'||status==='saved'}>{status==='saving'?'Đang gửi…':status==='saved'?'Đã ghi nhận':'Gửi báo sai'}</button><p className={styles.help} role="status">{status==='saved'?'Đã lưu báo sai; bản dịch chưa tự động thay đổi.':status==='error'?'Chưa gửi được. Bạn thử lại nhé.':''}</p></form>}</div>;
}

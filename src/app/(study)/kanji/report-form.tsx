'use client';
import { useState } from 'react';
import styles from './kanji.module.css';
export function ReportForm({ translationId, label }: { translationId: string; label: string }) {
  const [reason, setReason] = useState(''),
    [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle'),
    [message, setMessage] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState('saving');
    setMessage('');
    try {
      const result = await fetch('/kanji/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ translationId, reason: reason.normalize('NFC') }),
      });
      if (result.status === 401 || (result.redirected && new URL(result.url).pathname === '/login')) {
        window.location.assign('/login');
        return;
      }
      const body = await result.json().catch(() => ({}));
      if (!result.ok) {
        setState('idle');
        setMessage(typeof body.error === 'string' ? body.error : 'Chưa lưu được báo cáo.');
        return;
      }
      setState('saved');
      setMessage('Đã ghi nhận để kiểm tra lại bản dịch.');
    } catch {
      setState('idle');
      setMessage('Chưa gửi được báo cáo. Hãy thử lại khi có mạng.');
    }
  }
  return (
    <details className={styles.report}>
      <summary>Báo sai {label}</summary>
      <form className={styles.reportForm} onSubmit={submit}>
        <label htmlFor={'report-' + translationId}>Điểm nào chưa đúng?</label>
        <textarea
          id={'report-' + translationId}
          required
          minLength={3}
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={state !== 'idle'}
        />
        <button className="button button-small" disabled={state !== 'idle'}>
          {state === 'saved' ? 'Đã gửi' : state === 'saving' ? 'Đang gửi…' : 'Gửi báo cáo'}
        </button>
        <p className={styles.reportStatus} role="status">
          {message}
        </p>
      </form>
    </details>
  );
}

'use client';
import { useState } from 'react';
export function ReportTranslation({
  itemId,
  translationId,
}: {
  itemId: string;
  translationId: string;
}) {
  const [open, setOpen] = useState(false),
    [reason, setReason] = useState(''),
    [status, setStatus] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus('');
    try {
      const response = await fetch('/vocab/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, translationId, reason }),
      });
      if (response.status === 401 || response.redirected) {
        window.location.assign('/login');
        return;
      }
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      setStatus('Đã ghi nhận báo sai. Bản dịch hiện tại được giữ để đối chiếu.');
      setReason('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Chưa gửi được báo sai.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button
        className="quiet-button"
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        Báo sai
      </button>
      {open && (
        <form onSubmit={submit}>
          <label style={{ display: 'block', fontSize: 12 }}>
            Điểm cần sửa
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              minLength={5}
              maxLength={1000}
              required
              rows={3}
              style={{
                display: 'block',
                width: '100%',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                padding: 10,
                fontSize: 16,
                margin: '8px 0',
              }}
            />
          </label>
          <button className="button button-small" disabled={busy}>
            {busy ? 'Đang gửi…' : 'Gửi báo sai'}
          </button>
        </form>
      )}
      <p role="status" style={{ fontSize: 12, color: 'var(--color-muted)' }}>
        {status}
      </p>
    </div>
  );
}

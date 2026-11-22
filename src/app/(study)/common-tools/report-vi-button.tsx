'use client';

import { useEffect, useState } from 'react';

type MarkState = 'idle' | 'saving' | 'saved';

export function ReportViButton({
  translationId,
  label,
}: {
  translationId: string;
  label?: string;
}) {
  const [state, setState] = useState<MarkState>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    setState('idle');
    setError('');
  }, [translationId]);

  async function mark() {
    if (state !== 'idle') return;
    setState('saving');
    setError('');
    try {
      const response = await fetch('/api/common-tools/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ translationId }),
      });
      if (
        response.status === 401 ||
        (response.redirected && new URL(response.url).pathname === '/login')
      ) {
        window.location.assign('/login');
        return;
      }
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setState('idle');
        setError(typeof data.error === 'string' ? data.error : 'Chưa đánh dấu được.');
        return;
      }
      setState('saved');
    } catch {
      setState('idle');
      setError('Chưa gửi được đánh dấu. Thử lại khi có mạng.');
    }
  }

  const idleText = label ? `Báo sai ${label}` : 'Báo sai';

  return (
    <span data-report-vi="">
      <button
        type="button"
        className="quiet-button"
        data-report-translation={translationId}
        disabled={state !== 'idle'}
        aria-pressed={state === 'saved'}
        aria-busy={state === 'saving'}
        onClick={() => void mark()}
      >
        {state === 'saved' ? 'Đã đánh dấu ✓' : state === 'saving' ? 'Đang đánh dấu…' : idleText}
      </button>
      {error && (
        <small role="status" className="muted">
          {' '}
          {error}
        </small>
      )}
    </span>
  );
}

'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CardType } from '../core/review.ts';
export function AddToReview({
  itemId,
  cardType = 'recognition',
}: {
  itemId: string;
  cardType?: CardType;
}) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle'),
    router = useRouter();
  async function add() {
    setState('saving');
    try {
      const response = await fetch('/api/review/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, cardType }),
      });
      if (response.status === 401) {
        router.replace('/login');
        return;
      }
      if (!response.ok) throw new Error();
      setState('saved');
      router.refresh();
    } catch {
      setState('error');
    }
  }
  return (
    <div className="review-control">
      <button
        type="button"
        className="button button-small"
        onClick={add}
        disabled={state === 'saving' || state === 'saved'}
        aria-busy={state === 'saving'}
      >
        {state === 'saved' ? 'Đã thêm ✓' : state === 'saving' ? 'Đang lưu…' : 'Thêm vào ôn'}
      </button>
      <span role="status" className="action-status">
        {state === 'error'
          ? 'Chưa lưu được. Hãy thử lại.'
          : state === 'saved'
            ? 'Thẻ đã ở trong hàng ôn.'
            : ''}
      </span>
    </div>
  );
}

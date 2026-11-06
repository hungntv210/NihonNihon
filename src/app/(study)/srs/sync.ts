import type { ReviewEvent } from './model.ts';
export async function syncReviews(events: ReviewEvent[], send: (event: ReviewEvent) => Promise<Response>, acknowledge: (id: string) => Promise<void>) {
  const blocked = new Set<string>(), conflicts: ReviewEvent[] = [];
  let stopped: 'auth' | 'temporary' | null = null;
  for (const event of events) {
    if (blocked.has(event.cardId)) continue;
    const response = await send(event);
    if (response.redirected || response.status === 401) { stopped = 'auth';break; }
    if ([400,404,409].includes(response.status)) { blocked.add(event.cardId);conflicts.push(event);continue; }
    if (!response.ok) { stopped = 'temporary';break; }
    const receipt = await response.json();
    if (receipt.reviewId !== event.reviewId) throw Error('Receipt mismatch');
    await acknowledge(event.reviewId);
  }
  return { conflicts, stopped };
}

import type { ReviewEvent } from './model.ts';
const database = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open('nihon-srs-outbox', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('reviews', { keyPath: 'reviewId' });
  request.onsuccess = () => resolve(request.result);request.onerror = () => reject(request.error);
});
export async function pendingReviews(): Promise<ReviewEvent[]> {
  const db = await database();try { return await new Promise((resolve, reject) => { const request = db.transaction('reviews').objectStore('reviews').getAll();request.onsuccess = () => resolve(request.result.sort((a: ReviewEvent,b: ReviewEvent) => a.reviewedAt.localeCompare(b.reviewedAt)));request.onerror = () => reject(request.error); }); } finally { db.close(); }
}
export async function queueReview(event: ReviewEvent) {
  const db = await database();try { await new Promise<void>((resolve, reject) => { const tx = db.transaction('reviews', 'readwrite'), store = tx.objectStore('reviews'), request = store.get(event.reviewId);request.onsuccess = () => { if (!request.result) store.add(event);else if (JSON.stringify(request.result) !== JSON.stringify(event)) tx.abort(); };tx.oncomplete = () => resolve();tx.onabort = () => reject(tx.error ?? new Error('REVIEW_ID_REUSED'));tx.onerror = () => reject(tx.error); }); } finally { db.close(); }
}
export async function acknowledge(reviewId: string) {
  const db = await database();try { await new Promise<void>((resolve,reject) => { const tx = db.transaction('reviews','readwrite');tx.objectStore('reviews').delete(reviewId);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error); }); } finally { db.close(); }
}

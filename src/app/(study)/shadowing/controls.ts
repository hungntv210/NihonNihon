import type { ClipSegment } from './clip-model.ts';

export const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.2, 1.25] as const;
export const DEFAULT_PLAYBACK_SPEED = 0.75;
export const SHADOW_PAUSE_FACTOR = 1.2;

export type ShadowingShortcutAction =
  | 'toggle-play'
  | 'prev-segment'
  | 'next-segment'
  | 'replay-segment'
  | 'toggle-loop';

export type ShortcutEventLike = {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  repeat?: boolean;
  defaultPrevented?: boolean;
  target: unknown;
};

export type SrsAddResult =
  | { status: 'added'; created: true; cardId?: string; message: string }
  | { status: 'duplicate'; created: false; cardId?: string; message: string }
  | { status: 'unsupported' | 'unauthorized' | 'error'; message: string };

export const shadowPauseDurationMs = (s: Pick<ClipSegment, 'start' | 'end'>) =>
  Math.round(Math.max(0, s.end - s.start) * SHADOW_PAUSE_FACTOR * 1000);

export const clampSegmentIndex = (i: number | undefined, len: number) =>
  Number.isInteger(i) && len > 0 ? Math.max(0, Math.min(len - 1, i!)) : 0;

type NodeLike = {
  tagName?: string;
  isContentEditable?: boolean;
  getAttribute?: (n: string) => string | null;
  closest?: (s: string) => unknown;
  parentElement?: NodeLike | null;
};

const isEditableNode = (n: NodeLike) => {
  const a = n.getAttribute?.('contenteditable');
  return (
    /^(INPUT|TEXTAREA|SELECT)$/i.test(n.tagName ?? '') ||
    Boolean(n.isContentEditable) ||
    (a != null && /^(|true|plaintext-only)$/i.test(a.trim()))
  );
};

export function isEditableTarget(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false;
  let cur: NodeLike | null | undefined = target as NodeLike;
  if (isEditableNode(cur) || cur.closest?.('[contenteditable]')) return true;
  for (let d = 0; cur?.parentElement && d < 16; d++) {
    if (isEditableNode((cur = cur.parentElement))) return true;
  }
  return false;
}

const KEY_MAP: Record<string, ShadowingShortcutAction> = {
  ' ': 'toggle-play',
  ArrowLeft: 'prev-segment',
  ArrowRight: 'next-segment',
  r: 'replay-segment',
  R: 'replay-segment',
  l: 'toggle-loop',
  L: 'toggle-loop',
};

export function resolveShadowingShortcut(e: ShortcutEventLike): ShadowingShortcutAction | null {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isEditableTarget(e.target)) return null;
  const act = KEY_MAP[e.key] ?? (e.code === 'Space' ? 'toggle-play' : null);
  return act && !(e.repeat && (act === 'toggle-play' || act === 'toggle-loop')) ? act : null;
}

export const toggleLoopLimit = (cur: number, prev: number) => {
  const n = prev > 0 ? prev : 1;
  return cur === 0 ? { limit: n, remembered: n } : { limit: 0, remembered: cur > 0 ? cur : 1 };
};

export async function addShadowingClipToSrs(
  clipId: string,
  fetcher: typeof fetch = fetch,
): Promise<SrsAddResult> {
  const fail = { status: 'error' as const, message: 'Chưa thêm được thẻ ôn.' };
  try {
    const res = await fetcher('/api/review/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: clipId, cardType: 'shadow' }),
    });
    if (res.status === 401) return { status: 'unauthorized', message: 'Cần đăng nhập lại.' };
    if (res.status === 404) return { status: 'unsupported', message: 'Clip chưa có trong thẻ ôn.' };
    if (!res.ok) return fail;
    const d = (await res.json().catch(() => null)) as { cardId?: string; created?: boolean } | null;
    return d?.created === false
      ? { status: 'duplicate', created: false, cardId: d.cardId, message: 'Câu này đã có trong thẻ ôn.' }
      : { status: 'added', created: true, cardId: d?.cardId, message: 'Đã thêm câu vào thẻ ôn SRS.' };
  } catch {
    return fail;
  }
}

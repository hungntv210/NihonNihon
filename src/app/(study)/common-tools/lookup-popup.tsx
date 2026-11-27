'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import {
  formatLookupKind,
  formatLookupSourceLabel,
  resolveFocusTrapTarget,
  type LookupItem,
  type LookupResponse,
  type LookupTarget,
} from './lookup-popup-model.ts';
import { ReportViButton } from './report-vi-button.tsx';
import styles from './lookup-popup.module.css';

// 0 = loading, 1 = ready, 2 = unauthorized, 3 = error
type FetchState = { k: 0 | 2 | 3 } | { k: 1; data: LookupResponse };
// 0 = idle, 1 = saving, 2 = saved, 3 = error
type SaveMode = 'srs' | 'notebook';
type SaveInfo = { s: 0 | 1 | 2 | 3; mode?: SaveMode; msg: string };

const IDLE_SAVE: SaveInfo = { s: 0, msg: '' };
const FOCUSABLE = 'a[href],button:not(:disabled),[tabindex]:not([tabindex="-1"])';

export function LookupPopup({
  target,
  triggerEl,
  onClose,
}: {
  target: LookupTarget | null;
  triggerEl: HTMLElement | null;
  onClose: () => void;
}) {
  const s = styles;
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const prevTriggerRef = useRef<HTMLElement | null>(null);
  const [fetchState, setFetchState] = useState<FetchState>({ k: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [save, setSave] = useState<SaveInfo>(IDLE_SAVE);

  useEffect(() => {
    if (!target) return;
    prevTriggerRef.current = triggerEl;
    setFetchState({ k: 0 });
    setSelectedIndex(0);
    setSave(IDLE_SAVE);

    const ctrl = new AbortController();
    const { signal } = ctrl;
    const params = new URLSearchParams({ q: target.surface });
    if (target.base && target.base !== target.surface) params.set('base', target.base);

    void fetch(`/api/common-tools/lookup?${params}`, { signal, cache: 'no-store' })
      .then(async (res) => {
        if (signal.aborted) return;
        if (res.status === 401) return setFetchState({ k: 2 });
        if (!res.ok) return setFetchState({ k: 3 });
        const data = (await res.json()) as LookupResponse;
        if (!signal.aborted) setFetchState({ k: 1, data });
      })
      .catch(() => {
        if (!signal.aborted) setFetchState({ k: 3 });
      });

    return () => ctrl.abort();
  }, [target, triggerEl]);

  useEffect(() => {
    if (!target) return;
    (closeBtnRef.current ?? dialogRef.current)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const nodes = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!nodes.length) {
        e.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const next = resolveFocusTrapTarget(
        nodes.length,
        nodes.indexOf(document.activeElement as HTMLElement),
        e.shiftKey,
      );
      if (next !== null) {
        e.preventDefault();
        nodes[next].focus();
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      if (prevTriggerRef.current?.isConnected) prevTriggerRef.current.focus();
    };
  }, [target, onClose]);

  if (!target) return null;

  const fk = fetchState.k;
  const hasSentence = Boolean(target.sentenceJa?.trim());
  const searchHref = `/common-tools/search?q=${encodeURIComponent(target.base ?? target.surface)}`;
  const allItems: LookupItem[] =
    fetchState.k === 1 && fetchState.data.item
      ? [fetchState.data.item, ...fetchState.data.alternatives]
      : [];
  const activeItem = allItems[selectedIndex] ?? allItems[0] ?? null;

  const sentenceBox = hasSentence ? (
    <div className={s.sentenceBox}>
      <p className={s.sectionLabel}>Câu gốc</p>
      <p className={s.sentenceJa} lang="ja">{target.sentenceJa}</p>
      {target.sentenceVi && <p className={s.sentenceVi} lang="vi">{target.sentenceVi}</p>}
    </div>
  ) : null;

  async function handleSave(item: LookupItem, mode: SaveMode) {
    if (!target || save.s === 1) return;
    setSave({ s: 1, mode, msg: '' });
    const nb = mode === 'notebook';
    const failMsg = nb ? 'Chưa lưu được vào sổ từ. Thử lại sau.' : 'Chưa lưu được thẻ ôn. Thử lại sau.';
    try {
      const res = await fetch('/api/common-tools/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...target,
          itemId: item.id,
          ...(nb ? { notebookOnly: true } : { cardType: item.cardType }),
        }),
      });
      if (!res.ok) {
        return setSave({ s: 3, msg: res.status === 401 ? 'Cần đăng nhập lại để lưu từ.' : failMsg });
      }
      const { created } = (await res.json()) as { created?: boolean };
      setSave({
        s: 2,
        mode,
        msg: nb
          ? created
            ? hasSentence ? 'Đã lưu vào sổ từ kèm câu gốc.' : 'Đã lưu vào sổ từ.'
            : hasSentence ? 'Từ đã có trong sổ; đã cập nhật câu gốc.' : 'Từ đã có trong sổ từ.'
          : created
            ? 'Đã thêm vào ôn kèm câu gốc.'
            : 'Thẻ đã có trong hàng ôn; đã lưu kèm câu gốc.',
      });
    } catch {
      setSave({ s: 3, msg: failMsg });
    }
  }

  const showNotebook = Boolean(
    activeItem && (activeItem.outsideJlpt || (activeItem.kind === 'vocab' && target.sourceKind === 'jlpt')),
  );
  const showSrs = Boolean(activeItem && !activeItem.outsideJlpt);
  const hv = activeItem?.hanViet ?? activeItem?.kanjiHanViet[0]?.hanViet ?? null;
  const meaning = activeItem?.meaning ?? null;
  const eng = activeItem ? activeItem.english.join('; ') : '';

  const saveBtn = (mode: SaveMode, primary: boolean, idle: string, done: string) => {
    const busy = save.s === 1;
    const isDone = save.s === 2 && save.mode === mode;
    return (
      <button
        type="button"
        className={primary ? 'button primary' : 'button'}
        onClick={() => activeItem && void handleSave(activeItem, mode)}
        disabled={busy || isDone}
        aria-busy={busy && save.mode === mode}
      >
        {isDone ? done : busy && save.mode === mode ? 'Đang lưu…' : idle}
      </button>
    );
  };

  return (
    <div
      className={s.backdrop}
      data-lookup-backdrop="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        className={s.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
      >
        <div className={s.top}>
          <div className={s.badges}>
            {activeItem ? (
              <>
                <span className={s.badge}>{formatLookupKind(activeItem.kind)}</span>
                <span className={`${s.badge} ${s.level}`}>{activeItem.level}</span>
              </>
            ) : (
              <span className={s.badge}>Tra nhanh</span>
            )}
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className={`button ${s.closeBtn}`}
            onClick={onClose}
            aria-label="Đóng tra từ"
          >
            Đóng
          </button>
        </div>

        {!activeItem ? (
          <>
            <h2 id={titleId} className={s.wordTitle} lang="ja">{target.surface}</h2>
            <p id={descId} role={fk === 0 ? 'status' : undefined} className={s.note}>
              {fk === 0
                ? 'Đang tra từ…'
                : fk === 2
                  ? 'Phiên đăng nhập đã hết hạn. Đăng nhập lại để tra từ.'
                  : fk === 3
                    ? 'Chưa tra được lúc này. Thử lại hoặc mở trang Tra cứu chung.'
                    : `Chưa tìm thấy “${target.surface}” trong dữ liệu đã nhập.`}
            </p>
            {fk === 1 && sentenceBox}
            {fk !== 0 && (
              <div className={s.actions}>
                {fk === 2 ? (
                  <Link className="button button-primary" href="/login">Đăng nhập lại</Link>
                ) : (
                  <Link className="button" href={searchHref}>
                    {fk === 3 ? 'Mở Tra cứu chung' : 'Tìm trong Tra cứu chung'}
                  </Link>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <div className={s.wordBlock}>
              <h2 id={titleId} className={s.wordTitle} lang="ja">{activeItem.title}</h2>
              {activeItem.reading && <p className={s.reading} lang="ja">{activeItem.reading}</p>}
            </div>

            {activeItem.matchedBy === 'kanji_fallback' && (
              <p className={s.note}>
                Chưa có từ <span lang="ja">{target.surface}</span> trong dữ liệu; hiển thị chữ Hán trong từ này.
              </p>
            )}

            {hv && (
              <div className={s.section}>
                <p className={s.sectionLabel}>Hán Việt</p>
                <p className={s.hanViet} lang="vi">
                  {activeItem.hanViet
                    ? activeItem.hanViet.text
                    : activeItem.kanjiHanViet.map((entry) => `${entry.character}: ${entry.hanViet.text}`).join(' · ')}
                </p>
                <small className={s.source}>{formatLookupSourceLabel(hv, activeItem.sourceName)}</small>
                {activeItem.hanViet
                  ? activeItem.hanViet.translationId && <ReportViButton translationId={activeItem.hanViet.translationId} label="Hán Việt" />
                  : <div>{activeItem.kanjiHanViet.map((entry) => entry.hanViet.translationId && <ReportViButton key={entry.hanViet.translationId} translationId={entry.hanViet.translationId} label={`Hán Việt ${entry.character}`} />)}</div>}
              </div>
            )}

            <div className={s.section} id={descId}>
              <p className={s.sectionLabel}>Nghĩa</p>
              <p className={s.meaning} lang={meaning ? 'vi' : 'en'}>{meaning ? meaning.text : eng}</p>
              <small className={s.source}>{formatLookupSourceLabel(meaning, activeItem.sourceName)}</small>
              {activeItem.meaning && activeItem.meaning.translationId && (
                <ReportViButton translationId={activeItem.meaning.translationId} label="nghĩa Việt" />
              )}
              {meaning && eng && (
                <>
                  <p className={s.englishSub} lang="en">{eng}</p>
                  {activeItem.outsideJlpt && <small className={s.source}>{formatLookupSourceLabel(null, activeItem.sourceName)}</small>}
                </>
              )}
            </div>

            {activeItem.outsideJlpt && (
              <p className={s.attribution}>
                Nguồn ngoài JLPT:{' '}
                <a href="https://www.edrdg.org/edrdg/licence.html" target="_blank" rel="noreferrer">JMdict (EDRDG, CC BY-SA 4.0)</a>
                {meaning?.sourceId === 'bunchaway-javi' && (
                  <>
                    {' · '}
                    <a href="https://github.com/bunchaway/tu-dien-nhat-viet" target="_blank" rel="noreferrer">tu-dien-nhat-viet (Bunchaway, CC BY-SA 4.0)</a>
                  </>
                )}
              </p>
            )}

            {sentenceBox}

            {allItems.length > 1 && (
              <div className={s.alternatives} aria-label="Kết quả khác">
                {allItems.map((candidate, index) => (
                  <button
                    key={candidate.id}
                    type="button"
                    className={`button ${s.altBtn}`}
                    aria-pressed={index === selectedIndex}
                    onClick={() => { setSelectedIndex(index); setSave(IDLE_SAVE); }}
                  >
                    <span lang="ja">{candidate.title}</span> · {formatLookupKind(candidate.kind)}
                  </button>
                ))}
              </div>
            )}

            <div className={s.actions}>
              {showNotebook && saveBtn('notebook', true, 'Lưu vào sổ', 'Đã lưu vào sổ ✓')}
              {showSrs && saveBtn('srs', !showNotebook, 'Thêm vào ôn', 'Đã thêm ✓')}
              <Link className="button" href={activeItem.href}>
                {activeItem.outsideJlpt && !activeItem.inSrs ? 'Mở Tra cứu chung' : 'Xem chi tiết'}
              </Link>
            </div>

            <p role="status" className={s.status}>
              {save.msg ||
                (activeItem.outsideJlpt && activeItem.savedSentence && !activeItem.inSrs
                  ? 'Từ này đã lưu trong sổ từ; bấm “Lưu vào sổ” để cập nhật.'
                  : activeItem.inSrs && activeItem.savedSentence
                    ? 'Từ này đã có trong hàng ôn; bấm “Thêm vào ôn” để cập nhật câu gốc.'
                    : '')}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

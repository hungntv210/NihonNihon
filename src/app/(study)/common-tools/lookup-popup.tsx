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

type FetchState =
  | { kind: 'loading' }
  | { kind: 'ready'; data: LookupResponse }
  | { kind: 'unauthorized' }
  | { kind: 'error' };

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const FOCUSABLE_SELECTOR =
  'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

export function LookupPopup({
  target,
  triggerEl,
  onClose,
}: {
  target: LookupTarget | null;
  triggerEl: HTMLElement | null;
  onClose: () => void;
}) {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previousTriggerRef = useRef<HTMLElement | null>(null);
  const [fetchState, setFetchState] = useState<FetchState>({ kind: 'loading' });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    if (!target) return;
    previousTriggerRef.current = triggerEl;
    setFetchState({ kind: 'loading' });
    setSelectedIndex(0);
    setSaveState('idle');
    setSaveMessage('');

    const controller = new AbortController();
    const params = new URLSearchParams({ q: target.surface });
    if (target.base && target.base !== target.surface) params.set('base', target.base);

    void fetch(`/api/common-tools/lookup?${params.toString()}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        if (controller.signal.aborted) return;
        if (response.status === 401) {
          setFetchState({ kind: 'unauthorized' });
          return;
        }
        if (!response.ok) {
          setFetchState({ kind: 'error' });
          return;
        }
        const data = (await response.json()) as LookupResponse;
        if (!controller.signal.aborted) {
          setFetchState({ kind: 'ready', data });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setFetchState({ kind: 'error' });
      });

    return () => {
      controller.abort();
    };
  }, [target, triggerEl]);

  useEffect(() => {
    if (!target) return;
    const focusTarget = closeBtnRef.current ?? dialogRef.current;
    focusTarget?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (!focusables.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const currentIndex = focusables.indexOf(document.activeElement as HTMLElement);
      const nextIndex = resolveFocusTrapTarget(focusables.length, currentIndex, event.shiftKey);
      if (nextIndex !== null) {
        event.preventDefault();
        focusables[nextIndex].focus();
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      const returnTo = previousTriggerRef.current;
      if (returnTo && returnTo.isConnected) {
        returnTo.focus();
      }
    };
  }, [target, onClose]);

  if (!target) return null;

  const allItems: LookupItem[] =
    fetchState.kind === 'ready' && fetchState.data.item
      ? [fetchState.data.item, ...fetchState.data.alternatives]
      : [];
  const activeItem = allItems[selectedIndex] ?? allItems[0] ?? null;

  async function handleSaveToSrs(item: LookupItem) {
    if (!target || saveState === 'saving') return;
    setSaveState('saving');
    setSaveMessage('');
    try {
      const response = await fetch('/api/common-tools/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: item.id,
          cardType: item.cardType,
          sentenceJa: target.sentenceJa,
          sentenceVi: target.sentenceVi ?? null,
          sourceClipId: target.sourceClipId ?? null,
        }),
      });
      if (response.status === 401) {
        setSaveState('error');
        setSaveMessage('Cần đăng nhập lại để lưu thẻ ôn.');
        return;
      }
      if (!response.ok) {
        setSaveState('error');
        setSaveMessage('Chưa lưu được thẻ ôn. Thử lại sau.');
        return;
      }
      const data = (await response.json()) as { created?: boolean };
      setSaveState('saved');
      setSaveMessage(
        data.created
          ? 'Đã thêm vào ôn kèm câu gốc.'
          : 'Thẻ đã có trong hàng ôn; đã lưu kèm câu gốc.',
      );
    } catch {
      setSaveState('error');
      setSaveMessage('Chưa lưu được thẻ ôn. Thử lại sau.');
    }
  }

  return (
    <div
      className={styles.backdrop}
      data-lookup-backdrop="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
      >
        <div className={styles.top}>
          <div className={styles.badges}>
            {activeItem ? (
              <>
                <span className={styles.badge}>{formatLookupKind(activeItem.kind)}</span>
                <span className={`${styles.badge} ${styles.level}`}>{activeItem.level}</span>
              </>
            ) : (
              <span className={styles.badge}>Tra nhanh</span>
            )}
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className={`button ${styles.closeBtn}`}
            onClick={onClose}
            aria-label="Đóng tra từ"
          >
            Đóng
          </button>
        </div>

        {fetchState.kind === 'loading' && (
          <>
            <h2 id={titleId} className={styles.wordTitle} lang="ja">
              {target.surface}
            </h2>
            <p id={descId} role="status" className={styles.note}>
              Đang tra từ…
            </p>
          </>
        )}

        {fetchState.kind === 'unauthorized' && (
          <>
            <h2 id={titleId} className={styles.wordTitle} lang="ja">
              {target.surface}
            </h2>
            <p id={descId} className={styles.note}>
              Phiên đăng nhập đã hết hạn. Đăng nhập lại để tra từ.
            </p>
            <div className={styles.actions}>
              <Link className="button button-primary" href="/login">
                Đăng nhập lại
              </Link>
            </div>
          </>
        )}

        {fetchState.kind === 'error' && (
          <>
            <h2 id={titleId} className={styles.wordTitle} lang="ja">
              {target.surface}
            </h2>
            <p id={descId} className={styles.note}>
              Chưa tra được lúc này. Thử lại hoặc mở trang Tra cứu chung.
            </p>
            <div className={styles.actions}>
              <Link
                className="button"
                href={`/common-tools/search?q=${encodeURIComponent(target.base ?? target.surface)}`}
              >
                Mở Tra cứu chung
              </Link>
            </div>
          </>
        )}

        {fetchState.kind === 'ready' && !activeItem && (
          <>
            <h2 id={titleId} className={styles.wordTitle} lang="ja">
              {target.surface}
            </h2>
            <p id={descId} className={styles.note}>
              Chưa tìm thấy “{target.surface}” trong dữ liệu đã nhập.
            </p>
            <div className={styles.sentenceBox}>
              <p className={styles.sectionLabel}>Câu gốc</p>
              <p className={styles.sentenceJa} lang="ja">
                {target.sentenceJa}
              </p>
              {target.sentenceVi && (
                <p className={styles.sentenceVi} lang="vi">
                  {target.sentenceVi}
                </p>
              )}
            </div>
            <div className={styles.actions}>
              <Link
                className="button"
                href={`/common-tools/search?q=${encodeURIComponent(target.base ?? target.surface)}`}
              >
                Tìm trong Tra cứu chung
              </Link>
            </div>
          </>
        )}

        {fetchState.kind === 'ready' && activeItem && (
          <>
            <div className={styles.wordBlock}>
              <h2 id={titleId} className={styles.wordTitle} lang="ja">
                {activeItem.title}
              </h2>
              {activeItem.reading && (
                <p className={styles.reading} lang="ja">
                  {activeItem.reading}
                </p>
              )}
            </div>

            {activeItem.matchedBy === 'kanji_fallback' && (
              <p className={styles.note}>
                Chưa có từ <span lang="ja">{target.surface}</span> trong dữ liệu; hiển thị chữ Hán
                trong từ này.
              </p>
            )}

            {(activeItem.hanViet || activeItem.kanjiHanViet.length > 0) && (
              <div className={styles.section}>
                <p className={styles.sectionLabel}>Hán Việt</p>
                {activeItem.hanViet ? (
                  <>
                    <p className={styles.hanViet} lang="vi">
                      {activeItem.hanViet.text}
                    </p>
                    <small className={styles.source}>
                      {formatLookupSourceLabel(activeItem.hanViet, activeItem.sourceName)}
                    </small>
                    {activeItem.hanViet.translationId && (
                      <ReportViButton
                        translationId={activeItem.hanViet.translationId}
                        label="Hán Việt"
                      />
                    )}
                  </>
                ) : (
                  <>
                    <p className={styles.hanViet} lang="vi">
                      {activeItem.kanjiHanViet
                        .map((entry) => `${entry.character}: ${entry.hanViet.text}`)
                        .join(' · ')}
                    </p>
                    <small className={styles.source}>
                      {formatLookupSourceLabel(
                        activeItem.kanjiHanViet[0].hanViet,
                        activeItem.sourceName,
                      )}
                    </small>
                    <div>
                      {activeItem.kanjiHanViet.map(
                        (entry) =>
                          entry.hanViet.translationId && (
                            <ReportViButton
                              key={entry.hanViet.translationId}
                              translationId={entry.hanViet.translationId}
                              label={`Hán Việt ${entry.character}`}
                            />
                          ),
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            <div className={styles.section} id={descId}>
              <p className={styles.sectionLabel}>Nghĩa</p>
              {activeItem.meaning ? (
                <>
                  <p className={styles.meaning} lang="vi">
                    {activeItem.meaning.text}
                  </p>
                  <small className={styles.source}>
                    {formatLookupSourceLabel(activeItem.meaning, activeItem.sourceName)}
                  </small>
                  {activeItem.meaning.translationId && (
                    <ReportViButton
                      translationId={activeItem.meaning.translationId}
                      label="nghĩa Việt"
                    />
                  )}
                  {activeItem.english.length > 0 && (
                    <>
                      <p className={styles.englishSub} lang="en">
                        {activeItem.english.join('; ')}
                      </p>
                      {activeItem.outsideJlpt && (
                        <small className={styles.source}>
                          {formatLookupSourceLabel(null, activeItem.sourceName)}
                        </small>
                      )}
                    </>
                  )}
                </>
              ) : (
                <>
                  <p className={styles.meaning} lang="en">
                    {activeItem.english.join('; ')}
                  </p>
                  <small className={styles.source}>
                    {formatLookupSourceLabel(null, activeItem.sourceName)}
                  </small>
                </>
              )}
            </div>

            {activeItem.outsideJlpt && (
              <p className={styles.attribution}>
                Nguồn ngoài JLPT:{' '}
                <a
                  href="https://www.edrdg.org/edrdg/licence.html"
                  target="_blank"
                  rel="noreferrer"
                >
                  JMdict (EDRDG, CC BY-SA 4.0)
                </a>
                {activeItem.meaning?.sourceId === 'bunchaway-javi' && (
                  <>
                    {' · '}
                    <a
                      href="https://github.com/bunchaway/tu-dien-nhat-viet"
                      target="_blank"
                      rel="noreferrer"
                    >
                      tu-dien-nhat-viet (Bunchaway, CC BY-SA 4.0)
                    </a>
                  </>
                )}
              </p>
            )}

            <div className={styles.sentenceBox}>
              <p className={styles.sectionLabel}>Câu gốc</p>
              <p className={styles.sentenceJa} lang="ja">
                {target.sentenceJa}
              </p>
              {target.sentenceVi && (
                <p className={styles.sentenceVi} lang="vi">
                  {target.sentenceVi}
                </p>
              )}
            </div>

            {allItems.length > 1 && (
              <div className={styles.alternatives} aria-label="Kết quả khác">
                {allItems.map((candidate, index) => (
                  <button
                    key={candidate.id}
                    type="button"
                    className={`button ${styles.altBtn}`}
                    aria-pressed={index === selectedIndex}
                    onClick={() => {
                      setSelectedIndex(index);
                      setSaveState('idle');
                      setSaveMessage('');
                    }}
                  >
                    <span lang="ja">{candidate.title}</span> · {formatLookupKind(candidate.kind)}
                  </button>
                ))}
              </div>
            )}

            <div className={styles.actions}>
              <button
                type="button"
                className="button primary"
                onClick={() => void handleSaveToSrs(activeItem)}
                disabled={saveState === 'saving' || saveState === 'saved'}
                aria-busy={saveState === 'saving'}
              >
                {saveState === 'saved'
                  ? 'Đã thêm ✓'
                  : saveState === 'saving'
                    ? 'Đang lưu…'
                    : 'Thêm vào ôn'}
              </button>
              <Link className="button" href={activeItem.href}>
                {activeItem.outsideJlpt && !activeItem.inSrs
                  ? 'Mở Tra cứu chung'
                  : 'Xem chi tiết'}
              </Link>
            </div>

            <p role="status" className={styles.status}>
              {saveMessage ||
                (activeItem.inSrs && activeItem.savedSentence
                  ? 'Từ này đã có trong hàng ôn; bấm “Thêm vào ôn” để cập nhật câu gốc.'
                  : '')}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

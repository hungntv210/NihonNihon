'use client';
import { lazy, Suspense, useState, type ReactNode } from 'react';
import type { Clip } from './clip-model.ts';
import {
  computeClipMeta,
  formatKnownWordPercent,
  formatSpeechRate,
  type ClipMetaSummary,
} from './clip-meta.ts';
import {
  emptyClipHistory,
  formatHistoryDate,
  type ClipHistorySummary,
} from './history-model.ts';
import { ShadowingPlayer } from './player.tsx';
import styles from './shadowing.module.css';

const ShadowingClipMaker = lazy(() =>
  import('./clip-maker.tsx').then((mod) => ({ default: mod.ShadowingClipMaker })),
);

function libraryHistoryText(summary: ClipHistorySummary, timeZone: string): string {
  const pinCount = Object.keys(summary.pinned).length;
  const parts: string[] = [];
  if (summary.totalTurns > 0) {
    parts.push(`${summary.totalTurns} lượt`);
    if (summary.lastPracticedDate) {
      parts.push(`gần nhất ${formatHistoryDate(summary.lastPracticedDate, timeZone)}`);
    }
  }
  if (pinCount > 0) {
    parts.push(`${pinCount} bản ghi ghim`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'Chưa có lượt luyện';
}

function defaultUserClipNotice(clip: Clip): ReactNode {
  if (clip.youtubeId) {
    return (
      <>
        <strong>
          YouTube cá nhân · {clip.level || 'N5'} · {clip.topic || 'Tự tạo'}
        </strong>
        <p>Chỉ lưu ID video và mốc thời gian, phát bằng trình phát nhúng sau khi bạn bấm. Không tải video về máy.</p>
      </>
    );
  }
  return (
    <>
      <strong>
        Clip tự tạo · {clip.level || 'N5'} · {clip.topic || 'Tự tạo'}
      </strong>
      <p>Tệp âm thanh/video lưu trong thư mục riêng tư trên máy chủ nhà, chỉ phát khi đã đăng nhập.</p>
    </>
  );
}

export function ShadowingLibrary({
  clips,
  initialClipId,
  initialSegment = 0,
  notices,
  practiceNote,
  recordNote,
  initialHistory,
  metaByClip,
  timeZone = 'Asia/Ho_Chi_Minh',
  whisperAvailable = false,
}: {
  clips: Clip[];
  initialClipId?: string;
  initialSegment?: number;
  notices?: Record<string, ReactNode>;
  practiceNote?: ReactNode;
  recordNote?: string;
  initialHistory?: Record<string, ClipHistorySummary>;
  metaByClip?: Record<string, ClipMetaSummary>;
  timeZone?: string;
  whisperAvailable?: boolean;
}) {
  const [clipList, setClipList] = useState<Clip[]>(clips);
  const [metaMap, setMetaMap] = useState<Record<string, ClipMetaSummary>>(() => metaByClip ?? {});
  const [makerOpen, setMakerOpen] = useState(false);
  const startId = initialClipId && clipList.some((c) => c.id === initialClipId) ? initialClipId : clipList[0].id;
  const [id, setId] = useState(startId);
  const [historyByClip, setHistoryByClip] = useState<Record<string, ClipHistorySummary>>(
    () => initialHistory ?? {},
  );
  const clip = clipList.find((c) => c.id === id) ?? clipList[0];
  const activeHistory = historyByClip[clip.id] ?? emptyClipHistory(clip.id);

  function handleHistoryChange(summary: ClipHistorySummary) {
    setHistoryByClip((prev) => ({ ...prev, [summary.clipId]: summary }));
  }

  function handleClipCreated(created: Clip, meta?: ClipMetaSummary) {
    setClipList((prev) => [...prev, created]);
    if (meta) {
      setMetaMap((prev) => ({ ...prev, [created.id]: meta }));
    }
    setId(created.id);
    setMakerOpen(false);
  }

  return (
    <>
      <div className={styles.libraryBar}>
        <button
          type="button"
          className="button primary"
          aria-expanded={makerOpen}
          onClick={() => setMakerOpen((open) => !open)}
        >
          {makerOpen ? 'Đóng trình tạo clip' : '+ Tạo clip mới'}
        </button>
      </div>
      {makerOpen && (
        <Suspense fallback={<p className={styles.makerHint}>Đang tải công cụ tạo clip…</p>}>
          <ShadowingClipMaker
            whisperAvailable={whisperAvailable}
            onCreated={handleClipCreated}
            onClose={() => setMakerOpen(false)}
          />
        </Suspense>
      )}
      <section className={styles.library} aria-label="Kho clip">
        {clipList.map((c) => {
          const summary = historyByClip[c.id] ?? emptyClipHistory(c.id);
          const meta = metaMap[c.id] ?? computeClipMeta(c, null);
          return (
            <button key={c.id} className="button" aria-pressed={id === c.id} onClick={() => setId(c.id)}>
              <strong>{meta.title}</strong>
              <span className={styles.libraryMeta}>
                <span className={styles.libraryBadge}>{meta.level}</span>
                <span className={styles.libraryField}>Nguồn: {meta.sourceLabel}</span>
                <span className={styles.libraryField}>Chủ đề: {meta.topic}</span>
              </span>
              <span className={styles.libraryStats}>
                <span className={styles.libraryStat}>{meta.sentenceCount} câu</span>
                <span className={styles.libraryStat}>
                  Tốc độ: {formatSpeechRate(meta.speechRateCharsPerSec)}
                </span>
                <span className={styles.libraryStat}>
                  Từ đã biết: {formatKnownWordPercent(meta.knownWordPercent)}
                </span>
              </span>
              <span className={styles.libraryHistory}>{libraryHistoryText(summary, timeZone)}</span>
            </button>
          );
        })}
      </section>
      <ShadowingPlayer
        key={clip.id}
        clip={clip}
        initialSegment={clip.id === startId ? initialSegment : 0}
        notice={notices?.[clip.id] ?? (clip.id.startsWith('user-clip:') ? defaultUserClipNotice(clip) : undefined)}
        practiceNote={practiceNote}
        recordNote={recordNote}
        history={activeHistory}
        timeZone={timeZone}
        onHistoryChange={handleHistoryChange}
      />
    </>
  );
}

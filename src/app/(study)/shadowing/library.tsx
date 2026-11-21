'use client';
import { useState, type ReactNode } from 'react';
import type { Clip } from './clip-model.ts';
import {
  emptyClipHistory,
  formatHistoryDate,
  type ClipHistorySummary,
} from './history-model.ts';
import { ShadowingPlayer } from './player.tsx';
import styles from './shadowing.module.css';

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

export function ShadowingLibrary({
  clips,
  initialClipId,
  initialSegment = 0,
  notices,
  practiceNote,
  recordNote,
  initialHistory,
  timeZone = 'Asia/Ho_Chi_Minh',
}: {
  clips: Clip[];
  initialClipId?: string;
  initialSegment?: number;
  notices?: Record<string, ReactNode>;
  practiceNote?: ReactNode;
  recordNote?: string;
  initialHistory?: Record<string, ClipHistorySummary>;
  timeZone?: string;
}) {
  const startId = initialClipId && clips.some((c) => c.id === initialClipId) ? initialClipId : clips[0].id;
  const [id, setId] = useState(startId);
  const [historyByClip, setHistoryByClip] = useState<Record<string, ClipHistorySummary>>(
    () => initialHistory ?? {},
  );
  const clip = clips.find((c) => c.id === id)!;
  const activeHistory = historyByClip[clip.id] ?? emptyClipHistory(clip.id);

  function handleHistoryChange(summary: ClipHistorySummary) {
    setHistoryByClip((prev) => ({ ...prev, [summary.clipId]: summary }));
  }

  return (
    <>
      <section className={styles.library} aria-label="Kho clip">
        {clips.map((c) => {
          const summary = historyByClip[c.id] ?? emptyClipHistory(c.id);
          return (
            <button key={c.id} className="button" aria-pressed={id === c.id} onClick={() => setId(c.id)}>
              <strong>{c.title}</strong>
              <span>
                {c.isDemo ? 'Demo' : (c.youtubeId ? 'YouTube · ' : '') + c.level + ' · ' + c.topic} ·{' '}
                {c.segments.length} câu
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
        notice={notices?.[clip.id]}
        practiceNote={practiceNote}
        recordNote={recordNote}
        history={activeHistory}
        timeZone={timeZone}
        onHistoryChange={handleHistoryChange}
      />
    </>
  );
}

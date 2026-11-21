export type ExampleProgress = {
  playingId: string | null;
  listenedIds: string[];
  readIds: string[];
};

export type ExampleStepStatus = 'idle' | 'playing' | 'read-aloud' | 'done';

export const EMPTY_EXAMPLE_PROGRESS: ExampleProgress = {
  playingId: null,
  listenedIds: [],
  readIds: [],
};

export function getExampleStepStatus(
  progress: ExampleProgress,
  exampleId: string,
): ExampleStepStatus {
  if (progress.playingId === exampleId) return 'playing';
  if (progress.readIds.includes(exampleId)) return 'done';
  if (progress.listenedIds.includes(exampleId)) return 'read-aloud';
  return 'idle';
}

export function startExamplePlayback(
  progress: ExampleProgress,
  exampleId: string,
): ExampleProgress {
  return { ...progress, playingId: exampleId };
}

export function finishExamplePlayback(
  progress: ExampleProgress,
  exampleId: string,
): ExampleProgress {
  return {
    ...progress,
    playingId: progress.playingId === exampleId ? null : progress.playingId,
    listenedIds: progress.listenedIds.includes(exampleId)
      ? progress.listenedIds
      : [...progress.listenedIds, exampleId],
  };
}

export function stopExamplePlayback(progress: ExampleProgress): ExampleProgress {
  return progress.playingId ? { ...progress, playingId: null } : progress;
}

export function markExampleRead(
  progress: ExampleProgress,
  exampleId: string,
  exampleIds: readonly string[],
): { progress: ExampleProgress; allRead: boolean; nextExampleId: string | null } {
  const readIds = progress.readIds.includes(exampleId)
    ? progress.readIds
    : [...progress.readIds, exampleId];
  const listenedIds = progress.listenedIds.includes(exampleId)
    ? progress.listenedIds
    : [...progress.listenedIds, exampleId];
  const next: ExampleProgress = {
    playingId: progress.playingId === exampleId ? null : progress.playingId,
    listenedIds,
    readIds,
  };
  const remaining = exampleIds.filter((id) => !readIds.includes(id));
  return {
    progress: next,
    allRead: exampleIds.length > 0 && remaining.length === 0,
    nextExampleId: remaining[0] ?? null,
  };
}

export function getExampleAudioState(progress: ExampleProgress, exampleId: string) {
  const status = getExampleStepStatus(progress, exampleId);
  const listened = progress.listenedIds.includes(exampleId);
  return {
    status,
    primaryLabel: status === 'playing' ? 'Dừng đọc' : listened ? 'Phát lại' : 'Nghe câu',
    showReplayButton: status === 'playing',
    showReadAloudPrompt: status === 'read-aloud',
    isReadDone: status === 'done',
  };
}

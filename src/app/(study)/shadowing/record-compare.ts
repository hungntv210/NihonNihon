export const WAVEFORM_BARS = 64;

export type AlternatingSource = 'original' | 'user';

export type AlternatingStep =
  | { kind: 'segment'; segmentIndex: number; source: AlternatingSource }
  | { kind: 'whole'; source: AlternatingSource };

export type AlternatingStatus = 'idle' | 'playing' | 'paused' | 'completed';

export type AlternatingState = {
  status: AlternatingStatus;
  steps: readonly AlternatingStep[];
  index: number;
};

export const IDLE_ALTERNATING: AlternatingState = {
  status: 'idle',
  steps: [],
  index: -1,
};

export function buildAlternatingQueue(
  segmentCount: number,
  recordedSegments: Iterable<number>,
  options: { hasWholeTake?: boolean; startFrom?: number } = {},
): AlternatingStep[] {
  const { hasWholeTake = false, startFrom = 0 } = options;
  const minIndex = Number.isInteger(startFrom) && startFrom > 0 ? startFrom : 0;
  const unique = new Set<number>();
  if (Number.isInteger(segmentCount) && segmentCount > 0) {
    for (const raw of recordedSegments) {
      if (Number.isInteger(raw) && raw >= minIndex && raw < segmentCount) {
        unique.add(raw);
      }
    }
  }
  const ordered = [...unique].sort((a, b) => a - b);
  if (ordered.length > 0) {
    const steps: AlternatingStep[] = [];
    for (const segmentIndex of ordered) {
      steps.push({ kind: 'segment', segmentIndex, source: 'original' });
      steps.push({ kind: 'segment', segmentIndex, source: 'user' });
    }
    return steps;
  }
  if (hasWholeTake) {
    return [
      { kind: 'whole', source: 'original' },
      { kind: 'whole', source: 'user' },
    ];
  }
  return [];
}

export function startAlternating(steps: readonly AlternatingStep[]): AlternatingState {
  if (!steps.length) return IDLE_ALTERNATING;
  return { status: 'playing', steps: [...steps], index: 0 };
}

export function currentAlternatingStep(state: AlternatingState): AlternatingStep | null {
  if (state.status !== 'playing' && state.status !== 'paused') return null;
  return state.steps[state.index] ?? null;
}

export function advanceAlternating(state: AlternatingState): AlternatingState {
  if (state.status !== 'playing') return state;
  const nextIndex = state.index + 1;
  if (nextIndex >= state.steps.length) {
    return { status: 'completed', steps: state.steps, index: state.steps.length };
  }
  return { status: 'playing', steps: state.steps, index: nextIndex };
}

export function pauseAlternating(state: AlternatingState): AlternatingState {
  if (state.status !== 'playing') return state;
  return { ...state, status: 'paused' };
}

export function resumeAlternating(state: AlternatingState): AlternatingState {
  if (state.status !== 'paused') return state;
  if (state.index < 0 || state.index >= state.steps.length) return IDLE_ALTERNATING;
  return { ...state, status: 'playing' };
}

export function stopAlternating(): AlternatingState {
  return IDLE_ALTERNATING;
}

export function describeAlternatingStep(step: AlternatingStep, index: number, total: number): string {
  const target = step.kind === 'whole' ? 'Cả clip' : `Câu ${step.segmentIndex + 1}`;
  const voice = step.source === 'original' ? 'câu gốc' : 'giọng của bạn';
  return `Đang phát xen kẽ (${index + 1}/${total}): ${target} — ${voice}.`;
}

export function mixChannelsToMono(channels: readonly ArrayLike<number>[]): Float32Array {
  if (!channels.length) return new Float32Array(0);
  const length = channels[0].length;
  const mono = new Float32Array(length);
  if (channels.length === 1) {
    const ch = channels[0];
    for (let i = 0; i < length; i++) {
      const value = ch[i];
      mono[i] = Number.isFinite(value) ? value : 0;
    }
    return mono;
  }
  const scale = 1 / channels.length;
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (let c = 0; c < channels.length; c++) {
      const value = channels[c][i];
      if (Number.isFinite(value)) sum += value;
    }
    mono[i] = sum * scale;
  }
  return mono;
}

export function slicePcmRange(
  totalSamples: number,
  sampleRate: number,
  startSeconds: number,
  endSeconds: number,
): { startSample: number; endSample: number } {
  if (!Number.isFinite(totalSamples) || totalSamples <= 0 || !Number.isFinite(sampleRate) || sampleRate <= 0) {
    return { startSample: 0, endSample: 0 };
  }
  const maxSamples = Math.floor(totalSamples);
  const s = Number.isFinite(startSeconds) ? Math.max(0, startSeconds) : 0;
  const e = Number.isFinite(endSeconds) ? Math.max(s, endSeconds) : s;
  const startSample = Math.min(maxSamples, Math.floor(s * sampleRate));
  const endSample = Math.min(maxSamples, Math.max(startSample, Math.ceil(e * sampleRate)));
  return { startSample, endSample };
}

export function normalizePeaks(peaks: readonly number[]): number[] {
  if (!peaks.length) return [];
  let maxPeak = 0;
  for (let i = 0; i < peaks.length; i++) {
    const v = peaks[i];
    if (Number.isFinite(v) && v > maxPeak) maxPeak = v;
  }
  if (maxPeak <= 0) return peaks.map(() => 0);
  return peaks.map((v) => {
    if (!Number.isFinite(v) || v <= 0) return 0;
    const scaled = v / maxPeak;
    return Math.min(1, Math.round(scaled * 10000) / 10000);
  });
}

export function computeWaveformPeaks(
  samples: ArrayLike<number>,
  buckets = WAVEFORM_BARS,
  options: { startSample?: number; endSample?: number; normalize?: boolean } = {},
): number[] {
  const count = Math.floor(buckets);
  if (!Number.isFinite(count) || count <= 0) return [];
  const total = samples.length;
  const start = Math.max(0, Math.min(total, Math.floor(options.startSample ?? 0)));
  const end = Math.max(start, Math.min(total, Math.floor(options.endSample ?? total)));
  const span = end - start;
  if (span <= 0) return Array.from({ length: count }, () => 0);

  const peaks: number[] = new Array(count);
  for (let b = 0; b < count; b++) {
    const from = start + Math.floor((b * span) / count);
    const nextEdge = start + Math.floor(((b + 1) * span) / count);
    const to = Math.min(end, Math.max(from + 1, nextEdge));
    let peak = 0;
    for (let i = from; i < to; i++) {
      const value = samples[i];
      if (!Number.isFinite(value)) continue;
      const abs = Math.abs(value);
      if (abs > peak) peak = abs;
    }
    peaks[b] = Math.min(1, Math.round(peak * 10000) / 10000);
  }
  return options.normalize ? normalizePeaks(peaks) : peaks;
}

export function formatDurationRatio(userSeconds: number, originalSeconds: number): number | null {
  if (!Number.isFinite(userSeconds) || !Number.isFinite(originalSeconds) || userSeconds <= 0 || originalSeconds <= 0) {
    return null;
  }
  return Math.round((userSeconds / originalSeconds) * 100);
}

export function wholeClipMaxRecordMs(clipDurationSeconds: number): number {
  const safeDuration = Number.isFinite(clipDurationSeconds) && clipDurationSeconds > 0 ? clipDurationSeconds : 40;
  return Math.min(120_000, Math.max(60_000, Math.ceil(safeDuration * 1500)));
}

export function formatMicError(error: unknown): string {
  const name =
    error && typeof error === 'object' && 'name' in error && typeof (error as { name?: unknown }).name === 'string'
      ? (error as { name: string }).name
      : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return 'Chưa có quyền micro. Cho phép micro trong cài đặt trình duyệt rồi thử lại.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'Không tìm thấy micro trên thiết bị. Kiểm tra micro đã kết nối và bật rồi thử lại.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
    return 'Micro đang bận hoặc bị hỏng. Đóng ứng dụng khác đang dùng micro rồi thử lại.';
  }
  if (name === 'OverconstrainedError') {
    return 'Micro hiện tại không hỗ trợ cấu hình ghi âm. Thử chọn thiết bị micro khác.';
  }
  return 'Không mở được micro. Kiểm tra thiết bị và dùng HTTPS hoặc localhost.';
}

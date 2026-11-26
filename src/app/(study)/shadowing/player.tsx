'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Clip, ClipSegment } from './clip-model.ts';
import { segmentAtIn, shouldRepeat, updatePlayback, SEEK_TOLERANCE } from './playback.ts';
import {
  PLAYBACK_SPEEDS,
  DEFAULT_PLAYBACK_SPEED,
  clampSegmentIndex,
  shadowPauseDurationMs,
  resolveShadowingShortcut,
  toggleLoopLimit,
  addShadowingClipToSrs,
} from './controls.ts';
import styles from './shadowing.module.css';
import { usePractice } from './use-practice.ts';
import { LookupPopup } from '../common-tools/lookup-popup.tsx';
import {
  fallbackSegmentTokens,
  type LookupTarget,
  type SentenceToken,
} from '../common-tools/lookup-popup-model.ts';
import {
  emptyClipHistory,
  formatHistoryDate,
  formatHistoryTime,
  HISTORY_RETENTION_DAYS,
  MAX_TURNS_PER_CLIP,
  type ClipHistorySummary,
} from './history-model.ts';
import {
  IDLE_ALTERNATING,
  advanceAlternating,
  buildAlternatingQueue,
  currentAlternatingStep,
  describeAlternatingStep,
  formatMicError,
  pauseAlternating,
  resumeAlternating,
  startAlternating,
  stopAlternating,
  wholeClipMaxRecordMs,
  type AlternatingState,
  type AlternatingStep,
} from './record-compare.ts';
import {
  decodeArrayBufferToMono,
  decodeBlobPeaks,
  extractWindowPeaks,
  type DecodedMonoAudio,
} from './waveform-compare.tsx';
import { RecordingPanel, type RecordingMode, type Take, type WholeTake } from './recording-panel.tsx';

type YoutubePlayer = {
  destroy(): void;
  getCurrentTime(): number;
  pauseVideo(): void;
  playVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setPlaybackRate(rate: number): void;
};
declare global {
  interface Window {
    YT?: { Player: new (element: HTMLElement, options: unknown) => YoutubePlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}
const DONE_MSG = 'Đã nghe xong đoạn. Bạn có thể ghi âm nói thử.';
const YOUTUBE_WAVE_NOTE = 'Clip YouTube nhúng không trích xuất được âm thanh gốc; chỉ hiển thị sóng âm giọng của bạn.';
const stopTracks = (s: MediaStream | null | undefined) => s?.getTracks().forEach((t) => t.stop());

export function ShadowingPlayer({
  clip,
  initialSegment = 0,
  notice,
  practiceNote,
  recordNote = '',
  history,
  timeZone = 'Asia/Ho_Chi_Minh',
  onHistoryChange,
}: {
  clip: Clip;
  initialSegment?: number;
  notice?: ReactNode;
  practiceNote?: ReactNode;
  recordNote?: string;
  history?: ClipHistorySummary;
  timeZone?: string;
  onHistoryChange?: (summary: ClipHistorySummary) => void;
}) {
  const clipHistory = history ?? emptyClipHistory(clip.id);
  const startSegment = clampSegmentIndex(initialSegment, clip.segments.length);
  const video = useRef<HTMLVideoElement>(null);
  const youtubeHost = useRef<HTMLDivElement>(null);
  const youtube = useRef<YoutubePlayer | null>(null);
  const youtubeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const replay = useRef<HTMLAudioElement>(null);
  const wholeReplay = useRef<HTMLAudioElement>(null);
  const pinnedReplay = useRef<HTMLAudioElement>(null);
  const altAudio = useRef<HTMLAudioElement | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const recordingBegan = useRef(0),
    recordingEnded = useRef<number | null>(null);
  const meter = useRef<AudioContext | null>(null),
    analyser = useRef<AnalyserNode | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const disposed = useRef(false);
  const takeUrls = useRef(new Map<number, string>());
  const wholeTakeUrl = useRef<string | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ctrl = useRef({
    pause: false,
    prevLimit: 1,
    seeked: startSegment === 0,
    timer: null as ReturnType<typeof setTimeout> | null,
  });
  const session = useRef({
    selected: startSegment,
    limit: 1,
    count: 0,
    active: false,
    whole: false,
    entered: false,
  });
  const [selected, setSelected] = useState(startSegment);
  const [playing, setPlaying] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [pauseToShadow, setPauseToShadow] = useState(false);
  const [time, setTime] = useState(clip.segments[startSegment]?.start ?? clip.start);
  const [speed, setSpeed] = useState<number>(DEFAULT_PLAYBACK_SPEED);
  const [limit, setLimit] = useState(1);
  const [count, setCount] = useState(0);
  const [subtitles, setSubtitles] = useState(clip.isDemo ? 'both' : 'kana');
  const [status, setStatus] = useState(
    clip.isDemo
      ? 'Chọn một câu rồi nghe thử. Clip chỉ có hình và tiếng bíp, không có giọng đọc Nhật.'
      : 'Chọn câu để nghe, lặp lại và ghi âm.',
  );
  const [srsSaving, setSrsSaving] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [unpinning, setUnpinning] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingMode, setRecordingMode] = useState<RecordingMode | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [takes, setTakes] = useState<Record<number, Take>>({});
  const [wholeTake, setWholeTake] = useState<WholeTake | null>(null);
  const [altState, setAltState] = useState<AlternatingState>(IDLE_ALTERNATING);
  const [originalAudio, setOriginalAudio] = useState<DecodedMonoAudio | null>(null);
  const [originalWaveLoading, setOriginalWaveLoading] = useState(false);
  const [originalWaveError, setOriginalWaveError] = useState<string | null>(null);
  const originalAudioRef = useRef<DecodedMonoAudio | null>(null);
  const originalLoadingRef = useRef(false);
  const takesRef = useRef<Record<number, Take>>({});
  takesRef.current = takes;
  const wholeTakeRef = useRef<WholeTake | null>(null);
  wholeTakeRef.current = wholeTake;
  const altRef = useRef<AlternatingState>(IDLE_ALTERNATING);
  const speedRef = useRef<number>(speed);
  speedRef.current = speed;
  const take = takes[selected] ?? null;
  const [supported, setSupported] = useState(false);
  const [youtubeLoaded, setYoutubeLoaded] = useState(false);
  const [lookupTarget, setLookupTarget] = useState<LookupTarget | null>(null);
  const lookupTrigger = useRef<HTMLElement | null>(null);
  const pending = useRef(false);
  const keyHandler = useRef<(event: KeyboardEvent) => void>(() => {});
  const altFinishRef = useRef<() => void>(() => {});
  const onHistoryChangeRef = useRef(onHistoryChange);
  onHistoryChangeRef.current = onHistoryChange;
  const closeLookup = useCallback(() => setLookupTarget(null), []);
  const practice = usePractice(clip.id, !clip.isDemo, () => {
    const rec = recorder.current?.state === 'recording';
    for (const audio of [replay.current, wholeReplay.current, altAudio.current]) {
      if (audio && !audio.paused) return { recording: rec, playing: true, seeking: audio.seeking, mediaTime: audio.currentTime };
    }
    return {
      recording: rec,
      playing: clip.youtubeId ? playing : Boolean(video.current && !video.current.paused),
      seeking: clip.youtubeId ? false : Boolean(video.current?.seeking),
      mediaTime: clip.youtubeId ? (youtube.current?.getCurrentTime() ?? 0) : (video.current?.currentTime ?? 0),
    };
  });

  const logPracticeTurn = useCallback(
    async (segmentId: string | null, durationMs: number, recordedSegments: number) => {
      try {
        const res = await fetch('/api/shadowing/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'turn',
            clipId: clip.id,
            segmentId,
            durationMs: Math.max(100, Math.round(durationMs)),
            recordedSegments,
            totalSegments: clip.segments.length,
          }),
        });
        if (!res.ok || disposed.current) return;
        const data = (await res.json()) as { summary?: ClipHistorySummary };
        if (data.summary && !disposed.current) onHistoryChangeRef.current?.(data.summary);
      } catch {
        // Non-blocking history log; ignore transient or aborted network errors
      }
    },
    [clip.id, clip.segments.length],
  );

  const ensureOriginalAudio = useCallback(() => {
    if (!clip.mediaUrl || originalAudioRef.current || originalLoadingRef.current) return;
    originalLoadingRef.current = true;
    setOriginalWaveLoading(true);
    setOriginalWaveError(null);
    void fetch(clip.mediaUrl)
      .then((res) => {
        if (!res.ok) throw new Error('MEDIA_FETCH_FAILED');
        return res.arrayBuffer();
      })
      .then((buffer) => decodeArrayBufferToMono(buffer))
      .then((decoded) => {
        if (disposed.current) return;
        originalAudioRef.current = decoded;
        setOriginalAudio(decoded);
      })
      .catch(() => {
        if (!disposed.current) setOriginalWaveError('Không giải mã được sóng âm bản gốc trên trình duyệt này.');
      })
      .finally(() => {
        originalLoadingRef.current = false;
        if (!disposed.current) setOriginalWaveLoading(false);
      });
  }, [clip.mediaUrl]);

  const clearShadowPause = () => {
    if (ctrl.current.timer) {
      clearTimeout(ctrl.current.timer);
      ctrl.current.timer = null;
    }
    setPausing(false);
  };
  const clearRecTimeout = () => {
    if (timeout.current) clearTimeout(timeout.current);
  };
  const resetSession = (sel: number, lim: number, act: boolean, whole: boolean) => {
    session.current = { selected: sel, limit: lim, count: 0, active: act, whole, entered: false };
    setCount(0);
  };
  const clearAltAudio = () => {
    const audio = altAudio.current;
    if (!audio) return;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
  };
  const stopAlternatingState = () => {
    clearAltAudio();
    altRef.current = stopAlternating();
    setAltState(IDLE_ALTERNATING);
  };
  function afterSegment(repeat: boolean, pauseMedia: () => void, resume: () => void) {
    if (!ctrl.current.pause) {
      if (repeat) resume();
      else setStatus(DONE_MSG);
      return;
    }
    clearShadowPause();
    const seg = clip.segments[session.current.selected],
      waitMs = seg ? shadowPauseDurationMs(seg) : 0;
    if (repeat) pauseMedia();
    if (waitMs <= 0) {
      if (repeat) resume();
      return;
    }
    setPausing(true);
    setStatus(`Dừng nói theo ${(waitMs / 1000).toFixed(1)}s (×1.2)…`);
    ctrl.current.timer = setTimeout(() => {
      ctrl.current.timer = null;
      if (disposed.current) return;
      setPausing(false);
      if (repeat) {
        if (session.current.active) resume();
      } else setStatus(DONE_MSG);
    }, waitMs);
  }

  async function playAlternatingStep(step: AlternatingStep, index: number, total: number) {
    if (disposed.current) return;
    setStatus(describeAlternatingStep(step, index, total));
    if (step.source === 'original') {
      clearAltAudio();
      replay.current?.pause();
      wholeReplay.current?.pause();
      pinnedReplay.current?.pause();
      const player = youtube.current,
        media = video.current;
      if (clip.youtubeId && !player) {
        stopAlternatingState();
        setStatus('Bấm “Mở trình phát YouTube” trước khi phát xen kẽ.');
        return;
      }
      if (!clip.youtubeId && !media) {
        stopAlternatingState();
        return;
      }
      const isWhole = step.kind === 'whole';
      const segIdx = step.kind === 'segment' ? step.segmentIndex : 0;
      const target = isWhole ? clip.start : clip.segments[segIdx].start;
      ctrl.current.seeked = true;
      setSelected(segIdx);
      setTime(target);
      resetSession(segIdx, 1, !isWhole, isWhole);
      if (clip.youtubeId) {
        player!.seekTo(target, true);
        player!.setPlaybackRate(speedRef.current);
        player!.playVideo();
        return;
      }
      media!.currentTime = target;
      media!.playbackRate = speedRef.current;
      media!.preservesPitch = true;
      try {
        await media!.play();
      } catch {
        stopAlternatingState();
        setStatus('Chưa phát được bản gốc trong chế độ xen kẽ. Thử bấm lại.');
      }
      return;
    }

    video.current?.pause();
    youtube.current?.pauseVideo();
    replay.current?.pause();
    wholeReplay.current?.pause();
    pinnedReplay.current?.pause();
    session.current.active = false;
    session.current.whole = false;

    const targetTake = step.kind === 'segment' ? takesRef.current[step.segmentIndex] : wholeTakeRef.current;
    if (!targetTake) {
      altFinishRef.current();
      return;
    }
    if (step.kind === 'segment') setSelected(step.segmentIndex);
    const audio = (altAudio.current ??= new Audio());
    audio.onended = () => {
      if (!disposed.current && altRef.current.status === 'playing') altFinishRef.current();
    };
    audio.onerror = () => {
      if (!disposed.current) {
        stopAlternatingState();
        setStatus('Không phát được bản ghi của bạn trong chế độ xen kẽ.');
      }
    };
    audio.src = targetTake.url;
    audio.currentTime = 0;
    try {
      await audio.play();
    } catch {
      if (!disposed.current) {
        stopAlternatingState();
        setStatus('Trình duyệt chặn phát giọng ghi âm trong chế độ xen kẽ. Thử bấm lại.');
      }
    }
  }

  altFinishRef.current = () => {
    if (altRef.current.status !== 'playing') return;
    const next = advanceAlternating(altRef.current);
    altRef.current = next;
    setAltState(next);
    if (next.status === 'completed') {
      clearAltAudio();
      setStatus('Đã phát xong chuỗi xen kẽ: câu gốc → giọng của bạn.');
      return;
    }
    const step = currentAlternatingStep(next);
    if (step) void playAlternatingStep(step, next.index, next.steps.length);
  };

  async function startAlternatingPlayback() {
    const steps = buildAlternatingQueue(clip.segments.length, Object.keys(takesRef.current).map(Number), {
      hasWholeTake: Boolean(wholeTakeRef.current),
    });
    if (!steps.length) {
      setStatus('Ghi âm ít nhất một câu hoặc cả clip để phát xen kẽ.');
      return;
    }
    if (clip.youtubeId && !youtube.current) {
      setStatus('Bấm “Mở trình phát YouTube” trước khi phát xen kẽ.');
      return;
    }
    stopPlayback();
    const next = startAlternating(steps);
    altRef.current = next;
    setAltState(next);
    const step = currentAlternatingStep(next);
    if (step) await playAlternatingStep(step, next.index, next.steps.length);
  }

  function pauseAlternatingPlayback() {
    if (altRef.current.status !== 'playing') return;
    const next = pauseAlternating(altRef.current);
    altRef.current = next;
    setAltState(next);
    video.current?.pause();
    youtube.current?.pauseVideo();
    altAudio.current?.pause();
    setStatus('Đã tạm dừng phát xen kẽ. Bấm Tiếp tục xen kẽ để nghe tiếp.');
  }

  async function resumeAlternatingPlayback() {
    if (altRef.current.status !== 'paused') return;
    const next = resumeAlternating(altRef.current);
    altRef.current = next;
    setAltState(next);
    const step = currentAlternatingStep(next);
    if (!step) return;
    setStatus(describeAlternatingStep(step, next.index, next.steps.length));
    if (step.source === 'original') {
      if (clip.youtubeId) {
        youtube.current?.playVideo();
        return;
      }
      try {
        await video.current?.play();
      } catch {
        stopAlternatingState();
        setStatus('Không thể tiếp tục phát bản gốc. Thử bắt đầu phát xen kẽ lại.');
      }
      return;
    }
    const audio = altAudio.current;
    if (!audio) {
      await playAlternatingStep(step, next.index, next.steps.length);
      return;
    }
    try {
      await audio.play();
    } catch {
      stopAlternatingState();
      setStatus('Không thể tiếp tục phát giọng ghi âm. Thử bắt đầu phát xen kẽ lại.');
    }
  }

  function stopAlternatingPlayback() {
    stopAlternatingState();
    video.current?.pause();
    youtube.current?.pauseVideo();
    session.current.active = false;
    session.current.whole = false;
    setStatus('Đã dừng chế độ phát xen kẽ.');
  }

  useEffect(() => {
    disposed.current = false;
    setSupported(
      window.isSecureContext &&
        Boolean(navigator.mediaDevices?.getUserMedia) &&
        typeof MediaRecorder !== 'undefined',
    );
    return () => {
      disposed.current = true;
      clearRecTimeout();
      if (ctrl.current.timer) clearTimeout(ctrl.current.timer);
      const current = recorder.current;
      if (current && current.state !== 'inactive') current.stop();
      stopTracks(stream.current);
      if (altAudio.current) {
        altAudio.current.onended = null;
        altAudio.current.onerror = null;
        altAudio.current.pause();
        altAudio.current = null;
      }
      void meter.current?.close().catch(() => {});
      meter.current = null;
      analyser.current = null;
      for (const url of takeUrls.current.values()) URL.revokeObjectURL(url);
      if (wholeTakeUrl.current) URL.revokeObjectURL(wholeTakeUrl.current);
    };
  }, []);

  useEffect(() => {
    if (!youtubeLoaded || !clip.youtubeId || !youtubeHost.current) return;
    let cancelled = false;
    const stopTimer = () => {
      if (youtubeTimer.current) {
        clearInterval(youtubeTimer.current);
        youtubeTimer.current = null;
      }
    };
    const tick = () => {
      const player = youtube.current;
      if (!player) return;
      const current = player.getCurrentTime(),
        loop = session.current;
      setTime(current);
      if (loop.whole && current >= clip.end - 0.08) {
        player.pauseVideo();
        player.seekTo(clip.end, true);
        loop.whole = false;
        setTime(clip.end);
        void logPracticeTurn(null, (clip.end - clip.start) * 1000, takeUrls.current.size);
        if (altRef.current.status === 'playing') altFinishRef.current();
        return;
      }
      if (!loop.active || current < clip.segments[loop.selected].end - 0.08) return;
      loop.count += 1;
      setCount(loop.count);
      const repeat = shouldRepeat(loop.count, loop.limit);
      if (!repeat) {
        loop.active = false;
        player.pauseVideo();
        const seg = clip.segments[loop.selected];
        if (seg) {
          void logPracticeTurn(seg.id, Math.max(500, (seg.end - seg.start) * 1000 * loop.count), takeUrls.current.size);
        }
        if (altRef.current.status === 'playing') {
          altFinishRef.current();
          return;
        }
      }
      afterSegment(
        repeat,
        () => player.pauseVideo(),
        () => {
          player.seekTo(clip.segments[loop.selected].start, true);
          player.playVideo();
        },
      );
    };
    const create = () => {
      if (cancelled || !window.YT?.Player || !youtubeHost.current) return;
      // Set policy before navigation: YouTube error153 means the Referer is missing.
      const frame = document.createElement('iframe');
      frame.title = clip.title;
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.allow = 'autoplay; encrypted-media; fullscreen';
      frame.src =
        'https://www.youtube-nocookie.com/embed/' +
        clip.youtubeId +
        '?' +
        new URLSearchParams({
          enablejsapi: '1',
          start: String(Math.floor(clip.start)),
          end: String(Math.ceil(clip.end)),
          playsinline: '1',
          rel: '0',
          origin: location.origin,
        });
      youtubeHost.current.replaceChildren(frame);
      youtube.current = new window.YT.Player(frame, {
        events: {
          onReady: () => {
            if (session.current.selected > 0)
              youtube.current?.seekTo(clip.segments[session.current.selected].start, true);
            setStatus('Trình phát YouTube đã sẵn sàng. Chọn câu hoặc phát cả clip.');
          },
          onStateChange: (event: { data: number }) => {
            setPlaying(event.data === 1);
            stopTimer();
            if (event.data === 1) youtubeTimer.current = setInterval(tick, 100);
          },
        },
      });
    };
    if (window.YT?.Player) create();
    else {
      window.onYouTubeIframeAPIReady = create;
      if (!document.querySelector('script[data-nihon-youtube]')) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.dataset.nihonYoutube = 'true';
        document.head.append(script);
      }
    }
    return () => {
      cancelled = true;
      stopTimer();
      youtube.current?.destroy();
      youtube.current = null;
      if (window.onYouTubeIframeAPIReady === create) delete window.onYouTubeIframeAPIReady;
    };
  }, [clip, youtubeLoaded, logPracticeTurn]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function stopPlayback() {
    clearShadowPause();
    stopAlternatingState();
    session.current.active = false;
    session.current.whole = false;
    video.current?.pause();
    youtube.current?.pauseVideo();
    replay.current?.pause();
    wholeReplay.current?.pause();
    pinnedReplay.current?.pause();
  }
  function openLookup(token: SentenceToken, sentence: ClipSegment, trigger: HTMLElement) {
    stopPlayback();
    lookupTrigger.current = trigger;
    setLookupTarget({
      surface: token.surface,
      base: token.base,
      sentenceJa: sentence.ja,
      sentenceVi: sentence.vi,
      sourceClipId: clip.id,
    });
  }
  function renderTokens(text: string, precomputed: SentenceToken[] | undefined, sentence: ClipSegment) {
    const tokens = precomputed && precomputed.length ? precomputed : fallbackSegmentTokens(text);
    return tokens.map((token, index) =>
      token.clickable ? (
        <button
          key={index}
          type="button"
          className={styles.wordToken}
          aria-label={`Tra từ ${token.surface}`}
          onClick={(event) => openLookup(token, sentence, event.currentTarget)}
        >
          {token.surface}
        </button>
      ) : (
        <span key={index}>{token.surface}</span>
      ),
    );
  }
  function choose(index: number) {
    stopPlayback();
    ctrl.current.seeked = true;
    resetSession(index, limit, false, false);
    setSelected(index);
    if (video.current) video.current.currentTime = clip.segments[index].start;
    youtube.current?.seekTo(clip.segments[index].start, true);
    setTime(clip.segments[index].start);
  }
  async function play(whole = false) {
    clearShadowPause();
    stopAlternatingState();
    ctrl.current.seeked = true;
    const player = youtube.current,
      media = video.current;
    if (clip.youtubeId && !player) {
      setStatus('Bấm “Mở trình phát YouTube” trước.');
      return;
    }
    if (!clip.youtubeId && !media) return;
    const target = whole ? clip.start : clip.segments[selected].start;
    const msg = whole ? 'Đang phát toàn clip.' : 'Đang phát đoạn đã chọn.';
    replay.current?.pause();
    wholeReplay.current?.pause();
    pinnedReplay.current?.pause();
    resetSession(selected, whole ? 1 : limit, !whole, whole);
    if (clip.youtubeId) {
      player!.seekTo(target, true);
      player!.setPlaybackRate(speed);
      player!.playVideo();
      setStatus(msg);
      return;
    }
    media!.currentTime = target;
    media!.playbackRate = speed;
    media!.preservesPitch = true;
    try {
      await media!.play();
      setStatus(msg);
    } catch {
      setStatus('Chưa phát được clip. Thử bấm phát lại hoặc tải lại trang.');
    }
  }
  function updateTime() {
    const media = video.current;
    if (!media) return;
    const loop = session.current;
    const wasWhole = loop.whole;
    const result = updatePlayback(media, clip, loop);
    if (!result) return;
    setTime(result.time);
    setCount(loop.count);
    if (wasWhole && !loop.whole) {
      void logPracticeTurn(null, (clip.end - clip.start) * 1000, takeUrls.current.size);
      if (altRef.current.status === 'playing') {
        altFinishRef.current();
        return;
      }
    }
    if (result.finished && !result.repeat) {
      const seg = clip.segments[loop.selected];
      if (seg) {
        void logPracticeTurn(seg.id, Math.max(500, (seg.end - seg.start) * 1000 * loop.count), takeUrls.current.size);
      }
      if (altRef.current.status === 'playing') {
        altFinishRef.current();
        return;
      }
    }
    if (result.finished || result.repeat)
      afterSegment(
        result.repeat,
        () => media.pause(),
        () => {
          media.currentTime = clip.segments[loop.selected].start;
          void media.play().catch(() => {
            loop.active = false;
            setStatus('Không thể phát tiếp. Bấm nghe lại đoạn.');
          });
        },
      );
  }
  async function addSrs() {
    if (srsSaving) return;
    setSrsSaving(true);
    const res = await addShadowingClipToSrs(clip.id);
    if (!disposed.current) {
      setSrsSaving(false);
      setStatus(res.message);
    }
  }
  keyHandler.current = (e: KeyboardEvent) => {
    const act = lookupTarget || recording || requesting ? null : resolveShadowingShortcut(e);
    if (!act) return;
    e.preventDefault();
    if (act === 'toggle-play') {
      if (altRef.current.status === 'playing') pauseAlternatingPlayback();
      else if (altRef.current.status === 'paused') void resumeAlternatingPlayback();
      else if (playing || pausing) stopPlayback();
      else void play();
    } else if (act === 'prev-segment') choose(Math.max(0, selected - 1));
    else if (act === 'next-segment') choose(Math.min(clip.segments.length - 1, selected + 1));
    else if (act === 'replay-segment') void play();
    else {
      const n = toggleLoopLimit(limit, ctrl.current.prevLimit);
      ctrl.current.prevLimit = n.remembered;
      setLimit(n.limit);
      session.current.limit = n.limit;
    }
  };
  function stopRecording() {
    clearRecTimeout();
    const current = recorder.current;
    if (current && current.state !== 'inactive') {
      recordingEnded.current ??= performance.now();
      current.stop();
    }
    stopTracks(stream.current);
  }
  async function startRecording(mode: RecordingMode = 'segment') {
    if (pending.current || recorder.current?.state === 'recording') return;
    pending.current = true;
    setRequesting(true);
    setRecordingMode(mode);
    stopPlayback();
    let acquired: MediaStream | null = null;
    try {
      meter.current = new AudioContext();
      void meter.current.resume().catch(() => {});
      acquired = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (disposed.current) {
        stopTracks(acquired);
        return;
      }
      stream.current = acquired;
      analyser.current = meter.current.createAnalyser();
      analyser.current.fftSize = 256;
      meter.current.createMediaStreamSource(acquired).connect(analyser.current);
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const current = new MediaRecorder(acquired, mimeType ? { mimeType } : undefined);
      recorder.current = current;
      const chunks: Blob[] = [],
        sentence = selected;
      const maxDurationMs = mode === 'whole' ? wholeClipMaxRecordMs(clip.end - clip.start) : 60_000;
      current.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      current.onerror = () => {
        stopRecording();
        if (!disposed.current) {
          setRecordingMode(null);
          setStatus('Ghi âm bị gián đoạn. Kiểm tra micro hoặc cấp lại quyền rồi thử lại.');
        }
      };
      current.onstop = () => {
        stopTracks(acquired);
        clearRecTimeout();
        if (disposed.current) return;
        setRecording(false);
        setRecordingMode(null);
        const resolvedMime = current.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunks, { type: resolvedMime });
        if (!blob.size) {
          setStatus('Bản ghi trống. Kiểm tra micro rồi thử lại.');
          return;
        }
        const durationMs = Math.max(0, (recordingEnded.current ?? performance.now()) - recordingBegan.current);
        const extension = resolvedMime.includes('mp4') ? 'm4a' : resolvedMime.includes('ogg') ? 'ogg' : 'webm';
        ensureOriginalAudio();
        if (mode === 'whole') {
          if (wholeTakeUrl.current) URL.revokeObjectURL(wholeTakeUrl.current);
          const url = URL.createObjectURL(blob);
          wholeTakeUrl.current = url;
          setWholeTake({ url, blob, mimeType: resolvedMime, seconds: durationMs / 1000, extension, peaks: null, waveLoading: true, waveError: null });
          void logPracticeTurn(null, durationMs, takeUrls.current.size);
          setStatus('Đã ghi âm cả clip trên thiết bị. Nghe lại, phát xen kẽ hoặc so sóng âm bên dưới.');
          void decodeBlobPeaks(blob)
            .then((peaks) => {
              if (!disposed.current && wholeTakeUrl.current === url)
                setWholeTake((prev) => (prev && prev.url === url ? { ...prev, peaks, waveLoading: false } : prev));
            })
            .catch(() => {
              if (!disposed.current && wholeTakeUrl.current === url)
                setWholeTake((prev) =>
                  prev && prev.url === url ? { ...prev, waveLoading: false, waveError: 'Không giải mã được sóng âm bản ghi trên trình duyệt này.' } : prev,
                );
            });
          return;
        }
        const previous = takeUrls.current.get(sentence);
        if (previous) URL.revokeObjectURL(previous);
        const url = URL.createObjectURL(blob);
        takeUrls.current.set(sentence, url);
        setTakes((values) => ({
          ...values,
          [sentence]: { url, blob, mimeType: resolvedMime, segment: sentence, seconds: durationMs / 1000, extension, peaks: null, waveLoading: true, waveError: null },
        }));
        practice.record(clip.segments[sentence].id, durationMs);
        void logPracticeTurn(clip.segments[sentence].id, durationMs, takeUrls.current.size);
        setStatus('Đã ghi âm trên thiết bị. Nghe lại, phát xen kẽ, tải xuống hoặc ghim làm bản ghi tốt nhất.');
        void decodeBlobPeaks(blob)
          .then((peaks) => {
            if (!disposed.current && takeUrls.current.get(sentence) === url)
              setTakes((v) => (v[sentence]?.url === url ? { ...v, [sentence]: { ...v[sentence], peaks, waveLoading: false } } : v));
          })
          .catch(() => {
            if (!disposed.current && takeUrls.current.get(sentence) === url)
              setTakes((v) =>
                v[sentence]?.url === url
                  ? { ...v, [sentence]: { ...v[sentence], waveLoading: false, waveError: 'Không giải mã được sóng âm bản ghi trên trình duyệt này.' } }
                  : v,
              );
          });
      };
      recordingBegan.current = performance.now();
      recordingEnded.current = null;
      current.onstart = () => {
        recordingBegan.current = performance.now();
      };
      current.start();
      setRecording(true);
      setStatus(
        mode === 'whole'
          ? `Đang ghi micro cả clip · tự dừng sau ${Math.round(maxDurationMs / 1000)} giây.`
          : 'Đang ghi micro · tự dừng sau 60 giây.',
      );
      timeout.current = setTimeout(stopRecording, maxDurationMs);
    } catch (error) {
      stopTracks(acquired);
      if (!disposed.current) {
        setRecordingMode(null);
        setStatus(formatMicError(error));
      }
    } finally {
      pending.current = false;
      if (!disposed.current) setRequesting(false);
    }
  }
  function removeTake() {
    stopAlternatingState();
    replay.current?.pause();
    const url = takeUrls.current.get(selected);
    if (url) URL.revokeObjectURL(url);
    takeUrls.current.delete(selected);
    setTakes((values) => {
      const next = { ...values };
      delete next[selected];
      return next;
    });
    setStatus('Đã xóa bản ghi của câu này.');
  }
  function removeWholeTake() {
    stopAlternatingState();
    wholeReplay.current?.pause();
    if (wholeTakeUrl.current) URL.revokeObjectURL(wholeTakeUrl.current);
    wholeTakeUrl.current = null;
    setWholeTake(null);
    setStatus('Đã xóa bản ghi cả clip.');
  }
  async function pinTake() {
    if (!take || pinning) return;
    const segment = clip.segments[take.segment];
    if (!segment) return;
    setPinning(true);
    try {
      const form = new FormData();
      form.set('clipId', clip.id);
      form.set('segmentId', segment.id);
      form.set('durationMs', String(Math.max(100, Math.round(take.seconds * 1000))));
      form.set('audioMime', take.mimeType || 'audio/webm');
      form.set('audio', take.blob, `take.${take.extension}`);
      const res = await fetch('/api/shadowing/history', { method: 'POST', body: form });
      const data = (await res.json().catch(() => ({}))) as { summary?: ClipHistorySummary; error?: string };
      if (disposed.current) return;
      if (!res.ok || !data.summary) {
        setStatus(data.error || 'Chưa ghim được bản ghi. Thử lại.');
        return;
      }
      onHistoryChangeRef.current?.(data.summary);
      setStatus(`Đã ghim bản ghi tốt nhất cho câu ${take.segment + 1}.`);
    } catch {
      if (!disposed.current) setStatus('Không kết nối được để ghim bản ghi.');
    } finally {
      if (!disposed.current) setPinning(false);
    }
  }
  async function unpinTake(segmentId: string, segmentIndex: number) {
    if (unpinning) return;
    setUnpinning(true);
    pinnedReplay.current?.pause();
    try {
      const res = await fetch(
        `/api/shadowing/history?clip=${encodeURIComponent(clip.id)}&segment=${encodeURIComponent(segmentId)}`,
        { method: 'DELETE' },
      );
      const data = (await res.json().catch(() => ({}))) as { summary?: ClipHistorySummary; error?: string };
      if (disposed.current) return;
      if (!res.ok || !data.summary) {
        setStatus(data.error || 'Chưa bỏ ghim được bản ghi.');
        return;
      }
      onHistoryChangeRef.current?.(data.summary);
      setStatus(`Đã bỏ ghim bản ghi câu ${segmentIndex + 1}.`);
    } catch {
      if (!disposed.current) setStatus('Không kết nối được để bỏ ghim.');
    } finally {
      if (!disposed.current) setUnpinning(false);
    }
  }
  function handleAudioPlay(kind: 'segment' | 'whole' | 'pinned') {
    stopAlternatingState();
    video.current?.pause();
    youtube.current?.pauseVideo();
    if (kind !== 'segment') replay.current?.pause();
    if (kind !== 'whole') wholeReplay.current?.pause();
    if (kind !== 'pinned') pinnedReplay.current?.pause();
  }

  const active = segmentAtIn(time, clip.segments),
    caption = clip.segments[active >= 0 ? active : selected],
    clipStart = clip.start,
    clipEnd = clip.end,
    locked = recording || requesting || Boolean(clip.youtubeId && !youtubeLoaded);
  const canLookupCaption =
    subtitles === 'both' || subtitles === 'ja' || (subtitles === 'kana' && Boolean(caption.kana));
  const selectedSegment = clip.segments[selected];
  const currentPin = selectedSegment ? (clipHistory.pinned[selectedSegment.id] ?? null) : null;
  const pinnedList = clip.segments
    .map((segment, index) => ({ segment, index, pin: clipHistory.pinned[segment.id] ?? null }))
    .filter((entry): entry is { segment: ClipSegment; index: number; pin: NonNullable<typeof entry.pin> } =>
      Boolean(entry.pin),
    );
  const segmentIndexById = new Map(clip.segments.map((segment, index) => [segment.id, index]));
  const altActive = altState.status === 'playing' || altState.status === 'paused';
  const segmentOriginalPeaks = useMemo(
    () => (originalAudio && selectedSegment ? extractWindowPeaks(originalAudio, selectedSegment.start, selectedSegment.end) : null),
    [originalAudio, selectedSegment],
  );
  const wholeOriginalPeaks = useMemo(
    () => (originalAudio ? extractWindowPeaks(originalAudio, clipStart, clipEnd) : null),
    [originalAudio, clipStart, clipEnd],
  );

  return (
    <div className={styles.root}>
      {notice && <aside className={styles.notice}>{notice}</aside>}
      {!clip.isDemo && (
        <aside aria-label="Buổi shadowing tự động">
          <p>
            {practice.status?.awarded
              ? 'Đã ghi nhận buổi shadowing hôm nay.'
              : 'Thời gian luyện đã lưu: ' +
                Math.floor((practice.status?.practiceMs ?? 0) / 60000) +
                '/15 phút · Câu ghi đủ độ dài: ' +
                (practice.status?.clips[clip.id]?.recorded ?? 0) +
                '/' +
                clip.segments.length}
          </p>
          {practiceNote}
          {practice.error && <p role="status">Chưa lưu được tiến độ. Đang thử lại; có thể dùng ghi tay dự phòng.</p>}
        </aside>
      )}
      <div className={styles.columns}>
        <section
          className={styles.card}
          aria-label={clip.isDemo ? 'Trình phát clip thử' : clip.youtubeId ? 'Trình phát clip YouTube' : 'Trình phát clip riêng'}
        >
          <div className={styles.header}>
            <h2>{clip.title}</h2>
            <span>
              {clip.isDemo ? 'DEMO' : clip.level} · {(clipEnd - clipStart).toFixed(1)} giây
            </span>
          </div>
          {clip.youtubeId ? (
            youtubeLoaded ? (
              <div className={styles.youtubeFrame}>
                <div ref={youtubeHost} aria-label={clip.title} />
              </div>
            ) : (
              <div className={styles.youtubeGate}>
                <p>Video chưa được nhúng. Khi mở, YouTube sẽ nhận yêu cầu phát.</p>
                <button className="button primary" onClick={() => setYoutubeLoaded(true)}>
                  Mở trình phát YouTube
                </button>
              </div>
            )
          ) : (
            <video
              ref={video}
              className={styles.video}
              src={clip.mediaUrl ?? undefined}
              playsInline
              preload="metadata"
              onLoadedMetadata={() => {
                const media = video.current;
                if (!media || media.seeking) return;
                if (!ctrl.current.seeked) {
                  ctrl.current.seeked = true;
                  media.currentTime = clip.segments[session.current.selected].start;
                  return;
                }
                if (media.currentTime < clipStart - SEEK_TOLERANCE || media.currentTime > clipEnd + SEEK_TOLERANCE)
                  media.currentTime = clipStart;
              }}
              onSeeking={updateTime}
              onSeeked={updateTime}
              onTimeUpdate={updateTime}
              onEnded={updateTime}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onError={() => setStatus('Không tải được clip. Kiểm tra tệp trên máy chủ rồi tải lại trang.')}
              aria-label={clip.isDemo ? 'Video tổng hợp chỉ có tiếng bíp' : clip.title}
            />
          )}
          <div className={styles.captions} aria-label="Phụ đề mẫu">
            {caption.speaker && subtitles !== 'off' && <small lang="ja">{caption.speaker}</small>}
            {(subtitles === 'both' || subtitles === 'ja') && (
              <p lang="ja">{renderTokens(caption.ja, caption.tokens, caption)}</p>
            )}
            {subtitles === 'kana' && (
              <p lang={caption.kana ? 'ja' : 'vi'}>
                {caption.kana ? renderTokens(caption.kana, caption.kanaTokens, caption) : 'Chưa có phụ đề kana.'}
              </p>
            )}
            {(subtitles === 'both' || subtitles === 'vi') && (
              <p lang="vi">{caption.vi ?? 'Chưa có bản dịch Việt.'}</p>
            )}
            {subtitles === 'off' && <p>Đã ẩn phụ đề</p>}
            {canLookupCaption && <p className={styles.lookupHint}>Chạm vào từ tiếng Nhật để tra nhanh</p>}
          </div>
          <p className={styles.progress}>
            {Math.max(0, time - clipStart).toFixed(1)} / {(clipEnd - clipStart).toFixed(1)} giây · Câu {selected + 1} · Đã
            phát {count} lượt
          </p>
          <div className={styles.actions}>
            <button className="button primary" onClick={() => void play()} disabled={locked}>
              Nghe lại đoạn
            </button>
            <button
              className="button play-toggle"
              aria-pressed={playing}
              onClick={() => (playing || pausing ? stopPlayback() : void play(true))}
              disabled={locked}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path className="play-icon" d="M5 3 17 10 5 17Z" />
                <path className="pause-icon" d="M4 3h4v14H4zM12 3h4v14h-4z" />
              </svg>
              {playing ? 'Tạm dừng clip' : 'Phát cả clip'}
            </button>
            <button className="button" onClick={stopPlayback} disabled={!playing && !pausing && !altActive}>
              Tạm dừng
            </button>
            <button
              type="button"
              className="button"
              aria-pressed={pauseToShadow}
              onClick={() => {
                const next = !pauseToShadow;
                setPauseToShadow(next);
                ctrl.current.pause = next;
                if (!next) clearShadowPause();
              }}
            >
              Dừng nói theo ×1.2
            </button>
            <button
              type="button"
              className="button"
              onClick={() => void addSrs()}
              disabled={srsSaving}
              aria-busy={srsSaving}
            >
              Thêm câu vào SRS
            </button>
          </div>
          <div className={styles.options}>
            <label>
              Tốc độ
              <select
                aria-label="Tốc độ"
                value={speed}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setSpeed(value);
                  if (video.current) video.current.playbackRate = value;
                  youtube.current?.setPlaybackRate(value);
                }}
              >
                {PLAYBACK_SPEEDS.map((value) => (
                  <option key={value} value={value}>
                    {value}×
                  </option>
                ))}
              </select>
            </label>
            <label>
              Lặp đoạn
              <select
                aria-label="Lặp đoạn"
                value={limit}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setLimit(value);
                  if (value > 0) ctrl.current.prevLimit = value;
                  session.current.limit = value;
                }}
              >
                {[1, 3, 5, 0].map((value) => (
                  <option key={value} value={value}>
                    {value || '∞'} lần
                  </option>
                ))}
              </select>
            </label>
            <label>
              Phụ đề
              <select
                aria-label="Phụ đề"
                value={subtitles}
                onChange={(event) => setSubtitles(event.target.value)}
              >
                <option value="both">Nhật + Việt</option>
                <option value="ja">Tiếng Nhật</option>
                <option value="kana">Kana</option>
                <option value="vi">Tiếng Việt</option>
                <option value="off">Ẩn</option>
              </select>
            </label>
          </div>
          <p className={styles.shortcuts} aria-label="Phím tắt máy tính">
            Phím tắt: Space Phát/dừng · ← → Câu · R Lặp · L ∞
          </p>
        </section>
        <section className={styles.card} aria-labelledby="segments-title">
          <h2 id="segments-title">Chọn câu</h2>
          <p className={styles.muted}>
            {clip.isDemo
              ? 'Mốc thời gian chỉ phục vụ kiểm thử.'
              : 'Mỗi câu giữ nguyên script; chạm để nghe lại và ghi âm.'}
          </p>
          <ol className={styles.segments}>
            {clip.segments.map((sentence, index) => (
              <li key={sentence.id}>
                <button
                  aria-pressed={selected === index}
                  aria-current={playing && active === index ? 'true' : undefined}
                  data-active={playing && active === index}
                  disabled={recording || requesting}
                  onClick={() => choose(index)}
                >
                  <span className={styles.segmentTop}>
                    Câu {index + 1}
                    <span>
                      {sentence.start.toFixed(1)}–{sentence.end.toFixed(1)}s
                    </span>
                  </span>
                  {sentence.speaker && <small lang="ja">{sentence.speaker}</small>}
                  <span lang="ja">{sentence.ja}</span>
                  <span>{sentence.vi}</span>
                  {takes[index] && <small>Đã ghi âm</small>}
                  {Boolean(clipHistory.pinned[sentence.id]) && <small>Đã ghim</small>}
                  {playing && active === index && <small>Đang phát</small>}
                </button>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <RecordingPanel
        clip={clip}
        selected={selected}
        selectedSegment={selectedSegment}
        recordNote={recordNote}
        timeZone={timeZone}
        supported={supported}
        locked={locked}
        recording={recording}
        recordingMode={recordingMode}
        requesting={requesting}
        takesCount={Object.keys(takes).length}
        take={take}
        wholeTake={wholeTake}
        currentPin={currentPin}
        pinning={pinning}
        unpinning={unpinning}
        altState={altState}
        analyser={analyser.current}
        replayRef={replay}
        wholeReplayRef={wholeReplay}
        pinnedReplayRef={pinnedReplay}
        segmentOriginalPeaks={segmentOriginalPeaks}
        wholeOriginalPeaks={wholeOriginalPeaks}
        originalWaveLoading={originalWaveLoading}
        originalUnavailableNote={clip.youtubeId ? YOUTUBE_WAVE_NOTE : originalWaveError}
        onStartRecording={(mode) => void startRecording(mode)}
        onStopRecording={stopRecording}
        onStartAlternating={() => void startAlternatingPlayback()}
        onPauseAlternating={pauseAlternatingPlayback}
        onResumeAlternating={() => void resumeAlternatingPlayback()}
        onStopAlternating={stopAlternatingPlayback}
        onPinTake={() => void pinTake()}
        onUnpinTake={(segmentId, segmentIndex) => void unpinTake(segmentId, segmentIndex)}
        onRemoveTake={removeTake}
        onRemoveWholeTake={removeWholeTake}
        onAudioPlay={handleAudioPlay}
        onAudioError={setStatus}
      />
      <section className={styles.card} aria-labelledby="history-title">
        <div className={styles.header}>
          <h2 id="history-title">Lịch sử luyện</h2>
          <span>
            {clipHistory.totalTurns} LƯỢT
            {clipHistory.lastPracticedDate
              ? ` · GẦN NHẤT ${formatHistoryDate(clipHistory.lastPracticedDate, timeZone)}`
              : ''}
          </span>
        </div>
        <p className={styles.historySummary}>
          {clipHistory.totalTurns > 0
            ? `Đã luyện ${clipHistory.totalTurns} lượt · Lần gần nhất: ${formatHistoryDate(clipHistory.lastPracticedDate!, timeZone)}`
            : 'Chưa có lượt luyện nào cho clip này.'}
          {pinnedList.length > 0 ? ` · ${pinnedList.length} bản ghi tốt nhất đã ghim.` : ''}
        </p>
        {pinnedList.length > 0 && (
          <div className={styles.pinnedStrip} aria-label="Danh sách bản ghi đã ghim">
            {pinnedList.map(({ index, pin }) => (
              <button
                key={pin.id}
                type="button"
                className="button"
                aria-pressed={selected === index}
                onClick={() => choose(index)}
              >
                ★ Câu {index + 1} · {(pin.durationMs / 1000).toFixed(1)}s
              </button>
            ))}
          </div>
        )}
        {clipHistory.turns.length > 0 ? (
          <ol className={styles.historyList} aria-label="Các lượt luyện gần nhất">
            {clipHistory.turns.slice(0, 20).map((turn) => {
              const segIdx = turn.segmentId ? segmentIndexById.get(turn.segmentId) : undefined;
              const segLabel = segIdx !== undefined ? `Câu ${segIdx + 1}` : 'Cả clip';
              return (
                <li key={turn.id} className={styles.historyRow}>
                  <span className={styles.historyTime}>{formatHistoryTime(turn.practicedAt, timeZone)}</span>
                  <span className={styles.historyMeta}>
                    {segLabel} · {(turn.durationMs / 1000).toFixed(1)}s
                    {turn.recordedSegments > 0
                      ? ` · Ghi ${turn.recordedSegments}/${turn.totalSegments} câu`
                      : ''}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className={styles.historyEmpty}>Nghe hết một câu hoặc ghi âm để bắt đầu lưu lịch sử luyện.</p>
        )}
        <p className={styles.historyNote}>
          Lưu tối đa {HISTORY_RETENTION_DAYS} ngày ({MAX_TURNS_PER_CLIP} lượt gần nhất/clip). Bản ghi tốt nhất đã ghim không bị tự dọn và đi kèm bản sao lưu.
        </p>
      </section>
      <p role="status" className={styles.status}>
        {status}
      </p>
      <LookupPopup target={lookupTarget} triggerEl={lookupTrigger.current} onClose={closeLookup} />
    </div>
  );
}

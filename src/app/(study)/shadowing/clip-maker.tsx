'use client';
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { Clip } from './clip-model.ts';
import type { ClipMetaSummary } from './clip-meta.ts';
import { computeWaveformPeaks } from './record-compare.ts';
import { decodeArrayBufferToMono } from './waveform-compare.tsx';
import {
  MAX_CLIP_TAGS,
  MAX_CLIP_TAG_LENGTH,
  MAX_ROADMAP_WEEK,
  MIN_ROADMAP_WEEK,
  ROADMAP_STAGES,
  furiganaToKana,
  normalizeClipTags,
  normalizeRoadmapWeek,
  parseFuriganaNotationStrict,
  validateFuriganaNotation,
  type AutoMetaWeekCandidate,
  type ClipAutoMetaResult,
} from './auto-meta-model.ts';
import {
  CLIP_LEVELS,
  MAX_CLIP_SPAN_MS,
  MAX_CLIP_UPLOAD_BYTES,
  MIN_CLIP_SPAN_MS,
  MIN_SEGMENT_MS,
  adjustSegmentBoundary,
  buildSegmentsFromPlainText,
  buildSegmentsFromSubtitles,
  clampClipRange,
  normalizeUploadMime,
  parseSubtitleFile,
  parseYoutubeLink,
  validateClipDraft,
  type DraftSegment,
  type SubtitleCue,
} from './clip-maker-model.ts';
import styles from './shadowing.module.css';

const WAVE_BUCKETS = 96;
const WAVE_W = 480;
const WAVE_H = 88;
const WAVE_MID = WAVE_H / 2;

const ROADMAP_WEEK_OPTIONS = Array.from(
  { length: MAX_ROADMAP_WEEK - MIN_ROADMAP_WEEK + 1 },
  (_, idx) => {
    const week = MIN_ROADMAP_WEEK + idx;
    const stage = ROADMAP_STAGES.find((s) => week >= s.start && week <= s.end)!;
    return { week, label: `Tuần ${week} · ${stage.level} — ${stage.theme}` };
  },
);

function toSec(ms: number): string {
  return (ms / 1000).toFixed(1);
}

function parseSecInput(raw: string, fallbackMs: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return fallbackMs;
  return Math.round(value * 1000);
}

export function ShadowingClipMaker({
  whisperAvailable = false,
  onCreated,
  onClose,
}: {
  whisperAvailable?: boolean;
  onCreated: (clip: Clip, meta?: ClipMetaSummary) => void;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<'file' | 'youtube'>('file');
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState<string>('N5');
  const [topic, setTopic] = useState('');

  // Auto-metadata state (offline furigana, tags, 87-week roadmap suggestion)
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [roadmapWeek, setRoadmapWeek] = useState<number | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [autoMetaNote, setAutoMetaNote] = useState<string | null>(null);
  const [weekReason, setWeekReason] = useState<string | null>(null);
  const [weekCandidates, setWeekCandidates] = useState<AutoMetaWeekCandidate[]>([]);

  // File source state
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [waveLoading, setWaveLoading] = useState(false);
  const [waveNote, setWaveNote] = useState<string | null>(null);

  // YouTube source state
  const [youtubeInput, setYoutubeInput] = useState('');
  const [youtubePreviewOpen, setYoutubePreviewOpen] = useState(false);

  // Timing & segments state
  const [durationMs, setDurationMs] = useState(30_000);
  const [clipStartMs, setClipStartMs] = useState(0);
  const [clipEndMs, setClipEndMs] = useState(15_000);
  const [parsedCues, setParsedCues] = useState<SubtitleCue[] | null>(null);
  const [subtitleText, setSubtitleText] = useState('');
  const [subtitleName, setSubtitleName] = useState('');
  const [subtitleStatus, setSubtitleStatus] = useState<string | null>(null);
  const [plainText, setPlainText] = useState('');
  const [segments, setSegments] = useState<DraftSegment[]>([]);

  // Playback preview & submission state
  const [previewingIndex, setPreviewingIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const mediaRef = useRef<HTMLVideoElement | null>(null);
  const previewStopMs = useRef<number | null>(null);
  const waveSvgRef = useRef<SVGSVGElement | null>(null);
  const dragHandle = useRef<'start' | 'end' | null>(null);
  const urlRef = useRef<string | null>(null);
  const fileDurationRef = useRef(0);
  const userAdjustedRangeRef = useRef(false);
  const parsedCuesRef = useRef<SubtitleCue[] | null>(null);
  const userEditedLevelRef = useRef(false);
  const userEditedTagsRef = useRef(false);
  const userEditedWeekRef = useRef(false);
  const analyzeSeqRef = useRef(0);

  useEffect(() => {
    parsedCuesRef.current = parsedCues;
  }, [parsedCues]);

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  const parsedYoutube = useMemo(() => parseYoutubeLink(youtubeInput), [youtubeInput]);

  const draftCheck = useMemo(
    () =>
      validateClipDraft({
        kind,
        title,
        level,
        topic,
        tags,
        roadmapWeek,
        durationMs,
        clipStartMs,
        clipEndMs,
        youtubeUrlOrId: youtubeInput,
        segments,
      }),
    [kind, title, level, topic, tags, roadmapWeek, durationMs, clipStartMs, clipEndMs, youtubeInput, segments],
  );

  function stopPreview() {
    previewStopMs.current = null;
    setPreviewingIndex(null);
    mediaRef.current?.pause();
  }

  async function runAutoAnalyze(
    targetSegments: readonly DraftSegment[],
    options: { overwriteFurigana?: boolean } = {},
  ) {
    const entries: { index: number; ja: string }[] = [];
    for (let i = 0; i < targetSegments.length; i++) {
      const ja = targetSegments[i].ja.normalize('NFC').trim();
      if (ja) entries.push({ index: i, ja });
    }
    if (entries.length === 0) {
      setAutoMetaNote('Thêm ít nhất 1 câu tiếng Nhật trước khi chạy phân tích tự động.');
      return;
    }

    const seq = ++analyzeSeqRef.current;
    setAnalyzing(true);
    setAutoMetaNote('Đang tạo furigana, gợi ý tag và tuần lộ trình (offline)…');

    try {
      const res = await fetch('/api/shadowing/clips/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentences: entries.map((e) => e.ja) }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<ClipAutoMetaResult> & { error?: string };
      if (seq !== analyzeSeqRef.current) return;
      if (!res.ok || !Array.isArray(data.segments)) {
        setAutoMetaNote(data.error || 'Chưa phân tích được tự động. Bạn vẫn có thể nhập thủ công.');
        return;
      }

      const byIndex = new Map<number, { ja: string; furigana: string; kana: string }>();
      entries.forEach((entry, i) => {
        const resultSeg = data.segments?.[i];
        if (resultSeg) byIndex.set(entry.index, resultSeg);
      });

      setSegments((prev) =>
        prev.map((seg, idx) => {
          const hit = byIndex.get(idx);
          if (!hit) return seg;
          if (seg.ja.normalize('NFC').trim() !== hit.ja) return seg;
          if (!options.overwriteFurigana && seg.furigana && seg.furigana.trim()) return seg;
          return {
            ...seg,
            furigana: hit.furigana,
            kana: hit.kana || seg.kana || null,
          };
        }),
      );

      if (data.suggestedLevel && !userEditedLevelRef.current) {
        setLevel(data.suggestedLevel);
      }
      const nextTags = Array.isArray(data.suggestedTags) ? data.suggestedTags : [];
      if (!userEditedTagsRef.current) {
        setTags(nextTags);
      }
      const nextWeek = normalizeRoadmapWeek(data.suggestedWeek);
      if (!userEditedWeekRef.current) {
        setRoadmapWeek(nextWeek);
      }
      setWeekReason(typeof data.suggestedWeekReason === 'string' ? data.suggestedWeekReason : null);
      setWeekCandidates(Array.isArray(data.weekCandidates) ? data.weekCandidates : []);

      const weekLabel = nextWeek ? ` và Tuần ${nextWeek}` : '';
      setAutoMetaNote(
        `Đã tạo furigana cho ${data.segments.length} câu, gợi ý ${nextTags.length} tag${weekLabel} (xử lý offline trên máy chủ; chưa có dịch máy tiếng Việt — chờ duyệt gửi ra ngoài).`,
      );
    } catch {
      if (seq === analyzeSeqRef.current) {
        setAutoMetaNote('Không kết nối được máy chủ để phân tích offline.');
      }
    } finally {
      if (seq === analyzeSeqRef.current) {
        setAnalyzing(false);
      }
    }
  }

  function mergeFileDuration(candidateMs: number) {
    if (!Number.isFinite(candidateMs) || candidateMs <= 0) return;
    const normalized = Math.max(MIN_CLIP_SPAN_MS, Math.round(candidateMs));
    if (normalized <= fileDurationRef.current) return;
    fileDurationRef.current = normalized;
    setDurationMs(normalized);
    if (!userAdjustedRangeRef.current) {
      const next = clampClipRange(0, Math.min(normalized, MAX_CLIP_SPAN_MS), normalized);
      setClipStartMs(next.clipStartMs);
      setClipEndMs(next.clipEndMs);
      if (parsedCuesRef.current && parsedCuesRef.current.length > 0) {
        setSegments(
          buildSegmentsFromSubtitles(parsedCuesRef.current, next.clipStartMs, next.clipEndMs, {
            autoSplit: true,
          }),
        );
      }
    }
  }

  function applyRange(nextStart: number, nextEnd: number, totalDur = durationMs, fromUser = true) {
    if (fromUser) userAdjustedRangeRef.current = true;
    const clamped = clampClipRange(nextStart, nextEnd, totalDur);
    setClipStartMs(clamped.clipStartMs);
    setClipEndMs(clamped.clipEndMs);
    if (parsedCuesRef.current && parsedCuesRef.current.length > 0) {
      setSegments(
        buildSegmentsFromSubtitles(parsedCuesRef.current, clamped.clipStartMs, clamped.clipEndMs, {
          autoSplit: true,
        }),
      );
    } else {
      setSegments((prev) =>
        prev
          .map((seg) => ({
            ...seg,
            startMs: Math.max(clamped.clipStartMs, Math.min(clamped.clipEndMs - MIN_SEGMENT_MS, seg.startMs)),
            endMs: Math.min(clamped.clipEndMs, Math.max(clamped.clipStartMs + MIN_SEGMENT_MS, seg.endMs)),
          }))
          .filter((seg) => seg.endMs > seg.startMs),
      );
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0] ?? null;
    stopPreview();
    setStatus(null);
    setWaveNote(null);
    setPeaks(null);
    fileDurationRef.current = 0;
    userAdjustedRangeRef.current = false;
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    if (!picked) {
      setFile(null);
      setPreviewUrl(null);
      return;
    }
    if (picked.size > MAX_CLIP_UPLOAD_BYTES) {
      setFile(null);
      setPreviewUrl(null);
      setStatus(`Tệp vượt giới hạn ${MAX_CLIP_UPLOAD_BYTES / (1024 * 1024)} MB. Hãy chọn tệp nhỏ hơn.`);
      return;
    }
    const mime = normalizeUploadMime(picked.type);
    if (!mime) {
      setFile(null);
      setPreviewUrl(null);
      setStatus('Định dạng không hỗ trợ. Chỉ nhận MP4, WebM, MP3, M4A, OGG hoặc WAV.');
      return;
    }
    setFile(picked);
    if (!title.trim()) {
      setTitle(picked.name.replace(/\.[^.]+$/, '').slice(0, 80));
    }
    const blobUrl = URL.createObjectURL(picked);
    urlRef.current = blobUrl;
    setPreviewUrl(blobUrl);

    setWaveLoading(true);
    try {
      const decoded = await decodeArrayBufferToMono(await picked.arrayBuffer());
      const computedPeaks = computeWaveformPeaks(decoded.mono, WAVE_BUCKETS, { normalize: true });
      setPeaks(computedPeaks);
      mergeFileDuration(decoded.duration * 1000);
    } catch {
      setWaveNote('Không giải mã được sóng âm trên trình duyệt này; vẫn có thể chỉnh mốc bằng thanh trượt.');
    } finally {
      setWaveLoading(false);
    }
  }

  function handleYoutubeChange(next: string) {
    setYoutubeInput(next);
    setYoutubePreviewOpen(false);
    const parsed = parseYoutubeLink(next);
    if (parsed && parsed.startSeconds !== null) {
      const startMs = parsed.startSeconds * 1000;
      const neededDur = Math.max(durationMs, startMs + 30_000);
      setDurationMs(neededDur);
      const nextRange = clampClipRange(startMs, Math.min(neededDur, startMs + 20_000), neededDur);
      setClipStartMs(nextRange.clipStartMs);
      setClipEndMs(nextRange.clipEndMs);
    }
  }

  function applySubtitleContent(name: string, content: string) {
    setSubtitleName(name);
    setSubtitleText(content);
    const parsed = parseSubtitleFile(name, content);
    if (!parsed.ok) {
      setParsedCues(null);
      setSubtitleStatus(`Lỗi phụ đề: ${parsed.message}`);
      return;
    }
    setParsedCues(parsed.value.cues);
    const firstStart = parsed.value.cues[0].startMs;
    const lastEnd = parsed.value.cues[parsed.value.cues.length - 1].endMs;
    let nextStart = clipStartMs;
    let nextEnd = clipEndMs;
    let nextDur = durationMs;
    if (kind === 'youtube' && lastEnd > nextDur) {
      nextDur = Math.max(nextDur, lastEnd + 1000);
      setDurationMs(nextDur);
    }
    const existingInRange = buildSegmentsFromSubtitles(parsed.value.cues, nextStart, nextEnd, { autoSplit: true });
    let built = existingInRange;
    if (built.length === 0) {
      const autoRange = clampClipRange(
        firstStart,
        Math.min(lastEnd, firstStart + MAX_CLIP_SPAN_MS),
        Math.max(nextDur, lastEnd),
      );
      nextStart = autoRange.clipStartMs;
      nextEnd = autoRange.clipEndMs;
      setClipStartMs(nextStart);
      setClipEndMs(nextEnd);
      built = buildSegmentsFromSubtitles(parsed.value.cues, nextStart, nextEnd, { autoSplit: true });
    }
    setSegments(built);
    const warn = parsed.value.errors.length > 0 ? ` (bỏ qua ${parsed.value.errors.length} dòng lỗi)` : '';
    setSubtitleStatus(
      `Đã đọc ${parsed.value.cues.length} dòng ${parsed.value.format.toUpperCase()}${warn} → tạo ${built.length} câu trong đoạn ${toSec(nextStart)}–${toSec(nextEnd)}s.`,
    );
    if (built.length > 0) {
      void runAutoAnalyze(built);
    }
  }

  async function handleSubtitleFile(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    if (!picked) return;
    const text = await picked.text();
    applySubtitleContent(picked.name, text);
  }

  function handleAutoSplitPlainText() {
    const source = plainText.trim() || segments.map((s) => s.ja).join(' ');
    if (!source) {
      setSubtitleStatus('Nhập câu tiếng Nhật trước khi chia câu tự động.');
      return;
    }
    const built = buildSegmentsFromPlainText(source, clipStartMs, clipEndMs);
    if (!built.length) {
      setSubtitleStatus('Không tách được câu nào từ văn bản.');
      return;
    }
    setParsedCues(null);
    setSegments(built);
    setSubtitleStatus(
      `Đã tự chia thành ${built.length} câu theo dấu 。！？ trong khoảng ${toSec(clipStartMs)}–${toSec(clipEndMs)}s.`,
    );
    void runAutoAnalyze(built);
  }

  function handleWaveformPointer(event: ReactPointerEvent<SVGSVGElement>, isStart: boolean) {
    const svg = waveSvgRef.current;
    if (!svg || durationMs <= 0) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const ms = Math.round((ratio * durationMs) / 100) * 100;
    if (isStart) {
      const distStart = Math.abs(ms - clipStartMs);
      const distEnd = Math.abs(ms - clipEndMs);
      dragHandle.current = distStart <= distEnd ? 'start' : 'end';
      svg.setPointerCapture?.(event.pointerId);
    }
    if (dragHandle.current === 'start') {
      const nextStart = Math.min(ms, clipEndMs - MIN_CLIP_SPAN_MS);
      const boundedEnd = Math.min(clipEndMs, nextStart + MAX_CLIP_SPAN_MS);
      applyRange(nextStart, boundedEnd);
    } else if (dragHandle.current === 'end') {
      const nextEnd = Math.max(ms, clipStartMs + MIN_CLIP_SPAN_MS);
      const boundedStart = Math.max(clipStartMs, nextEnd - MAX_CLIP_SPAN_MS);
      applyRange(boundedStart, nextEnd);
    }
  }

  function playSegmentPreview(index: number) {
    const seg = segments[index];
    if (!seg) return;
    if (kind === 'youtube') {
      setYoutubePreviewOpen(true);
      setStatus(`Đã chọn câu ${index + 1} (${toSec(seg.startMs)}–${toSec(seg.endMs)}s). Xem trong khung YouTube bên trên.`);
      return;
    }
    const media = mediaRef.current;
    if (!media) return;
    if (previewingIndex === index) {
      stopPreview();
      return;
    }
    previewStopMs.current = seg.endMs;
    setPreviewingIndex(index);
    media.currentTime = seg.startMs / 1000;
    void media.play().catch(() => {
      stopPreview();
      setStatus('Trình duyệt chưa phát được đoạn thử. Bấm lại để thử.');
    });
  }

  function updateSegmentBoundary(index: number, field: 'startMs' | 'endMs', nextMs: number) {
    setSegments((prev) => adjustSegmentBoundary(prev, index, field, nextMs, clipStartMs, clipEndMs));
  }

  function updateSegmentField(index: number, field: 'ja' | 'vi' | 'kana' | 'furigana', value: string) {
    setSegments((prev) =>
      prev.map((seg, i) => {
        if (i !== index) return seg;
        if (field === 'ja') {
          const keepFurigana = seg.furigana && parseFuriganaNotationStrict(value.trim(), seg.furigana.trim());
          return {
            ...seg,
            ja: value,
            furigana: keepFurigana ? seg.furigana : null,
            kana: keepFurigana ? seg.kana : null,
          };
        }
        if (field === 'furigana') {
          const check = validateFuriganaNotation(seg.ja, value);
          return {
            ...seg,
            furigana: value,
            kana: check.ok && check.value ? furiganaToKana(check.value) : seg.kana,
          };
        }
        return { ...seg, [field]: value };
      }),
    );
  }

  function splitSegmentAtMidpoint(index: number) {
    const seg = segments[index];
    if (!seg || seg.endMs - seg.startMs < MIN_SEGMENT_MS * 2) return;
    const mid = Math.round((seg.startMs + seg.endMs) / 2);
    const splitIdx = Math.ceil(seg.ja.length / 2);
    const firstJa = seg.ja.slice(0, splitIdx).trim() || seg.ja;
    const secondJa = seg.ja.slice(splitIdx).trim() || seg.ja;
    const next = segments.slice();
    next.splice(
      index,
      1,
      { ...seg, endMs: mid, ja: firstJa, furigana: null, kana: null },
      {
        id: `seg-${Date.now()}`,
        startMs: mid,
        endMs: seg.endMs,
        ja: secondJa,
        furigana: null,
        kana: null,
        speaker: seg.speaker,
        vi: null,
      },
    );
    setSegments(next);
  }

  function addSegment() {
    const last = segments[segments.length - 1];
    const nextStart = last ? last.endMs : clipStartMs;
    const available = clipEndMs - nextStart;
    if (available >= MIN_SEGMENT_MS) {
      const nextEnd = Math.min(clipEndMs, nextStart + Math.min(available, 3000));
      setSegments((prev) => [
        ...prev,
        {
          id: `seg-${prev.length + 1}-${Date.now()}`,
          startMs: nextStart,
          endMs: nextEnd,
          ja: '',
          furigana: null,
          kana: null,
          speaker: null,
          vi: null,
        },
      ]);
      return;
    }
    if (last && last.endMs - last.startMs >= MIN_SEGMENT_MS * 2) {
      splitSegmentAtMidpoint(segments.length - 1);
    }
  }

  function removeSegment(index: number) {
    if (previewingIndex === index) stopPreview();
    setSegments((prev) => prev.filter((_, i) => i !== index));
  }

  function addTagFromInput() {
    const cleaned = tagInput.normalize('NFC').replace(/\s+/g, ' ').trim();
    if (!cleaned) return;
    userEditedTagsRef.current = true;
    setTags((prev) => normalizeClipTags([...prev, cleaned]));
    setTagInput('');
  }

  function removeTag(target: string) {
    userEditedTagsRef.current = true;
    setTags((prev) => prev.filter((item) => item !== target));
  }

  async function handleSave() {
    if (submitting) return;
    if (!draftCheck.ok) {
      setStatus(draftCheck.message);
      return;
    }
    if (kind === 'file' && !file) {
      setStatus('Chọn tệp âm thanh hoặc video trước khi lưu.');
      return;
    }
    setSubmitting(true);
    setStatus('Đang lưu clip vào thư mục riêng tư…');
    try {
      let res: Response;
      if (kind === 'file' && file) {
        const form = new FormData();
        form.set('file', file, file.name);
        form.set('mime', file.type || 'video/webm');
        form.set(
          'metadata',
          JSON.stringify({
            title: draftCheck.value.title,
            level: draftCheck.value.level,
            topic: draftCheck.value.topic,
            tags: draftCheck.value.tags,
            roadmapWeek: draftCheck.value.roadmapWeek,
            durationMs: draftCheck.value.durationMs,
            clipStartMs: draftCheck.value.clipStartMs,
            clipEndMs: draftCheck.value.clipEndMs,
            segments: draftCheck.value.segments,
          }),
        );
        res = await fetch('/api/shadowing/clips', { method: 'POST', body: form });
      } else {
        res = await fetch('/api/shadowing/clips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'youtube',
            title: draftCheck.value.title,
            level: draftCheck.value.level,
            topic: draftCheck.value.topic,
            tags: draftCheck.value.tags,
            roadmapWeek: draftCheck.value.roadmapWeek,
            durationMs: draftCheck.value.durationMs,
            clipStartMs: draftCheck.value.clipStartMs,
            clipEndMs: draftCheck.value.clipEndMs,
            youtubeUrlOrId: draftCheck.value.youtubeId,
            segments: draftCheck.value.segments,
          }),
        });
      }
      const data = (await res.json().catch(() => ({}))) as { clip?: Clip; meta?: ClipMetaSummary; error?: string };
      if (!res.ok || !data.clip) {
        setStatus(data.error || 'Chưa lưu được clip. Kiểm tra lại thông tin.');
        return;
      }
      stopPreview();
      onCreated(data.clip, data.meta);
    } catch {
      setStatus('Không kết nối được máy chủ để lưu clip.');
    } finally {
      setSubmitting(false);
    }
  }

  const startX = durationMs > 0 ? (clipStartMs / durationMs) * WAVE_W : 0;
  const endX = durationMs > 0 ? (clipEndMs / durationMs) * WAVE_W : WAVE_W;

  return (
    <section className={styles.makerCard} aria-label="Công cụ tạo clip shadowing" data-clip-maker="">
      <div className={styles.header}>
        <h2>Tạo clip shadowing mới</h2>
        <button type="button" className="button" onClick={onClose}>
          Đóng
        </button>
      </div>

      <div className={styles.makerTabs} role="tablist" aria-label="Chọn nguồn clip">
        <button
          type="button"
          role="tab"
          className="button"
          aria-selected={kind === 'file'}
          onClick={() => {
            stopPreview();
            setKind('file');
            setStatus(null);
          }}
        >
          Tải file audio / video
        </button>
        <button
          type="button"
          role="tab"
          className="button"
          aria-selected={kind === 'youtube'}
          onClick={() => {
            stopPreview();
            setKind('youtube');
            setStatus(null);
          }}
        >
          Dán link YouTube
        </button>
      </div>

      <div className={styles.makerGrid}>
        <label className={styles.makerField}>
          <span>Tiêu đề clip</span>
          <input
            type="text"
            value={title}
            maxLength={120}
            placeholder="Ví dụ: Hội thoại quán cà phê"
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className={styles.makerField}>
          <span>Cấp độ</span>
          <select
            value={level}
            onChange={(e) => {
              userEditedLevelRef.current = true;
              setLevel(e.target.value);
            }}
          >
            {CLIP_LEVELS.map((lv) => (
              <option key={lv} value={lv}>
                {lv}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.makerField}>
          <span>Chủ đề</span>
          <input
            type="text"
            value={topic}
            maxLength={80}
            placeholder="Giao tiếp hằng ngày"
            onChange={(e) => setTopic(e.target.value)}
          />
        </label>
      </div>

      {kind === 'file' ? (
        <div className={styles.makerSection}>
          <label className={styles.makerField}>
            <span>Chọn tệp audio / video (MP4, WebM, MP3, M4A, OGG, WAV · tối đa 8 MB)</span>
            <input
              type="file"
              accept="video/mp4,video/webm,audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/webm,.mp4,.webm,.mp3,.m4a,.ogg,.wav"
              onChange={(e) => void handleFileChange(e)}
            />
          </label>
          <p className={styles.makerHint}>
            Tệp lưu riêng trên máy chủ nhà, yêu cầu đăng nhập khi phát, không commit vào repo.
          </p>
          {previewUrl && (
            <video
              ref={mediaRef}
              className={styles.makerPreview}
              src={previewUrl}
              controls
              playsInline
              preload="metadata"
              onLoadedMetadata={(e) => {
                const dur = e.currentTarget.duration;
                if (Number.isFinite(dur) && dur >= 1) {
                  mergeFileDuration(dur * 1000);
                }
              }}
              onTimeUpdate={(e) => {
                if (previewStopMs.current !== null && e.currentTarget.currentTime * 1000 >= previewStopMs.current - 30) {
                  e.currentTarget.pause();
                  previewStopMs.current = null;
                  setPreviewingIndex(null);
                }
              }}
              onPause={() => {
                previewStopMs.current = null;
                setPreviewingIndex(null);
              }}
            />
          )}
        </div>
      ) : (
        <div className={styles.makerSection}>
          <label className={styles.makerField}>
            <span>Dán link YouTube hoặc ID 11 ký tự</span>
            <input
              type="text"
              value={youtubeInput}
              placeholder="https://www.youtube.com/watch?v=... hoặc https://youtu.be/..."
              onChange={(e) => handleYoutubeChange(e.target.value)}
            />
          </label>
          <p className={styles.makerHint}>
            {parsedYoutube
              ? `ID video hợp lệ: ${parsedYoutube.videoId}. Chỉ lưu ID và mốc thời gian, phát bằng trình phát nhúng — không tải video về máy.`
              : 'Chỉ lưu ID video và mốc thời gian, phát bằng trình phát nhúng (youtube-nocookie.com), không tải video về máy.'}
          </p>
          <div className={styles.makerRow}>
            <label className={styles.makerField}>
              <span>Độ dài video nguồn (giây)</span>
              <input
                type="number"
                min={1}
                max={7200}
                step={1}
                value={Math.round(durationMs / 1000)}
                onChange={(e) => {
                  const nextDur = Math.max(MIN_CLIP_SPAN_MS, parseSecInput(e.target.value, durationMs));
                  setDurationMs(nextDur);
                  applyRange(clipStartMs, Math.min(nextDur, clipEndMs), nextDur);
                }}
              />
            </label>
            {parsedYoutube && (
              <button
                type="button"
                className="button"
                onClick={() => setYoutubePreviewOpen((v) => !v)}
              >
                {youtubePreviewOpen ? 'Ẩn xem thử YouTube' : 'Mở xem thử YouTube'}
              </button>
            )}
          </div>
          {parsedYoutube && youtubePreviewOpen && (
            <div className={styles.youtubeFrame}>
              <iframe
                title={title || 'Xem thử YouTube'}
                referrerPolicy="strict-origin-when-cross-origin"
                allow="autoplay; encrypted-media; fullscreen"
                src={`https://www.youtube-nocookie.com/embed/${parsedYoutube.videoId}?start=${Math.floor(clipStartMs / 1000)}&end=${Math.ceil(clipEndMs / 1000)}&playsinline=1&rel=0`}
              />
            </div>
          )}
        </div>
      )}

      <div className={styles.makerSection}>
        <div className={styles.waveHead}>
          <strong>Chọn đoạn trên sóng âm ({toSec(clipStartMs)}s – {toSec(clipEndMs)}s · dài {toSec(clipEndMs - clipStartMs)}s)</strong>
          <span>Khuyên dùng 10–60 giây</span>
        </div>
        {waveLoading && <p className={styles.waveNote}>Đang giải mã sóng âm ngoại tuyến…</p>}
        {waveNote && <p className={styles.waveNote}>{waveNote}</p>}
        <svg
          ref={waveSvgRef}
          className={styles.makerWaveSvg}
          viewBox={`0 0 ${WAVE_W} ${WAVE_H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label="Sóng âm chọn đoạn clip"
          data-maker-waveform=""
          data-wave-decoded={peaks ? 'true' : 'false'}
          onPointerDown={(e) => handleWaveformPointer(e, true)}
          onPointerMove={(e) => {
            if (dragHandle.current) handleWaveformPointer(e, false);
          }}
          onPointerUp={() => {
            dragHandle.current = null;
          }}
          onPointerCancel={() => {
            dragHandle.current = null;
          }}
        >
          <line x1={0} y1={WAVE_MID} x2={WAVE_W} y2={WAVE_MID} className={styles.waveAxis} />
          <rect
            x={startX}
            y={0}
            width={Math.max(2, endX - startX)}
            height={WAVE_H}
            className={styles.makerWaveWindow}
          />
          {(peaks ?? Array.from({ length: WAVE_BUCKETS }, (_, i) => 0.18 + ((i * 7) % 5) * 0.06)).map(
            (peak, i) => {
              const step = WAVE_W / WAVE_BUCKETS;
              const barW = Math.max(2, step * 0.65);
              const half = Math.max(2, Math.min(1, peak) * 34);
              const x = i * step + (step - barW) / 2;
              const inWindow = x + barW >= startX && x <= endX;
              return (
                <rect
                  key={i}
                  data-maker-wave-bar=""
                  x={x}
                  y={WAVE_MID - half}
                  width={barW}
                  height={half * 2}
                  rx={1}
                  className={inWindow ? styles.waveUserBar : styles.waveOrigBar}
                />
              );
            },
          )}
          {segments.map((seg) => {
            const sx = durationMs > 0 ? (seg.startMs / durationMs) * WAVE_W : 0;
            return <line key={seg.id} x1={sx} y1={4} x2={sx} y2={WAVE_H - 4} className={styles.makerSegTick} />;
          })}
          <line x1={startX} y1={0} x2={startX} y2={WAVE_H} className={styles.makerHandleLine} />
          <line x1={endX} y1={0} x2={endX} y2={WAVE_H} className={styles.makerHandleLine} />
        </svg>

        <div className={styles.makerRangeInputs}>
          <label className={styles.makerField}>
            <span>Đầu đoạn (giây)</span>
            <input
              type="number"
              min={0}
              max={Math.max(0, (durationMs - MIN_CLIP_SPAN_MS) / 1000)}
              step={0.1}
              value={toSec(clipStartMs)}
              onChange={(e) => applyRange(parseSecInput(e.target.value, clipStartMs), clipEndMs)}
            />
          </label>
          <label className={styles.makerField}>
            <span>Cuối đoạn (giây)</span>
            <input
              type="number"
              min={MIN_CLIP_SPAN_MS / 1000}
              max={durationMs / 1000}
              step={0.1}
              value={toSec(clipEndMs)}
              onChange={(e) => applyRange(clipStartMs, parseSecInput(e.target.value, clipEndMs))}
            />
          </label>
        </div>
      </div>

      <div className={styles.makerSection}>
        <strong>Phụ đề có sẵn (.srt / .ass) hoặc chia câu tự động</strong>
        <div className={styles.makerRow}>
          <label className={styles.makerField}>
            <span>Nhập tệp phụ đề (.srt / .ass)</span>
            <input
              type="file"
              accept=".srt,.ass,.ssa,text/plain"
              onChange={(e) => void handleSubtitleFile(e)}
            />
          </label>
          {whisperAvailable && (
            <button type="button" className="button" disabled>
              Nhận dạng Whisper cục bộ
            </button>
          )}
        </div>
        <div className={styles.makerField}>
          <label htmlFor="maker-subtitle-text">Hoặc dán nội dung .srt / .ass</label>
          <textarea
            id="maker-subtitle-text"
            rows={3}
            value={subtitleText}
            placeholder="Dán nội dung SRT hoặc ASS rồi bấm Áp dụng phụ đề"
            onChange={(e) => setSubtitleText(e.target.value)}
          />
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className="button"
            onClick={() => applySubtitleContent(subtitleName || 'pasted.srt', subtitleText)}
          >
            Áp dụng phụ đề .srt/.ass
          </button>
        </div>

        <div className={styles.makerField}>
          <label htmlFor="maker-plain-text">Hoặc dán văn bản tiếng Nhật để tự chia câu theo 。！？</label>
          <textarea
            id="maker-plain-text"
            rows={2}
            value={plainText}
            placeholder="おはようございます。今日はいい天気ですね！おげんきですか？"
            onChange={(e) => setPlainText(e.target.value)}
          />
        </div>
        <div className={styles.actions}>
          <button type="button" className="button" onClick={handleAutoSplitPlainText}>
            Chia câu tự động (。！？)
          </button>
          <button type="button" className="button" onClick={addSegment}>
            + Thêm câu thủ công
          </button>
        </div>
        {subtitleStatus && (
          <p className={styles.makerHint} role="status">
            {subtitleStatus}
          </p>
        )}
      </div>

      <div className={styles.makerSection} data-maker-auto-meta="">
        <div className={styles.waveHead}>
          <strong>Tự thêm furigana, gắn tag &amp; tuần lộ trình (offline)</strong>
          <button
            type="button"
            className="button"
            disabled={analyzing || segments.length === 0}
            aria-busy={analyzing}
            onClick={() => void runAutoAnalyze(segments, { overwriteFurigana: true })}
          >
            {analyzing ? 'Đang phân tích offline…' : 'Tự thêm furigana & gợi ý (offline)'}
          </button>
        </div>
        <p className={styles.makerHint} role="status" data-maker-auto-status="">
          {autoMetaNote ??
            'Tự sinh furigana, gợi ý tag và tuần lộ trình chạy offline bằng từ điển OpenJLPT trên máy chủ. Chưa có dịch máy tiếng Việt (chờ duyệt gửi ra ngoài).'}
        </p>

        <div className={styles.makerMetaGrid}>
          <div className={styles.makerMetaBox}>
            <strong>Tag clip ({tags.length}/{MAX_CLIP_TAGS})</strong>
            <div className={styles.makerTagList} aria-label="Danh sách tag đã gắn">
              {tags.length === 0 ? (
                <span className={styles.makerHint}>Chưa có tag. Chạy phân tích offline hoặc thêm thủ công bên dưới.</span>
              ) : (
                tags.map((tag) => (
                  <span key={tag} className={styles.makerTagChip} data-maker-tag={tag}>
                    <span>{tag}</span>
                    <button
                      type="button"
                      className={styles.makerTagRemove}
                      aria-label={`Xóa tag ${tag}`}
                      onClick={() => removeTag(tag)}
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>
            <div className={styles.makerTagAddRow}>
              <input
                type="text"
                aria-label="Thêm tag mới"
                value={tagInput}
                maxLength={MAX_CLIP_TAG_LENGTH}
                placeholder="Nhập tag mới (ví dụ: hội thoại)"
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTagFromInput();
                  }
                }}
              />
              <button
                type="button"
                className="button"
                disabled={!tagInput.trim() || tags.length >= MAX_CLIP_TAGS}
                onClick={addTagFromInput}
              >
                + Thêm tag
              </button>
            </div>
          </div>

          <div className={styles.makerMetaBox}>
            <label className={styles.makerField}>
              <strong>Tuần lộ trình (87 tuần · N5 → N2)</strong>
              <select
                aria-label="Tuần lộ trình"
                value={roadmapWeek ?? ''}
                onChange={(e) => {
                  userEditedWeekRef.current = true;
                  setRoadmapWeek(normalizeRoadmapWeek(e.target.value));
                }}
              >
                <option value="">Chưa gắn tuần lộ trình</option>
                {ROADMAP_WEEK_OPTIONS.map((opt) => (
                  <option key={opt.week} value={opt.week}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            {weekReason && <p className={styles.makerHint}>{weekReason}</p>}
            {weekCandidates.length > 0 && (
              <div className={styles.makerCandidateRow} aria-label="Gợi ý tuần lộ trình nhanh">
                {weekCandidates.map((cand) => (
                  <button
                    key={cand.week}
                    type="button"
                    className="button"
                    aria-pressed={roadmapWeek === cand.week}
                    onClick={() => {
                      userEditedWeekRef.current = true;
                      setRoadmapWeek(cand.week);
                    }}
                  >
                    Tuần {cand.week} ({cand.level} · {cand.matchedCount} mục)
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.makerSection}>
        <strong>Danh sách câu ({segments.length} câu) — kéo chỉnh mốc, sửa furigana và nghe thử</strong>
        {segments.length === 0 ? (
          <p className={styles.makerHint}>
            Chưa có câu nào. Nhập tệp .srt/.ass, dán văn bản rồi bấm “Chia câu tự động”, hoặc bấm “+ Thêm câu thủ công”.
          </p>
        ) : (
          <ol className={styles.makerSegList}>
            {segments.map((seg, idx) => {
              const prevEnd = idx > 0 ? segments[idx - 1].endMs : clipStartMs;
              const nextStart = idx < segments.length - 1 ? segments[idx + 1].startMs : clipEndMs;
              const trimmedFuri = seg.furigana?.trim() ?? '';
              const parsedFuri = trimmedFuri ? parseFuriganaNotationStrict(seg.ja.trim(), trimmedFuri) : null;
              return (
                <li key={seg.id} className={styles.makerSegRow} data-maker-segment={idx}>
                  <div className={styles.makerSegHead}>
                    <strong>
                      Câu {idx + 1} · {toSec(seg.startMs)}–{toSec(seg.endMs)}s ({toSec(seg.endMs - seg.startMs)}s)
                    </strong>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className="button"
                        onClick={() => playSegmentPreview(idx)}
                        disabled={kind === 'file' && !previewUrl}
                      >
                        {previewingIndex === idx ? 'Dừng nghe thử' : 'Nghe thử câu'}
                      </button>
                      <button
                        type="button"
                        className="button"
                        onClick={() => splitSegmentAtMidpoint(idx)}
                        disabled={seg.endMs - seg.startMs < MIN_SEGMENT_MS * 2}
                      >
                        Tách đôi
                      </button>
                      <button type="button" className="button" onClick={() => removeSegment(idx)}>
                        Xóa câu
                      </button>
                    </div>
                  </div>
                  <div className={styles.makerSegSliders}>
                    <label className={styles.makerField}>
                      <span>Bắt đầu câu {idx + 1} (s)</span>
                      <input
                        type="range"
                        min={prevEnd}
                        max={Math.max(prevEnd, seg.endMs - MIN_SEGMENT_MS)}
                        step={50}
                        value={seg.startMs}
                        onChange={(e) => updateSegmentBoundary(idx, 'startMs', Number(e.target.value))}
                      />
                      <input
                        type="number"
                        min={prevEnd / 1000}
                        max={Math.max(prevEnd, seg.endMs - MIN_SEGMENT_MS) / 1000}
                        step={0.1}
                        aria-label={`Mốc bắt đầu câu ${idx + 1}`}
                        value={toSec(seg.startMs)}
                        onChange={(e) =>
                          updateSegmentBoundary(idx, 'startMs', parseSecInput(e.target.value, seg.startMs))
                        }
                      />
                    </label>
                    <label className={styles.makerField}>
                      <span>Kết thúc câu {idx + 1} (s)</span>
                      <input
                        type="range"
                        min={Math.min(nextStart, seg.startMs + MIN_SEGMENT_MS)}
                        max={nextStart}
                        step={50}
                        value={seg.endMs}
                        onChange={(e) => updateSegmentBoundary(idx, 'endMs', Number(e.target.value))}
                      />
                      <input
                        type="number"
                        min={Math.min(nextStart, seg.startMs + MIN_SEGMENT_MS) / 1000}
                        max={nextStart / 1000}
                        step={0.1}
                        aria-label={`Mốc kết thúc câu ${idx + 1}`}
                        value={toSec(seg.endMs)}
                        onChange={(e) =>
                          updateSegmentBoundary(idx, 'endMs', parseSecInput(e.target.value, seg.endMs))
                        }
                      />
                    </label>
                  </div>
                  <div className={styles.makerSegText}>
                    <label className={styles.makerField}>
                      <span>Tiếng Nhật câu {idx + 1}</span>
                      <input
                        type="text"
                        lang="ja"
                        value={seg.ja}
                        maxLength={400}
                        onChange={(e) => updateSegmentField(idx, 'ja', e.target.value)}
                      />
                    </label>
                    <label className={styles.makerField}>
                      <span>Tiếng Việt (tùy chọn — chưa dịch máy)</span>
                      <input
                        type="text"
                        value={seg.vi ?? ''}
                        maxLength={400}
                        onChange={(e) => updateSegmentField(idx, 'vi', e.target.value)}
                      />
                    </label>
                  </div>
                  <label className={styles.makerField}>
                    <span>Furigana câu {idx + 1} (cú pháp {'{chữ|cách đọc}'})</span>
                    <input
                      type="text"
                      lang="ja"
                      aria-label={`Furigana câu ${idx + 1}`}
                      value={seg.furigana ?? ''}
                      maxLength={1200}
                      placeholder="Tự sinh offline hoặc nhập dạng {base|reading}"
                      onChange={(e) => updateSegmentField(idx, 'furigana', e.target.value)}
                    />
                  </label>
                  {trimmedFuri &&
                    (parsedFuri ? (
                      <p className={styles.makerRubyPreview} lang="ja" data-maker-ruby-preview={idx}>
                        {parsedFuri.map((part, pIdx) =>
                          part.reading ? (
                            <ruby key={pIdx}>
                              {part.text}
                              <rt>{part.reading}</rt>
                            </ruby>
                          ) : (
                            <Fragment key={pIdx}>{part.text}</Fragment>
                          ),
                        )}
                      </p>
                    ) : (
                      <p className={styles.makerWarn} role="alert">
                        Furigana chưa khớp chữ gốc câu {idx + 1}. Hãy giữ nguyên chữ gốc tiếng Nhật và dùng cú pháp {'{base|reading}'}.
                      </p>
                    ))}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className={styles.makerFooter}>
        <p className={styles.status} role="status">
          {status ?? (draftCheck.ok ? 'Sẵn sàng lưu clip vào kho Shadowing.' : draftCheck.message)}
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className="button primary"
            disabled={submitting || !draftCheck.ok || (kind === 'file' && !file)}
            onClick={() => void handleSave()}
          >
            {submitting ? 'Đang lưu…' : 'Lưu clip vào kho'}
          </button>
          <button type="button" className="button" onClick={onClose} disabled={submitting}>
            Hủy
          </button>
        </div>
      </div>
    </section>
  );
}

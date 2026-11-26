'use client';
import type { RefObject } from 'react';
import type { Clip, ClipSegment } from './clip-model.ts';
import {
  formatHistoryTime,
  pinnedAudioUrl,
  type PinnedBestTake,
} from './history-model.ts';
import {
  currentAlternatingStep,
  describeAlternatingStep,
  type AlternatingState,
} from './record-compare.ts';
import { VoiceMeter } from './voice-meter.tsx';
import { WaveformCompare } from './waveform-compare.tsx';
import styles from './shadowing.module.css';

export type Take = {
  url: string;
  blob: Blob;
  mimeType: string;
  segment: number;
  seconds: number;
  extension: string;
  peaks: number[] | null;
  waveLoading: boolean;
  waveError: string | null;
};

export type WholeTake = Omit<Take, 'segment'>;
export type RecordingMode = 'segment' | 'whole';

export function RecordingPanel({
  clip,
  selected,
  selectedSegment,
  recordNote,
  timeZone,
  supported,
  locked,
  recording,
  recordingMode,
  requesting,
  takesCount,
  take,
  wholeTake,
  currentPin,
  pinning,
  unpinning,
  altState,
  analyser,
  replayRef,
  wholeReplayRef,
  pinnedReplayRef,
  segmentOriginalPeaks,
  wholeOriginalPeaks,
  originalWaveLoading,
  originalUnavailableNote,
  onStartRecording,
  onStopRecording,
  onStartAlternating,
  onPauseAlternating,
  onResumeAlternating,
  onStopAlternating,
  onPinTake,
  onUnpinTake,
  onRemoveTake,
  onRemoveWholeTake,
  onAudioPlay,
  onAudioError,
}: {
  clip: Clip;
  selected: number;
  selectedSegment: ClipSegment | undefined;
  recordNote: string;
  timeZone: string;
  supported: boolean;
  locked: boolean;
  recording: boolean;
  recordingMode: RecordingMode | null;
  requesting: boolean;
  takesCount: number;
  take: Take | null;
  wholeTake: WholeTake | null;
  currentPin: PinnedBestTake | null;
  pinning: boolean;
  unpinning: boolean;
  altState: AlternatingState;
  analyser: AnalyserNode | null;
  replayRef: RefObject<HTMLAudioElement | null>;
  wholeReplayRef: RefObject<HTMLAudioElement | null>;
  pinnedReplayRef: RefObject<HTMLAudioElement | null>;
  segmentOriginalPeaks: readonly number[] | null;
  wholeOriginalPeaks: readonly number[] | null;
  originalWaveLoading: boolean;
  originalUnavailableNote: string | null;
  onStartRecording: (mode: RecordingMode) => void;
  onStopRecording: () => void;
  onStartAlternating: () => void;
  onPauseAlternating: () => void;
  onResumeAlternating: () => void;
  onStopAlternating: () => void;
  onPinTake: () => void;
  onUnpinTake: (segmentId: string, segmentIndex: number) => void;
  onRemoveTake: () => void;
  onRemoveWholeTake: () => void;
  onAudioPlay: (kind: 'segment' | 'whole' | 'pinned') => void;
  onAudioError: (message: string) => void;
}) {
  const altStep = currentAlternatingStep(altState);
  const altPlaying = altState.status === 'playing';
  const altPaused = altState.status === 'paused';
  const altActive = altPlaying || altPaused;
  const hasAlternatingSource = takesCount > 0 || Boolean(wholeTake);
  const safeId = clip.id.replace(/[^a-zA-Z0-9-]/g, '-');

  return (
    <section className={styles.card} aria-labelledby="record-title">
      <div className={styles.header}>
        <h2 id="record-title">Giọng của bạn</h2>
        <span>TRÊN THIẾT BỊ · GHIM LƯU RIÊNG</span>
      </div>
      <p>
        {recordNote}Đã ghi {takesCount}/{clip.segments.length} câu
        {wholeTake ? ' · Đã ghi cả clip' : ''}.
      </p>
      <div className={styles.actions}>
        {!recording ? (
          <>
            <button
              className="button primary"
              disabled={!supported || requesting}
              onClick={() => onStartRecording('segment')}
            >
              {requesting && recordingMode === 'segment' ? 'Đang xin quyền micro…' : `Ghi âm câu ${selected + 1}`}
            </button>
            <button
              type="button"
              className="button"
              disabled={!supported || requesting}
              onClick={() => onStartRecording('whole')}
            >
              {requesting && recordingMode === 'whole' ? 'Đang xin quyền micro…' : 'Ghi âm cả clip'}
            </button>
          </>
        ) : (
          <button className="button primary" onClick={onStopRecording}>
            Dừng ghi âm
          </button>
        )}
        {!altActive ? (
          <button
            type="button"
            className="button"
            disabled={locked || !hasAlternatingSource}
            onClick={onStartAlternating}
          >
            Phát xen kẽ
          </button>
        ) : altPlaying ? (
          <>
            <button type="button" className="button primary" onClick={onPauseAlternating}>
              Tạm dừng xen kẽ
            </button>
            <button type="button" className="button" onClick={onStopAlternating}>
              Dừng xen kẽ
            </button>
          </>
        ) : (
          <>
            <button type="button" className="button primary" onClick={onResumeAlternating}>
              Tiếp tục xen kẽ
            </button>
            <button type="button" className="button" onClick={onStopAlternating}>
              Dừng xen kẽ
            </button>
          </>
        )}
        {take && !recording && (
          <>
            <button
              type="button"
              className="button primary"
              disabled={pinning}
              aria-busy={pinning}
              onClick={onPinTake}
            >
              {pinning ? 'Đang ghim…' : currentPin ? 'Thay bản ghi tốt nhất' : 'Ghim bản ghi tốt nhất'}
            </button>
            <a
              className="button"
              href={take.url}
              download={`shadowing-${safeId}-cau-${take.segment + 1}.${take.extension}`}
            >
              Tải bản ghi
            </a>
            <button className="button" onClick={onRemoveTake}>
              Xóa bản ghi
            </button>
          </>
        )}
      </div>
      {altActive && altStep && (
        <p className={styles.altBanner} data-alternating-state={altState.status}>
          {describeAlternatingStep(altStep, altState.index, altState.steps.length)}
          {altPaused ? ' (Đang tạm dừng)' : ''}
        </p>
      )}
      {recording && <VoiceMeter analyser={analyser} />}
      <span className="record-state" aria-hidden="true">
        {recording ? '●' : ''}
      </span>
      {!supported && <p>Micro cần trình duyệt hỗ trợ MediaRecorder và kết nối HTTPS (hoặc localhost).</p>}
      {take && !recording && (
        <div className={styles.take}>
          <p>
            Câu {take.segment + 1} · {take.seconds.toFixed(1)} giây · bản ghi thử
          </p>
          <audio
            ref={replayRef}
            src={take.url}
            controls
            onPlay={() => onAudioPlay('segment')}
            onError={() => onAudioError('Trình duyệt không phát được định dạng bản ghi này. Thử tải xuống.')}
            aria-label="Nghe lại giọng của bạn"
          />
          {selectedSegment && (
            <WaveformCompare
              title={`Sóng âm xếp chồng · Câu ${take.segment + 1}`}
              originalPeaks={segmentOriginalPeaks}
              userPeaks={take.peaks}
              originalSeconds={selectedSegment.end - selectedSegment.start}
              userSeconds={take.seconds}
              loading={take.waveLoading || originalWaveLoading}
              error={take.waveError}
              originalUnavailableNote={originalUnavailableNote}
            />
          )}
        </div>
      )}
      {wholeTake && !recording && (
        <div className={styles.wholeTake} aria-label="Bản ghi cả clip">
          <div className={styles.pinnedHead}>
            <strong>Bản ghi cả clip</strong>
            <span>{wholeTake.seconds.toFixed(1)} giây · trên thiết bị</span>
          </div>
          <div className={styles.pinnedControls}>
            <audio
              ref={wholeReplayRef}
              src={wholeTake.url}
              controls
              onPlay={() => onAudioPlay('whole')}
              onError={() => onAudioError('Trình duyệt không phát được định dạng bản ghi cả clip. Thử tải xuống.')}
              aria-label="Nghe lại bản ghi cả clip"
            />
            <a
              className="button"
              href={wholeTake.url}
              download={`shadowing-${safeId}-ca-clip.${wholeTake.extension}`}
            >
              Tải file cả clip
            </a>
            <button type="button" className="button" onClick={onRemoveWholeTake}>
              Xóa ghi âm cả clip
            </button>
          </div>
          <WaveformCompare
            title="Sóng âm xếp chồng · Cả clip"
            originalPeaks={wholeOriginalPeaks}
            userPeaks={wholeTake.peaks}
            originalSeconds={clip.end - clip.start}
            userSeconds={wholeTake.seconds}
            loading={wholeTake.waveLoading || originalWaveLoading}
            error={wholeTake.waveError}
            originalUnavailableNote={originalUnavailableNote}
          />
        </div>
      )}
      {currentPin && selectedSegment && (
        <div className={styles.pinnedBox} aria-label="Bản ghi tốt nhất đã ghim">
          <div className={styles.pinnedHead}>
            <strong>Bản ghi tốt nhất · Câu {selected + 1}</strong>
            <span>
              {(currentPin.durationMs / 1000).toFixed(1)} giây · Ghim lúc{' '}
              {formatHistoryTime(currentPin.pinnedAt, timeZone)}
            </span>
          </div>
          <div className={styles.pinnedControls}>
            <audio
              key={currentPin.id}
              ref={pinnedReplayRef}
              src={pinnedAudioUrl(clip.id, selectedSegment.id, currentPin.id)}
              controls
              preload="none"
              onPlay={() => onAudioPlay('pinned')}
              aria-label="Nghe lại bản ghi đã ghim"
            />
            <button
              type="button"
              className="button"
              disabled={unpinning}
              aria-busy={unpinning}
              onClick={() => onUnpinTake(selectedSegment.id, selected)}
            >
              {unpinning ? 'Đang bỏ ghim…' : 'Bỏ ghim'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

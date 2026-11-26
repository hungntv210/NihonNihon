'use client';
import styles from './shadowing.module.css';
import {
  WAVEFORM_BARS,
  computeWaveformPeaks,
  formatDurationRatio,
  mixChannelsToMono,
  slicePcmRange,
} from './record-compare.ts';

export type DecodedMonoAudio = {
  sampleRate: number;
  duration: number;
  mono: Float32Array;
};

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as typeof window & { webkitAudioContext?: AudioContextCtor };
  return window.AudioContext ?? w.webkitAudioContext ?? null;
}

export async function decodeArrayBufferToMono(buffer: ArrayBuffer): Promise<DecodedMonoAudio> {
  const Ctor = getAudioContextCtor();
  if (!Ctor) throw new Error('WEB_AUDIO_UNAVAILABLE');
  const ctx = new Ctor();
  try {
    const decoded = await ctx.decodeAudioData(buffer.slice(0));
    const channels: Float32Array[] = [];
    for (let c = 0; c < decoded.numberOfChannels; c++) {
      channels.push(decoded.getChannelData(c));
    }
    return {
      sampleRate: decoded.sampleRate,
      duration: decoded.duration,
      mono: mixChannelsToMono(channels),
    };
  } finally {
    void ctx.close().catch(() => {});
  }
}

export async function decodeBlobPeaks(blob: Blob, buckets = WAVEFORM_BARS): Promise<number[]> {
  const decoded = await decodeArrayBufferToMono(await blob.arrayBuffer());
  return computeWaveformPeaks(decoded.mono, buckets, { normalize: true });
}

export function extractWindowPeaks(
  decoded: DecodedMonoAudio,
  startSeconds: number,
  endSeconds: number,
  buckets = WAVEFORM_BARS,
): number[] {
  const { startSample, endSample } = slicePcmRange(
    decoded.mono.length,
    decoded.sampleRate,
    startSeconds,
    endSeconds,
  );
  return computeWaveformPeaks(decoded.mono, buckets, {
    startSample,
    endSample,
    normalize: true,
  });
}

const SVG_WIDTH = 320;
const SVG_HEIGHT = 96;
const MID_Y = SVG_HEIGHT / 2;
const MAX_HALF_HEIGHT = 40;

export function WaveformCompare({
  title,
  originalPeaks,
  userPeaks,
  originalSeconds,
  userSeconds,
  loading = false,
  error = null,
  originalUnavailableNote = null,
}: {
  title: string;
  originalPeaks: readonly number[] | null;
  userPeaks: readonly number[] | null;
  originalSeconds: number;
  userSeconds: number;
  loading?: boolean;
  error?: string | null;
  originalUnavailableNote?: string | null;
}) {
  const count = Math.max(originalPeaks?.length ?? 0, userPeaks?.length ?? 0, WAVEFORM_BARS);
  const step = SVG_WIDTH / count;
  const origWidth = Math.max(1.8, step * 0.72);
  const userWidth = Math.max(1.2, step * 0.44);
  const ratio = formatDurationRatio(userSeconds, originalSeconds);

  return (
    <div className={styles.waveBox} data-waveform-compare="">
      <div className={styles.waveHead}>
        <strong>{title}</strong>
        {ratio !== null && <span>Độ dài {ratio}% so với gốc</span>}
      </div>
      <div className={styles.waveLegend} aria-hidden="true">
        {originalPeaks && (
          <span className={styles.waveLegendItem}>
            <i className={styles.waveSwatchOrig} />
            Bản gốc ({originalSeconds.toFixed(1)}s)
          </span>
        )}
        <span className={styles.waveLegendItem}>
          <i className={styles.waveSwatchUser} />
          Giọng của bạn ({userSeconds.toFixed(1)}s)
        </span>
      </div>
      {error ? (
        <p className={styles.waveNote}>{error}</p>
      ) : loading && !userPeaks ? (
        <p className={styles.waveNote}>Đang tính sóng âm ngoại tuyến…</p>
      ) : (
        <svg
          className={styles.waveSvg}
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={title}
        >
          <line x1={0} y1={MID_Y} x2={SVG_WIDTH} y2={MID_Y} className={styles.waveAxis} />
          {originalPeaks &&
            originalPeaks.map((peak, i) => {
              const half = Math.max(1.5, Math.min(1, peak) * MAX_HALF_HEIGHT);
              const x = i * step + (step - origWidth) / 2;
              return (
                <rect
                  key={`o-${i}`}
                  data-wave="original"
                  className={styles.waveOrigBar}
                  x={x}
                  y={MID_Y - half}
                  width={origWidth}
                  height={half * 2}
                  rx={1}
                />
              );
            })}
          {userPeaks &&
            userPeaks.map((peak, i) => {
              const half = Math.max(1.5, Math.min(1, peak) * MAX_HALF_HEIGHT);
              const x = i * step + (step - userWidth) / 2;
              return (
                <rect
                  key={`u-${i}`}
                  data-wave="user"
                  className={styles.waveUserBar}
                  x={x}
                  y={MID_Y - half}
                  width={userWidth}
                  height={half * 2}
                  rx={1}
                />
              );
            })}
        </svg>
      )}
      {originalUnavailableNote && <p className={styles.waveNote}>{originalUnavailableNote}</p>}
    </div>
  );
}

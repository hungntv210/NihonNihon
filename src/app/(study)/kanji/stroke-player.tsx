'use client';
import { useEffect, useState } from 'react';
import styles from './kanji.module.css';
export function StrokePlayer({
  character,
  paths,
}: {
  character: string;
  paths: { number: number; path: string }[];
}) {
  const [visible, setVisible] = useState(paths.length),
    [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(paths.length);
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => {
      if (visible + 1 >= paths.length) {
        setVisible(paths.length);
        setPlaying(false);
      } else setVisible(visible + 1);
    }, 500);
    return () => clearTimeout(timer);
  }, [playing, visible, paths.length]);
  if (!paths.length)
    return (
      <p className={styles.strokeEmpty}>
        Chưa có dữ liệu nét viết cho chữ này. Số nét và âm đọc vẫn có thể xem ở bên cạnh.
      </p>
    );
  return (
    <>
      <svg
        className={styles.strokeBoard}
        viewBox="0 0 109 109"
        role="img"
        aria-label={`Nét viết chữ ${character}: ${visible} trên ${paths.length} nét`}
      >
        <path d="M54.5 0v109M0 54.5h109M0 0l109 109M109 0 0 109" className={styles.strokeGrid} />
        {paths.map((stroke) => (
          <path key={'outline' + stroke.number} d={stroke.path} className={styles.strokeOutline} />
        ))}
        {paths.map((stroke, index) =>
          index < visible || (index === visible && playing) ? (
            <path
              key={stroke.number + ':' + (index === visible && playing ? 'drawing' : 'done')}
              d={stroke.path}
              pathLength={1}
              className={`${styles.stroke} ${index === visible && playing ? styles.drawing : ''}`}
            />
          ) : null,
        )}
      </svg>
      <div className={styles.strokeControls}>
        <button
          type="button"
          onClick={() => {
            setVisible(0);
            setPlaying(true);
          }}
          disabled={playing}
        >
          Phát lại
        </button>
        <button
          type="button"
          onClick={() => setVisible((v) => Math.min(paths.length, v + 1))}
          disabled={playing || visible >= paths.length}
        >
          Từng nét
        </button>
        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            setVisible(0);
          }}
        >
          Về đầu
        </button>
        {playing && (
          <button type="button" onClick={() => setPlaying(false)}>
            Dừng
          </button>
        )}
      </div>
      <p className={styles.strokeProgress} aria-live="polite">
        {visible}/{paths.length} nét
      </p>
    </>
  );
}

'use client';
import { useEffect, useRef, useState } from 'react';
import { demo, segmentAt, shouldRepeat } from './demo.ts';
import styles from './shadowing.module.css';

type Take = { url: string; segment: number; seconds: number; extension: string };
export function ShadowingPlayer() {
  const video = useRef<HTMLVideoElement>(null);
  const replay = useRef<HTMLAudioElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const disposed = useRef(false);
  const takeUrl = useRef('');
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const session = useRef({ selected: 0, limit: 1, count: 0, active: false });
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [speed, setSpeed] = useState(0.75);
  const [limit, setLimit] = useState(1);
  const [count, setCount] = useState(0);
  const [subtitles, setSubtitles] = useState('both');
  const [status, setStatus] = useState('Chọn một câu rồi nghe thử. Clip chỉ có hình và tiếng bíp, không có giọng đọc Nhật.');
  const [recording, setRecording] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [take, setTake] = useState<Take | null>(null);
  const [supported, setSupported] = useState(false);
  const pending = useRef(false);

  useEffect(() => {
    disposed.current = false;
    setSupported(window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined');
    return () => {
      disposed.current = true;
      if (timeout.current) clearTimeout(timeout.current);
      const current = recorder.current;
      if (current && current.state !== 'inactive') current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
      if (takeUrl.current) URL.revokeObjectURL(takeUrl.current);
    };
  }, []);

  function stopPlayback() {
    session.current.active = false;
    video.current?.pause();
    replay.current?.pause();
  }
  function choose(index: number) {
    stopPlayback();
    session.current = { selected: index, limit, count: 0, active: false };
    setSelected(index); setCount(0);
    if (video.current) video.current.currentTime = demo.segments[index].start;
    setTime(demo.segments[index].start);
  }
  async function play(whole = false) {
    const media = video.current;
    if (!media) return;
    replay.current?.pause();
    session.current = { selected, limit: whole ? 1 : limit, count: 0, active: !whole };
    setCount(0);
    media.currentTime = whole ? 0 : demo.segments[selected].start;
    media.playbackRate = speed;
    media.preservesPitch = true;
    try { await media.play(); setStatus(whole ? 'Đang phát toàn clip thử.' : 'Đang phát đoạn đã chọn.'); }
    catch { setStatus('Chưa phát được clip. Thử bấm phát lại hoặc tải lại trang.'); }
  }
  function updateTime() {
    const media = video.current;
    if (!media) return;
    setTime(media.currentTime);
    const loop = session.current;
    if (!loop.active || media.currentTime < demo.segments[loop.selected].end - 0.04) return;
    loop.count += 1; setCount(loop.count);
    if (shouldRepeat(loop.count, loop.limit)) {
      media.currentTime = demo.segments[loop.selected].start;
      if (media.paused) void media.play().catch(() => { loop.active = false; setStatus('Không thể phát tiếp. Bấm nghe lại đoạn.'); });
    } else {
      loop.active = false; media.pause();
      setStatus('Đã nghe xong đoạn. Bạn có thể ghi âm nói thử.');
    }
  }
  function stopRecording() {
    if (timeout.current) clearTimeout(timeout.current);
    const current = recorder.current;
    if (current && current.state !== 'inactive') current.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
  }
  async function startRecording() {
    if (pending.current || recorder.current?.state === 'recording') return;
    pending.current = true; setRequesting(true); stopPlayback();
    let acquired: MediaStream | null = null;
    try {
      acquired = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (disposed.current) { acquired.getTracks().forEach((track) => track.stop()); return; }
      stream.current = acquired;
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((type) => MediaRecorder.isTypeSupported(type));
      const current = new MediaRecorder(acquired, mimeType ? { mimeType } : undefined);
      recorder.current = current;
      const chunks: Blob[] = [], began = performance.now(), sentence = selected;
      current.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      current.onerror = () => { stopRecording(); if (!disposed.current) setStatus('Ghi âm bị gián đoạn. Thử cấp lại quyền micro.'); };
      current.onstop = () => {
        acquired?.getTracks().forEach((track) => track.stop());
        if (timeout.current) clearTimeout(timeout.current);
        if (disposed.current) return;
        setRecording(false);
        const blob = new Blob(chunks, { type: current.mimeType });
        if (!blob.size) { setStatus('Bản ghi trống. Kiểm tra micro rồi thử lại.'); return; }
        if (takeUrl.current) URL.revokeObjectURL(takeUrl.current);
        takeUrl.current = URL.createObjectURL(blob);
        setTake({ url: takeUrl.current, segment: sentence, seconds: (performance.now() - began) / 1000, extension: current.mimeType.includes('mp4') ? 'm4a' : 'webm' });
        setStatus('Đã ghi âm trên thiết bị. Nghe lại hoặc tải xuống trước khi rời trang.');
      };
      current.start(); setRecording(true);
      setStatus('Đang ghi micro · tự dừng sau 60 giây.');
      timeout.current = setTimeout(stopRecording, 60_000);
    } catch (error) {
      acquired?.getTracks().forEach((track) => track.stop());
      if (!disposed.current) setStatus(error instanceof DOMException && error.name === 'NotAllowedError' ? 'Chưa có quyền micro. Cho phép micro trong cài đặt trình duyệt rồi thử lại.' : 'Không mở được micro. Kiểm tra thiết bị và dùng HTTPS hoặc localhost.');
    } finally { pending.current = false; if (!disposed.current) setRequesting(false); }
  }
  function removeTake() {
    replay.current?.pause();
    if (takeUrl.current) URL.revokeObjectURL(takeUrl.current);
    takeUrl.current = ''; setTake(null); setStatus('Đã xóa bản ghi trên trang này.');
  }
  const active = segmentAt(time);
  return <div className={styles.root}>
    <aside className={styles.notice}><strong>Bản thử tương tác · không phải tư liệu luyện nói</strong><p>Video tổng hợp 9 giây với tiếng bíp. Câu Nhật / Việt tự soạn chỉ để thử phụ đề; không khớp lời nói. Không tính buổi học hoặc tiến độ.</p></aside>
    <div className={styles.columns}>
      <section className={styles.card} aria-label="Trình phát clip thử">
        <div className={styles.header}><h2>{demo.title}</h2><span>DEMO · 00:09</span></div>
        <video ref={video} className={styles.video} src="/shadowing/media" playsInline preload="auto" onTimeUpdate={updateTime} onEnded={updateTime} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setStatus('Không tải được clip thử. Kiểm tra kết nối rồi tải lại trang.')} aria-label="Video tổng hợp chỉ có tiếng bíp" />
        <div className={styles.captions} aria-label="Phụ đề mẫu">
          {(subtitles === 'both' || subtitles === 'ja') && <p lang="ja">{demo.segments[active >= 0 ? active : selected].ja}</p>}
          {(subtitles === 'both' || subtitles === 'vi') && <p lang="vi">{demo.segments[active >= 0 ? active : selected].vi}</p>}
          {subtitles === 'off' && <p>Đã ẩn phụ đề</p>}
        </div>
        <p className={styles.progress}>{time.toFixed(1)} / 9.0 giây · Câu {selected + 1} · Đã phát {count} lượt</p>
        <div className={styles.actions}>
          <button className="button primary" onClick={() => void play()} disabled={recording || requesting}>Nghe lại đoạn</button>
          <button className="button" onClick={() => void play(true)} disabled={recording || requesting}>Phát cả clip</button>
          <button className="button" onClick={stopPlayback} disabled={!playing}>Tạm dừng</button>
        </div>
        <div className={styles.options}>
          <label>Tốc độ<select aria-label="Tốc độ" value={speed} onChange={(event) => { const value = Number(event.target.value); setSpeed(value); if (video.current) video.current.playbackRate = value; }}>{[0.5, 0.75, 1, 1.25].map((value) => <option key={value} value={value}>{value}×</option>)}</select></label>
          <label>Lặp đoạn<select aria-label="Lặp đoạn" value={limit} onChange={(event) => { const value = Number(event.target.value); setLimit(value); session.current.limit = value; }}>{[1, 3, 5, 0].map((value) => <option key={value} value={value}>{value || '∞'} lần</option>)}</select></label>
          <label>Phụ đề<select aria-label="Phụ đề" value={subtitles} onChange={(event) => setSubtitles(event.target.value)}><option value="both">Nhật + Việt</option><option value="ja">Tiếng Nhật</option><option value="vi">Tiếng Việt</option><option value="off">Ẩn</option></select></label>
        </div>
      </section>
      <section className={styles.card} aria-labelledby="segments-title"><h2 id="segments-title">Chọn câu</h2><p className={styles.muted}>Mốc thời gian chỉ phục vụ kiểm thử.</p><ol className={styles.segments}>{demo.segments.map((sentence, index) => <li key={sentence.start}><button aria-pressed={selected === index} disabled={recording || requesting} onClick={() => choose(index)}><span className={styles.segmentTop}>Câu {index + 1}<span>{sentence.start.toFixed(1)}–{sentence.end.toFixed(1)}s</span></span><span lang="ja">{sentence.ja}</span><span>{sentence.vi}</span>{playing && active === index && <small>Đang phát</small>}</button></li>)}</ol></section>
    </div>
    <section className={styles.card} aria-labelledby="record-title"><div className={styles.header}><h2 id="record-title">Giọng của bạn</h2><span>CHỈ TRÊN THIẾT BỊ</span></div><p>Bản ghi mới thay bản cũ. Không tải lên máy chủ; tải xuống để giữ lại. Rời trang sẽ mất bản ghi.</p><div className={styles.actions}>
      {!recording ? <button className="button primary" disabled={!supported || requesting} onClick={() => void startRecording()}>{requesting ? 'Đang xin quyền micro…' : `Ghi âm câu ${selected + 1}`}</button> : <button className="button primary" onClick={stopRecording}>Dừng ghi âm</button>}
      {take && !recording && <><a className="button" href={take.url} download={`shadowing-demo-cau-${take.segment + 1}.${take.extension}`}>Tải bản ghi</a><button className="button" onClick={removeTake}>Xóa bản ghi</button></>}
    </div>{!supported && <p>Micro cần trình duyệt hỗ trợ MediaRecorder và kết nối HTTPS (hoặc localhost).</p>}
    {take && !recording && <div className={styles.take}><p>Câu {take.segment + 1} · {take.seconds.toFixed(1)} giây · bản ghi thử</p><audio ref={replay} src={take.url} controls onPlay={() => video.current?.pause()} onError={() => setStatus('Trình duyệt không phát được định dạng bản ghi này. Thử tải xuống.')} aria-label="Nghe lại giọng của bạn" /></div>}
    </section><p role="status" className={styles.status}>{status}</p>
  </div>;
}

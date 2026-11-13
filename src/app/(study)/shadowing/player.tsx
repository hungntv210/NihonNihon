'use client';
import { useEffect, useRef, useState } from 'react';
import { segmentAtIn } from './demo.ts';
import {syntheticClip,updatePlayback,SEEK_TOLERANCE,type Clip} from './clip-model.ts';
import styles from './shadowing.module.css';

type Take = { url: string; segment: number; seconds: number; extension: string };
export function ShadowingPlayer({clip=syntheticClip}:{clip?:Clip}) {
  const video = useRef<HTMLVideoElement>(null);
  const replay = useRef<HTMLAudioElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const disposed = useRef(false);
  const takeUrls = useRef(new Map<number,string>());
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const session = useRef({ selected: 0, limit: 1, count: 0, active: false,whole:false,entered:false });
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(clip.start);
  const [speed, setSpeed] = useState(0.75);
  const [limit, setLimit] = useState(1);
  const [count, setCount] = useState(0);
  const [subtitles, setSubtitles] = useState(clip.isDemo?'both':'kana');
  const [status, setStatus] = useState(clip.isDemo?'Chọn một câu rồi nghe thử. Clip chỉ có hình và tiếng bíp, không có giọng đọc Nhật.':'Chọn câu để nghe, lặp lại và ghi âm.');
  const [recording, setRecording] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [takes, setTakes] = useState<Record<number,Take>>({});
  const take=takes[selected]??null;
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
      for(const url of takeUrls.current.values())URL.revokeObjectURL(url);
    };
  }, []);

  function stopPlayback() {
    session.current.active = false;session.current.whole=false;
    video.current?.pause();
    replay.current?.pause();
  }
  function choose(index: number) {
    stopPlayback();
    session.current = { selected: index, limit, count: 0, active: false,whole:false,entered:false };
    setSelected(index); setCount(0);
    if (video.current) video.current.currentTime = clip.segments[index].start;
    setTime(clip.segments[index].start);
  }
  async function play(whole = false) {
    const media = video.current;
    if (!media) return;
    replay.current?.pause();
    session.current = { selected, limit: whole ? 1 : limit, count: 0, active: !whole,whole,entered:false };
    setCount(0);
    media.currentTime = whole ? clip.start : clip.segments[selected].start;
    media.playbackRate = speed;
    media.preservesPitch = true;
    try { await media.play(); setStatus(whole ? 'Đang phát toàn clip.' : 'Đang phát đoạn đã chọn.'); }
    catch { setStatus('Chưa phát được clip. Thử bấm phát lại hoặc tải lại trang.'); }
  }
  function updateTime() {
    const media=video.current;if(!media)return;
    const loop=session.current,result=updatePlayback(media,clip,loop);if(!result)return;
    setTime(result.time);setCount(loop.count);
    if(result.finished)setStatus('Đã nghe xong đoạn. Bạn có thể ghi âm nói thử.');
    if(result.repeat)void media.play().catch(()=>{loop.active=false;setStatus('Không thể phát tiếp. Bấm nghe lại đoạn.');});
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
        const previous=takeUrls.current.get(sentence);if(previous)URL.revokeObjectURL(previous);
        const url=URL.createObjectURL(blob);takeUrls.current.set(sentence,url);
        setTakes(values=>({...values,[sentence]:{url,segment:sentence,seconds:(performance.now()-began)/1000,extension:current.mimeType.includes('mp4')?'m4a':'webm'}}));
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
    const url=takeUrls.current.get(selected);if(url)URL.revokeObjectURL(url);takeUrls.current.delete(selected);
    setTakes(values=>{const next={...values};delete next[selected];return next;});setStatus('Đã xóa bản ghi của câu này.');
  }
  const active = segmentAtIn(time,clip.segments),caption=clip.segments[active>=0?active:selected],clipStart=clip.start,clipEnd=clip.end;
  return <div className={styles.root}>
    <aside className={styles.notice}>{clip.isDemo?<><strong>Bản thử tương tác · không phải tư liệu luyện nói</strong><p>Video tổng hợp 9 giây với tiếng bíp. Câu Nhật / Việt tự soạn chỉ để thử phụ đề; không khớp lời nói. Không tính buổi học hoặc tiến độ.</p></>:<><strong>Tư liệu riêng · {clip.level} · {clip.topic}</strong><p>{clip.attribution}</p><p>Phụ đề từ script chính thức; mốc thời gian chờ tester duyệt. Không gửi video hoặc bản ghi lên dịch vụ AI.</p></>}</aside>
    <div className={styles.columns}>
      <section className={styles.card} aria-label={clip.isDemo?'Trình phát clip thử':'Trình phát clip riêng'}>
        <div className={styles.header}><h2>{clip.title}</h2><span>{clip.isDemo?'DEMO':clip.level} · {(clipEnd-clipStart).toFixed(1)} giây</span></div>
        <video ref={video} className={styles.video} src={clip.mediaUrl} playsInline preload="auto" onLoadedMetadata={()=>{const media=video.current;if(media&&!media.seeking&&(media.currentTime<clipStart-SEEK_TOLERANCE||media.currentTime>clipEnd+SEEK_TOLERANCE))media.currentTime=clipStart;}} onSeeking={updateTime} onSeeked={updateTime} onTimeUpdate={updateTime} onEnded={updateTime} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setStatus('Không tải được clip. Kiểm tra tệp trên máy chủ rồi tải lại trang.')} aria-label={clip.isDemo?'Video tổng hợp chỉ có tiếng bíp':clip.title} />
        <div className={styles.captions} aria-label="Phụ đề mẫu">
          {caption.speaker&&subtitles!=='off'&&<small lang="ja">{caption.speaker}</small>}
          {(subtitles === 'both' || subtitles === 'ja') && <p lang="ja">{caption.ja}</p>}
          {subtitles==='kana'&&<p lang={caption.kana?'ja':'vi'}>{caption.kana??'Chưa có phụ đề kana.'}</p>}
          {(subtitles === 'both' || subtitles === 'vi') && <p lang="vi">{caption.vi??'Chưa có bản dịch Việt.'}</p>}
          {subtitles === 'off' && <p>Đã ẩn phụ đề</p>}
        </div>
        <p className={styles.progress}>{Math.max(0,time-clipStart).toFixed(1)} / {(clipEnd-clipStart).toFixed(1)} giây · Câu {selected + 1} · Đã phát {count} lượt</p>
        <div className={styles.actions}>
          <button className="button primary" onClick={() => void play()} disabled={recording || requesting}>Nghe lại đoạn</button>
          <button className="button" onClick={() => void play(true)} disabled={recording || requesting}>Phát cả clip</button>
          <button className="button" onClick={stopPlayback} disabled={!playing}>Tạm dừng</button>
        </div>
        <div className={styles.options}>
          <label>Tốc độ<select aria-label="Tốc độ" value={speed} onChange={(event) => { const value = Number(event.target.value); setSpeed(value); if (video.current) video.current.playbackRate = value; }}>{[0.5, 0.75, 1, 1.25].map((value) => <option key={value} value={value}>{value}×</option>)}</select></label>
          <label>Lặp đoạn<select aria-label="Lặp đoạn" value={limit} onChange={(event) => { const value = Number(event.target.value); setLimit(value); session.current.limit = value; }}>{[1, 3, 5, 0].map((value) => <option key={value} value={value}>{value || '∞'} lần</option>)}</select></label>
          <label>Phụ đề<select aria-label="Phụ đề" value={subtitles} onChange={(event) => setSubtitles(event.target.value)}><option value="both">Nhật + Việt</option><option value="ja">Tiếng Nhật</option><option value="kana">Kana</option><option value="vi">Tiếng Việt</option><option value="off">Ẩn</option></select></label>
        </div>
      </section>
      <section className={styles.card} aria-labelledby="segments-title"><h2 id="segments-title">Chọn câu</h2><p className={styles.muted}>{clip.isDemo?'Mốc thời gian chỉ phục vụ kiểm thử.':'Mỗi câu giữ nguyên script; chạm để nghe lại và ghi âm.'}</p><ol className={styles.segments}>{clip.segments.map((sentence, index) => <li key={sentence.id}><button aria-pressed={selected === index} aria-current={playing&&active===index?'true':undefined} data-active={playing&&active===index} disabled={recording || requesting} onClick={() => choose(index)}><span className={styles.segmentTop}>Câu {index + 1}<span>{sentence.start.toFixed(1)}–{sentence.end.toFixed(1)}s</span></span>{sentence.speaker&&<small lang="ja">{sentence.speaker}</small>}<span lang="ja">{sentence.ja}</span><span>{sentence.vi}</span>{takes[index]&&<small>Đã ghi âm</small>}{playing && active === index && <small>Đang phát</small>}</button></li>)}</ol></section>
    </div>
    <section className={styles.card} aria-labelledby="record-title"><div className={styles.header}><h2 id="record-title">Giọng của bạn</h2><span>CHỈ TRÊN THIẾT BỊ</span></div><p>Bản ghi mới thay bản cũ của cùng câu. Không tải lên máy chủ; tải xuống để giữ lại. Đổi clip hoặc rời trang sẽ mất bản ghi. Đã ghi {Object.keys(takes).length}/{clip.segments.length} câu.</p><div className={styles.actions}>
      {!recording ? <button className="button primary" disabled={!supported || requesting} onClick={() => void startRecording()}>{requesting ? 'Đang xin quyền micro…' : `Ghi âm câu ${selected + 1}`}</button> : <button className="button primary" onClick={stopRecording}>Dừng ghi âm</button>}
      {take && !recording && <><a className="button" href={take.url} download={`shadowing-${clip.id.replace(/[^a-zA-Z0-9-]/g,'-')}-cau-${take.segment + 1}.${take.extension}`}>Tải bản ghi</a><button className="button" onClick={removeTake}>Xóa bản ghi</button></>}
    </div>{!supported && <p>Micro cần trình duyệt hỗ trợ MediaRecorder và kết nối HTTPS (hoặc localhost).</p>}
    {take && !recording && <div className={styles.take}><p>Câu {take.segment + 1} · {take.seconds.toFixed(1)} giây · bản ghi thử</p><audio ref={replay} src={take.url} controls onPlay={() => video.current?.pause()} onError={() => setStatus('Trình duyệt không phát được định dạng bản ghi này. Thử tải xuống.')} aria-label="Nghe lại giọng của bạn" /></div>}
    </section><p role="status" className={styles.status}>{status}</p>
  </div>;
}

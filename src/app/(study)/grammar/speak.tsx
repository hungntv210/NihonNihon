'use client';
import { useEffect, useState } from 'react';
import styles from './grammar.module.css';
export function Speak({ text }: { text: string }) {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null), [available,setAvailable]=useState(false), [message,setMessage]=useState('');
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    function refresh() { setAvailable(true);setVoice(window.speechSynthesis.getVoices().find(v => /^ja(?:-|$)/i.test(v.lang)) ?? null); }
    refresh();window.speechSynthesis.addEventListener('voiceschanged',refresh);return () => {window.speechSynthesis.removeEventListener('voiceschanged',refresh);window.speechSynthesis.cancel();};
  },[]);
  function speak() { if (!voice) return;const utterance=new SpeechSynthesisUtterance(text);utterance.lang='ja-JP';utterance.voice=voice;utterance.rate=.85;utterance.onerror=()=>setMessage('Chưa phát được giọng đọc. Bạn thử lại nhé.');window.speechSynthesis.cancel();window.speechSynthesis.speak(utterance); }
  return <div><button className="button button-small" type="button" disabled={!voice} onClick={speak} aria-label="Nghe câu tiếng Nhật">Nghe câu ↗</button><p className={styles.help} role="status">{message || (!voice ? available ? 'Trình duyệt chưa có giọng tiếng Nhật.' : 'Giọng đọc chưa sẵn sàng trên trình duyệt này.' : 'Giọng đọc của trình duyệt; không tự phát.')}</p></div>;
}

'use client';
import { useEffect, useState } from 'react';
export function Speak({ text, label = 'Nghe phát âm' }: { text: string; label?: string }) {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null),
    [speaking, setSpeaking] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis,
      update = () => setVoice(synth.getVoices().find((v) => /^ja(?:-|$)/i.test(v.lang)) ?? null);
    update();
    synth.addEventListener('voiceschanged', update);
    return () => {
      synth.removeEventListener('voiceschanged', update);
      synth.cancel();
    };
  }, []);
  function speak() {
    if (!voice) return;
    setError('');
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = 'ja-JP';
    utterance.rate = 0.85;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => {
      setSpeaking(false);
      setError('Chưa phát được giọng đọc. Bạn thử lại nhé.');
    };
    synth.speak(utterance);
  }
  return (
    <div>
      <button
        type="button"
        className="button button-small"
        disabled={!voice}
        onClick={speak}
        aria-pressed={speaking}
      >
        {speaking ? 'Dừng đọc' : label}
      </button>
      <small role="status" style={{ display: 'block', marginTop: 6, color: 'var(--color-muted)' }}>
        {error ||
          (!voice
            ? 'Trình duyệt chưa có giọng Nhật.'
            : 'Giọng đọc của trình duyệt · chỉ phát khi bạn chọn.')}
      </small>
    </div>
  );
}

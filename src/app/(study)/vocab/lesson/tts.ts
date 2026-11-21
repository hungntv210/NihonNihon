export function findJapaneseVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  return window.speechSynthesis.getVoices().find((v) => /^ja(?:-|$)/i.test(v.lang)) ?? null;
}

export function stopJapaneseSpeech() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function speakJapanese(
  text: string,
  voice: SpeechSynthesisVoice,
  handlers: { onStart?: () => void; onEnd?: () => void; onError?: () => void },
) {
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = 'ja-JP';
  utterance.rate = 0.85;
  utterance.onstart = () => handlers.onStart?.();
  utterance.onend = () => handlers.onEnd?.();
  utterance.onerror = () => handlers.onError?.();
  synth.speak(utterance);
}

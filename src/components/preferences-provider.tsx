'use client';
import { useEffect } from 'react';
import type { StudyPreferences } from '../core/preferences.ts';
export function PreferencesProvider({initial}:{initial:StudyPreferences}) {
 useEffect(()=>{
  const apply=(p:StudyPreferences)=>{ document.documentElement.dataset.theme=p.theme;document.documentElement.dataset.motion=p.motion?'on':'off';document.documentElement.dataset.furigana=String(p.furigana);localStorage.setItem('nihon-preferences',JSON.stringify(p));window.dispatchEvent(new Event('nihon-motion')); };
  apply(initial);const changed=(e:Event)=>apply((e as CustomEvent<StudyPreferences>).detail);window.addEventListener('nihon-preferences',changed);
  // Existing route TTS calls inherit the preferred voice when they do not set one.
  const synth=window.speechSynthesis, speak=synth?.speak.bind(synth);
  if(speak) synth.speak=(u)=>{const p=JSON.parse(localStorage.getItem('nihon-preferences')||'{}');if(!u.voice&&p.ttsVoice)u.voice=synth.getVoices().find(v=>v.voiceURI===p.ttsVoice)||null;speak(u);};
  return ()=>{window.removeEventListener('nihon-preferences',changed);if(speak)synth.speak=speak;};
 },[initial]);return null;
}

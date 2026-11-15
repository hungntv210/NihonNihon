import { vietnamClock } from '../../core/day-period.ts';
import { renderTown } from './art.ts';
import { TownEffects } from './town-effects.tsx';
export function TownScene({ level }: { level?: string }) {
  const clock = vietnamClock();
  const label = {morning:'あさ',day:'ひる',sunset:'ゆうがた',night:'よる'}[clock.period];
  return <section className="town-scene" aria-label="Cảnh thị trấn theo giờ Việt Nam">
    <div className="town-caption" lang="ja"><span>まち{level ? ` · ${level}` : ''}</span><span>{clock.time} · {label}</span></div>
    <TownEffects period={clock.period}><div className="town-art" dangerouslySetInnerHTML={{__html:renderTown(clock.period)}} /></TownEffects>
    <div className="town-greeting"><p lang="ja">今日も少しずつ。</p><p>Mỗi ngày tiến thêm một chút.</p></div>
  </section>;
}

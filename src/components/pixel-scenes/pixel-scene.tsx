import {sceneClock,type SceneId} from './model.ts';
import {PixelCanvas} from './pixel-canvas.tsx';
import styles from './scene.module.css';
const titles={'vocab-market':'Phố chợ · Từ vựng','grammar-kinkakuji':'Kinkaku-ji · Ngữ pháp','jlpt-study':'Góc học · JLPT','roadmap-journey':'Xuyên Nhật · Lộ trình','home-tokyo':'Tokyo · Mỗi ngày một chút','review-koi':'Ao koi · Ôn tập','kanji-himeji':'Himeji · Từng nét chữ','shadowing-inari':'Inari · Theo nhịp của bạn'};
export function PixelScene({id,params={}}:{id:SceneId;params?:Record<string,number>}){
 const clock=sceneClock();return <section className={styles.scene} aria-label={titles[id]} data-pixel-scene={id} data-scene-time={clock.period} data-scene-season={clock.season} data-scene-date={clock.date}>
 <div className={styles.caption}><span>{titles[id]}</span><time dateTime={clock.now}>{clock.time} · giờ Việt Nam</time></div>
 <PixelCanvas id={id} clock={clock} params={params}/>
 </section>;
}

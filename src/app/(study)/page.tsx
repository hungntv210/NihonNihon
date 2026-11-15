import Link from 'next/link';
import {getContent,getContentSummary} from '../../server/dal.ts';
import {ContentCard} from '../../components/content-card.tsx';
import {JaText,ViText} from '../../components/text.tsx';
import {PixelScene} from '../../components/pixel-scenes/pixel-scene.tsx';
import {RouteHeading} from '../../components/route-heading.tsx';
import {Mascot} from '../../components/mascot.tsx';
import {getToday} from './today-roadmap/server.ts';
import {todayPlan,allocateRoadmap,plusDays} from './today-roadmap/model.ts';
export default async function TodayPage(){
 const [summary,words,today]=await Promise.all([getContentSummary(),getContent('vocab',3),getToday()]);
 const plan=todayPlan(today.progress,today.settings,new Date(today.now),today.data.due);
 const current=allocateRoadmap(today.data.items,plusDays(today.settings.startDate,plan.delayedWeeks*7))[plan.week-1];
 return <>
  <RouteHeading title="Hôm nay" eyebrow="MỖI NGÀY MỘT CHÚT"><h2 className="welcome-subtitle">Chào bạn, cùng học nhé.</h2><p>Không cần học thật nhiều. Chỉ cần hôm nay tiến thêm một bước.</p></RouteHeading>
  <PixelScene id="home-tokyo"/>
  <section className="today-block" aria-labelledby="now-title"><div className="block-heading"><span>01</span><h2 id="now-title">Làm ngay</h2></div>
   <div className="today-quick"><div><p className="eyebrow">TỪ & KANJI · KHÔNG ÂM THANH</p><h3>Ôn nhanh</h3><p>{today.data.due} thẻ đến hạn trong hàng ôn của bạn.</p><Link className="button button-primary" href="/srs?mode=quick">Bắt đầu ôn nhanh →</Link></div><Mascot species="tanuki" size={108}/></div>
  </section>
  <section className="today-block" aria-labelledby="week-title"><div className="block-heading"><span>02</span><h2 id="week-title">Tuần này</h2></div><div className="today-week">
   <Link className="today-link" href="/shadowing"><Mascot species="bird"/><div><h3>Shadowing</h3><p>{plan.count}/2 buổi đã ghi nhận tuần này</p><span className="text-link">Mở thư viện clip →</span></div></Link>
   <Link className="today-link" href="/common-tools/progress"><div><h3>Tiến độ học</h3><p>Xem số lượt ôn và kết quả đã lưu trong app.</p><span className="text-link">Xem tiến độ →</span></div></Link>
  </div></section>
  <section className="today-block" aria-labelledby="journey-title"><div className="block-heading"><span>03</span><h2 id="journey-title">Hành trình</h2></div><div className="journey-stats">
   <article><span>Chuỗi ngày tự ghi nhận</span><strong>{plan.streak} ngày</strong></article><article><span>Chặng hiện tại</span><strong>{current.level} · tuần {plan.week}</strong></article><article><span>Kỳ thi dự kiến {today.settings.examDate}</span><strong>{Math.max(0,plan.examDays)} ngày</strong></article>
  </div><Link className="text-link" href="/today-roadmap">Hôm nay và lộ trình →</Link></section>
  <section className="stats-grid" aria-label="Thư viện của bạn">{([['Từ vựng',summary.vocab,'/vocab'],['Kanji',summary.kanji,'/kanji'],['Ngữ pháp',summary.grammar,'/grammar'],['Hàng ôn',summary.review,'/srs']]as const).map(([label,count,url])=><Link className="stat-card" key={url} href={url}><span>{label}</span><strong>{count}</strong><small>Mở để học →</small></Link>)}</section>
  <section className="section-block"><div className="section-heading"><div><p className="eyebrow">MỞ MỘT TRANG SỔ</p><h2>Những từ đầu tiên</h2></div><Link className="text-link" href="/vocab">Xem từ vựng →</Link></div><div className="content-grid">{words.map(item=><ContentCard key={item.id} item={item}/>)}</div></section>
  <section className="type-sample"><div><p className="eyebrow">ĐỌC RÕ, HỌC THOẢI MÁI</p><ViText as="p" className="vi-specimen">Ộ Ệ Ờ Ữ Ỹ Đ</ViText><p className="muted">Chữ Việt trọn dấu, chữ Nhật rõ nét.</p></div><JaText as="p" className="ja-specimen">働 返 直 骨</JaText></section>
 </>;
}

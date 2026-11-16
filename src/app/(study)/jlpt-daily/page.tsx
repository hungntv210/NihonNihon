import {PixelScene} from '../../../components/pixel-scenes/pixel-scene.tsx';
import {RouteHeading} from '../../../components/route-heading.tsx';
import Link from 'next/link';import { dailyContext } from './server-context.ts';import { availableBank,readState,dailyView } from './repository.ts';import { Practice } from './practice.tsx';import styles from './jlpt.module.css';
export default async function JlptDaily(){
 const context=await dailyContext();let bank;try{bank=availableBank(context,context.catalog,context.approvedCatalog);}catch{bank=null;}
 const attempts=readState();
 const answered=attempts.attempts.filter(a=>a.date===context.date).length;
 const view=bank?dailyView(bank,context.date,attempts):null;
 return <section className={styles.page}><RouteHeading title="JLPT mỗi tối" eyebrow="MỘT CHÚT MỖI TỐI" species="crane"><p>Tối đa mười câu mới mỗi tối. Hiểu kỹ thêm từng chút.</p><p>Cấp hiện tại: {context.level}</p></RouteHeading>
 <PixelScene id="jlpt-study" params={{answered}}/>
 <div className={styles.meta}><span>{view?.total??0} câu đang có</span><time dateTime={context.date}>{context.date}</time></div>
 {context.shadow&&<aside className={styles.notice}>Hôm nay ưu tiên <Link href="/shadowing">shadowing</Link>. Bài JLPT vẫn sẵn nếu bạn muốn luyện thêm.</aside>}
 {!context.evening&&<p className={styles.muted}>Bài tối nay đã sẵn; bạn có thể luyện sớm hoặc quay lại vào buổi tối.</p>}
 {view&&view.total>0?<Practice initial={view} answeredToday={answered}/>:bank?<div className={styles.empty}><h2>Hôm nay chưa có thêm câu mới</h2><p>Ngân hàng đã duyệt hiện chưa có câu chưa dùng. Không lặp câu cũ; mở trang không gọi AI.</p></div>:<div className={styles.empty}><span aria-hidden="true">◇</span><h2>Bài tuần này chưa sẵn</h2><p>Câu luyện chỉ dùng nội dung đã ôn đúng cấp của bạn. Hãy ôn trước, rồi quay lại khi bộ câu tuần được chuẩn bị.</p><Link className="button primary" href="/srs">Vào ôn tập</Link><p className={styles.muted}>Mở trang không tạo câu hỏi hay gọi AI.</p></div>}
 </section>;
}

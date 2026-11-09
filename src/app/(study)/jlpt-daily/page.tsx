import Link from 'next/link';import { dailyContext } from './server-context.ts';import { readBank,readState,dailyView } from './repository.ts';import { Practice } from './practice.tsx';import styles from './jlpt.module.css';
export default async function JlptDaily(){
 const context=await dailyContext();let bank;try{bank=readBank(context.week,context.level,context.catalog);}catch{bank=null;}
 return <section className={styles.page}><header className={styles.header}><div><p className="eyebrow">MỘT CHÚT MỖI TỐI</p><h1>Luyện JLPT buổi tối</h1><p>Mười câu quen thuộc. Hiểu kỹ thêm từng chút.</p></div><div className={styles.level}><strong>{context.level}</strong><span>Cấp hiện tại</span></div></header>
 <div className={styles.meta}><span>10 câu · khoảng 12 phút</span><time dateTime={context.date}>{context.date}</time></div>
 {context.shadow&&<aside className={styles.notice}>Hôm nay ưu tiên <Link href="/shadowing">shadowing</Link>. Bài JLPT vẫn sẵn nếu bạn muốn luyện thêm.</aside>}
 {!context.evening&&<p className={styles.muted}>Bài tối nay đã sẵn; bạn có thể luyện sớm hoặc quay lại vào buổi tối.</p>}
 {bank?<Practice initial={dailyView(bank,context.date,readState())}/>:<div className={styles.empty}><span aria-hidden="true">◇</span><h2>Bài tuần này chưa sẵn</h2><p>Câu luyện chỉ dùng nội dung đã ôn đúng cấp của bạn. Hãy ôn trước, rồi quay lại khi bộ câu tuần được chuẩn bị.</p><Link className="button primary" href="/srs">Vào ôn tập</Link><p className={styles.muted}>Mở trang không tạo câu hỏi hay gọi AI.</p></div>}
 </section>;
}

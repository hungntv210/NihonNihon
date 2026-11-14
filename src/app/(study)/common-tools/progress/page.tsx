import Link from 'next/link';
import { withContentDatabase } from '../../../../server/dal.ts';
import { getStudyPreferences } from '../../../../server/preferences.ts';
import { readProgress } from '../../today-roadmap/repository.ts';
import { progressData } from '../repository.ts';
export default async function ProgressPage() {
 const prefs=await getStudyPreferences(),data=await withContentDatabase(db=>progressData(db,prefs.timeZone)),shadow=readProgress().shadow;
 const maximum=Math.max(1,...data.days.map(d=>d.count));
 return <><div className="page-heading"><p className="eyebrow">NHỮNG LẦN ĐÃ HỌC</p><h1>Tiến độ học</h1><p>Dữ liệu ôn đã ghi nhận · múi giờ {prefs.timeZone}.</p></div><div className="content-grid"><article className="content-card"><h2>{data.totalReviews} lượt ôn</h2><p>{data.due} thẻ đến hạn</p><Link href="/srs">Mở ôn tập</Link></article><article className="content-card"><h2>{shadow.length} buổi shadowing</h2><p>{shadow.filter(s=>s.method==='automatic').length} buổi tự động đủ điều kiện; còn lại ghi tay dự phòng. Không tải bản ghi âm lên server.</p><Link href="/today-roadmap">Mở lộ trình</Link></article></div><section className="content-card"><h2>Lượt ôn trong 14 ngày</h2><p>Mỗi dòng gồm ngày và số lượt chấm đã lưu, kể cả ôn lại cùng thẻ.</p>{data.days.map(d=><div key={d.date}><label htmlFor={'day-'+d.date}>{d.date}: {d.count} lượt</label><meter id={'day-'+d.date} min={0} max={maximum} value={d.count}/></div>)}</section><section className="content-card"><h2>Độ phủ nội dung</h2><p>“Đã ôn” là có ít nhất một lượt chấm, chưa có nghĩa là đã thành thạo.</p><table><thead><tr><th>Loại</th><th>Đã nhập</th><th>Đã thêm ôn</th><th>Đã ôn</th></tr></thead><tbody>{data.coverage.map(r=><tr key={r.kind}><th>{r.kind}</th><td>{r.total}</td><td>{r.saved}</td><td>{r.reviewed}</td></tr>)}</tbody></table></section></>;
}

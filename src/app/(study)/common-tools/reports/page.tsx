import Link from 'next/link';
import { withContentDatabase } from '../../../../server/dal.ts';
import { reportQueue } from '../repository.ts';
export default async function ReportsPage() {
 const rows=await withContentDatabase(reportQueue);
 return <><div className="page-heading"><p className="eyebrow">GIỮ LẠI ĐỂ XEM SAU</p><h1>Hàng báo sai</h1><p>Chỉ đọc. Báo sai không tự sửa hoặc dịch lại nội dung.</p></div><p role="status">{rows.length} dòng báo sai / gắn cờ (tối đa 300). Bao gồm mọi nguồn, cả dịch máy.</p>{!rows.length&&<p>Chưa có báo sai mở hoặc bản dịch được gắn cờ.</p>}<div className="content-grid">{rows.map((r,n)=><article className="content-card" key={r.id+'-'+n}><h2>{r.href?<Link href={r.href}>{r.title}</Link>:r.title}</h2><p>{r.text}</p><p className="source-label">{r.method==='machine'?'Dịch máy':r.method} · {r.source}{r.model?' · '+r.model:''} · {r.field}</p><p>{r.reason}</p><p>{r.status}{r.stale?' · Nội dung cũ / cần làm mới':''}</p>{r.date&&<time dateTime={r.date}>{r.date}</time>}</article>)}</div><p>Mở chi tiết mục học để báo sai bản Việt đang được chọn. Hàng này không xác nhận đã sửa bản dịch.</p></>;
}

import { getContentSummary } from '../../../server/dal.ts';
import Link from 'next/link';
export default async function SrsPage() {
  const summary = await getContentSummary();
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">GẶP LẠI ĐỂ NHỚ LÂU</p>
        <h1>Hàng ôn tập</h1>
        <p>Những điều bạn muốn mang theo, thêm một lần nữa.</p>
      </div>
      <section className="empty-state">
        <span className="review-total">{summary.review}</span>
        <h2>{summary.review ? 'Thẻ đã được lưu vào hàng ôn.' : 'Một khởi đầu nhẹ nhàng.'}</h2>
        <p>
          {summary.review
            ? 'Phiên ôn và lịch nhắc sẽ được bổ sung ở bước tiếp theo.'
            : 'Thêm một từ, một chữ hay một mẫu câu từ thư viện để bắt đầu.'}
        </p>
        <Link className="button button-primary" href="/vocab">
          Chọn từ để ôn →
        </Link>
      </section>
    </>
  );
}

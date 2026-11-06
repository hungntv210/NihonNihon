import Link from 'next/link';
import { getContent, getContentSummary } from '../../server/dal.ts';
import { ContentCard } from '../../components/content-card.tsx';
import { JaText, ViText } from '../../components/text.tsx';
export default async function TodayPage() {
  const [summary, words] = await Promise.all([getContentSummary(), getContent('vocab', 3)]);
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">MỖI NGÀY MỘT CHÚT</p>
        <h1>Chào bạn, cùng học nhé.</h1>
        <p>Không cần học thật nhiều. Chỉ cần hôm nay tiến thêm một bước.</p>
      </div>
      <section className="welcome-panel" aria-labelledby="welcome-title">
        <div>
          <span className="small-label">GÓC NHỎ TIẾNG NHẬT</span>
          <h2 id="welcome-title">
            Bắt đầu từ những
            <br />
            điều quen thuộc.
          </h2>
          <p>
            Gặp một từ mới, hiểu thêm một chút.
            <br />
            Lưu lại để gặp nhau trong buổi ôn sau.
          </p>
          <Link className="button button-primary" href="/vocab">
            Mở sổ từ vựng <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <svg className="desk-art" viewBox="0 0 320 230" aria-hidden="true">
          <ellipse cx="167" cy="206" rx="128" ry="14" fill="#DDE6D9" />
          <path d="m40 88 115-21 106 31-113 24Z" fill="#fff" stroke="#96AE95" />
          <path d="M40 88v82l108 37v-85M148 207l113-30V98" fill="#EEF1E7" stroke="#96AE95" />
          <path d="m54 97 93 32 99-26M147 129v63" fill="none" stroke="#96AE95" />
          <path
            d="m83 128 41 14m-41-3 41 14m42-8 47-14m-47 24 35-11"
            stroke="#B0BDA9"
            strokeWidth="3"
          />
          <path d="M251 108c-32-27-41-48-39-80 33 6 42 35 39 80Z" fill="#477D59" />
          <path d="M250 110c2-36 17-57 44-61-2 34-17 51-44 61Z" fill="#86A681" />
          <path d="m232 109 42 1-7 60h-27Z" fill="#D8B994" />
          <path d="M251 111V62" stroke="#2F684E" strokeWidth="2" />
          <circle cx="88" cy="43" r="17" fill="#E6C87B" />
          <path
            d="m28 51 8-5m-1 16 9 2M276 29l3-10m10 17 9-3"
            stroke="#96AE95"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </section>
      <section className="stats-grid" aria-label="Thư viện của bạn">
        {(
          [
            ['Từ vựng', summary.vocab, '/vocab', 'Từng từ, từng ý'],
            ['Kanji', summary.kanji, '/kanji', 'Nhận mặt, hiểu nghĩa'],
            ['Ngữ pháp', summary.grammar, '/grammar', 'Nối những điều đã biết'],
            ['Hàng ôn', summary.review, '/srs', 'Lưu lại để nhớ lâu'],
          ] as const
        ).map(([label, count, url, note]) => (
          <Link className="stat-card" key={url} href={url}>
            <span>{label}</span>
            <strong>{count}</strong>
            <small>{note}</small>
          </Link>
        ))}
      </section>
      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">MỞ MỘT TRANG SỔ</p>
            <h2>Những từ đầu tiên</h2>
          </div>
          <Link className="text-link" href="/vocab">
            Xem từ vựng <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="content-grid">
          {words.map((item) => (
            <ContentCard key={item.id} item={item} />
          ))}
        </div>
      </section>
      <section className="type-sample">
        <div>
          <p className="eyebrow">ĐỌC RÕ, HỌC THOẢI MÁI</p>
          <ViText as="p" className="vi-specimen">
            Ộ Ệ Ờ Ữ Ỹ Đ
          </ViText>
          <p className="muted">Chữ Việt trọn dấu, chữ Nhật rõ nét.</p>
        </div>
        <JaText as="p" className="ja-specimen">
          働 返 直 骨
        </JaText>
      </section>
    </>
  );
}

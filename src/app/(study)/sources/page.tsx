import {RouteHeading} from '../../../components/route-heading.tsx';
import { getContentSources } from '../../../server/dal.ts';
export default async function SourcesPage() {
  const sources = await getContentSources();
  return (
    <>
      <RouteHeading title="Nguồn dữ liệu" eyebrow="HỌC CÙNG NGUỒN MỞ" species="owl"><p>Ghi công những người đã tạo nên nội dung trong thư viện.</p></RouteHeading>
      <div className="source-list">
        {sources.map((source) => (
          <article className="source-card" key={source.id}>
            <span className="level">{source.license}</span>
            <h2>{source.name}</h2>
            <p>{source.attribution}</p>
            {/^https?:\/\//.test(source.url) && (
              <a className="text-link" href={source.url} target="_blank" rel="noreferrer">
                Mở nguồn gốc ↗
              </a>
            )}
          </article>
        ))}
      </div>
      <p className="muted source-footnote">
        Nội dung mẫu giữ nguyên bản Anh của OpenJLPT. Bản Việt chỉ hiển thị khi có bản dịch được
        chọn trong database.
      </p>
    </>
  );
}

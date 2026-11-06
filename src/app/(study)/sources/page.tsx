import { getContentSources } from '../../../server/dal.ts';
export default async function SourcesPage() {
  const sources = await getContentSources();
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">HỌC CÙNG NGUỒN MỞ</p>
        <h1>Nguồn dữ liệu</h1>
        <p>Ghi công những người đã tạo nên nội dung trong thư viện.</p>
      </div>
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

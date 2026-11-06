import { getContent } from '../../../server/dal.ts';
import { ContentCard } from '../../../components/content-card.tsx';
export default async function VocabPage() {
  const items = await getContent('vocab');
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">SỔ TỪ CỦA BẠN</p>
        <h1>Từ vựng</h1>
        <p>Gặp một từ mới, lưu lại để nhớ lâu hơn.</p>
      </div>
      <div className="content-grid">
        {items.map((item) => (
          <ContentCard key={item.id} item={item} />
        ))}
      </div>
    </>
  );
}

import { getContent } from '../../../server/dal.ts';
import { ContentCard } from '../../../components/content-card.tsx';
export default async function GrammarPage() {
  const items = await getContent('grammar');
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">NỐI LỜI THÀNH CÂU</p>
        <h1>Ngữ pháp</h1>
        <p>Những mẫu câu đầu tiên trong sổ học của bạn.</p>
      </div>
      <div className="content-grid">
        {items.map((item) => (
          <ContentCard key={item.id} item={item} />
        ))}
      </div>
    </>
  );
}

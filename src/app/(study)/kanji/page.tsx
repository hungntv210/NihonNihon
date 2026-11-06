import { getContent } from '../../../server/dal.ts';
import { ContentCard } from '../../../components/content-card.tsx';
export default async function KanjiPage() {
  const items = await getContent('kanji');
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">TỪNG NÉT, TỪNG Ý</p>
        <h1>Kanji</h1>
        <p>Làm quen với mặt chữ và nghĩa của những chữ đầu tiên.</p>
      </div>
      <div className="content-grid">
        {items.map((item) => (
          <ContentCard key={item.id} item={item} />
        ))}
      </div>
    </>
  );
}

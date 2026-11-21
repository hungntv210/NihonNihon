import { withContentDatabase } from '../../../../../server/dal.ts';
import { RouteHeading } from '../../../../../components/route-heading.tsx';
import lessonStyles from '../lesson.module.css';
import { newLessonKanji } from './model.ts';
import { KanjiCardBody, KanjiCardReview, KanjiLessonDone, KanjiWordBody } from './card-body.tsx';
import { KanjiLesson, type KanjiLessonCard } from './session.tsx';

export default async function KanjiLessonPage() {
  const kanjiList = await withContentDatabase((db) => newLessonKanji(db));
  const items: KanjiLessonCard[] = kanjiList.map((item) => ({
    id: item.id,
    body: <KanjiCardBody item={item} />,
    words: item.words.map((word, index) => ({
      id: word.id,
      reading: word.reading || word.word,
      content: <KanjiWordBody word={word} index={index} />,
    })),
    review: <KanjiCardReview item={item} />,
  }));
  return (
    <div className={lessonStyles.root}>
      <RouteHeading title="Kanji" species="fox">
        <h2 className="welcome-subtitle">Gặp những chữ kanji mới</h2>
        <p>Xem mặt chữ, âm Hán Việt, từ đi kèm rồi thêm vào hàng ôn khi bạn thấy sẵn sàng.</p>
      </RouteHeading>
      {items.length ? (
        <KanjiLesson
          items={items}
          done={<KanjiLessonDone count={items.length} />}
          footer={
            <p data-lesson-muted="">
              Xem chữ không tự đưa vào hàng ôn. Chỉ các kanji bạn bấm “Thêm vào ôn” mới được lưu.
            </p>
          }
        />
      ) : (
        <KanjiLessonDone count={0} />
      )}
    </div>
  );
}

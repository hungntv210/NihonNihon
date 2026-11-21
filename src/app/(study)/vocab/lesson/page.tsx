import { withContentDatabase } from '../../../../server/dal.ts';
import { RouteHeading } from '../../../../components/route-heading.tsx';
import { newLessonVocabulary } from './model.ts';
import {
  LessonEmptyState,
  LessonExampleBody,
  LessonWordHead,
  LessonWordMeaning,
} from './example-body.tsx';
import { Lesson, type LessonCardItem } from './session.tsx';
import lessonStyles from './lesson.module.css';

export default async function LessonPage() {
  const words = await withContentDatabase(newLessonVocabulary);
  const items: LessonCardItem[] = words.map((item) => ({
    id: item.id,
    reading: item.reading,
    head: <LessonWordHead item={item} />,
    meaning: <LessonWordMeaning item={item} />,
    examples: item.examples.map((example, i) => ({
      id: example.id,
      japanese: example.japanese,
      content: (
        <LessonExampleBody
          itemId={item.id}
          sourceName={item.sourceName}
          example={example}
          index={i}
        />
      ),
    })),
  }));
  return (
    <div className={lessonStyles.root}>
      <RouteHeading title="Từ vựng" species="cat">
        <h2 className="welcome-subtitle">Gặp những từ mới</h2>
        <p>Nghe, đọc to câu ví dụ rồi mở nghĩa để đối chiếu. Bạn có thể dừng bất cứ lúc nào.</p>
      </RouteHeading>
      {items.length ? (
        <Lesson
          items={items}
          done={<LessonEmptyState count={items.length} />}
          footer={
            <p data-lesson-muted="">
              Mở nghĩa không tự đánh dấu đã nhớ. Chỉ các từ bạn chọn “Thêm vào ôn” mới được lưu vào
              hàng ôn.
            </p>
          }
        />
      ) : (
        <LessonEmptyState count={0} />
      )}
    </div>
  );
}

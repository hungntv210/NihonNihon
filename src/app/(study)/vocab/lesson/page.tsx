import { getNewVocabulary } from '../server.ts';
import { Lesson } from './session.tsx';
export default async function LessonPage() {
  return <Lesson items={await getNewVocabulary()} />;
}

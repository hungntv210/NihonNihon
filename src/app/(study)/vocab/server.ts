import 'server-only';
import { withContentDatabase } from '../../../server/dal.ts';
import { findVocabulary, vocabularyDetail, newVocabulary, type Search } from './data.ts';
export const getVocabulary = (search: Search) =>
  withContentDatabase((db) => findVocabulary(db, search));
export const getVocabularyDetail = (id: string) =>
  withContentDatabase((db) => vocabularyDetail(db, id));
export const getNewVocabulary = () => withContentDatabase(newVocabulary);

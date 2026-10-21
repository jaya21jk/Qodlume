import { QUIZ_MANIFEST_ENTRIES } from '../data/quiz-manifest';
import { LocalFileQuizRepository } from './quiz-repository';
import { validateQuizCollection } from './quiz-validator';

const manifestValidation = validateQuizCollection(QUIZ_MANIFEST_ENTRIES);

const availableQuizzes = manifestValidation.fileReports
  .flatMap((report) => (report.parsedQuiz ? [report.parsedQuiz] : []));

export const quizRepository = new LocalFileQuizRepository(availableQuizzes, {
  timezone: 'Asia/Kolkata',
});

export function getPublishedQuizArchive() {
  return quizRepository.listPublishedQuizzes();
}

export function getCurrentPublishedQuiz(date?: string) {
  return quizRepository.getTodaysPublishedQuiz(date);
}

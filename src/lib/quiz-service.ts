import type { Quiz, QuizFilterCriteria, QuizSummary } from '../types/quiz';
import { ApiQuizRepository, LocalFileQuizRepository, type QuizRepository } from './quiz-repository';

export interface QuizServiceDependencies {
  repository: QuizRepository;
}

export class QuizService {
  constructor(private readonly deps: QuizServiceDependencies) {}

  getTodaysPublishedQuiz(date?: string): Quiz | null {
    return this.deps.repository.getTodaysPublishedQuiz(date);
  }

  getQuizById(id: string): Quiz | null {
    return this.deps.repository.getQuizById(id);
  }

  getQuizByPublicationDate(publicationDate: string): Quiz | null {
    return this.deps.repository.getQuizByPublicationDate(publicationDate);
  }

  listPublishedQuizzes(): Quiz[] {
    return this.deps.repository.listPublishedQuizzes();
  }

  filterQuizzes(criteria?: QuizFilterCriteria): Quiz[] {
    return this.deps.repository.filterQuizzes(criteria);
  }

  buildArchive(): QuizSummary[] {
    return this.listPublishedQuizzes().map((quiz) => ({
      id: quiz.id,
      version: quiz.version,
      publicationDate: quiz.publicationDate,
      timezone: quiz.timezone,
      status: quiz.status,
      title: quiz.title,
      description: quiz.description,
      topic: quiz.topic,
      difficulty: quiz.difficulty,
      estimatedDurationMinutes: quiz.estimatedDurationMinutes,
      questionCount: quiz.questions.length,
      questionIds: quiz.questions.map((question) => question.id),
    }));
  }
}

export function createLocalQuizService(quizzes: ReadonlyArray<Quiz>, timezone = 'Asia/Kolkata'): QuizService {
  return new QuizService({
    repository: new LocalFileQuizRepository(quizzes, { timezone }),
  });
}

export function createApiQuizService(apiBaseUrl: string, timezone = 'Asia/Kolkata'): QuizService {
  return new QuizService({
    repository: new ApiQuizRepository(apiBaseUrl, timezone),
  });
}

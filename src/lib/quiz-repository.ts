import {
  DEFAULT_PUBLICATION_TIMEZONE,
  type Quiz,
  type QuizFilterCriteria,
  type QuizSummary,
  type ValidationReport,
} from '../types/quiz';
import { validateQuizJsonString } from './quiz-validator';

export interface QuizRepository {
  getTodaysPublishedQuiz(date?: string): Quiz | null;
  getQuizById(id: string): Quiz | null;
  getQuizByPublicationDate(publicationDate: string): Quiz | null;
  listPublishedQuizzes(): Quiz[];
  filterQuizzes(criteria?: QuizFilterCriteria): Quiz[];
  validateImportedQuiz(jsonText: string, fileName?: string): ValidationReport;
}

export interface FileQuizRepositoryConfig {
  timezone?: string;
  includeDraftsInMemory?: boolean;
}

export class LocalFileQuizRepository implements QuizRepository {
  private readonly timezone: string;
  private readonly sourceQuizzes: readonly Quiz[];

  constructor(quizzes: ReadonlyArray<Quiz>, config: FileQuizRepositoryConfig = {}) {
    this.timezone = config.timezone ?? DEFAULT_PUBLICATION_TIMEZONE;
    this.sourceQuizzes = [...quizzes];
  }

  getTodaysPublishedQuiz(date?: string): Quiz | null {
    const targetDate = date ?? this.getTodayInTimezone();
    return this.getQuizByPublicationDate(targetDate);
  }

  getQuizById(id: string): Quiz | null {
    return this.sourceQuizzes.find((quiz) => quiz.id === id && quiz.status === 'published') ?? null;
  }

  getQuizByPublicationDate(publicationDate: string): Quiz | null {
    return this.sourceQuizzes.find(
      (quiz) => quiz.publicationDate === publicationDate && quiz.status === 'published'
    ) ?? null;
  }

  listPublishedQuizzes(): Quiz[] {
    return [...this.sourceQuizzes]
      .filter((quiz) => quiz.status === 'published')
      .sort((a, b) => b.publicationDate.localeCompare(a.publicationDate));
  }

  filterQuizzes(criteria: QuizFilterCriteria = {}): Quiz[] {
    const published = this.listPublishedQuizzes();
    return published.filter((quiz) => {
      const topicMatch =
        !criteria.topic || criteria.topic === 'all' || quiz.topic === criteria.topic;
      const difficultyMatch =
        !criteria.difficulty || criteria.difficulty === 'all' || quiz.difficulty === criteria.difficulty;
      const searchMatch =
        !criteria.searchQuery ||
        `${quiz.title} ${quiz.description}`.toLowerCase().includes(criteria.searchQuery.toLowerCase());
      return topicMatch && difficultyMatch && searchMatch;
    });
  }

  validateImportedQuiz(jsonText: string, fileName = 'imported-quiz.json'): ValidationReport {
    return validateQuizJsonString(jsonText, fileName);
  }

  private getTodayInTimezone(): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const today = new Date();
    return formatter.format(today);
  }
}

export class ApiQuizRepository implements QuizRepository {
  constructor(
    private readonly apiBaseUrl: string,
    private readonly timezone: string = DEFAULT_PUBLICATION_TIMEZONE
  ) {}

  getTodaysPublishedQuiz(date?: string): Quiz | null {
    return null;
  }

  getQuizById(id: string): Quiz | null {
    return null;
  }

  getQuizByPublicationDate(publicationDate: string): Quiz | null {
    return null;
  }

  listPublishedQuizzes(): Quiz[] {
    return [];
  }

  filterQuizzes(criteria: QuizFilterCriteria = {}): Quiz[] {
    void criteria;
    return [];
  }

  validateImportedQuiz(jsonText: string, fileName = 'imported-quiz.json'): ValidationReport {
    return validateQuizJsonString(jsonText, fileName);
  }
}

export function buildQuizArchive(quizzes: ReadonlyArray<Quiz>): QuizSummary[] {
  return [...quizzes]
    .filter((quiz) => quiz.status === 'published')
    .sort((a, b) => b.publicationDate.localeCompare(a.publicationDate))
    .map((quiz) => ({
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

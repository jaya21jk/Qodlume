/**
 * Qodlume API contract
 *
 * Public quiz routes read from D1 server-side and only return published records.
 * Admin routes verify the signed HttpOnly session server-side; D1 bindings never
 * leave the Worker.
 *
 * Current quiz data flow:
 *   Owner uploads quiz JSON
 *   -> Next.js server validates schema and uniqueness
 *   -> Cloudflare D1 stores quiz and question records
 *   -> Public routes expose published quizzes only
 *
 * Server-scored quiz attempts remain a future extension.
 */

import type {
  CodeSnippet,
  LearningReference,
  PublicationStatus,
  Quiz,
  QuizDifficulty,
  QuizOption,
  QuizSummary,
  QuizTopic,
  ValidationIssue,
} from './quiz';

/**
 * Public Question DTO returned when a user is taking a live server-scored quiz
 * (Optionally omits correctOptionId/explanation before submission in strict server mode,
 * or includes them in Phase 1 static/hybrid mode).
 */
export interface PublicQuizQuestionDto {
  id: string;
  prompt: string;
  codeSnippet?: CodeSnippet;
  options: QuizOption[];
  tags?: string[];
}

export interface QuizDetailResponseDto {
  quiz: Quiz;
  serverTimestamp: string;
  timezone: string;
}

export interface QuizArchiveResponseDto {
  items: QuizSummary[];
  totalElements: number;
  page: number;
  pageSize: number;
  availableTopics: QuizTopic[];
  availableDifficulties: QuizDifficulty[];
}

export interface SubmitQuizAttemptRequestDto {
  quizId: string;
  quizVersion: number;
  startedAt: string;
  completedAt: string;
  clientTimezone: string;
  answers: Array<{
    questionId: string;
    selectedOptionId: string;
    timeSpentMs?: number;
  }>;
}

export interface QuestionEvaluationDto {
  questionId: string;
  selectedOptionId: string;
  correctOptionId: string;
  isCorrect: boolean;
  explanation: string;
  references?: LearningReference[];
}

export interface QuizAttemptResultResponseDto {
  attemptId: string;
  quizId: string;
  quizVersion: number;
  publicationDate: string;
  eligibleForOfficialLeaderboard: boolean;
  totalQuestions: number;
  correctCount: number;
  scorePercentage: number;
  evaluatedAt: string;
  questionBreakdown: QuestionEvaluationDto[];
}

export interface AdminImportQuizRequestDto {
  quiz: Quiz;
  allowVersionUpgrade: boolean;
  targetStatus: PublicationStatus;
  changeNotes?: string;
}

export interface AdminImportQuizResponseDto {
  accepted: boolean;
  quizId: string;
  version: number;
  status: PublicationStatus;
  previousVersionPreserved: boolean;
  validationIssues: ValidationIssue[];
}

/**
 * Current admin and public route paths, plus planned attempt endpoints.
 */
export const FUTURE_API_ENDPOINTS = {
  GET_TODAYS_QUIZ: '/api/quizzes?date={date}',
  GET_QUIZ_BY_ID: (id: string) => `/api/v1/quizzes/${encodeURIComponent(id)}`,
  GET_QUIZ_BY_DATE: (date: string) => `/api/quizzes?date=${encodeURIComponent(date)}`,
  LIST_PUBLISHED_ARCHIVE: '/api/quizzes/archive',
  FILTER_QUIZZES: '/api/v1/quizzes',
  SUBMIT_ATTEMPT: (quizId: string) => `/api/v1/quizzes/${encodeURIComponent(quizId)}/attempts`,
  GET_ATTEMPT_RESULT: (attemptId: string) => `/api/v1/attempts/${encodeURIComponent(attemptId)}`,
  ADMIN_IMPORT_QUIZ: '/api/admin/quizzes',
  ADMIN_PUBLISH_QUIZ: (quizId: string) => `/api/admin/quizzes/${encodeURIComponent(quizId)}`,
  ADMIN_SESSION: '/api/admin/session',
} as const;

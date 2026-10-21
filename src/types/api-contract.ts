/**
 * Future Backend REST API Contract (Spring Boot + PostgreSQL)
 *
 * Designed so the Next.js frontend and QuizRepository depend only on stable DTOs
 * and never on underlying PostgreSQL table structures or credentials.
 *
 * Target Data Flow (Phase 2+):
 *   Owner uploads quiz JSON
 *   -> Spring Boot backend validates schema & uniqueness
 *   -> PostgreSQL stores versioned quiz & question records
 *   -> Publication workflow approves & transitions status to 'published'
 *   -> Next.js fetches published quiz DTOs via REST API
 *   -> User completes quiz & submits answers
 *   -> Backend validates eligible attempt & calculates official score on server
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
 * Contract describing all REST endpoints the future Spring Boot service will expose.
 */
export const FUTURE_API_ENDPOINTS = {
  GET_TODAYS_QUIZ: '/api/v1/quizzes/today',
  GET_QUIZ_BY_ID: (id: string) => `/api/v1/quizzes/${encodeURIComponent(id)}`,
  GET_QUIZ_BY_DATE: (date: string) => `/api/v1/quizzes/by-date/${encodeURIComponent(date)}`,
  LIST_PUBLISHED_ARCHIVE: '/api/v1/quizzes/archive',
  FILTER_QUIZZES: '/api/v1/quizzes',
  SUBMIT_ATTEMPT: (quizId: string) => `/api/v1/quizzes/${encodeURIComponent(quizId)}/attempts`,
  GET_ATTEMPT_RESULT: (attemptId: string) => `/api/v1/attempts/${encodeURIComponent(attemptId)}`,
  ADMIN_IMPORT_QUIZ: '/api/v1/admin/quizzes/import',
  ADMIN_PUBLISH_QUIZ: (quizId: string) => `/api/v1/admin/quizzes/${encodeURIComponent(quizId)}/publish`,
} as const;

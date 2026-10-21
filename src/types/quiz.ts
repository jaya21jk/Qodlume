/**
 * Core domain types for Qodlume External Quiz Content Management.
 * Kept independent of UI components and database table structures.
 */

export const PUBLICATION_STATUSES = [
  'draft',
  'validated',
  'scheduled',
  'published',
  'archived',
] as const;

export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

export const QUIZ_DIFFICULTIES = [
  'beginner',
  'intermediate',
  'advanced',
] as const;

export type QuizDifficulty = (typeof QUIZ_DIFFICULTIES)[number];

export const QUIZ_TOPICS = [
  'javascript',
  'java',
  'typescript',
  'react',
  'nextjs',
  'algorithms',
  'system-design',
  'css',
  'web-performance',
  'security',
  'databases',
] as const;

export type QuizTopic = (typeof QUIZ_TOPICS)[number];

export const DEFAULT_PUBLICATION_TIMEZONE = 'Asia/Kolkata';

export interface CodeSnippet {
  language: string;
  code: string;
  filename?: string;
  highlightLines?: number[];
}

export interface LearningReference {
  title: string;
  url: string;
  type?: 'documentation' | 'article' | 'video' | 'spec';
}

export interface QuizOption {
  id: string;
  text: string;
  code?: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  hint?: string;
  questionType?: 'single_choice';
  codeSnippet?: CodeSnippet;
  options: QuizOption[];
  correctOptionId: string;
  explanation: string;
  references?: LearningReference[];
  tags?: string[];
}

export interface Quiz {
  id: string;
  version: number;
  publicationDate: string; // YYYY-MM-DD in Asia/Kolkata
  timezone: string; // e.g., "Asia/Kolkata"
  status: PublicationStatus;
  scheduledAt?: string;
  publishedAt?: string;
  createdAt?: string;
  createdBy?: string;
  title: string;
  description: string;
  topic: QuizTopic;
  difficulty: QuizDifficulty;
  estimatedDurationMinutes: number;
  author?: string;
  updatedAt?: string;
  previousVersionId?: string;
  validationErrors?: ValidationIssue[];
  questions: QuizQuestion[];
}

export type PublicQuizQuestion = Omit<QuizQuestion, 'correctOptionId' | 'explanation'>;

export type PublicQuiz = Omit<Quiz, 'questions' | 'validationErrors' | 'createdBy'> & {
  questions: PublicQuizQuestion[];
};

export interface QuizGradingResult {
  score: number;
  answers: {
    questionId: string;
    selectedOptionId: string;
    correctOptionId: string;
    explanation: string;
    correct: boolean;
  }[];
}

export interface QuizSummary {
  id: string;
  version: number;
  publicationDate: string;
  timezone: string;
  status: PublicationStatus;
  title: string;
  description: string;
  topic: QuizTopic;
  difficulty: QuizDifficulty;
  estimatedDurationMinutes: number;
  questionCount: number;
  questionIds: string[];
  updatedAt?: string;
}

export interface AdminQuizListItem extends Omit<QuizSummary, 'questionIds'> {
  questionCount: number;
  scheduledAt?: string;
  publishedAt?: string;
  updatedAt: string;
  validationErrors: ValidationIssue[];
}

export interface QuizFilterCriteria {
  topic?: QuizTopic | 'all';
  difficulty?: QuizDifficulty | 'all';
  searchQuery?: string;
  status?: PublicationStatus;
}

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  code: string;
  severity: ValidationSeverity;
  message: string;
  fileName?: string;
  quizId?: string;
  questionId?: string;
  field?: string;
}

export interface ValidationReport {
  valid: boolean;
  fileName?: string;
  quizId?: string;
  publicationDate?: string;
  status?: PublicationStatus;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  checkedAt: string;
  parsedQuiz?: Quiz;
}

export interface CollectionValidationReport {
  valid: boolean;
  totalFiles: number;
  publishedCount: number;
  draftCount: number;
  validatedCount: number;
  scheduledCount: number;
  archivedCount: number;
  fileReports: ValidationReport[];
  collectionIssues: ValidationIssue[];
  checkedAt: string;
}

export interface OverwriteConflictInfo {
  hasConflict: boolean;
  conflictType?: 'duplicate_id' | 'duplicate_date' | 'both';
  existingQuiz?: Quiz;
   touchesPublishedQuiz: boolean;
  requiresExplicitReplacement: boolean;
  suggestedNextVersion: number;
  message?: string;
}

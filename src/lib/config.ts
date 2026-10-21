import { DEFAULT_PUBLICATION_TIMEZONE } from '../types/quiz';

export type QuizDataSourceType = 'file' | 'api';

export interface QodlumeDataSourceConfig {
  sourceType: QuizDataSourceType;
  publicationTimezone: string;
  apiBaseUrl?: string;
  staticHostingNotice: string;
}

/**
 * Resolves the current data-source configuration.
 *
 * Security & Static Hosting notes:
 * - Phase 1 uses 'file' (validated local JSON files bundled at build time).
 * - Never store database credentials or GitHub Personal Access Tokens in NEXT_PUBLIC_* variables.
 * - In a future SSR/Edge or Spring Boot backend deployment, QODLUME_DATA_SOURCE=api and
 *   QODLUME_API_BASE_URL can be configured on the server.
 */
export function getDataSourceConfig(): QodlumeDataSourceConfig {
  const rawSource =
    (typeof process !== 'undefined' && process.env?.QODLUME_DATA_SOURCE) ||
    'file';

  const sourceType: QuizDataSourceType =
    rawSource === 'api' ? 'api' : 'file';

  const apiBaseUrl =
    typeof process !== 'undefined'
      ? process.env?.QODLUME_API_BASE_URL
      : undefined;

  return {
    sourceType,
    publicationTimezone: DEFAULT_PUBLICATION_TIMEZONE,
    apiBaseUrl,
    staticHostingNotice:
      'Phase 1 Static Export Mode: Content is compiled from content/quizzes/*.json at build time. Browser uploads are validated and previewed locally; publishing to live visitors requires exporting the validated JSON, committing to GitHub, and redeploying the static build.',
  };
}

/**
 * Formats a Date object (or current time) into YYYY-MM-DD in the Asia/Kolkata timezone.
 */
export function getCurrentDateInTimezone(
  timezone: string = DEFAULT_PUBLICATION_TIMEZONE,
  referenceDate: Date = new Date()
): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(referenceDate);
}

import { DEFAULT_PUBLICATION_TIMEZONE } from '../types/quiz';

export type QuizDataSourceType = 'd1' | 'file' | 'api';

export interface QodlumeDataSourceConfig {
  sourceType: QuizDataSourceType;
  publicationTimezone: string;
  apiBaseUrl?: string;
  deploymentNotice: string;
}

export function getSiteUrl(value: string | undefined): string {
  if (!value) {
    throw new Error('SITE_URL must be configured with the canonical site URL.');
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('SITE_URL must be a valid absolute URL.');
  }

  const isLocalHttp =
    url.protocol === 'http:' &&
    (url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname === '[::1]');
  if (
    (url.protocol !== 'https:' && !isLocalHttp) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('SITE_URL must be an HTTPS origin (HTTP is allowed only for localhost).');
  }

  return url.origin;
}

/**
 * Resolves the current data-source configuration.
 *
 * Security & runtime notes:
 * - Production uses the Cloudflare D1 binding through server-side Worker routes.
 * - The JSON file repository remains available for local validation and legacy tests.
 * - Never store database credentials or GitHub Personal Access Tokens in NEXT_PUBLIC_* variables.
 * - An external API can be selected explicitly with QODLUME_DATA_SOURCE=api.
 */
export function getDataSourceConfig(): QodlumeDataSourceConfig {
  const rawSource =
    (typeof process !== 'undefined' && process.env?.QODLUME_DATA_SOURCE) ||
    'd1';

  const sourceType: QuizDataSourceType = rawSource === 'file' || rawSource === 'api'
    ? rawSource
    : 'd1';

  const apiBaseUrl =
    typeof process !== 'undefined'
      ? process.env?.QODLUME_API_BASE_URL
      : undefined;

  return {
    sourceType,
    publicationTimezone: DEFAULT_PUBLICATION_TIMEZONE,
    apiBaseUrl,
    deploymentNotice:
      'Production quiz content is read from Cloudflare D1 through server-side Worker routes. Local JSON files are retained as validated backup and seed data.',
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

/**
 * Manifest of the versioned JSON quiz backups.
 *
 * Production reads quiz content from D1. This manifest remains available to
 * legacy local-file repository tests; migration and validation scripts read
 * the full content/quizzes directory directly.
 */

import quiz20261015 from '../../content/quizzes/2026-10-15.json';
import quiz20261018 from '../../content/quizzes/2026-10-18.json';
import quiz20261019 from '../../content/quizzes/2026-10-19.json';
import quiz20261020 from '../../content/quizzes/2026-10-20.json';
import quiz20261021 from '../../content/quizzes/2026-10-21.json';

export interface ManifestEntry {
  fileName: string;
  rawContent: unknown;
}

export const QUIZ_MANIFEST_ENTRIES: readonly ManifestEntry[] = [
  { fileName: '2026-10-15.json', rawContent: quiz20261015 },
  { fileName: '2026-10-18.json', rawContent: quiz20261018 },
  { fileName: '2026-10-19.json', rawContent: quiz20261019 },
  { fileName: '2026-10-20.json', rawContent: quiz20261020 },
  { fileName: '2026-10-21.json', rawContent: quiz20261021 },
] as const;

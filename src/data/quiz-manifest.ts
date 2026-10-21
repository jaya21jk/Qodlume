/**
 * Static Manifest of External Quiz Content Files.
 *
 * Why this file exists:
 * Next.js static export (`output: 'export'`) pre-renders pages at build time and
 * cannot use Node's `fs` module inside client components in the browser.
 * By importing the external JSON files from `content/quizzes/*.json` here and
 * validating them through `quiz-validator.ts`, quiz content stays 100% in
 * standalone JSON files under `content/quizzes/` while remaining available
 * to both static build workers and the owner import studio.
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

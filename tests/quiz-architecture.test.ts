import test from 'node:test';
import assert from 'node:assert/strict';

import {
  checkOverwriteSafety,
  validateQuizJsonString,
} from '../src/lib/quiz-validator';
import {
  LocalFileQuizRepository,
  type FileQuizRepositoryConfig,
} from '../src/lib/quiz-repository';
import type { Quiz } from '../src/types/quiz';

const makeQuiz = (overrides: Partial<Quiz> = {}): Quiz => ({
  id: 'quiz-2026-10-19-typescript',
  version: 1,
  publicationDate: '2026-10-19',
  timezone: 'Asia/Kolkata',
  status: 'published',
  title: 'TypeScript Basics',
  description: 'Daily TypeScript challenge',
  topic: 'typescript',
  difficulty: 'beginner',
  estimatedDurationMinutes: 5,
  author: 'Editorial',
  updatedAt: '2026-10-19T00:00:00+05:30',
  questions: [
    {
      id: 'q-1',
      prompt: 'Which keyword creates a variable that cannot be reassigned?',
      options: [
        { id: 'a', text: 'let' },
        { id: 'b', text: 'const' },
      ],
      correctOptionId: 'b',
      explanation: 'const prevents reassignment of the binding, though object contents can still mutate.',
    },
  ],
  ...overrides,
});

test('validateQuizJsonString accepts a valid published quiz payload', () => {
  const report = validateQuizJsonString(JSON.stringify(makeQuiz()), 'valid-quiz.json');

  assert.equal(report.valid, true);
  assert.equal(report.errors.length, 0);
  assert.ok(report.parsedQuiz);
  assert.equal(report.parsedQuiz?.questions[0]?.correctOptionId, 'b');
});

test('validateQuizJsonString flags invalid references and duplicate question IDs', () => {
  const invalidQuiz = makeQuiz({
    questions: [
      {
        id: 'q-1',
        prompt: 'Question 1',
        options: [
          { id: 'a', text: 'One' },
          { id: 'b', text: 'Two' },
        ],
        correctOptionId: 'c',
        explanation: 'Wrong answer target',
      },
      {
        id: 'q-1',
        prompt: 'Duplicate ID',
        options: [
          { id: 'a', text: 'One' },
          { id: 'b', text: 'Two' },
        ],
        correctOptionId: 'b',
        explanation: 'Duplicate question ID should fail.',
      },
    ],
  });

  const report = validateQuizJsonString(JSON.stringify(invalidQuiz), 'duplicate-ids.json');

  assert.equal(report.valid, false);
  assert.ok(report.errors.some((issue) => issue.code === 'INVALID_CORRECT_OPTION_ID'));
  assert.ok(report.errors.some((issue) => issue.code === 'DUPLICATE_QUESTION_ID'));
});

test('checkOverwriteSafety blocks publishing over an existing published quiz', () => {
  const existing = makeQuiz({ id: 'quiz-2026-10-19-typescript', publicationDate: '2026-10-19', status: 'published' });
  const candidate = makeQuiz({ id: 'quiz-2026-10-19-typescript', publicationDate: '2026-10-19', status: 'validated' });

  const conflict = checkOverwriteSafety(candidate, [existing]);

  assert.equal(conflict.hasConflict, true);
  assert.equal(conflict.touchesPublishedQuiz, true);
  assert.equal(conflict.requiresExplicitReplacement, true);
});

test('LocalFileQuizRepository returns published quizzes and ignores drafts', () => {
  const repo = new LocalFileQuizRepository(
    [
      makeQuiz({ id: 'published-1', publicationDate: '2026-10-19', status: 'published', topic: 'typescript' }),
      makeQuiz({ id: 'draft-1', publicationDate: '2026-10-20', status: 'draft', topic: 'nextjs' }),
      makeQuiz({ id: 'published-2', publicationDate: '2026-10-21', status: 'published', topic: 'react', difficulty: 'advanced' }),
    ] as Quiz[],
    {
      timezone: 'Asia/Kolkata',
      includeDraftsInMemory: false,
    } satisfies FileQuizRepositoryConfig,
  );

  const published = repo.listPublishedQuizzes();
  const today = repo.getTodaysPublishedQuiz('2026-10-19');
  const filtered = repo.filterQuizzes({ topic: 'typescript', difficulty: 'beginner' });

  assert.equal(published.length, 2);
  assert.ok(today);
  assert.equal(today?.publicationDate, '2026-10-19');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.id, 'published-1');
});

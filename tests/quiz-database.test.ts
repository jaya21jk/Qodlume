import test from "node:test";
import assert from "node:assert/strict";
import {
  createDraftQuiz,
  getQuizByDate,
  publishDueDailyGameChallenges,
  publishDueQuizzes,
  saveDraftQuiz,
} from "../src/lib/quiz-database";
import type { Quiz } from "../src/types/quiz";

function makeQuizRow(status: string) {
  return {
    id: "d1-test-quiz",
    version: 1,
    publication_date: "2026-10-22",
    timezone: "Asia/Kolkata",
    status,
    title: "D1 visibility test",
    description: "Test database-backed quiz access.",
    topic: "javascript",
    difficulty: "beginner",
    estimated_duration_minutes: 3,
    author: null,
    previous_version_id: null,
    scheduled_at: null,
    published_at: null,
    created_at: "2026-10-21T00:00:00.000Z",
    updated_at: "2026-10-21T00:00:00.000Z",
    created_by: "test",
    validation_errors_json: "[]",
  };
}

function fakeDatabase(
  row: ReturnType<typeof makeQuizRow>,
  queries: string[],
  changes = 2,
  questions: unknown[] = [],
  options: unknown[] = [],
): D1Database {
  const db = {
    prepare(query: string) {
      queries.push(query);
      const statement = {
        bind() {
          return statement;
        },
        async first<T>() {
          return row as T;
        },
        async all<T>() {
          const results = query.includes("FROM questions WHERE")
            ? questions
            : query.includes("FROM question_options")
              ? options
              : [];
          return { success: true, results: results as T[] };
        },
        async run() {
          return {
            success: true,
            meta: { duration: 0, changes },
          };
        },
      };
      return statement;
    },
    async batch() {
      return [];
    },
  };
  return db as unknown as D1Database;
}

test("D1 quiz reads filter and defensively reject non-published content", async () => {
  for (const status of ["draft", "scheduled", "archived"]) {
    const hiddenQueries: string[] = [];
    const hidden = await getQuizByDate(
      fakeDatabase(makeQuizRow(status), hiddenQueries),
      "2026-10-22",
    );
    assert.equal(hidden, null, `${status} quiz must not be public`);
    assert.match(hiddenQueries[0], /status = 'published'/);
  }

  const publicQueries: string[] = [];
  const published = await getQuizByDate(
    fakeDatabase(
      makeQuizRow("published"),
      publicQueries,
      2,
      [
        {
          id: "question-1",
          question_text: "Question",
          question_type: "single_choice",
          explanation: "Private until grading.",
          hint: null,
          correct_option_id: "a",
          code_snippet_json: null,
          references_json: null,
          tags_json: null,
        },
      ],
      [{ id: "a", option_text: "Answer A", code: null, is_correct: 1 }],
    ),
    "2026-10-22",
  );
  assert.equal(published?.id, "d1-test-quiz");
  assert.equal(published?.questions[0]?.prompt, "Question");
  assert.equal("correctOptionId" in published!.questions[0]!, false);
  assert.equal("explanation" in published!.questions[0]!, false);
  assert.equal("is_correct" in published!.questions[0]!.options[0]!, false);
  assert.match(publicQueries[0], /status = 'published'/);
});

test("scheduled publishing only updates due scheduled records", async () => {
  const queries: string[] = [];
  const now = "2026-10-22T03:00:00.000Z";
  const changed = await publishDueQuizzes(
    fakeDatabase(makeQuizRow("scheduled"), queries) as D1Database,
    now,
  );
  assert.equal(changed, 2);
  assert.match(queries[0], /status = 'scheduled'/);
  assert.match(queries[0], /scheduled_at <= \?/);
});

function makeAtomicSchedulerDatabase(state: {
  status: string;
  scheduledAt: string;
  publishedAt?: string;
}): D1Database {
  const db = {
    prepare(query: string) {
      let values: unknown[] = [];
      return {
        bind(...bound: unknown[]) {
          values = bound;
          return this;
        },
        async run() {
          assert.match(query, /WHERE status = 'scheduled' AND scheduled_at <= \?/);
          const [publishedAt, updatedAt, now] = values as [string, string, string];
          if (state.status !== "scheduled" || state.scheduledAt > now) {
            return { success: true, meta: { duration: 0, changes: 0 } };
          }
          state.status = "published";
          state.publishedAt ??= publishedAt;
          void updatedAt;
          return { success: true, meta: { duration: 0, changes: 1 } };
        },
      };
    },
  };
  return db as unknown as D1Database;
}

test("scheduler leaves future items alone, recovers overdue items, and concurrent runs publish once", async () => {
  const quizState = {
    status: "scheduled",
    scheduledAt: "2026-10-24T18:30:00.000Z",
  };
  const quizDb = makeAtomicSchedulerDatabase(quizState);
  assert.equal(
    await publishDueQuizzes(quizDb, "2026-10-24T18:29:59.999Z"),
    0,
  );
  assert.equal(quizState.status, "scheduled");
  const quizCounts = await Promise.all([
    publishDueQuizzes(quizDb, "2026-10-25T02:00:00.000Z"),
    publishDueQuizzes(quizDb, "2026-10-25T02:00:00.000Z"),
  ]);
  assert.equal(quizCounts.reduce((sum, count) => sum + count, 0), 1);
  assert.equal(quizState.status, "published");

  const gameState = {
    status: "scheduled",
    scheduledAt: "2026-10-24T18:30:00.000Z",
  };
  const gameDb = makeAtomicSchedulerDatabase(gameState);
  const gameCounts = await Promise.all([
    publishDueDailyGameChallenges(gameDb, "2026-10-25T02:00:00.000Z"),
    publishDueDailyGameChallenges(gameDb, "2026-10-25T02:00:00.000Z"),
  ]);
  assert.equal(gameCounts.reduce((sum, count) => sum + count, 0), 1);
  assert.equal(gameState.status, "published");
});

test("draft and archived records are never auto-published by the scheduler", async () => {
  for (const status of ["draft", "archived"]) {
    const state = { status, scheduledAt: "2026-10-20T00:00:00.000Z" };
    assert.equal(
      await publishDueQuizzes(makeAtomicSchedulerDatabase(state), "2026-10-25T00:00:00.000Z"),
      0,
    );
    assert.equal(state.status, status);
    assert.equal(
      await publishDueDailyGameChallenges(
        makeAtomicSchedulerDatabase(state),
        "2026-10-25T00:00:00.000Z",
      ),
      0,
    );
    assert.equal(state.status, status);
  }
});

test("draft edits are conditional and cannot overwrite a quiz published concurrently", async () => {
  const queries: string[] = [];
  const db = {
    prepare(query: string) {
      queries.push(query);
      return { bind() { return this; } };
    },
    async batch() {
      return [
        { success: true, meta: { duration: 0, changes: 0 } },
        { success: true, meta: { duration: 0, changes: 0 } },
        { success: true, meta: { duration: 0, changes: 0 } },
        { success: true, meta: { duration: 0, changes: 0 } },
      ];
    },
  } as unknown as D1Database;
  const quiz: Quiz = {
    id: "safe-draft-update",
    version: 1,
    publicationDate: "2026-10-25",
    timezone: "Asia/Kolkata",
    status: "draft",
    scheduledAt: "2026-10-24T18:30:00.000Z",
    title: "Draft",
    description: "A draft quiz.",
    topic: "javascript",
    difficulty: "beginner",
    estimatedDurationMinutes: 3,
    questions: [
      {
        id: "safe-draft-question",
        prompt: "Question",
        options: [{ id: "a", text: "A" }, { id: "b", text: "B" }],
        correctOptionId: "a",
        explanation: "Answer.",
      },
    ],
  };
  await assert.rejects(saveDraftQuiz(db, quiz, "test"), /Only draft or validated quizzes can be edited/);
  assert.match(queries[0] ?? "", /WHERE quizzes\.status IN \('draft', 'validated'\)/);
  assert.equal(
    queries.slice(1).every((query) => /EXISTS \(\s*SELECT 1 FROM quizzes WHERE id = \? AND status = 'draft'/.test(query)),
    true,
  );

  const createQueries: string[] = [];
  const createBindings: unknown[][] = [];
  const createDb = {
    prepare(query: string) {
      createQueries.push(query);
      return {
        bind(...values: unknown[]) {
          createBindings.push(values);
          return this;
        },
      };
    },
    async batch() {
      return Array.from({ length: 4 }, () => ({
        success: true,
        meta: { duration: 0, changes: 1 },
      }));
    },
  } as unknown as D1Database;
  await createDraftQuiz(createDb, quiz, "test");
  assert.doesNotMatch(createQueries[0] ?? "", /ON CONFLICT/i);
  assert.equal(createBindings[0]?.[11], quiz.scheduledAt);
});

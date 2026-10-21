import test from "node:test";
import assert from "node:assert/strict";
import {
  getQuizByDate,
  publishDueQuizzes,
} from "../src/lib/quiz-database";

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
  const hiddenQueries: string[] = [];
  const hidden = await getQuizByDate(
    fakeDatabase(makeQuizRow("draft"), hiddenQueries),
    "2026-10-22",
  );
  assert.equal(hidden, null);
  assert.match(hiddenQueries[0], /status = 'published'/);

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

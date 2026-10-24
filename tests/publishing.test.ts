import test from "node:test";
import assert from "node:assert/strict";
import {
  compareAdminPassword,
  createAdminSessionToken,
  hasValidAdminSecrets,
  hasSameOrigin,
  verifyAdminSessionToken,
} from "../src/lib/admin-auth";
import {
  canEditQuiz,
  areQuizContentsEqual,
  dateTimeLocalToUtc,
  dateTimeUtcToLocal,
  findQuizImportBatchConflicts,
  isQuizPublic,
  normalizeScheduledPublicationTime,
  resolveImportPublication,
  validateScheduledPublicationDate,
  validateQuizForPublishing,
} from "../src/lib/quiz-publishing";
import type { Quiz } from "../src/types/quiz";
import { getSiteUrl } from "../src/lib/config";
import { validateQuizJsonString } from "../src/lib/quiz-validator";

const makeQuiz = (overrides: Partial<Quiz> = {}): Quiz => ({
  id: "publishing-test-quiz",
  version: 1,
  publicationDate: "2026-10-22",
  timezone: "Asia/Kolkata",
  status: "draft",
  title: "Publishing test",
  description: "Test the publishing workflow.",
  topic: "javascript",
  difficulty: "beginner",
  estimatedDurationMinutes: 3,
  questions: [
    {
      id: "publishing-test-question",
      prompt: "Which option is correct?",
      options: [
        { id: "a", text: "Correct" },
        { id: "b", text: "Incorrect" },
      ],
      correctOptionId: "a",
      explanation: "The first option is correct.",
    },
  ],
  ...overrides,
});

test("publication validation accepts a valid quiz and rejects an invalid answer key", () => {
  assert.equal(validateQuizForPublishing(makeQuiz()).valid, true);
  const invalid = makeQuiz({
    questions: [
      {
        ...makeQuiz().questions[0],
        correctOptionId: "missing",
      },
    ],
  });

  test("scheduled quiz imports may omit scheduledAt so publication defaults to midnight", () => {
    const quiz = makeQuiz({ status: "scheduled", scheduledAt: undefined });
    const report = validateQuizJsonString(JSON.stringify(quiz));
    assert.equal(report.valid, true);
    assert.equal(report.parsedQuiz?.scheduledAt, undefined);
  });
  const report = validateQuizForPublishing(invalid);
  assert.equal(report.valid, false);
  assert.ok(report.errors.some((issue) => issue.code === "INVALID_CORRECT_OPTION_ID"));
});

test("scheduled publication requires a future time on the quiz date in its timezone", () => {
  const now = Date.parse("2026-10-21T00:00:00.000Z");
  assert.deepEqual(
    normalizeScheduledPublicationTime(
      "2026-10-22",
      "Asia/Kolkata",
      "2026-10-22T03:00:00.000Z",
      now,
    ),
    { scheduledAt: "2026-10-22T03:00:00.000Z" },
  );
  const wrongDate = normalizeScheduledPublicationTime(
    "2026-10-22",
    "Asia/Kolkata",
    "2026-10-21T18:00:00Z",
    now,
  );
  assert.ok("error" in wrongDate);
  if ("error" in wrongDate) assert.match(wrongDate.error, /must fall on/);
  assert.ok(
    "error" in normalizeScheduledPublicationTime(
      "2026-10-22",
      "Asia/Kolkata",
      "2026-10-21T01:00:00Z",
      now,
    ),
  );
  assert.ok(
    "error" in normalizeScheduledPublicationTime(
      "2026-10-22",
      "Asia/Kolkata",
      "2026-10-22T03:00:00",
      now,
    ),
  );
});

test("schedule by publication date resolves to midnight in the configured timezone", () => {
  assert.deepEqual(
    normalizeScheduledPublicationTime(
      "2026-10-25",
      "Asia/Kolkata",
      undefined,
      Date.parse("2026-10-24T00:00:00.000Z"),
    ),
    { scheduledAt: "2026-10-24T18:30:00.000Z" },
  );
});

test("explicit schedule offsets are preserved as UTC instants and checked against local date", () => {
  assert.deepEqual(
    validateScheduledPublicationDate(
      "2026-10-25",
      "Asia/Kolkata",
      "2026-10-25T00:00:00+05:30",
    ),
    { scheduledAt: "2026-10-24T18:30:00.000Z" },
  );
  assert.ok("error" in validateScheduledPublicationDate(
    "2026-10-25",
    "Asia/Kolkata",
    "2026-10-24T17:30:00Z",
  ));
  assert.ok("error" in validateScheduledPublicationDate(
    "2026-10-25",
    "Asia/Kolkata",
    "2026-02-30T00:00:00+05:30",
  ));
  assert.ok("error" in validateScheduledPublicationDate(
    "2026-10-25",
    "Asia/Kolkata",
    "2026-10-25T00:00:00",
  ));
});

test("bulk import mode keeps drafts as drafts and resolves every scheduled date independently", () => {
  const now = Date.parse("2026-10-20T00:00:00.000Z");
  assert.deepEqual(
    resolveImportPublication("draft", "2026-10-19", "Asia/Kolkata", undefined, now),
    { status: "draft" },
  );
  assert.deepEqual(
    resolveImportPublication("schedule", "2026-10-25", "Asia/Kolkata", undefined, now),
    { status: "scheduled", scheduledAt: "2026-10-24T18:30:00.000Z" },
  );
  assert.deepEqual(
    resolveImportPublication("schedule", "2026-10-26", "Asia/Kolkata", undefined, now),
    { status: "scheduled", scheduledAt: "2026-10-25T18:30:00.000Z" },
  );
  assert.ok("error" in resolveImportPublication(
    "schedule",
    "2026-10-25",
    "Asia/Kolkata",
    "not-a-timestamp",
    now,
  ));
});

test("bulk quiz import detects repeated record IDs, dates, and question IDs", () => {
  const seen = {
    ids: new Set<string>(),
    publicationDates: new Set<string>(),
    questionIds: new Set<string>(),
  };
  const first = makeQuiz();
  assert.deepEqual(findQuizImportBatchConflicts(first, seen), []);
  assert.deepEqual(
    findQuizImportBatchConflicts(
      makeQuiz({
        publicationDate: "2026-10-23",
        questions: [{ ...first.questions[0], id: "second-question" }],
      }),
      seen,
    ),
    ['Duplicate quiz ID "publishing-test-quiz" in this import.'],
  );
  assert.deepEqual(
    findQuizImportBatchConflicts(
      makeQuiz({
        id: "another-quiz",
        publicationDate: "2026-10-23",
        questions: [{ ...first.questions[0], id: "publishing-test-question" }],
      }),
      seen,
    ),
    [
      'Duplicate publication date "2026-10-23" in this import.',
      'Question ID "publishing-test-question" is duplicated within this import.',
    ],
  );
});

test("existing draft quiz content comparison ignores JSON property ordering", () => {
  const original = makeQuiz();
  const reordered: Quiz = {
    ...original,
    questions: [
      {
        explanation: original.questions[0].explanation,
        correctOptionId: original.questions[0].correctOptionId,
        options: original.questions[0].options,
        prompt: original.questions[0].prompt,
        id: original.questions[0].id,
      },
    ],
  };
  assert.equal(areQuizContentsEqual(original, reordered), true);
  assert.equal(
    areQuizContentsEqual(original, { ...reordered, title: "Changed draft" }),
    false,
  );
});

test("schedule input is converted from the quiz timezone to UTC", () => {
  assert.deepEqual(
    dateTimeLocalToUtc("2026-10-23T00:03", "Asia/Kolkata"),
    { scheduledAt: "2026-10-22T18:33:00.000Z" },
  );
  assert.ok("error" in dateTimeLocalToUtc("not-a-date", "Asia/Kolkata"));
  assert.ok("error" in dateTimeLocalToUtc("2026-10-23T00:03", "Not/A_Zone"));
});

test("stored UTC publication times display in the configured local timezone", () => {
  assert.equal(
    dateTimeUtcToLocal("2026-10-24T18:30:00.000Z", "Asia/Kolkata"),
    "2026-10-25T00:00",
  );
  assert.equal(dateTimeUtcToLocal("not-a-timestamp", "Asia/Kolkata"), undefined);
});

test("edit permissions and public visibility are status-based", () => {
  assert.equal(canEditQuiz("draft"), true);
  assert.equal(canEditQuiz("validated"), true);
  assert.equal(canEditQuiz("published"), false);
  assert.equal(isQuizPublic("published"), true);
  assert.equal(isQuizPublic("draft"), false);
  assert.equal(isQuizPublic("scheduled"), false);
  assert.equal(isQuizPublic("archived"), false);
});

test("admin sessions are signed, expiring, and passwords are compared", async () => {
  const secret = "test-only-secret-with-at-least-32-characters";
  const now = Date.parse("2026-10-21T00:00:00.000Z");
  const token = await createAdminSessionToken(secret, now);
  assert.equal(await verifyAdminSessionToken(token, secret, now), true);
  assert.equal(await verifyAdminSessionToken(`${token}x`, secret, now), false);
  assert.equal(
    await verifyAdminSessionToken(token, secret, now + 61 * 60_000),
    false,
  );
  assert.equal(await compareAdminPassword("correct", "correct"), true);
  assert.equal(await compareAdminPassword("incorrect", "correct"), false);
});

test("admin authentication requires both secrets to meet minimum lengths", () => {
  assert.equal(
    hasValidAdminSecrets({
      ADMIN_PASSWORD: "p".repeat(16),
      AUTH_SECRET: "s".repeat(32),
    }),
    true,
  );
  assert.equal(
    hasValidAdminSecrets({
      ADMIN_PASSWORD: "p".repeat(15),
      AUTH_SECRET: "s".repeat(32),
    }),
    false,
  );
  assert.equal(
    hasValidAdminSecrets({
      ADMIN_PASSWORD: "p".repeat(16),
      AUTH_SECRET: "s".repeat(31),
    }),
    false,
  );
});

test("admin write origins must match the request host", () => {
  assert.equal(
    hasSameOrigin(
      new Request("https://qodlume.example/api/admin/quizzes", {
        method: "POST",
        headers: { origin: "https://qodlume.example" },
      }),
    ),
    true,
  );
  assert.equal(
    hasSameOrigin(
      new Request("https://qodlume.example/api/admin/quizzes", {
        method: "POST",
        headers: { origin: "https://attacker.example" },
      }),
    ),
    false,
  );
  assert.equal(hasSameOrigin(new Request("https://qodlume.example/api/admin/quizzes")), false);
});

test("production site URLs must be HTTPS origins and localhost may use HTTP", () => {
  assert.equal(getSiteUrl("https://qodlume.example"), "https://qodlume.example");
  assert.equal(getSiteUrl("http://localhost:8787"), "http://localhost:8787");
  assert.throws(() => getSiteUrl(undefined), /SITE_URL must be configured/);
  assert.throws(() => getSiteUrl("http://qodlume.example"), /HTTPS origin/);
  assert.throws(() => getSiteUrl("https://qodlume.example/path"), /HTTPS origin/);
});

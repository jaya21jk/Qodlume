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
  isQuizPublic,
  normalizeScheduledPublicationTime,
  validateQuizForPublishing,
} from "../src/lib/quiz-publishing";
import type { Quiz } from "../src/types/quiz";
import { getSiteUrl } from "../src/lib/config";

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

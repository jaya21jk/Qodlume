import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateWordGuess,
} from "../src/lib/game-logic";
import {
  getDateInTimezone,
  isDailyChallengeAvailable,
  toPublicDailyGameChallenge,
  validateDailyGameChallenge,
  validateDailySchedule,
} from "../src/lib/daily-game-challenges";
import {
  DEFAULT_DAILY_GAME_CONFIGURATIONS,
  type DailyGameChallenge,
} from "../src/types/daily-game-challenge";

type WordGuessChallenge = Extract<DailyGameChallenge, { gameType: "word-guess" }>;

function makeChallenge(
  overrides: Partial<WordGuessChallenge> = {},
): WordGuessChallenge {
  return {
    id: "word-guess-2026-10-24",
    publicationDate: "2026-10-24",
    timezone: "Asia/Kolkata",
    status: "published",
    gameType: "word-guess",
    title: "Word Guess",
    description: "Solve today's word.",
    configuration: {
      answer: "CRANE",
      validWords: ["CRANE", "APPLE"],
      attempts: 6,
    },
    ...overrides,
  };
}

test("daily challenge timezone date rolls over at the configured local midnight", () => {
  assert.equal(
    getDateInTimezone(new Date("2026-10-24T18:29:59.000Z"), "Asia/Kolkata"),
    "2026-10-24",
  );
  assert.equal(
    getDateInTimezone(new Date("2026-10-24T18:30:00.000Z"), "Asia/Kolkata"),
    "2026-10-25",
  );
  assert.equal(
    getDateInTimezone(new Date("2026-10-24T18:30:00.000Z"), "UTC"),
    "2026-10-24",
  );
});

test("daily game schedule must fall on the publication date in its timezone", () => {
  const now = new Date("2026-10-24T12:00:00.000Z");
  assert.deepEqual(
    validateDailySchedule(
      "2026-10-24",
      "Asia/Kolkata",
      "2026-10-24T13:00:00.000Z",
      now,
    ),
    { scheduledAt: "2026-10-24T13:00:00.000Z" },
  );
  assert.deepEqual(
    validateDailySchedule(
      "2026-10-24",
      "Asia/Kolkata",
      "2026-10-24T18:30:00.000Z",
      now,
    ),
    { error: "Scheduled time must fall on 2026-10-24 in Asia/Kolkata." },
  );
});

test("only published or due scheduled challenges are available for their local date", () => {
  const now = new Date("2026-10-24T12:00:00.000Z");
  assert.equal(isDailyChallengeAvailable(makeChallenge(), now), true);
  assert.equal(
    isDailyChallengeAvailable(makeChallenge({ status: "draft" }), now),
    false,
  );
  assert.equal(
    isDailyChallengeAvailable(makeChallenge({ status: "unpublished" }), now),
    false,
  );
  assert.equal(
    isDailyChallengeAvailable(
      makeChallenge({ status: "scheduled", scheduledAt: "2026-10-24T12:01:00.000Z" }),
      now,
    ),
    false,
  );
  assert.equal(
    isDailyChallengeAvailable(
      makeChallenge({ status: "scheduled", scheduledAt: "2026-10-24T11:59:00.000Z" }),
      now,
    ),
    true,
  );
  assert.equal(
    isDailyChallengeAvailable(
      makeChallenge({ publicationDate: "2026-10-23" }),
      now,
    ),
    false,
  );
});

test("Word Guess answer is canonicalized and remains part of the validated daily config", () => {
  const candidate = makeChallenge({
    configuration: {
      ...DEFAULT_DAILY_GAME_CONFIGURATIONS["word-guess"],
      answer: "crane",
      validWords: ["crane", "APPLE"],
    },
  });

  const firstPlayerConfig = validateDailyGameChallenge(candidate);
  const secondPlayerConfig = validateDailyGameChallenge(candidate);
  assert.equal(firstPlayerConfig.valid, true);
  assert.equal(firstPlayerConfig.challenge?.gameType, "word-guess");
  assert.equal(
    firstPlayerConfig.challenge?.gameType === "word-guess"
      ? firstPlayerConfig.challenge.configuration.answer
      : undefined,
    "CRANE",
  );
  assert.deepEqual(
    firstPlayerConfig.challenge?.configuration,
    secondPlayerConfig.challenge?.configuration,
  );
});

test("public Word Guess challenge responses do not expose the answer or accepted words", () => {
  const publicChallenge = toPublicDailyGameChallenge(makeChallenge());
  assert.equal(publicChallenge?.gameType, "word-guess");
  assert.deepEqual(publicChallenge?.configuration, { attempts: 6 });
  assert.equal("answer" in (publicChallenge?.configuration ?? {}), false);
  assert.equal("validWords" in (publicChallenge?.configuration ?? {}), false);
});

test("Word Guess feedback distinguishes correct position and misplaced letters", () => {
  assert.deepEqual(evaluateWordGuess("CRATE", "CRANE"), [
    "correct",
    "correct",
    "correct",
    "absent",
    "correct",
  ]);
  assert.deepEqual(evaluateWordGuess("EARTH", "CRANE"), [
    "present",
    "present",
    "present",
    "absent",
    "absent",
  ]);
});

test("challenge validator rejects malformed game settings and invalid dates", () => {
  const invalid = validateDailyGameChallenge(
    makeChallenge({
      publicationDate: "2026-02-30",
      configuration: {
        answer: "CRAN",
        validWords: ["APPLE"],
        attempts: 5,
      },
    }),
  );
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((error) => error.includes("publicationDate")));
  assert.ok(invalid.errors.some((error) => error.includes("answer")));
  assert.ok(invalid.errors.some((error) => error.includes("attempts")));
});

test("scheduled game imports without a time resolve to midnight IST", () => {
  const challenge = makeChallenge({
    publicationDate: "2026-10-25",
    status: "scheduled",
    scheduledAt: undefined,
  });
  const validation = validateDailyGameChallenge(challenge);
  assert.equal(validation.valid, true);
  assert.deepEqual(
    validateDailySchedule(
      challenge.publicationDate,
      challenge.timezone,
      undefined,
      new Date("2026-10-24T00:00:00.000Z"),
    ),
    { scheduledAt: "2026-10-24T18:30:00.000Z" },
  );
});

test("scheduled game imports validate explicit offsets and reject malformed or conflicting times", () => {
  const explicit = makeChallenge({
    publicationDate: "2026-10-25",
    status: "scheduled",
    scheduledAt: "2026-10-25T00:15:00+05:30",
  });
  assert.equal(validateDailyGameChallenge(explicit).valid, true);
  assert.deepEqual(
    validateDailySchedule(
      explicit.publicationDate,
      explicit.timezone,
      explicit.scheduledAt,
      new Date("2026-10-24T00:00:00.000Z"),
    ),
    { scheduledAt: "2026-10-24T18:45:00.000Z" },
  );
  assert.equal(
    validateDailyGameChallenge({
      ...explicit,
      scheduledAt: "2026-02-30T00:00:00+05:30",
    }).valid,
    false,
  );
  assert.equal(
    validateDailyGameChallenge({
      ...explicit,
      scheduledAt: "2026-10-24T17:30:00Z",
    }).valid,
    false,
  );
});

test("scheduled games are not visible early and drafts stay hidden after their date", () => {
  const publicationDate = "2026-10-25";
  const notYetMidnight = new Date("2026-10-24T18:29:59.999Z");
  const atMidnight = new Date("2026-10-24T18:30:00.000Z");
  assert.equal(
    isDailyChallengeAvailable(
      makeChallenge({
        publicationDate,
        status: "scheduled",
        scheduledAt: "2026-10-24T18:30:00.000Z",
      }),
      notYetMidnight,
    ),
    false,
  );
  assert.equal(
    isDailyChallengeAvailable(
      makeChallenge({
        publicationDate,
        status: "scheduled",
        scheduledAt: "2026-10-24T18:30:00.000Z",
      }),
      atMidnight,
    ),
    true,
  );
  assert.equal(
    isDailyChallengeAvailable(
      makeChallenge({
        publicationDate: "2026-10-24",
        status: "draft",
      }),
      new Date("2026-10-25T00:00:00.000Z"),
    ),
    false,
  );
});

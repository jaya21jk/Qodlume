import test from "node:test";
import assert from "node:assert/strict";
import { handleWordGuessRequest } from "../src/lib/word-guess-api";
import { buildWordDictionaryImportSql } from "../src/lib/word-dictionary-import";
import {
  validateWordGuess,
  type WordDictionaryDatabase,
} from "../src/lib/word-dictionary";
import type { DailyGameChallenge } from "../src/types/daily-game-challenge";

type WordGuessChallenge = Extract<DailyGameChallenge, { gameType: "word-guess" }>;

function makeChallenge(): WordGuessChallenge {
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
  };
}

function makeDictionary(options: {
  allowed?: string[];
  disabled?: string[];
  fail?: boolean;
} = {}): {
  db: WordDictionaryDatabase;
  queries: Array<{ sql: string; values: unknown[] }>;
} {
  const allowed = new Set(options.allowed ?? ["crane", "apple"]);
  const disabled = new Set(options.disabled ?? []);
  const queries: Array<{ sql: string; values: unknown[] }> = [];
  const db: WordDictionaryDatabase = {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async first<T>() {
              queries.push({ sql, values });
              if (options.fail) throw new Error("D1 unavailable");
              const [word, length] = values;
              if (
                typeof word !== "string" ||
                word.length !== length ||
                (!allowed.has(word) && !disabled.has(word))
              ) {
                return null;
              }
              if (disabled.has(word) || !allowed.has(word)) {
                return null;
              }
              return { word } as T;
            },
          };
        },
      };
    },
  };
  return { db, queries };
}

function apiDependencies(
  db: WordDictionaryDatabase,
  challenge: DailyGameChallenge | null = makeChallenge(),
) {
  return {
    getDatabase: async () => db,
    getChallenge: async () => challenge,
    logError: () => {},
  };
}

function guessRequest(guess: unknown): Request {
  return new Request("https://qodlume.test/api/daily-game-challenges/word-guess/guess", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ guess }),
  });
}

test("enabled dictionary words are normalized and evaluated against the puzzle answer", async () => {
  const { db, queries } = makeDictionary();
  const result = await validateWordGuess(db, "  cRaNe  ", "CRANE");
  assert.deepEqual(result, {
    valid: true,
    guess: "CRANE",
    feedback: ["correct", "correct", "correct", "correct", "correct"],
  });
  assert.deepEqual(queries[0].values, ["crane", 5]);
  assert.match(queries[0].sql, /word = \? AND word_length = \? AND is_guess_allowed = 1/);
});

test("unknown and disabled words are rejected without letter feedback", async () => {
  const unknown = await validateWordGuess(
    makeDictionary({ allowed: ["crane"] }).db,
    "ghost",
    "CRANE",
  );
  assert.deepEqual(unknown, { valid: false, reason: "not-in-word-list" });
  assert.equal("feedback" in unknown, false);

  const disabledDictionary = makeDictionary({
    allowed: ["crane"],
    disabled: ["ghost"],
  });
  const disabled = await validateWordGuess(disabledDictionary.db, "ghost", "CRANE");
  assert.deepEqual(disabled, { valid: false, reason: "not-in-word-list" });
  assert.match(disabledDictionary.queries[0].sql, /is_guess_allowed = 1/);
  assert.equal("feedback" in disabled, false);
});

test("malformed input and wrong-length words do not query the dictionary", async () => {
  const { db, queries } = makeDictionary();
  assert.deepEqual(await validateWordGuess(db, "", "CRANE"), {
    valid: false,
    reason: "malformed",
  });
  assert.deepEqual(await validateWordGuess(db, "ab12!", "CRANE"), {
    valid: false,
    reason: "malformed",
  });
  assert.deepEqual(await validateWordGuess(db, 52, "CRANE"), {
    valid: false,
    reason: "malformed",
  });
  assert.deepEqual(await validateWordGuess(db, "cranee", "CRANE"), {
    valid: false,
    reason: "invalid-length",
  });
  assert.equal(queries.length, 0);
});

test("the API rejects direct invalid requests without feedback or attempt advancement", async () => {
  const { db, queries } = makeDictionary({ allowed: ["crane"] });
  const response = await handleWordGuessRequest(
    guessRequest("ghost"),
    apiDependencies(db),
  );
  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), {
    error: "Not in word list.",
    code: "not-in-word-list",
  });
  assert.equal(queries.length, 1);
});

test("the API accepts trimmed mixed-case valid input and returns puzzle feedback", async () => {
  const { db } = makeDictionary();
  const response = await handleWordGuessRequest(
    guessRequest("  apple  "),
    apiDependencies(db),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    feedback: ["present", "absent", "absent", "absent", "correct"],
    won: false,
    publicationDate: "2026-10-24",
  });
});

test("empty, malformed, and wrong-length API payloads return clear errors", async () => {
  const { db, queries } = makeDictionary();
  const dependencies = apiDependencies(db);
  const empty = await handleWordGuessRequest(guessRequest("  "), dependencies);
  assert.equal(empty.status, 400);
  assert.match(
    ((await empty.json()) as { error: string }).error,
    /English letters/,
  );

  const malformed = await handleWordGuessRequest(guessRequest("abc12"), dependencies);
  assert.equal(malformed.status, 400);

  const wrongLength = await handleWordGuessRequest(guessRequest("cranee"), dependencies);
  assert.equal(wrongLength.status, 422);
  assert.match(
    ((await wrongLength.json()) as { error: string }).error,
    /required number of letters/,
  );
  assert.equal(queries.length, 0);
});

test("database failure is retryable and never returns evaluation feedback", async () => {
  const { db } = makeDictionary({ fail: true });
  const response = await handleWordGuessRequest(
    guessRequest("crane"),
    apiDependencies(db),
  );
  assert.equal(response.status, 503);
  const payload = (await response.json()) as { error: string; feedback?: unknown };
  assert.match(payload.error, /temporarily unavailable/);
  assert.equal("feedback" in payload, false);
});

test("repeated valid API submissions are read-only and do not record duplicate attempts", async () => {
  const { db, queries } = makeDictionary();
  const dependencies = apiDependencies(db);
  const first = await handleWordGuessRequest(guessRequest("apple"), dependencies);
  const second = await handleWordGuessRequest(guessRequest("apple"), dependencies);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(queries.length, 2);
  assert.ok(queries.every(({ sql }) => /^\s*SELECT\b/i.test(sql)));
});

test("missing challenge and malformed JSON are safely rejected", async () => {
  const { db } = makeDictionary();
  const noChallenge = await handleWordGuessRequest(
    guessRequest("crane"),
    apiDependencies(db, null),
  );
  assert.equal(noChallenge.status, 404);

  const malformedJson = await handleWordGuessRequest(
    new Request("https://qodlume.test/guess", { method: "POST", body: "{" }),
    apiDependencies(db),
  );
  assert.equal(malformedJson.status, 400);
});

test("dictionary importer validates flags, rejects duplicates, and generates safe batched SQL", () => {
  const sql = buildWordDictionaryImportSql(
    [
      { word: "CRANE", isGuessAllowed: true, isAnswerEligible: true },
      { word: "apple", isGuessAllowed: true, isAnswerEligible: false },
    ],
    "2026-10-24T00:00:00.000Z",
  );
  assert.match(sql, /'crane', 5, 1, 1/);
  assert.match(sql, /'apple', 5, 1, 0/);

  assert.throws(
    () =>
      buildWordDictionaryImportSql([
        { word: "CRANE", isGuessAllowed: true, isAnswerEligible: false },
        { word: "crane", isGuessAllowed: true, isAnswerEligible: false },
      ]),
    /duplicate normalized word/,
  );
  assert.throws(
    () =>
      buildWordDictionaryImportSql([
        { word: "crane", isGuessAllowed: false, isAnswerEligible: true },
      ]),
    /must also be enabled/,
  );
});

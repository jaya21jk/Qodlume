import { evaluateWordGuess, type GuessFeedback } from "./game-logic";

export interface WordDictionaryDatabase {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T = Record<string, unknown>>(): Promise<T | null>;
    };
  };
}

export type WordGuessValidation =
  | { valid: true; guess: string; feedback: GuessFeedback[] }
  | {
      valid: false;
      reason: "malformed" | "invalid-length" | "not-in-word-list";
    };

export async function validateWordGuess(
  db: WordDictionaryDatabase,
  rawGuess: unknown,
  answer: string,
): Promise<WordGuessValidation> {
  if (typeof rawGuess !== "string") return { valid: false, reason: "malformed" };

  const normalizedGuess = rawGuess.trim().toLowerCase();
  if (!normalizedGuess || !/^[a-z]+$/.test(normalizedGuess)) {
    return { valid: false, reason: "malformed" };
  }
  if (normalizedGuess.length !== answer.length) {
    return { valid: false, reason: "invalid-length" };
  }

  const allowedWord = await db
    .prepare(
      `SELECT word
       FROM daily_game_words
       WHERE word = ? AND word_length = ? AND is_guess_allowed = 1
       LIMIT 1`,
    )
    .bind(normalizedGuess, normalizedGuess.length)
    .first<{ word: string }>();
  if (!allowedWord) return { valid: false, reason: "not-in-word-list" };

  const guess = normalizedGuess.toUpperCase();
  return {
    valid: true,
    guess,
    feedback: evaluateWordGuess(guess, answer),
  };
}

import type { DailyGameChallenge } from "../types/daily-game-challenge";
import {
  validateWordGuess,
  type WordDictionaryDatabase,
} from "./word-dictionary";

export interface WordGuessApiDependencies<
  Database extends WordDictionaryDatabase = WordDictionaryDatabase,
> {
  getDatabase(): Promise<Database>;
  getChallenge(db: Database): Promise<DailyGameChallenge | null>;
  logError?(error: unknown): void;
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function handleWordGuessRequest<
  Database extends WordDictionaryDatabase,
>(
  request: Request,
  dependencies: WordGuessApiDependencies<Database>,
): Promise<Response> {
  let body: unknown;
  try {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > 1024) {
      return json({ error: "Guess request is too large." }, 413);
    }
    const text = await request.text();
    if (text.length > 1024) return json({ error: "Guess request is too large." }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ error: "A valid JSON guess is required." }, 400);
  }

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    !("guess" in body) ||
    typeof body.guess !== "string"
  ) {
    return json({ error: "Guess must be a string." }, 400);
  }

  try {
    const db = await dependencies.getDatabase();
    const challenge = await dependencies.getChallenge(db);
    if (!challenge || challenge.gameType !== "word-guess") {
      return json({ error: "No Word Guess challenge is published for today." }, 404);
    }

    const validation = await validateWordGuess(
      db,
      body.guess,
      challenge.configuration.answer,
    );
    if (!validation.valid) {
      if (validation.reason === "invalid-length") {
        return json(
          { error: "Enter a word with the required number of letters.", code: validation.reason },
          422,
        );
      }
      if (validation.reason === "not-in-word-list") {
        return json({ error: "Not in word list.", code: validation.reason }, 422);
      }
      return json({ error: "Guess must contain English letters only.", code: validation.reason }, 400);
    }

    return json({
      feedback: validation.feedback,
      won: validation.guess === challenge.configuration.answer,
      publicationDate: challenge.publicationDate,
    });
  } catch (error) {
    (dependencies.logError ?? console.error)("Word Guess submission failed.", error);
    return json(
      { error: "Word validation is temporarily unavailable. Please try again." },
      503,
    );
  }
}

import {
  handleWordGuessRequest,
  type WordGuessApiDependencies,
} from "../../../../../lib/word-guess-api";
import {
  getCurrentDailyGameChallenge,
  getDatabase,
} from "../../../../../lib/quiz-database";

export const dynamic = "force-dynamic";

const dependencies: WordGuessApiDependencies<D1Database> = {
  getDatabase,
  getChallenge: (db) => getCurrentDailyGameChallenge(db, "word-guess"),
};

export async function POST(request: Request): Promise<Response> {
  return handleWordGuessRequest(request, dependencies);
}

import { getDatabase, getCurrentDailyGameChallenge } from "../../../../../lib/quiz-database";
import { evaluateWordGuess } from "../../../../../lib/game-logic";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "A valid JSON guess is required." }, { status: 400 });
  }
  if (
    typeof body !== "object" ||
    body === null ||
    !("guess" in body) ||
    typeof body.guess !== "string" ||
    !/^[A-Za-z]{5}$/.test(body.guess)
  ) {
    return Response.json({ error: "Guess must contain exactly five letters." }, { status: 400 });
  }

  try {
    const challenge = await getCurrentDailyGameChallenge(
      await getDatabase(),
      "word-guess",
    );
    if (!challenge || challenge.gameType !== "word-guess") {
      return Response.json({ error: "No Word Guess challenge is published for today." }, {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const guess = body.guess.toUpperCase();
    const feedback = evaluateWordGuess(guess, challenge.configuration.answer);
    return Response.json({
      feedback,
      won: guess === challenge.configuration.answer,
      publicationDate: challenge.publicationDate,
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Word Guess submission failed.", error);
    return Response.json({ error: "Unable to check this guess." }, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}

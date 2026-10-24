import { getDatabase, getCurrentDailyGameChallenge } from "../../../../lib/quiz-database";
import { DAILY_GAME_TYPES, type DailyGameType } from "../../../../types/daily-game-challenge";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ gameType: string }> };

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const { gameType } = await context.params;
  if (!DAILY_GAME_TYPES.includes(gameType as DailyGameType)) {
    return Response.json({ error: "Unsupported game type." }, {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const challenge = await getCurrentDailyGameChallenge(
      await getDatabase(),
      gameType as DailyGameType,
    );
    return Response.json({ challenge }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Daily game challenge lookup failed.", error);
    return Response.json({ error: "Unable to load the daily challenge." }, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}

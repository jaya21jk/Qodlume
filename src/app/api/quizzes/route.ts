import { getDatabase, getQuizByDate } from "../../../lib/quiz-database";
import { isValidCalendarDate } from "../../../lib/quiz-validator";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const date = new URL(request.url).searchParams.get("date");
  if (!date || !isValidCalendarDate(date)) {
    return Response.json({ error: "A valid YYYY-MM-DD date is required." }, {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  }
  try {
    const quiz = await getQuizByDate(await getDatabase(), date);
    return quiz
      ? Response.json({ quiz }, { headers: { "Cache-Control": "no-store" } })
      : Response.json({ error: "Quiz not found." }, {
          status: 404,
          headers: { "Cache-Control": "no-store" },
        });
  } catch (error) {
    console.error("Public quiz lookup failed.", error);
    return Response.json({ error: "Unable to load quiz." }, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}

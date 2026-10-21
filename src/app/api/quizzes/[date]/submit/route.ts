import { getDatabase, getQuizForGrading } from "../../../../../lib/quiz-database";
import { gradeQuizSubmission } from "../../../../../lib/quiz-grading";
import { isValidCalendarDate } from "../../../../../lib/quiz-validator";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ date: string }> },
): Promise<Response> {
  const { date } = await context.params;
  if (!isValidCalendarDate(date)) {
    return json({ error: "A valid YYYY-MM-DD date is required." }, 400);
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 16_384) return json({ error: "Request body is too large." }, 413);

  let body: unknown;
  try {
    const bodyText = await request.text();
    if (bodyText.length > 16_384) return json({ error: "Request body is too large." }, 413);
    body = JSON.parse(bodyText);
  } catch {
    return json({ error: "Invalid JSON request body." }, 400);
  }
  if (typeof body !== "object" || body === null || !("answers" in body)) {
    return json({ error: "An answer for every question is required." }, 400);
  }

  try {
    const quiz = await getQuizForGrading(await getDatabase(), date);
    if (!quiz) return json({ error: "Quiz not found." }, 404);

    const result = gradeQuizSubmission(quiz, body.answers);
    if (!result) return json({ error: "Submit one valid answer for every question." }, 400);
    return json({ result });
  } catch (error) {
    console.error("Quiz answer submission failed.", error);
    return json({ error: "Unable to grade the quiz." }, 500);
  }
}

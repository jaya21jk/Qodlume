import { getDatabase, listPublishedQuizSummaries } from "../../../../lib/quiz-database";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const quizzes = await listPublishedQuizSummaries(await getDatabase());
    return Response.json(
      { quizzes },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Public quiz archive lookup failed.", error);
    return Response.json(
      { error: "Unable to load quiz archive." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

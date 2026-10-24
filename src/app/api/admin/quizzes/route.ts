import {
  validateQuizForPublishing,
  validateScheduledPublicationDate,
} from "../../../../lib/quiz-publishing";
import {
  adminJson,
  authorizeAdminRead,
  authorizeAdminWrite,
  readJsonBody,
} from "../../../../lib/admin-api";
import {
  createDraftQuiz,
  getDatabase,
  listAdminQuizzes,
} from "../../../../lib/quiz-database";
import type { Quiz } from "../../../../types/quiz";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const denied = await authorizeAdminRead(request);
  if (denied) return denied;
  try {
    const quizzes = await listAdminQuizzes(await getDatabase());
    return adminJson({ quizzes });
  } catch (error) {
    console.error("Admin quiz listing failed.", error);
    return adminJson({ error: "Unable to load quizzes." }, 500);
  }
}

export async function POST(request: Request): Promise<Response> {
  const denied = await authorizeAdminWrite(request);
  if (denied) return denied;
  const parsedBody = await readJsonBody(request);
  if ("response" in parsedBody) return parsedBody.response;
  const body = parsedBody.value;
  if (
    typeof body !== "object" ||
    body === null ||
    !("quiz" in body) ||
    typeof body.quiz !== "object" ||
    body.quiz === null
  ) {
    return adminJson({ error: "A quiz object is required." }, 400);
  }

  const candidate = body.quiz as Quiz;
  const report = validateQuizForPublishing(candidate);
  if (!report.valid || !report.parsedQuiz) {
    return adminJson({ error: "Quiz validation failed.", validation: report }, 422);
  }
  if (report.parsedQuiz.scheduledAt) {
    const schedule = validateScheduledPublicationDate(
      report.parsedQuiz.publicationDate,
      report.parsedQuiz.timezone,
      report.parsedQuiz.scheduledAt,
    );
    if ("error" in schedule) return adminJson({ error: schedule.error }, 400);
    report.parsedQuiz.scheduledAt = schedule.scheduledAt;
  }

  try {
    const db = await getDatabase();
    if (await db.prepare("SELECT id FROM quizzes WHERE id = ? OR publication_date = ? LIMIT 1")
      .bind(report.parsedQuiz.id, report.parsedQuiz.publicationDate)
      .first()) {
      return adminJson({ error: "A quiz with this ID or publication date already exists." }, 409);
    }
    await createDraftQuiz(db, { ...report.parsedQuiz, status: "draft" }, "admin");
    return adminJson({ quiz: { ...report.parsedQuiz, status: "draft" } }, 201);
  } catch (error) {
    console.error("Quiz import failed.", error);
    if (error instanceof Error && /constraint/i.test(error.message)) {
      return adminJson({ error: "A quiz with this date or question IDs already exists." }, 409);
    }
    return adminJson({ error: "Unable to save the quiz." }, 500);
  }
}

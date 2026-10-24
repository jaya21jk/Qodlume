import {
  adminJson,
  authorizeAdminRead,
  authorizeAdminWrite,
  readJsonBody,
} from "../../../../../lib/admin-api";
import {
  canEditQuiz,
  normalizeScheduledPublicationTime,
  validateScheduledPublicationDate,
  validateQuizForPublishing,
} from "../../../../../lib/quiz-publishing";
import {
  getAdminQuizById,
  getDatabase,
  saveDraftQuiz,
  setQuizStatus,
} from "../../../../../lib/quiz-database";
import type { PublicationStatus, Quiz, ValidationIssue } from "../../../../../types/quiz";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const denied = await authorizeAdminRead(request);
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const quiz = await getAdminQuizById(await getDatabase(), id);
    return quiz ? adminJson({ quiz }) : adminJson({ error: "Quiz not found." }, 404);
  } catch (error) {
    console.error("Admin quiz read failed.", error);
    return adminJson({ error: "Unable to load the quiz." }, 500);
  }
}

export async function PUT(request: Request, context: RouteContext): Promise<Response> {
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

  const { id } = await context.params;
  const candidate = body.quiz as Quiz;
  if (candidate.id !== id) return adminJson({ error: "Quiz ID cannot be changed." }, 400);
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
    const existing = await getAdminQuizById(db, id);
    if (!existing) return adminJson({ error: "Quiz not found." }, 404);
    if (!canEditQuiz(existing.status)) {
      return adminJson({ error: "Only draft or validated quizzes can be edited." }, 409);
    }
    await saveDraftQuiz(db, report.parsedQuiz, existing.createdBy ?? "admin");
    return adminJson({ quiz: { ...report.parsedQuiz, status: "draft" } });
  } catch (error) {
    console.error("Quiz update failed.", error);
    if (error instanceof Error && /only draft or validated/i.test(error.message)) {
      return adminJson({ error: error.message }, 409);
    }
    if (error instanceof Error && /constraint/i.test(error.message)) {
      return adminJson({ error: "This quiz date or question IDs are already in use." }, 409);
    }
    return adminJson({ error: "Unable to update the quiz." }, 500);
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const denied = await authorizeAdminWrite(request);
  if (denied) return denied;
  const parsedBody = await readJsonBody(request, 16_384);
  if ("response" in parsedBody) return parsedBody.response;
  const body = parsedBody.value;
  if (typeof body !== "object" || body === null || !("action" in body) || typeof body.action !== "string") {
    return adminJson({ error: "A quiz action is required." }, 400);
  }

  try {
    const { id } = await context.params;
    const db = await getDatabase();
    const quiz = await getAdminQuizById(db, id);
    if (!quiz) return adminJson({ error: "Quiz not found." }, 404);

    let status: PublicationStatus;
    let scheduledAt: string | undefined;
    let validationIssues: ValidationIssue[] = [];
    switch (body.action) {
      case "publish":
      case "schedule": {
        if (!canEditQuiz(quiz.status)) {
          return adminJson({ error: "Only draft or validated quizzes can be published or scheduled." }, 409);
        }
        const validation = validateQuizForPublishing(quiz);
        validationIssues = validation.errors;
        if (!validation.valid) {
          await setQuizStatus(db, id, quiz.status, {
            validationIssues,
            expectedStatus: quiz.status,
            preserveScheduledAt: true,
          });
          return adminJson({
            error: "Quiz cannot be published until validation errors are fixed.",
            validation,
          }, 422);
        }
        if (body.action === "publish") {
          status = "published";
        } else {
          const requestedAt = "scheduledAt" in body ? body.scheduledAt : undefined;
          if (
            requestedAt !== undefined &&
            typeof requestedAt !== "string"
          ) {
            return adminJson({ error: "scheduledAt must be an ISO timestamp with a UTC offset." }, 400);
          }
          const schedule = normalizeScheduledPublicationTime(
            quiz.publicationDate,
            quiz.timezone,
            typeof requestedAt === "string" ? requestedAt : quiz.scheduledAt,
          );
          if ("error" in schedule) return adminJson({ error: schedule.error }, 400);
          scheduledAt = schedule.scheduledAt;
          status = "scheduled";
        }
        break;
      }
      case "unpublish":
        if (quiz.status !== "published" && quiz.status !== "scheduled") {
          return adminJson({ error: "Only published or scheduled quizzes can be unpublished." }, 409);
        }
        status = "draft";
        break;
      case "archive":
        if (quiz.status === "archived") {
          return adminJson({ error: "Quiz is already archived." }, 409);
        }
        status = "archived";
        break;
      case "restore":
        if (quiz.status !== "archived") {
          return adminJson({ error: "Only archived quizzes can be restored." }, 409);
        }
        status = "draft";
        break;
      default:
        return adminJson({ error: "Unsupported quiz action." }, 400);
    }

    await setQuizStatus(db, id, status, {
      scheduledAt,
      validationIssues,
      expectedStatus: quiz.status,
    });
    return adminJson({
      quiz: {
        ...quiz,
        status,
        scheduledAt: status === "scheduled" ? scheduledAt : undefined,
        publishedAt:
          status === "published"
            ? new Date().toISOString()
            : status === "draft"
              ? undefined
              : quiz.publishedAt,
      },
    });
  } catch (error) {
    console.error("Quiz publication action failed.", error);
    return adminJson({ error: "Unable to update quiz publication status." }, 500);
  }
}

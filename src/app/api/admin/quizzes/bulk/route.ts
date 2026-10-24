import {
  adminJson,
  authorizeAdminWrite,
  readJsonBody,
} from "../../../../../lib/admin-api";
import {
  canEditQuiz,
  findQuizImportBatchConflicts,
  normalizeScheduledPublicationTime,
  resolveImportPublication,
  validateScheduledPublicationDate,
  validateQuizForPublishing,
} from "../../../../../lib/quiz-publishing";
import {
  getAdminQuizById,
  createDraftQuiz,
  getDatabase,
  setQuizStatus,
} from "../../../../../lib/quiz-database";
import { validateQuizJsonString } from "../../../../../lib/quiz-validator";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const denied = await authorizeAdminWrite(request);
  if (denied) return denied;
  const parsedBody = await readJsonBody(request);
  if ("response" in parsedBody) return parsedBody.response;
  const body = parsedBody.value;
  if (typeof body !== "object" || body === null || !("action" in body)) {
    return adminJson({ error: "A bulk action is required." }, 400);
  }

  if (body.action === "import") {
    if (!("quizzes" in body) || !Array.isArray(body.quizzes) || body.quizzes.length === 0) {
      return adminJson({ error: "quizzes must be a non-empty array." }, 400);
    }
    if (body.quizzes.length > 100) {
      return adminJson({ error: "Bulk imports are limited to 100 quizzes." }, 413);
    }
    const mode = "mode" in body ? body.mode : "draft";
    if (mode !== "draft" && mode !== "schedule") {
      return adminJson({ error: "Import mode must be draft or schedule." }, 400);
    }

    let db: Awaited<ReturnType<typeof getDatabase>>;
    try {
      db = await getDatabase();
    } catch (error) {
      console.error("Bulk quiz import database setup failed.", error);
      return adminJson({ error: "Unable to access the quiz database." }, 500);
    }
    const seenImportKeys = {
      ids: new Set<string>(),
      publicationDates: new Set<string>(),
      questionIds: new Set<string>(),
    };
    const results: Array<{
      index: number;
      id?: string;
      publicationDate?: string;
      status: "created" | "failed" | "duplicate";
      publicationStatus?: "draft" | "scheduled";
      timezone?: string;
      scheduledAt?: string;
      errors?: string[];
    }> = [];

    for (let index = 0; index < body.quizzes.length; index += 1) {
      const initialValidation = validateQuizJsonString(
        JSON.stringify(body.quizzes[index]),
        `bulk-item-${index + 1}.json`,
      );
      if (!initialValidation.valid || !initialValidation.parsedQuiz) {
        results.push({
          index,
          status: "failed",
          errors: initialValidation.errors.map((issue) => `${issue.field ? `${issue.field}: ` : ""}${issue.message}`),
        });
        continue;
      }
      const validation = validateQuizForPublishing(initialValidation.parsedQuiz);
      if (!validation.valid || !validation.parsedQuiz) {
        results.push({
          index,
          status: "failed",
          errors: validation.errors.map((issue) => `${issue.field ? `${issue.field}: ` : ""}${issue.message}`),
        });
        continue;
      }

      const quiz = validation.parsedQuiz;
      const duplicateFields = findQuizImportBatchConflicts(quiz, seenImportKeys);
      if (duplicateFields.length > 0) {
        results.push({
          index,
          id: quiz.id,
          publicationDate: quiz.publicationDate,
          status: "duplicate",
          errors: duplicateFields,
        });
        continue;
      }
      if (quiz.scheduledAt) {
        const scheduleDate = validateScheduledPublicationDate(
          quiz.publicationDate,
          quiz.timezone,
          quiz.scheduledAt,
        );
        if ("error" in scheduleDate) {
          results.push({
            index,
            id: quiz.id,
            publicationDate: quiz.publicationDate,
            status: "failed",
            errors: [scheduleDate.error],
          });
          continue;
        }
        quiz.scheduledAt = scheduleDate.scheduledAt;
      }
      const publication = resolveImportPublication(
        mode,
        quiz.publicationDate,
        quiz.timezone,
        quiz.scheduledAt,
      );
      if ("error" in publication) {
        results.push({
          index,
          id: quiz.id,
          publicationDate: quiz.publicationDate,
          status: "failed",
          errors: [publication.error],
        });
        continue;
      }
      let draftCreated = false;
      try {
        const existing = await db
          .prepare(
            "SELECT id FROM quizzes WHERE id = ? OR publication_date = ? LIMIT 1",
          )
          .bind(quiz.id, quiz.publicationDate)
          .first<{ id: string }>();
        if (existing) {
          results.push({
            index,
            id: quiz.id,
            publicationDate: quiz.publicationDate,
            status: "duplicate",
            errors: ["A quiz with this ID or publication date already exists."],
          });
          continue;
        }

        let existingQuestionId: { id: string } | null = null;
        for (const question of quiz.questions) {
          existingQuestionId = await db
            .prepare("SELECT id FROM questions WHERE id = ? LIMIT 1")
            .bind(question.id)
            .first<{ id: string }>();
          if (existingQuestionId) {
            break;
          }
        }
        if (existingQuestionId) {
          results.push({
            index,
            id: quiz.id,
            publicationDate: quiz.publicationDate,
            status: "duplicate",
            errors: [`Question ID "${existingQuestionId.id}" already exists.`],
          });
          continue;
        }

        await createDraftQuiz(db, { ...quiz, status: "draft" }, "admin");
        draftCreated = true;
        if (publication.status === "scheduled") {
          await setQuizStatus(db, quiz.id, "scheduled", {
            scheduledAt: publication.scheduledAt,
            validationIssues: validation.errors,
            expectedStatus: "draft",
          });
        }
        results.push({
          index,
          id: quiz.id,
          publicationDate: quiz.publicationDate,
          status: "created",
          publicationStatus: publication.status,
          timezone: quiz.timezone,
          scheduledAt: publication.status === "scheduled"
            ? publication.scheduledAt
            : quiz.scheduledAt,
        });
      } catch (error) {
        console.error("Bulk quiz import item failed.", { index, error });
        results.push({
          index,
          id: quiz.id,
          publicationDate: quiz.publicationDate,
          status: "failed",
          publicationStatus: draftCreated ? "draft" : undefined,
          errors: [
            error instanceof Error && /constraint/i.test(error.message)
              ? "A quiz or question with these IDs already exists."
              : draftCreated
                ? `Saved as a draft, but scheduling failed: ${error instanceof Error ? error.message : "Unable to schedule publication."}`
                : "Unable to persist this quiz.",
          ],
        });
      }
    }
    return adminJson({ results });
  }

  if (body.action === "schedule") {
    if (!("items" in body) || !Array.isArray(body.items) || body.items.length === 0) {
      return adminJson({ error: "items must be a non-empty array." }, 400);
    }
    if (body.items.length > 100) {
      return adminJson({ error: "Bulk scheduling is limited to 100 quizzes." }, 413);
    }

    let db: Awaited<ReturnType<typeof getDatabase>>;
    try {
      db = await getDatabase();
    } catch (error) {
      console.error("Bulk quiz scheduling database setup failed.", error);
      return adminJson({ error: "Unable to access the quiz database." }, 500);
    }
    const results: Array<{ id: string; status: "scheduled" | "failed"; error?: string }> = [];
    for (const item of body.items) {
      if (
        typeof item !== "object" ||
        item === null ||
        !("id" in item) ||
        typeof item.id !== "string" ||
        ("scheduledAt" in item && item.scheduledAt !== undefined && typeof item.scheduledAt !== "string")
      ) {
        results.push({ id: "", status: "failed", error: "Each item requires an id and optional scheduledAt." });
        continue;
      }
      try {
        const quiz = await getAdminQuizById(db, item.id);
        if (!quiz) throw new Error("Quiz not found.");
        if (!canEditQuiz(quiz.status)) {
          throw new Error("Only draft or validated quizzes can be scheduled.");
        }
        const validation = validateQuizForPublishing(quiz);
        if (!validation.valid) {
          throw new Error(validation.errors.map((issue) => issue.message).join(" "));
        }
        const schedule = normalizeScheduledPublicationTime(
          quiz.publicationDate,
          quiz.timezone,
          typeof item.scheduledAt === "string" ? item.scheduledAt : quiz.scheduledAt,
        );
        if ("error" in schedule) throw new Error(schedule.error);
        await setQuizStatus(db, item.id, "scheduled", {
          scheduledAt: schedule.scheduledAt,
          validationIssues: validation.errors,
          expectedStatus: quiz.status,
        });
        results.push({ id: item.id, status: "scheduled" });
      } catch (error) {
        results.push({
          id: "id" in item && typeof item.id === "string" ? item.id : "",
          status: "failed",
          error: error instanceof Error ? error.message : "Unable to schedule quiz.",
        });
      }
    }
    return adminJson({ results });
  }

  return adminJson({ error: "Unsupported bulk action." }, 400);
}

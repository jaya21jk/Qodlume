import {
  adminJson,
  authorizeAdminWrite,
  readJsonBody,
} from "../../../../../lib/admin-api";
import {
  areDailyGameChallengeContentsEqual,
  validateDailyGameChallenge,
  validateDailySchedule,
} from "../../../../../lib/daily-game-challenges";
import { resolveImportPublication } from "../../../../../lib/quiz-publishing";
import {
  createDailyGameChallengeDraft,
  getAdminDailyGameChallenge,
  getDatabase,
  setDailyGameChallengeStatus,
} from "../../../../../lib/quiz-database";
import type { DailyGameChallenge } from "../../../../../types/daily-game-challenge";

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
    if (!("challenges" in body) || !Array.isArray(body.challenges) || body.challenges.length === 0) {
      return adminJson({ error: "challenges must be a non-empty array." }, 400);
    }
    if (body.challenges.length > 100) {
      return adminJson({ error: "Bulk imports are limited to 100 challenges." }, 413);
    }
    const mode = "mode" in body ? body.mode : "draft";
    if (mode !== "draft" && mode !== "schedule" && mode !== "publish") {
      return adminJson({ error: "Import mode must be draft, schedule, or publish." }, 400);
    }

    let db: Awaited<ReturnType<typeof getDatabase>>;
    try {
      db = await getDatabase();
    } catch (error) {
      console.error("Bulk daily game challenge import database setup failed.", error);
      return adminJson({ error: "Unable to access the daily game challenge database." }, 500);
    }
    const seen = new Set<string>();
    const results: Array<{
      index: number;
      publicationDate?: string;
      gameType?: string;
      status: "created" | "scheduled" | "failed" | "duplicate";
      publicationStatus?: "draft" | "scheduled" | "published";
      timezone?: string;
      scheduledAt?: string;
      challenge?: DailyGameChallenge;
      errors?: string[];
    }> = [];

    for (let index = 0; index < body.challenges.length; index += 1) {
      const validation = validateDailyGameChallenge(body.challenges[index]);
      if (!validation.valid || !validation.challenge) {
        results.push({ index, status: "failed", errors: validation.errors });
        continue;
      }

      const challenge = validation.challenge;
      const publication = resolveImportPublication(
        mode,
        challenge.publicationDate,
        challenge.timezone,
        challenge.scheduledAt,
      );
      if ("error" in publication) {
        results.push({
          index,
          publicationDate: challenge.publicationDate,
          gameType: challenge.gameType,
          status: "failed",
          errors: [publication.error],
        });
        continue;
      }
      const duplicateKey = `${challenge.gameType}:${challenge.publicationDate}`;
      if (seen.has(duplicateKey)) {
        results.push({
          index,
          publicationDate: challenge.publicationDate,
          gameType: challenge.gameType,
          status: "duplicate",
          errors: ["Duplicate gameType and publicationDate in this import."],
        });
        continue;
      }
      seen.add(duplicateKey);

      let draftCreated = false;
      try {
        const existing = await db
          .prepare("SELECT id, status FROM daily_game_challenges WHERE game_type = ? AND publication_date = ? LIMIT 1")
          .bind(challenge.gameType, challenge.publicationDate)
          .first<{ id: string; status: string }>();
        if (existing) {
          if (
            mode !== "draft" &&
            (existing.status === "draft" || existing.status === "unpublished")
          ) {
            const savedChallenge = await getAdminDailyGameChallenge(db, existing.id);
            if (
              !savedChallenge ||
              !areDailyGameChallengeContentsEqual(challenge, savedChallenge)
            ) {
              results.push({
                index,
                publicationDate: challenge.publicationDate,
                gameType: challenge.gameType,
                status: "duplicate",
                errors: ["An existing draft has different content. Edit that draft or import a matching record; it was not overwritten."],
              });
              continue;
            }
            if (publication.status === "published") {
              await setDailyGameChallengeStatus(db, savedChallenge.id, "published");
            } else {
              const schedule = validateDailySchedule(
                savedChallenge.publicationDate,
                savedChallenge.timezone,
                challenge.scheduledAt,
              );
              if ("error" in schedule) {
                results.push({
                  index,
                  publicationDate: challenge.publicationDate,
                  gameType: challenge.gameType,
                  status: "failed",
                  errors: [schedule.error],
                });
                continue;
              }
              await setDailyGameChallengeStatus(
                db,
                savedChallenge.id,
                "scheduled",
                schedule.scheduledAt,
              );
              results.push({
                index,
                publicationDate: challenge.publicationDate,
                gameType: challenge.gameType,
                status: "scheduled",
                publicationStatus: "scheduled",
                timezone: challenge.timezone,
                scheduledAt: schedule.scheduledAt,
              });
              continue;
            }
            results.push({
              index,
              publicationDate: challenge.publicationDate,
              gameType: challenge.gameType,
              status: publication.status === "published" ? "created" : "scheduled",
              publicationStatus: publication.status,
              timezone: challenge.timezone,
            });
            continue;
          }
          results.push({
            index,
            publicationDate: challenge.publicationDate,
            gameType: challenge.gameType,
            status: "duplicate",
            errors: ["A challenge for this game and date already exists."],
          });
          continue;
        }
        const saved = await createDailyGameChallengeDraft(db, challenge, "admin");
        draftCreated = true;
        if (publication.status !== "draft") {
          await setDailyGameChallengeStatus(
            db,
            saved.id,
            publication.status,
            publication.status === "scheduled" ? publication.scheduledAt : undefined,
          );
        }
        results.push({
          index,
          publicationDate: challenge.publicationDate,
          gameType: challenge.gameType,
          status: "created",
          publicationStatus: publication.status,
          timezone: challenge.timezone,
          scheduledAt: publication.status === "scheduled"
            ? publication.scheduledAt
            : challenge.scheduledAt,
          challenge: {
            ...saved,
            status: publication.status,
            scheduledAt: publication.status === "scheduled"
              ? publication.scheduledAt
              : saved.scheduledAt,
          },
        });
      } catch (error) {
        console.error("Bulk daily game challenge import item failed.", { index, error });
        results.push({
          index,
          publicationDate: challenge.publicationDate,
          gameType: challenge.gameType,
          status: "failed",
          publicationStatus: draftCreated ? "draft" : undefined,
          errors: [
            error instanceof Error && /constraint/i.test(error.message)
              ? "A challenge for this game and date already exists."
              : draftCreated
              ? `Saved as a draft, but publication failed: ${error instanceof Error ? error.message : "Unable to publish or schedule."}`
                : "Unable to persist this challenge.",
          ],
        });
      }
    }

    return adminJson({ results }, 200);
  }

  if (body.action === "schedule") {
    if (!("items" in body) || !Array.isArray(body.items) || body.items.length === 0) {
      return adminJson({ error: "items must be a non-empty array." }, 400);
    }
    if (body.items.length > 100) {
      return adminJson({ error: "Bulk scheduling is limited to 100 challenges." }, 413);
    }
    let db: Awaited<ReturnType<typeof getDatabase>>;
    try {
      db = await getDatabase();
    } catch (error) {
      console.error("Bulk daily game challenge scheduling database setup failed.", error);
      return adminJson({ error: "Unable to access the daily game challenge database." }, 500);
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
        const challenge = await getAdminDailyGameChallenge(db, item.id);
        if (!challenge) throw new Error("Challenge not found.");
        if (challenge.status !== "draft" && challenge.status !== "unpublished") {
          throw new Error("Only draft or unpublished challenges can be scheduled.");
        }
        const validation = validateDailyGameChallenge(challenge);
        if (!validation.valid) throw new Error(validation.errors.join(" "));
        const schedule = validateDailySchedule(
          challenge.publicationDate,
          challenge.timezone,
          typeof item.scheduledAt === "string" ? item.scheduledAt : challenge.scheduledAt,
        );
        if ("error" in schedule) throw new Error(schedule.error);
        await setDailyGameChallengeStatus(db, item.id, "scheduled", schedule.scheduledAt);
        results.push({ id: item.id, status: "scheduled" });
      } catch (error) {
        results.push({
          id: "id" in item && typeof item.id === "string" ? item.id : "",
          status: "failed",
          error: error instanceof Error ? error.message : "Unable to schedule challenge.",
        });
      }
    }
    return adminJson({ results });
  }

  return adminJson({ error: "Unsupported bulk action." }, 400);
}

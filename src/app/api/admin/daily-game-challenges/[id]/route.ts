import {
  adminJson,
  authorizeAdminRead,
  authorizeAdminWrite,
  readJsonBody,
} from "../../../../../lib/admin-api";
import {
  validateDailyGameChallenge,
  validateDailySchedule,
} from "../../../../../lib/daily-game-challenges";
import {
  getAdminDailyGameChallenge,
  getDatabase,
  setDailyGameChallengeStatus,
  updateDailyGameChallengeDraft,
} from "../../../../../lib/quiz-database";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const denied = await authorizeAdminRead(request);
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const challenge = await getAdminDailyGameChallenge(await getDatabase(), id);
    return challenge ? adminJson({ challenge }) : adminJson({ error: "Challenge not found." }, 404);
  } catch (error) {
    console.error("Admin daily game challenge read failed.", error);
    return adminJson({ error: "Unable to load the challenge." }, 500);
  }
}

export async function PUT(request: Request, context: RouteContext): Promise<Response> {
  const denied = await authorizeAdminWrite(request);
  if (denied) return denied;
  const parsedBody = await readJsonBody(request);
  if ("response" in parsedBody) return parsedBody.response;
  const body = parsedBody.value;
  if (typeof body !== "object" || body === null || !("challenge" in body)) {
    return adminJson({ error: "A challenge object is required." }, 400);
  }

  try {
    const { id } = await context.params;
    const db = await getDatabase();
    const existing = await getAdminDailyGameChallenge(db, id);
    if (!existing) return adminJson({ error: "Challenge not found." }, 404);
    if (existing.status !== "draft" && existing.status !== "unpublished") {
      return adminJson({ error: "Only draft or unpublished challenges can be edited." }, 409);
    }

    const validation = validateDailyGameChallenge(body.challenge);
    if (!validation.valid || !validation.challenge) {
      return adminJson({ error: "Daily game challenge validation failed.", validation }, 422);
    }
    if (
      validation.challenge.gameType !== existing.gameType ||
      validation.challenge.publicationDate !== existing.publicationDate
    ) {
      return adminJson({ error: "Game type and publication date cannot be changed." }, 400);
    }
    const challenge = await updateDailyGameChallengeDraft(db, {
      ...validation.challenge,
      id,
    });
    return adminJson({ challenge });
  } catch (error) {
    console.error("Daily game challenge update failed.", error);
    if (error instanceof Error && /only draft or unpublished/i.test(error.message)) {
      return adminJson({ error: error.message }, 409);
    }
    return adminJson({ error: "Unable to update the challenge." }, 500);
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const denied = await authorizeAdminWrite(request);
  if (denied) return denied;
  const parsedBody = await readJsonBody(request, 16_384);
  if ("response" in parsedBody) return parsedBody.response;
  const body = parsedBody.value;
  if (typeof body !== "object" || body === null || !("action" in body) || typeof body.action !== "string") {
    return adminJson({ error: "A challenge action is required." }, 400);
  }

  try {
    const { id } = await context.params;
    const db = await getDatabase();
    const challenge = await getAdminDailyGameChallenge(db, id);
    if (!challenge) return adminJson({ error: "Challenge not found." }, 404);

    if (body.action === "publish") {
      if (challenge.status !== "draft" && challenge.status !== "unpublished") {
        return adminJson({ error: "Only draft or unpublished challenges can be published." }, 409);
      }
      const validation = validateDailyGameChallenge(challenge);
      if (!validation.valid) {
        return adminJson({ error: "Challenge cannot be published until its content is fixed.", validation }, 422);
      }
      return adminJson({
        challenge: await setDailyGameChallengeStatus(db, id, "published"),
      });
    }

    if (body.action === "schedule") {
      if (challenge.status !== "draft" && challenge.status !== "unpublished") {
        return adminJson({ error: "Only draft or unpublished challenges can be scheduled." }, 409);
      }
      const requestedAt = "scheduledAt" in body ? body.scheduledAt : undefined;
      if (requestedAt !== undefined && typeof requestedAt !== "string") {
        return adminJson({ error: "scheduledAt must be an ISO timestamp with a UTC offset." }, 400);
      }
      const validation = validateDailyGameChallenge(challenge);
      if (!validation.valid) {
        return adminJson({ error: "Challenge cannot be scheduled until its content is fixed.", validation }, 422);
      }
      const schedule = validateDailySchedule(
        challenge.publicationDate,
        challenge.timezone,
        typeof requestedAt === "string" ? requestedAt : challenge.scheduledAt,
      );
      if ("error" in schedule) return adminJson({ error: schedule.error }, 400);
      return adminJson({
        challenge: await setDailyGameChallengeStatus(db, id, "scheduled", schedule.scheduledAt),
      });
    }

    if (body.action === "unpublish") {
      if (challenge.status !== "published" && challenge.status !== "scheduled") {
        return adminJson({ error: "Only published or scheduled challenges can be unpublished." }, 409);
      }
      return adminJson({
        challenge: await setDailyGameChallengeStatus(db, id, "unpublished"),
      });
    }

    return adminJson({ error: "Unsupported challenge action." }, 400);
  } catch (error) {
    console.error("Daily game challenge status update failed.", error);
    if (error instanceof Error && /cannot change/i.test(error.message)) {
      return adminJson({ error: error.message }, 409);
    }
    return adminJson({ error: "Unable to update challenge status." }, 500);
  }
}

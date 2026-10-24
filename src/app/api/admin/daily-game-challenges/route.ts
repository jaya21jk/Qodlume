import {
  adminJson,
  authorizeAdminRead,
  authorizeAdminWrite,
  readJsonBody,
} from "../../../../lib/admin-api";
import { validateDailyGameChallenge } from "../../../../lib/daily-game-challenges";
import {
  createDailyGameChallengeDraft,
  getDatabase,
  listAdminDailyGameChallenges,
} from "../../../../lib/quiz-database";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const denied = await authorizeAdminRead(request);
  if (denied) return denied;
  try {
    const challenges = await listAdminDailyGameChallenges(await getDatabase());
    return adminJson({ challenges });
  } catch (error) {
    console.error("Admin daily game challenge listing failed.", error);
    return adminJson({ error: "Unable to load daily game challenges." }, 500);
  }
}

export async function POST(request: Request): Promise<Response> {
  const denied = await authorizeAdminWrite(request);
  if (denied) return denied;
  const parsedBody = await readJsonBody(request);
  if ("response" in parsedBody) return parsedBody.response;
  const body = parsedBody.value;
  if (typeof body !== "object" || body === null || !("challenge" in body)) {
    return adminJson({ error: "A challenge object is required." }, 400);
  }

  const validation = validateDailyGameChallenge(body.challenge);
  if (!validation.valid || !validation.challenge) {
    return adminJson({ error: "Daily game challenge validation failed.", validation }, 422);
  }

  try {
    const challenge = await createDailyGameChallengeDraft(
      await getDatabase(),
      validation.challenge,
      "admin",
    );
    return adminJson({ challenge }, 201);
  } catch (error) {
    console.error("Daily game challenge creation failed.", error);
    if (error instanceof Error && /constraint/i.test(error.message)) {
      return adminJson({ error: "A challenge for this game and publication date already exists." }, 409);
    }
    return adminJson({ error: "Unable to save daily game challenge." }, 500);
  }
}

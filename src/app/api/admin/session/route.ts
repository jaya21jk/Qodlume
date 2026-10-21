import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  ADMIN_SESSION_COOKIE,
  compareAdminPassword,
  createAdminSessionToken,
  getAdminCookie,
  hasValidAdminSecrets,
  hashLoginAddress,
  hasSameOrigin,
  verifyAdminSessionToken,
} from "../../../../lib/admin-auth";
import { getDatabase } from "../../../../lib/quiz-database";

export const dynamic = "force-dynamic";

const COOKIE_BASE = `${ADMIN_SESSION_COOKIE}=; Path=/api/admin; HttpOnly; Secure; SameSite=Strict`;

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

export async function GET(request: Request): Promise<Response> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    if (!hasValidAdminSecrets(env)) {
      return json({ error: "Admin authentication is not configured." }, 503);
    }
    const authenticated = await verifyAdminSessionToken(
      getAdminCookie(request),
      env.AUTH_SECRET,
    );
    return json({ authenticated });
  } catch (error) {
    console.error("Admin session check failed.", error);
    return json({ error: "Unable to verify admin session." }, 500);
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!hasSameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 4096) return json({ error: "Request body is too large." }, 413);

  try {
    const { env } = await getCloudflareContext({ async: true });
    if (!hasValidAdminSecrets(env)) {
      return json({ error: "Admin authentication is not configured securely." }, 503);
    }

    const bodyText = await request.text();
    if (bodyText.length > 4096) return json({ error: "Request body is too large." }, 413);
    let body: unknown;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return json({ error: "Invalid JSON request body." }, 400);
    }
    if (
      typeof body !== "object" ||
      body === null ||
      !("password" in body) ||
      typeof body.password !== "string" ||
      body.password.length === 0 ||
      body.password.length > 256
    ) {
      return json({ error: "A valid password is required." }, 400);
    }

    const address = request.headers.get("cf-connecting-ip") ?? "unknown";
    const ipHash = await hashLoginAddress(address, env.AUTH_SECRET);
    const db = await getDatabase();
    const now = new Date();
    const nowIso = now.toISOString();
    const windowStart = new Date(now.getTime() - 15 * 60_000).toISOString();
    const staleAttemptsBefore = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();
    await db
      .prepare("DELETE FROM admin_login_attempts WHERE window_started_at < ?")
      .bind(staleAttemptsBefore)
      .run();
    const blocked = await db
      .prepare("SELECT blocked_until FROM admin_login_attempts WHERE ip_hash = ?")
      .bind(ipHash)
      .first<{ blocked_until: string | null }>();
    if (blocked?.blocked_until && blocked.blocked_until > nowIso) {
      return json({ error: "Too many sign-in attempts. Try again later." }, 429);
    }

    const blockedUntil = new Date(now.getTime() + 15 * 60_000).toISOString();
    await db
      .prepare(
        `INSERT INTO admin_login_attempts (ip_hash, window_started_at, attempt_count, blocked_until)
         VALUES (?, ?, 1, NULL)
         ON CONFLICT(ip_hash) DO UPDATE SET
           attempt_count = CASE
             WHEN admin_login_attempts.window_started_at <= ? THEN 1
             ELSE admin_login_attempts.attempt_count + 1
           END,
           window_started_at = CASE
             WHEN admin_login_attempts.window_started_at <= ? THEN excluded.window_started_at
             ELSE admin_login_attempts.window_started_at
           END,
           blocked_until = CASE
             WHEN admin_login_attempts.window_started_at <= ? THEN NULL
             WHEN admin_login_attempts.attempt_count + 1 >= 10 THEN ?
             ELSE admin_login_attempts.blocked_until
           END`,
      )
      .bind(ipHash, nowIso, windowStart, windowStart, windowStart, blockedUntil)
      .run();

    if (!(await compareAdminPassword(body.password, env.ADMIN_PASSWORD))) {
      return json({ error: "Incorrect access code." }, 401);
    }

    const token = await createAdminSessionToken(env.AUTH_SECRET, now.getTime());
    const cookie = `${ADMIN_SESSION_COOKIE}=${token}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=3600`;
    return json({ authenticated: true }, 200, { "Set-Cookie": cookie });
  } catch (error) {
    console.error("Admin sign-in failed.", error);
    return json({ error: "Unable to sign in." }, 500);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  if (!hasSameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  return json({ authenticated: false }, 200, {
    "Set-Cookie": `${COOKIE_BASE}; Max-Age=0`,
  });
}

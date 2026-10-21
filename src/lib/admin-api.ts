import { hasSameOrigin, isAdminRequest } from "./admin-auth";

export function adminJson(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function authorizeAdminWrite(request: Request): Promise<Response | null> {
  if (!hasSameOrigin(request)) return adminJson({ error: "Invalid request origin." }, 403);
  try {
    if (!(await isAdminRequest(request))) {
      return adminJson({ error: "Admin authentication required." }, 401);
    }
  } catch (error) {
    console.error("Admin authorization configuration failed.", error);
    return adminJson({ error: "Admin authentication is unavailable." }, 503);
  }
  return null;
}

export async function authorizeAdminRead(request: Request): Promise<Response | null> {
  try {
    if (!(await isAdminRequest(request))) {
      return adminJson({ error: "Admin authentication required." }, 401);
    }
  } catch (error) {
    console.error("Admin authorization configuration failed.", error);
    return adminJson({ error: "Admin authentication is unavailable." }, 503);
  }
  return null;
}

export async function readJsonBody(
  request: Request,
  limit = 512_000,
): Promise<{ value: unknown } | { response: Response }> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > limit) {
    return { response: adminJson({ error: "Request body is too large." }, 413) };
  }
  const text = await request.text();
  if (text.length > limit) {
    return { response: adminJson({ error: "Request body is too large." }, 413) };
  }
  try {
    return { value: JSON.parse(text) as unknown };
  } catch {
    return { response: adminJson({ error: "Invalid JSON request body." }, 400) };
  }
}

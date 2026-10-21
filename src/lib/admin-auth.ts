import { getCloudflareContext } from "@opennextjs/cloudflare";

export const ADMIN_SESSION_COOKIE = "qodlume_admin";
const SESSION_TTL_SECONDS = 60 * 60;

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeBase64Url(value: string): Uint8Array | null {
  try {
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
    const binary = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function getSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createAdminSessionToken(secret: string, now = Date.now()): Promise<string> {
  const expiresAt = Math.floor(now / 1000) + SESSION_TTL_SECONDS;
  const key = await getSigningKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`qodlume-admin:${expiresAt}`),
  );
  return `${expiresAt}.${encodeBase64Url(new Uint8Array(signature))}`;
}

export async function verifyAdminSessionToken(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): Promise<boolean> {
  if (!token || !/^\d{10}\.[A-Za-z0-9_-]+$/.test(token)) return false;
  const [expires, signatureText] = token.split(".");
  const expiresAt = Number(expires);
  const signature = decodeBase64Url(signatureText);
  if (!signature || !Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(now / 1000)) {
    return false;
  }
  const signatureBuffer = new Uint8Array(signature.length);
  signatureBuffer.set(signature);
  const key = await getSigningKey(secret);
  return crypto.subtle.verify(
    "HMAC",
    key,
    signatureBuffer,
    new TextEncoder().encode(`qodlume-admin:${expiresAt}`),
  );
}

export function getAdminCookie(request: Request): string | undefined {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_SESSION_COOKIE}=`));
  return cookie?.slice(ADMIN_SESSION_COOKIE.length + 1);
}

export function hasSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function hasValidAdminSecrets(env: {
  ADMIN_PASSWORD?: string;
  AUTH_SECRET?: string;
}): boolean {
  return Boolean(
    env.ADMIN_PASSWORD &&
      env.ADMIN_PASSWORD.length >= 16 &&
      env.AUTH_SECRET &&
      env.AUTH_SECRET.length >= 32,
  );
}

export async function isAdminRequest(request: Request): Promise<boolean> {
  const { env } = await getCloudflareContext({ async: true });
  if (!hasValidAdminSecrets(env)) {
    throw new Error("ADMIN_PASSWORD and AUTH_SECRET must be configured with the required lengths.");
  }
  return verifyAdminSessionToken(getAdminCookie(request), env.AUTH_SECRET);
}

export async function compareAdminPassword(candidate: string, expected: string): Promise<boolean> {
  const [candidateHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(candidate)),
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(expected)),
  ]);
  const candidateBytes = new Uint8Array(candidateHash);
  const expectedBytes = new Uint8Array(expectedHash);
  let difference = 0;
  for (let index = 0; index < candidateBytes.length; index += 1) {
    difference |= candidateBytes[index] ^ expectedBytes[index];
  }
  return difference === 0;
}

export async function hashLoginAddress(address: string, secret: string): Promise<string> {
  const key = await getSigningKey(secret);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(address));
  return encodeBase64Url(new Uint8Array(digest));
}

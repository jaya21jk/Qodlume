/// <reference types="@cloudflare/workers-types" />

interface CloudflareEnv {
  DB: D1Database;
  ADMIN_PASSWORD: string;
  AUTH_SECRET: string;
  SITE_URL?: string;
}

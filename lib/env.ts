/**
 * Centralized env access with helpful error messages at boot.
 * Optional vars return undefined; required vars throw if missing in production.
 */

function required(name: string): string {
  const value = process.env[name];
  // Treat empty string as missing — Vercel can return "" for unset vars
  // and the `??` operator does not fall back on empty strings, which would
  // silently propagate an invalid empty value into URL builders.
  if (!value || value.trim() === "") {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Missing required env var: ${name}`);
    }
    return "";
  }
  return value;
}

function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v : undefined;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  DATABASE_URL: required("DATABASE_URL"),
  REDIS_URL: required("REDIS_URL"),
  NEXTAUTH_SECRET: required("NEXTAUTH_SECRET"),
  NEXTAUTH_URL:
    process.env.NEXTAUTH_URL && process.env.NEXTAUTH_URL.trim() !== ""
      ? process.env.NEXTAUTH_URL.trim()
      : "http://localhost:3000",

  GOOGLE_CLIENT_ID: optional("GOOGLE_CLIENT_ID"),
  GOOGLE_CLIENT_SECRET: optional("GOOGLE_CLIENT_SECRET"),
  PAGESPEED_API_KEY: optional("PAGESPEED_API_KEY"),

  GITHUB_CLIENT_ID: optional("GITHUB_CLIENT_ID"),
  GITHUB_CLIENT_SECRET: optional("GITHUB_CLIENT_SECRET"),

  META_APP_ID: optional("META_APP_ID"),
  META_APP_SECRET: optional("META_APP_SECRET"),

  LINKEDIN_CLIENT_ID: optional("LINKEDIN_CLIENT_ID"),
  LINKEDIN_CLIENT_SECRET: optional("LINKEDIN_CLIENT_SECRET"),
} as const;

export function isProviderConfigured(
  provider:
    | "google"
    | "github"
    | "pagespeed"
    | "meta"
    | "linkedin"
): boolean {
  switch (provider) {
    case "google":
      return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
    case "github":
      return Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
    case "pagespeed":
      return Boolean(env.PAGESPEED_API_KEY);
    case "meta":
      return Boolean(env.META_APP_ID && env.META_APP_SECRET);
    case "linkedin":
      return Boolean(env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET);
  }
}

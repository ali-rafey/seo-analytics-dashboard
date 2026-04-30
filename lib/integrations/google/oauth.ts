import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import { env } from "@/lib/env";
import { redis } from "@/lib/redis";
import { randomBytes } from "node:crypto";

export const GOOGLE_SCOPES_GA4 = [
  "https://www.googleapis.com/auth/analytics.readonly",
];
export const GOOGLE_SCOPES_GSC = [
  "https://www.googleapis.com/auth/webmasters.readonly",
];
export const GOOGLE_SCOPES_ALL = [
  ...GOOGLE_SCOPES_GA4,
  ...GOOGLE_SCOPES_GSC,
  "openid",
  "email",
  "profile",
];

export function googleRedirectUri(): string {
  return `${env.NEXTAUTH_URL.replace(/\/$/, "")}/api/integrations/google/callback`;
}

export function getGoogleOAuthClient(): OAuth2Client {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error(
      "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
    );
  }
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    googleRedirectUri(),
  );
}

export type GoogleOAuthState = {
  userId: string;
  productId: string;
  scopes: string[];
  returnTo: string;
};

const STATE_PREFIX = "oauth:google:state:";
const STATE_TTL_SECONDS = 600;

export async function createOAuthState(
  state: GoogleOAuthState,
): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  await redis.set(
    `${STATE_PREFIX}${token}`,
    JSON.stringify(state),
    "EX",
    STATE_TTL_SECONDS,
  );
  return token;
}

export async function consumeOAuthState(
  token: string,
): Promise<GoogleOAuthState | null> {
  const key = `${STATE_PREFIX}${token}`;
  // Atomic GETDEL ensures single-use semantics even under concurrent requests.
  // If a user double-clicks "Connect", only the first callback consumes the
  // state; the second receives null and is rejected with state-mismatch. This
  // protects against CSRF replays AND prevents racing callbacks from both
  // upserting tokens.
  let raw: string | null;
  try {
    raw = await (redis as unknown as { getdel: (k: string) => Promise<string | null> }).getdel(key);
  } catch {
    // Fallback for Redis versions < 6.2 that don't support GETDEL.
    raw = await redis.get(key);
    if (raw) await redis.del(key);
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GoogleOAuthState;
  } catch {
    return null;
  }
}

export function buildAuthUrl(state: string, scopes: string[]): string {
  const client = getGoogleOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: scopes,
    state,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const client = getGoogleOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}

export function authorizedClient(opts: {
  accessToken: string;
  refreshToken?: string | null;
  expiryDate?: number | null;
}): OAuth2Client {
  const client = getGoogleOAuthClient();
  client.setCredentials({
    access_token: opts.accessToken,
    refresh_token: opts.refreshToken ?? undefined,
    expiry_date: opts.expiryDate ?? undefined,
  });
  return client;
}

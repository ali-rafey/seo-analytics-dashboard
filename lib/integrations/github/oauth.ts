import { randomBytes } from "node:crypto";
import { env, isProviderConfigured } from "@/lib/env";
import { redis } from "@/lib/redis";

const STATE_PREFIX = "oauth:github:state:";
const STATE_TTL_SECONDS = 600;

export type GitHubOAuthState = {
  userId: string;
  productId: string;
  returnTo: string;
};

export function githubConfigured(): boolean {
  return isProviderConfigured("github");
}

export function buildAuthUrl(state: string): string {
  if (!githubConfigured()) {
    throw new Error(
      "GitHub OAuth not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.",
    );
  }
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", env.GITHUB_CLIENT_ID!);
  url.searchParams.set(
    "redirect_uri",
    `${env.NEXTAUTH_URL.replace(/\/$/, "")}/api/integrations/github/callback`,
  );
  // Need 'repo' to read private repos; if you only want public repos,
  // 'public_repo' is sufficient. We use 'repo' so this works for both.
  url.searchParams.set("scope", "repo read:user");
  url.searchParams.set("state", state);
  url.searchParams.set("allow_signup", "false");
  return url.toString();
}

export async function exchangeCodeForToken(code: string): Promise<{
  accessToken: string;
  scope: string;
}> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  if (!res.ok) {
    throw new Error(`GitHub token exchange failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    access_token?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!data.access_token) {
    throw new Error(
      data.error_description ?? data.error ?? "GitHub returned no access token",
    );
  }
  return { accessToken: data.access_token, scope: data.scope ?? "" };
}

export async function createOAuthState(
  state: GitHubOAuthState,
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
): Promise<GitHubOAuthState | null> {
  const key = `${STATE_PREFIX}${token}`;
  // Atomic GETDEL — see lib/integrations/google/oauth.ts for rationale.
  let raw: string | null;
  try {
    raw = await (redis as unknown as { getdel: (k: string) => Promise<string | null> }).getdel(key);
  } catch {
    raw = await redis.get(key);
    if (raw) await redis.del(key);
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GitHubOAuthState;
  } catch {
    return null;
  }
}

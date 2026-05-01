import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { env, isProviderConfigured } from "@/lib/env";
import { googleRedirectUri } from "@/lib/integrations/google/oauth";

export const dynamic = "force-dynamic";

/**
 * Auth-gated diagnostic endpoint. Returns the Google OAuth config the server
 * is actually running with, so the user can verify NEXTAUTH_URL and the
 * redirect URI without redeploying or leaking secrets. Hit it from the
 * browser while signed in: /api/integrations/google/debug
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let redirectUri: string | null = null;
  let redirectUriError: string | null = null;
  try {
    redirectUri = googleRedirectUri();
  } catch (err) {
    redirectUriError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({
    nodeEnv: env.NODE_ENV,
    nextauthUrl: env.NEXTAUTH_URL,
    googleConfigured: isProviderConfigured("google"),
    googleClientIdPresent: Boolean(env.GOOGLE_CLIENT_ID),
    googleClientSecretPresent: Boolean(env.GOOGLE_CLIENT_SECRET),
    redirectUri,
    redirectUriError,
    expectedRedirectUriOnGoogleCloudConsole: redirectUri,
    hint:
      "The 'redirectUri' value above MUST be listed exactly under " +
      "'Authorized redirect URIs' in your Google Cloud Console OAuth client.",
  });
}

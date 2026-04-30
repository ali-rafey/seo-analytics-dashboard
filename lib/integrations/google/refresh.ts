import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import {
  authorizedClient,
  type GoogleOAuthState,
} from "@/lib/integrations/google/oauth";
import { decrypt } from "@/lib/crypto";
import type { Integration } from "@prisma/client";

/**
 * Returns an OAuth client with fresh credentials. If the access token is near
 * expiry, refresh it and persist the new value back to the integration row.
 */
export async function authorizedClientFor(integration: Integration) {
  if (!integration.accessToken) {
    throw new Error("Integration has no access token");
  }
  const accessToken = decrypt(integration.accessToken);
  const refreshToken = integration.refreshToken
    ? decrypt(integration.refreshToken)
    : null;
  const expiry = integration.expiresAt?.getTime() ?? null;

  const client = authorizedClient({
    accessToken,
    refreshToken,
    expiryDate: expiry,
  });

  const expiringSoon = !expiry || expiry - Date.now() < 60_000;
  if (expiringSoon && refreshToken) {
    try {
      const { credentials } = await client.refreshAccessToken();
      if (credentials.access_token) {
        await prisma.integration.update({
          where: { id: integration.id },
          data: {
            accessToken: encrypt(credentials.access_token),
            expiresAt: credentials.expiry_date
              ? new Date(credentials.expiry_date)
              : null,
            refreshToken: credentials.refresh_token
              ? encrypt(credentials.refresh_token)
              : integration.refreshToken,
          },
        });
        client.setCredentials(credentials);
      }
    } catch {
      // surface as ERROR upstream
      throw new Error("Failed to refresh Google access token");
    }
  }
  return client;
}

// ensure the import isn't tree-shaken if unused
export type { GoogleOAuthState };

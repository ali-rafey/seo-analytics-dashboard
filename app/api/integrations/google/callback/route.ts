import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import {
  authorizedClient,
  consumeOAuthState,
  exchangeCodeForTokens,
} from "@/lib/integrations/google/oauth";
import { listGA4Properties } from "@/lib/integrations/google/ga4";
import { listGSCSites } from "@/lib/integrations/google/gsc";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(
      new URL("/login", new URL(req.url).origin).toString(),
    );
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateToken = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    const desc = url.searchParams.get("error_description") ?? undefined;
    console.error(
      "[google-callback] Google returned error:",
      errorParam,
      desc ?? "",
    );
    return redirectWithError(url.origin, "/dashboard", errorParam, desc);
  }
  if (!code || !stateToken) {
    console.error("[google-callback] missing code or state in callback URL");
    return redirectWithError(url.origin, "/dashboard", "missing-code");
  }

  const state = await consumeOAuthState(stateToken);
  if (!state || state.userId !== session.user.id) {
    console.error(
      "[google-callback] state mismatch (token expired, replayed, or different user)",
    );
    return redirectWithError(url.origin, "/dashboard", "state-mismatch");
  }

  const product = await prisma.product.findFirst({
    where: { id: state.productId, userId: session.user.id },
    select: { id: true },
  });
  if (!product) {
    return redirectWithError(url.origin, "/dashboard", "product-not-found");
  }

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[google-callback] token exchange failed:", message);
    return redirectWithError(
      url.origin,
      state.returnTo,
      "token-exchange-failed",
      message,
    );
  }

  if (!tokens.access_token) {
    return redirectWithError(url.origin, state.returnTo, "no-access-token");
  }

  const oauth = authorizedClient({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiryDate: tokens.expiry_date ?? null,
  });

  const wantsGA4 = state.scopes.some((s) => s.includes("analytics"));
  const wantsGSC = state.scopes.some((s) => s.includes("webmasters"));

  // Fetch what's available for the user. If multiple, redirect to picker.
  // Catch and remember the failure reason so it ends up on the integration row
  // (instead of silently turning a 403/missing-scope into "no properties found").
  let ga4ListError: string | null = null;
  let gscListError: string | null = null;
  const [ga4Properties, gscSites] = await Promise.all([
    wantsGA4
      ? listGA4Properties(oauth).catch((e: unknown) => {
          ga4ListError = e instanceof Error ? e.message : String(e);
          console.error("[google-callback] listGA4Properties failed:", ga4ListError);
          return [];
        })
      : Promise.resolve([]),
    wantsGSC
      ? listGSCSites(oauth).catch((e: unknown) => {
          gscListError = e instanceof Error ? e.message : String(e);
          console.error("[google-callback] listGSCSites failed:", gscListError);
          return [];
        })
      : Promise.resolve([]),
  ]);

  const needsPicker =
    (wantsGA4 && ga4Properties.length !== 1) ||
    (wantsGSC && gscSites.length !== 1);

  // Stash credentials on the picker pre-selection: store as PENDING integrations.
  // If exactly one of each, finalize immediately.
  if (wantsGA4) {
    if (ga4Properties.length === 1) {
      await upsertGoogleIntegration({
        productId: product.id,
        provider: "GOOGLE_ANALYTICS",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiryDate: tokens.expiry_date ?? null,
        scope: state.scopes.join(" "),
        config: { propertyId: ga4Properties[0].propertyId, displayName: ga4Properties[0].displayName },
        status: "CONNECTED",
      });
    } else {
      await upsertGoogleIntegration({
        productId: product.id,
        provider: "GOOGLE_ANALYTICS",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiryDate: tokens.expiry_date ?? null,
        scope: state.scopes.join(" "),
        config: { pendingProperties: ga4Properties },
        status: ga4Properties.length === 0 ? "ERROR" : "DISCONNECTED",
        errorMessage:
          ga4Properties.length === 0
            ? ga4ListError
              ? `Couldn't list GA4 properties: ${ga4ListError}. Make sure the Google account you signed in with has access to a GA4 property.`
              : "No GA4 properties found on this Google account. Sign in with the Google account that owns/has access to your GA4 property, or create one at analytics.google.com."
            : null,
      });
    }
  }

  if (wantsGSC) {
    if (gscSites.length === 1) {
      await upsertGoogleIntegration({
        productId: product.id,
        provider: "GOOGLE_SEARCH_CONSOLE",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiryDate: tokens.expiry_date ?? null,
        scope: state.scopes.join(" "),
        config: { siteUrl: gscSites[0].siteUrl, permissionLevel: gscSites[0].permissionLevel },
        status: "CONNECTED",
      });
    } else {
      await upsertGoogleIntegration({
        productId: product.id,
        provider: "GOOGLE_SEARCH_CONSOLE",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiryDate: tokens.expiry_date ?? null,
        scope: state.scopes.join(" "),
        config: { pendingSites: gscSites },
        status: gscSites.length === 0 ? "ERROR" : "DISCONNECTED",
        errorMessage:
          gscSites.length === 0
            ? gscListError
              ? `Couldn't list Search Console sites: ${gscListError}.`
              : "No Search Console sites found on this Google account. Verify your site at search.google.com/search-console first, then reconnect."
            : null,
      });
    }
  }

  if (needsPicker) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/products/${product.id}/integrations/google/select`,
        url.origin,
      ).toString(),
    );
  }

  const successFlag = wantsGSC && wantsGA4 ? "google" : wantsGA4 ? "ga4" : "gsc";
  const target = new URL(state.returnTo, url.origin);
  target.searchParams.set("connected", successFlag);
  return NextResponse.redirect(target.toString());
}

async function upsertGoogleIntegration(args: {
  productId: string;
  provider: "GOOGLE_ANALYTICS" | "GOOGLE_SEARCH_CONSOLE";
  accessToken: string;
  refreshToken: string | null;
  expiryDate: number | null;
  scope: string;
  config: Record<string, unknown>;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR";
  errorMessage?: string | null;
}) {
  const config = args.config as Prisma.InputJsonValue;
  await prisma.integration.upsert({
    where: {
      productId_provider: { productId: args.productId, provider: args.provider },
    },
    update: {
      accessToken: encrypt(args.accessToken),
      refreshToken: args.refreshToken ? encrypt(args.refreshToken) : null,
      expiresAt: args.expiryDate ? new Date(args.expiryDate) : null,
      scope: args.scope,
      config,
      status: args.status,
      errorMessage: args.errorMessage ?? null,
      lastSyncedAt: args.status === "CONNECTED" ? new Date() : null,
    },
    create: {
      productId: args.productId,
      provider: args.provider,
      accessToken: encrypt(args.accessToken),
      refreshToken: args.refreshToken ? encrypt(args.refreshToken) : null,
      expiresAt: args.expiryDate ? new Date(args.expiryDate) : null,
      scope: args.scope,
      config,
      status: args.status,
      errorMessage: args.errorMessage ?? null,
      lastSyncedAt: args.status === "CONNECTED" ? new Date() : null,
    },
  });
}

function redirectWithError(
  origin: string,
  path: string,
  code: string,
  detail?: string,
) {
  const target = new URL(path.startsWith("/") ? path : `/${path}`, origin);
  target.searchParams.set("connect_error", code);
  if (detail) target.searchParams.set("detail", detail);
  return NextResponse.redirect(target.toString());
}

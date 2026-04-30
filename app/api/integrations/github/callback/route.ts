import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import {
  consumeOAuthState,
  exchangeCodeForToken,
} from "@/lib/integrations/github/oauth";
import { Octokit } from "@octokit/rest";
import { listAccessibleRepos } from "@/lib/integrations/github/client";

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
    return redirectWithError(url.origin, "/dashboard", errorParam);
  }
  if (!code || !stateToken) {
    return redirectWithError(url.origin, "/dashboard", "missing-code");
  }

  const state = await consumeOAuthState(stateToken);
  if (!state || state.userId !== session.user.id) {
    return redirectWithError(url.origin, "/dashboard", "state-mismatch");
  }

  const product = await prisma.product.findFirst({
    where: { id: state.productId, userId: session.user.id },
    select: { id: true },
  });
  if (!product) {
    return redirectWithError(url.origin, "/dashboard", "product-not-found");
  }

  let tokenInfo: { accessToken: string; scope: string };
  try {
    tokenInfo = await exchangeCodeForToken(code);
  } catch (err) {
    return redirectWithError(
      url.origin,
      state.returnTo,
      "token-exchange-failed",
      err instanceof Error ? err.message : undefined,
    );
  }

  // Fetch repos so the picker has something to show.
  let repos: Awaited<ReturnType<typeof listAccessibleRepos>> = [];
  try {
    repos = await listAccessibleRepos(
      new Octokit({ auth: tokenInfo.accessToken }),
    );
  } catch {
    // continue — picker will surface the error
  }

  const config = { pendingRepos: repos } as Prisma.InputJsonValue;

  await prisma.integration.upsert({
    where: {
      productId_provider: {
        productId: product.id,
        provider: "GITHUB",
      },
    },
    update: {
      accessToken: encrypt(tokenInfo.accessToken),
      refreshToken: null,
      expiresAt: null,
      scope: tokenInfo.scope,
      status: "DISCONNECTED",
      config,
      errorMessage: null,
      lastSyncedAt: null,
    },
    create: {
      productId: product.id,
      provider: "GITHUB",
      accessToken: encrypt(tokenInfo.accessToken),
      refreshToken: null,
      expiresAt: null,
      scope: tokenInfo.scope,
      status: "DISCONNECTED",
      config,
      errorMessage: null,
      lastSyncedAt: null,
    },
  });

  if (repos.length === 0) {
    return redirectWithError(
      url.origin,
      state.returnTo,
      "no-repos-accessible",
    );
  }

  return NextResponse.redirect(
    new URL(
      `/dashboard/products/${product.id}/integrations/github/select`,
      url.origin,
    ).toString(),
  );
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

import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  GOOGLE_SCOPES_GA4,
  GOOGLE_SCOPES_GSC,
  buildAuthUrl,
  createOAuthState,
} from "@/lib/integrations/google/oauth";
import { isProviderConfigured } from "@/lib/env";

const querySchema = z.object({
  productId: z.string().min(1),
  scope: z.enum(["ga4", "gsc", "all"]).default("ga4"),
  returnTo: z.string().optional(),
  // ?switchAccount=1 forces Google's account picker on the OAuth screen,
  // letting users recover from "wrong account had no GA4 property".
  switchAccount: z.enum(["0", "1"]).optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isProviderConfigured("google")) {
    return NextResponse.json(
      {
        error:
          "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
      },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    productId: url.searchParams.get("productId") ?? "",
    scope: url.searchParams.get("scope") ?? "ga4",
    returnTo: url.searchParams.get("returnTo") ?? undefined,
    switchAccount: url.searchParams.get("switchAccount") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const product = await prisma.product.findFirst({
    where: { id: parsed.data.productId, userId: session.user.id },
    select: { id: true },
  });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const scopes =
    parsed.data.scope === "ga4"
      ? GOOGLE_SCOPES_GA4
      : parsed.data.scope === "gsc"
      ? GOOGLE_SCOPES_GSC
      : [...GOOGLE_SCOPES_GA4, ...GOOGLE_SCOPES_GSC];

  const state = await createOAuthState({
    userId: session.user.id,
    productId: product.id,
    scopes,
    returnTo: parsed.data.returnTo ?? `/dashboard?product=${product.id}`,
  });

  let authUrl: string;
  try {
    authUrl = buildAuthUrl(state, scopes, {
      forceAccountChooser: parsed.data.switchAccount === "1",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to build auth URL";
    console.error("[google-connect] buildAuthUrl failed:", message);
    const target = new URL(
      `/dashboard?product=${product.id}`,
      new URL(req.url).origin,
    );
    target.searchParams.set("connect_error", "config");
    target.searchParams.set("detail", message);
    return NextResponse.redirect(target.toString());
  }
  return NextResponse.redirect(authUrl);
}

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

  return NextResponse.redirect(buildAuthUrl(state, scopes));
}

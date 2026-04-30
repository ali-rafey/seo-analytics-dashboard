import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildAuthUrl,
  createOAuthState,
  githubConfigured,
} from "@/lib/integrations/github/oauth";

const querySchema = z.object({
  productId: z.string().min(1),
  returnTo: z.string().optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!githubConfigured()) {
    return NextResponse.json(
      {
        error:
          "GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.",
      },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    productId: url.searchParams.get("productId") ?? "",
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

  const state = await createOAuthState({
    userId: session.user.id,
    productId: product.id,
    returnTo: parsed.data.returnTo ?? `/dashboard?product=${product.id}`,
  });

  return NextResponse.redirect(buildAuthUrl(state));
}

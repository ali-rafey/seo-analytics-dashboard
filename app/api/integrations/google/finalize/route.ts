import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  propertyId: z.string().optional(),
  siteUrl: z.string().url().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const productId = url.searchParams.get("productId");
  if (!productId) {
    return NextResponse.json({ error: "Missing productId" }, { status: 400 });
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, userId: session.user.id },
    include: { integrations: true },
  });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  if (parsed.data.propertyId) {
    const ga4 = product.integrations.find(
      (i) => i.provider === "GOOGLE_ANALYTICS",
    );
    if (!ga4) {
      return NextResponse.json(
        { error: "GA4 integration not found — start the connect flow again." },
        { status: 400 },
      );
    }
    await prisma.integration.update({
      where: { id: ga4.id },
      data: {
        config: { propertyId: parsed.data.propertyId },
        status: "CONNECTED",
        errorMessage: null,
        lastSyncedAt: new Date(),
      },
    });
  }

  if (parsed.data.siteUrl) {
    const gsc = product.integrations.find(
      (i) => i.provider === "GOOGLE_SEARCH_CONSOLE",
    );
    if (!gsc) {
      return NextResponse.json(
        { error: "GSC integration not found — start the connect flow again." },
        { status: 400 },
      );
    }
    await prisma.integration.update({
      where: { id: gsc.id },
      data: {
        config: { siteUrl: parsed.data.siteUrl },
        status: "CONNECTED",
        errorMessage: null,
        lastSyncedAt: new Date(),
      },
    });
  }

  return NextResponse.json({ ok: true });
}

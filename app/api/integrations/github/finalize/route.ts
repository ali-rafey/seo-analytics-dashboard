import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  fullName: z.string().min(1),
  defaultBranch: z.string().min(1),
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

  const integration = product.integrations.find(
    (i) => i.provider === "GITHUB",
  );
  if (!integration) {
    return NextResponse.json(
      { error: "GitHub OAuth has not been completed yet." },
      { status: 400 },
    );
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

  await prisma.integration.update({
    where: { id: integration.id },
    data: {
      config: {
        repoFullName: parsed.data.fullName,
        defaultBranch: parsed.data.defaultBranch,
      } as Prisma.InputJsonValue,
      status: "CONNECTED",
      errorMessage: null,
      lastSyncedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}

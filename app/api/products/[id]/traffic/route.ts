import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTrafficSnapshot } from "@/lib/data/traffic";
import { isPeriod } from "@/lib/data/period";

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const product = await prisma.product.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { id: true },
  });
  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const url = new URL(req.url);
  const periodParam = url.searchParams.get("period") ?? "7days";
  const period = isPeriod(periodParam) ? periodParam : "7days";
  const snapshot = await getTrafficSnapshot(product.id, period);
  return NextResponse.json(snapshot);
}

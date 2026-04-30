import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const integration = await prisma.integration.findFirst({
    where: {
      id: params.id,
      product: { userId: session.user.id },
    },
  });
  if (!integration) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.integration.delete({ where: { id: integration.id } });
  return NextResponse.json({ ok: true });
}

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { product?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const products = await prisma.product.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    include: {
      integrations: {
        select: { provider: true, status: true, lastSyncedAt: true },
      },
    },
  });

  const activeProductId =
    searchParams.product && products.some((p) => p.id === searchParams.product)
      ? searchParams.product
      : products[0]?.id ?? null;

  return (
    <DashboardShell
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        url: p.url,
        logoUrl: p.logoUrl,
        description: p.description,
        integrations: p.integrations,
      }))}
      activeProductId={activeProductId}
    />
  );
}

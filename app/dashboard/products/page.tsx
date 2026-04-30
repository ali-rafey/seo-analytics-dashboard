import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProductsTable } from "@/components/dashboard/products-table";

export const dynamic = "force-dynamic";

export default async function ProductsManagePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const products = await prisma.product.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    include: {
      integrations: {
        select: { provider: true, status: true },
      },
    },
  });

  return (
    <div className="mx-auto max-w-5xl p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Products</CardTitle>
            <CardDescription>
              Manage the products you&apos;re tracking analytics for.
            </CardDescription>
          </div>
          <Button asChild>
            <Link href="/dashboard/products/new">
              <Plus className="h-4 w-4" /> Add product
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <ProductsTable
            products={products.map((p) => ({
              id: p.id,
              name: p.name,
              url: p.url,
              logoUrl: p.logoUrl,
              description: p.description,
              createdAt: p.createdAt.toISOString(),
              integrationCount: p.integrations.length,
              connectedCount: p.integrations.filter(
                (i) => i.status === "CONNECTED",
              ).length,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}

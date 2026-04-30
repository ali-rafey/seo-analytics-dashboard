import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GoogleSelectionForm } from "@/components/dashboard/google-selection-form";
import type { GA4Property } from "@/lib/integrations/google/ga4";
import type { GSCSite } from "@/lib/integrations/google/gsc";

export default async function GoogleSelectPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const product = await prisma.product.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: { integrations: true },
  });
  if (!product) notFound();

  const ga4 = product.integrations.find((i) => i.provider === "GOOGLE_ANALYTICS");
  const gsc = product.integrations.find(
    (i) => i.provider === "GOOGLE_SEARCH_CONSOLE",
  );

  const ga4Pending = (ga4?.config as { pendingProperties?: GA4Property[] } | null)
    ?.pendingProperties;
  const gscPending = (gsc?.config as { pendingSites?: GSCSite[] } | null)
    ?.pendingSites;

  const needs =
    Boolean(ga4Pending && ga4Pending.length > 1) ||
    Boolean(gscPending && gscPending.length > 1);

  if (!needs) {
    redirect(`/dashboard?product=${product.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>Pick what to connect</CardTitle>
          <CardDescription>
            Your Google account has access to multiple resources. Pick which to
            link to <span className="font-medium">{product.name}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GoogleSelectionForm
            productId={product.id}
            ga4Properties={ga4Pending ?? []}
            gscSites={gscPending ?? []}
          />
        </CardContent>
      </Card>

      <div className="mt-4 text-center">
        <Button variant="ghost" asChild>
          <Link href={`/dashboard?product=${product.id}`}>Cancel</Link>
        </Button>
      </div>
    </div>
  );
}

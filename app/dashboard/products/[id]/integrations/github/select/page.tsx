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
import { GithubRepoPicker } from "@/components/dashboard/github-repo-picker";
import type { GitHubRepoSummary } from "@/lib/integrations/github/client";

export default async function GitHubSelectPage({
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

  const integration = product.integrations.find(
    (i) => i.provider === "GITHUB",
  );
  if (!integration) {
    redirect(`/dashboard?product=${product.id}`);
  }

  const pendingRepos = (integration.config as {
    pendingRepos?: GitHubRepoSummary[];
  } | null)?.pendingRepos ?? [];

  if (integration.status === "CONNECTED" && pendingRepos.length === 0) {
    redirect(`/dashboard?product=${product.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>Pick a repository to audit</CardTitle>
          <CardDescription>
            We&apos;ll scan the default branch&apos;s HTML, MD/MDX, and
            framework component files for SEO issues — missing meta tags,
            sitemap/robots, alt attributes, render-blocking scripts, JSON-LD,
            broken internal links, and deprecated practices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingRepos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No repositories were returned for this account. Re-run{" "}
              <Link
                href={`/api/integrations/github/connect?productId=${product.id}`}
                className="text-primary hover:underline"
              >
                Connect GitHub
              </Link>{" "}
              and grant access.
            </p>
          ) : (
            <GithubRepoPicker
              productId={product.id}
              repos={pendingRepos}
            />
          )}
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

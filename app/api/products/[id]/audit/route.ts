import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  checkRepoAccess,
  octokitFromIntegration,
} from "@/lib/integrations/github/client";
import { scanRepository } from "@/lib/integrations/github/scanner";
import type { AuditSeverity } from "@prisma/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _req: Request,
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

  const audit = await prisma.seoAudit.findFirst({
    where: { productId: product.id },
    orderBy: { ranAt: "desc" },
    include: {
      issues: { orderBy: [{ severity: "asc" }, { rule: "asc" }] },
    },
  });

  if (!audit) {
    return NextResponse.json({ audit: null });
  }
  return NextResponse.json({ audit });
}

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const product = await prisma.product.findFirst({
    where: { id: params.id, userId: session.user.id },
    include: {
      integrations: {
        where: { provider: "GITHUB" },
      },
    },
  });
  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const integration = product.integrations[0];
  if (!integration || integration.status !== "CONNECTED") {
    return NextResponse.json(
      { error: "GitHub is not connected for this product." },
      { status: 400 },
    );
  }

  const config = integration.config as {
    repoFullName?: string;
    defaultBranch?: string;
  } | null;
  if (!config?.repoFullName || !config.defaultBranch) {
    return NextResponse.json(
      { error: "GitHub integration is missing repo configuration." },
      { status: 400 },
    );
  }

  const [owner, repo] = config.repoFullName.split("/");
  if (!owner || !repo) {
    return NextResponse.json(
      { error: `Invalid repo full name: ${config.repoFullName}` },
      { status: 400 },
    );
  }

  const octokit = octokitFromIntegration(integration);

  // Pre-check repo access before kicking off the (potentially long) scan.
  // This catches revoked tokens, deleted repos, and lost collaborator access
  // up front with a clear, actionable error rather than a mid-scan crash.
  const access = await checkRepoAccess(octokit, owner, repo);
  if (!access.ok) {
    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        errorMessage: access.message,
        status: access.reason === "token-invalid" ? "DISCONNECTED" : "ERROR",
      },
    });
    return NextResponse.json(
      { error: access.message, reason: access.reason },
      { status: access.reason === "token-invalid" ? 401 : 403 },
    );
  }

  // Use the freshly-verified default branch in case the repo's default
  // branch was renamed since the user connected it.
  const defaultBranch = access.defaultBranch || config.defaultBranch;

  let result;
  try {
    result = await scanRepository({
      octokit,
      owner,
      repo,
      defaultBranch,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Audit failed";
    await prisma.integration.update({
      where: { id: integration.id },
      data: { errorMessage: message, status: "ERROR" },
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Persist audit + issues atomically.
  const audit = await prisma.$transaction(async (tx) => {
    const created = await tx.seoAudit.create({
      data: {
        productId: product.id,
        repoFullName: result.repoFullName,
        commitSha: result.commitSha,
        totalIssues: result.issues.length,
      },
    });
    if (result.issues.length > 0) {
      await tx.seoAuditIssue.createMany({
        data: result.issues.map((i) => ({
          auditId: created.id,
          rule: i.rule,
          severity: i.severity as AuditSeverity,
          filePath: i.filePath,
          lineNumber: i.lineNumber,
          message: i.message,
          suggestion: i.suggestion ?? null,
        })),
      });
    }
    return tx.seoAudit.findUnique({
      where: { id: created.id },
      include: {
        issues: { orderBy: [{ severity: "asc" }, { rule: "asc" }] },
      },
    });
  });

  await prisma.integration.update({
    where: { id: integration.id },
    data: { lastSyncedAt: new Date(), errorMessage: null },
  });

  return NextResponse.json({
    audit,
    meta: {
      filesScanned: result.filesScanned,
      totalFilesInRepo: result.totalFilesInRepo,
      truncated: result.truncated,
    },
  });
}

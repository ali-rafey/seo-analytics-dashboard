import { Octokit } from "@octokit/rest";
import { decrypt } from "@/lib/crypto";
import type { Integration } from "@prisma/client";

export function octokitFromIntegration(integration: Integration): Octokit {
  if (!integration.accessToken) {
    throw new Error("GitHub integration has no access token");
  }
  const accessToken = decrypt(integration.accessToken);
  return new Octokit({
    auth: accessToken,
    userAgent: "seo-analytics-dashboard/0.1",
  });
}

export type GitHubRepoSummary = {
  fullName: string;
  defaultBranch: string;
  private: boolean;
  htmlUrl: string;
  description: string | null;
  language: string | null;
  updatedAt: string | null;
};

export type RepoAccessCheck =
  | { ok: true; defaultBranch: string }
  | { ok: false; reason: "not-found" | "no-access" | "token-invalid" | "unknown"; message: string };

/**
 * Verify the token can actually read the target repo BEFORE we kick off a
 * scan. This catches:
 *   - Token revoked or scopes downgraded after initial connect
 *   - Repo deleted, made private, or transferred away
 *   - User removed from a collaborator list
 * Without this pre-check, the scanner would fail mid-traversal with a 404
 * or 403 and the user would see a generic 502 from the audit endpoint.
 */
export async function checkRepoAccess(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<RepoAccessCheck> {
  try {
    const { data } = await octokit.repos.get({ owner, repo });
    return { ok: true, defaultBranch: data.default_branch ?? "main" };
  } catch (err: unknown) {
    const status =
      typeof err === "object" && err !== null && "status" in err
        ? (err as { status: number }).status
        : null;
    const message =
      err instanceof Error ? err.message : "Unable to verify repo access";
    if (status === 404) {
      return {
        ok: false,
        reason: "not-found",
        message: `${owner}/${repo} no longer exists or your token can't see it (private repo + missing 'repo' scope, or repo deleted/transferred).`,
      };
    }
    if (status === 401) {
      return {
        ok: false,
        reason: "token-invalid",
        message: "GitHub token is invalid or revoked. Reconnect GitHub in the Codebase Audit tab.",
      };
    }
    if (status === 403) {
      return {
        ok: false,
        reason: "no-access",
        message: `Access to ${owner}/${repo} is forbidden. Your account may have lost collaborator access, or the org enforces SSO and the token isn't authorized.`,
      };
    }
    return { ok: false, reason: "unknown", message };
  }
}

/**
 * List repos accessible to the authorized user. Uses the authenticated-user
 * endpoint with `affiliation=owner,collaborator,organization_member` so the
 * picker shows everything the token can read.
 */
export async function listAccessibleRepos(
  octokit: Octokit,
): Promise<GitHubRepoSummary[]> {
  const out: GitHubRepoSummary[] = [];
  let page = 1;
  // Hard cap at 5 pages × 100 = 500 repos so we don't hang.
  while (page <= 5) {
    const res = await octokit.repos.listForAuthenticatedUser({
      per_page: 100,
      page,
      sort: "updated",
      affiliation: "owner,collaborator,organization_member",
    });
    for (const r of res.data) {
      out.push({
        fullName: r.full_name,
        defaultBranch: r.default_branch ?? "main",
        private: r.private,
        htmlUrl: r.html_url,
        description: r.description ?? null,
        language: r.language ?? null,
        updatedAt: r.updated_at ?? null,
      });
    }
    if (res.data.length < 100) break;
    page++;
  }
  return out;
}

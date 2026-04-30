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

import type { Octokit } from "@octokit/rest";

export type IssueSeverity = "INFO" | "WARN" | "ERROR";

export type ScanIssue = {
  rule: string;
  severity: IssueSeverity;
  filePath: string;
  lineNumber: number | null;
  message: string;
  suggestion?: string;
};

export type ScanResult = {
  repoFullName: string;
  defaultBranch: string;
  commitSha: string | null;
  filesScanned: number;
  totalFilesInRepo: number;
  truncated: boolean;
  startedAt: string;
  finishedAt: string;
  issues: ScanIssue[];
};

const HTML_EXTS = [".html", ".htm"];
const MARKDOWN_EXTS = [".md", ".mdx"];
const FRAMEWORK_EXTS = [
  ".tsx",
  ".jsx",
  ".vue",
  ".svelte",
  ".astro",
];
// Hard cap on files we fetch (and on bytes per file) so a huge repo can't
// stall the scan or blow our memory budget.
const MAX_FILES = 200;
const MAX_BYTES_PER_FILE = 256 * 1024; // 256 KB

export async function scanRepository(opts: {
  octokit: Octokit;
  owner: string;
  repo: string;
  defaultBranch: string;
}): Promise<ScanResult> {
  const { octokit, owner, repo, defaultBranch } = opts;
  const startedAt = new Date().toISOString();

  // 1) Resolve default-branch tip → tree.
  const branch = await octokit.repos.getBranch({
    owner,
    repo,
    branch: defaultBranch,
  });
  const commitSha = branch.data.commit.sha;
  const treeSha = branch.data.commit.commit.tree.sha;

  const treeRes = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: treeSha,
    recursive: "1",
  });
  const allEntries = (treeRes.data.tree ?? []).filter(
    (e) => e.type === "blob" && e.path,
  );
  const truncated = treeRes.data.truncated ?? false;

  // Build a path set for quick existence checks (sitemap, robots, broken links).
  const pathSet = new Set<string>(
    allEntries.map((e) => normalizePath(e.path!)),
  );

  // 2) Repo-level issues that don't need file content.
  const issues: ScanIssue[] = [];
  issues.push(...checkSitemap(pathSet));
  issues.push(...checkRobots(pathSet));

  // 3) Pick which files to scan.
  const candidates = allEntries
    .filter((e) => {
      const path = e.path ?? "";
      const lower = path.toLowerCase();
      // Exclude obvious build outputs and dependencies.
      if (
        lower.startsWith("node_modules/") ||
        lower.includes("/node_modules/") ||
        lower.startsWith(".next/") ||
        lower.includes("/.next/") ||
        lower.startsWith("dist/") ||
        lower.includes("/dist/") ||
        lower.startsWith("build/") ||
        lower.includes("/build/") ||
        lower.startsWith(".cache/")
      ) {
        return false;
      }
      const size = e.size ?? 0;
      if (size > MAX_BYTES_PER_FILE) return false;
      return (
        hasExt(path, HTML_EXTS) ||
        hasExt(path, MARKDOWN_EXTS) ||
        hasExt(path, FRAMEWORK_EXTS)
      );
    })
    // Prioritize HTML files, then framework component files, then markdown.
    .sort((a, b) => priority(a.path!) - priority(b.path!))
    .slice(0, MAX_FILES);

  // 4) Fetch + scan each candidate file.
  let filesScanned = 0;
  for (const entry of candidates) {
    const path = entry.path!;
    let content: string | null = null;
    try {
      content = await fetchBlob(octokit, owner, repo, entry.sha!);
    } catch {
      // Skip files we can't read — log internally but don't fail the audit.
      continue;
    }
    if (content === null) continue;
    filesScanned++;

    if (hasExt(path, HTML_EXTS)) {
      issues.push(...scanHtml(path, content, pathSet));
    } else if (hasExt(path, MARKDOWN_EXTS)) {
      issues.push(...scanMarkdown(path, content, pathSet));
    } else if (hasExt(path, FRAMEWORK_EXTS)) {
      issues.push(...scanFramework(path, content));
    }
  }

  return {
    repoFullName: `${owner}/${repo}`,
    defaultBranch,
    commitSha,
    filesScanned,
    totalFilesInRepo: allEntries.length,
    truncated,
    startedAt,
    finishedAt: new Date().toISOString(),
    issues,
  };
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function hasExt(p: string, exts: string[]): boolean {
  const lower = p.toLowerCase();
  return exts.some((e) => lower.endsWith(e));
}

function priority(p: string): number {
  if (hasExt(p, HTML_EXTS)) return 0;
  if (hasExt(p, [".astro"])) return 1;
  if (hasExt(p, [".tsx", ".jsx"])) return 2;
  if (hasExt(p, [".vue", ".svelte"])) return 3;
  return 4;
}

function normalizePath(p: string): string {
  return p.replace(/^\.?\//, "").toLowerCase();
}

async function fetchBlob(
  octokit: Octokit,
  owner: string,
  repo: string,
  sha: string,
): Promise<string | null> {
  const res = await octokit.git.getBlob({ owner, repo, file_sha: sha });
  if (res.data.encoding !== "base64") {
    return res.data.content ?? null;
  }
  // GitHub returns base64 with newlines — Buffer.from handles them.
  const buf = Buffer.from(res.data.content, "base64");
  if (buf.length > MAX_BYTES_PER_FILE) return null;
  // Skip files that look binary (NUL byte in the first 4 KB).
  const head = buf.subarray(0, Math.min(4096, buf.length));
  for (let i = 0; i < head.length; i++) {
    if (head[i] === 0) return null;
  }
  return buf.toString("utf8");
}

function lineOf(content: string, charIndex: number): number {
  let line = 1;
  for (let i = 0; i < charIndex && i < content.length; i++) {
    if (content[i] === "\n") line++;
  }
  return line;
}

// ─── repo-level rules ────────────────────────────────────────────────────────

function checkSitemap(paths: Set<string>): ScanIssue[] {
  const candidates = [
    "sitemap.xml",
    "public/sitemap.xml",
    "static/sitemap.xml",
    "src/public/sitemap.xml",
    "out/sitemap.xml",
  ];
  if (candidates.some((c) => paths.has(c))) return [];
  // Many frameworks generate sitemap dynamically. Soft-warn rather than error.
  return [
    {
      rule: "missing-sitemap",
      severity: "WARN",
      filePath: "/",
      lineNumber: null,
      message:
        "No sitemap.xml found in the repository's static asset directories.",
      suggestion:
        "Add a sitemap.xml to public/ (or your framework's static folder), or generate one at build time. Search engines use this to discover and prioritize URLs.",
    },
  ];
}

function checkRobots(paths: Set<string>): ScanIssue[] {
  const candidates = [
    "robots.txt",
    "public/robots.txt",
    "static/robots.txt",
    "src/public/robots.txt",
  ];
  if (candidates.some((c) => paths.has(c))) return [];
  return [
    {
      rule: "missing-robots",
      severity: "WARN",
      filePath: "/",
      lineNumber: null,
      message: "No robots.txt found in the repository's static asset directories.",
      suggestion:
        "Add a robots.txt to public/ that points crawlers at your sitemap and (optionally) disallows admin/staging routes.",
    },
  ];
}

// ─── HTML rules ──────────────────────────────────────────────────────────────

function scanHtml(
  path: string,
  content: string,
  paths: Set<string>,
): ScanIssue[] {
  const issues: ScanIssue[] = [];

  const headMatch = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(content);
  const head = headMatch?.[1] ?? "";
  const headStart = headMatch?.index ?? 0;

  // <title>
  if (!/<title[^>]*>[\s\S]*?<\/title>/i.test(head)) {
    issues.push({
      rule: "missing-title",
      severity: "ERROR",
      filePath: path,
      lineNumber: lineOf(content, headStart),
      message: "Missing <title> in <head>.",
      suggestion:
        "Add a unique, descriptive <title> for each page. Recommended length: 50–60 characters.",
    });
  }

  // meta description
  if (!/<meta\s+[^>]*name=["']description["']/i.test(head)) {
    issues.push({
      rule: "missing-meta-description",
      severity: "ERROR",
      filePath: path,
      lineNumber: lineOf(content, headStart),
      message: 'Missing <meta name="description"> in <head>.',
      suggestion:
        'Add <meta name="description" content="…"> with a 120–160 character summary of the page. Used as the SERP snippet.',
    });
  }

  // viewport (mobile-friendly)
  if (!/<meta\s+[^>]*name=["']viewport["']/i.test(head)) {
    issues.push({
      rule: "missing-viewport",
      severity: "ERROR",
      filePath: path,
      lineNumber: lineOf(content, headStart),
      message: 'Missing <meta name="viewport"> — page won\'t be mobile-friendly.',
      suggestion:
        'Add <meta name="viewport" content="width=device-width, initial-scale=1">.',
    });
  }

  // charset
  if (!/<meta\s+[^>]*charset=/i.test(head)) {
    issues.push({
      rule: "missing-charset",
      severity: "WARN",
      filePath: path,
      lineNumber: lineOf(content, headStart),
      message: "Missing <meta charset> declaration.",
      suggestion: 'Add <meta charset="utf-8"> as the first <meta> in <head>.',
    });
  }

  // canonical
  if (!/<link\s+[^>]*rel=["']canonical["']/i.test(head)) {
    issues.push({
      rule: "missing-canonical",
      severity: "WARN",
      filePath: path,
      lineNumber: lineOf(content, headStart),
      message: 'Missing <link rel="canonical">.',
      suggestion:
        'Add <link rel="canonical" href="…"> pointing to the preferred URL for this page to avoid duplicate-content issues.',
    });
  }

  // Open Graph: at least og:title + og:description recommended.
  const hasOgTitle = /<meta\s+[^>]*property=["']og:title["']/i.test(head);
  const hasOgDesc = /<meta\s+[^>]*property=["']og:description["']/i.test(head);
  const hasOgImage = /<meta\s+[^>]*property=["']og:image["']/i.test(head);
  if (!hasOgTitle || !hasOgDesc || !hasOgImage) {
    const missing: string[] = [];
    if (!hasOgTitle) missing.push("og:title");
    if (!hasOgDesc) missing.push("og:description");
    if (!hasOgImage) missing.push("og:image");
    issues.push({
      rule: "missing-og-tags",
      severity: "WARN",
      filePath: path,
      lineNumber: lineOf(content, headStart),
      message: `Missing Open Graph tags: ${missing.join(", ")}.`,
      suggestion:
        'Add <meta property="og:title" content="…"> and friends so links shared on social platforms have rich previews.',
    });
  }

  // Twitter card meta
  const hasTwitterCard =
    /<meta\s+[^>]*name=["']twitter:card["']/i.test(head);
  if (!hasTwitterCard) {
    issues.push({
      rule: "missing-twitter-tags",
      severity: "INFO",
      filePath: path,
      lineNumber: lineOf(content, headStart),
      message: 'Missing <meta name="twitter:card">.',
      suggestion:
        'Add <meta name="twitter:card" content="summary_large_image"> to control how X/Twitter renders shared links.',
    });
  }

  // Deprecated keywords
  const keywordsMatch = /<meta\s+[^>]*name=["']keywords["']/i.exec(content);
  if (keywordsMatch) {
    issues.push({
      rule: "deprecated-keywords-meta",
      severity: "INFO",
      filePath: path,
      lineNumber: lineOf(content, keywordsMatch.index),
      message: '<meta name="keywords"> is ignored by all major search engines.',
      suggestion:
        "Remove this tag — it has no SEO value and adds page weight.",
    });
  }

  // Deprecated meta refresh
  const refreshMatch = /<meta\s+[^>]*http-equiv=["']refresh["']/i.exec(content);
  if (refreshMatch) {
    issues.push({
      rule: "deprecated-meta-refresh",
      severity: "WARN",
      filePath: path,
      lineNumber: lineOf(content, refreshMatch.index),
      message: '<meta http-equiv="refresh"> hurts SEO and accessibility.',
      suggestion:
        "Use a server-side 301/302 redirect (or framework router redirect) instead.",
    });
  }

  // JSON-LD structured data
  if (!/<script[^>]+type=["']application\/ld\+json["']/i.test(content)) {
    issues.push({
      rule: "missing-structured-data",
      severity: "INFO",
      filePath: path,
      lineNumber: lineOf(content, headStart),
      message: "No JSON-LD structured data block found.",
      suggestion:
        'Add a <script type="application/ld+json"> block with schema.org markup (Article, Product, BreadcrumbList, etc.) to enable rich SERP results.',
    });
  }

  // Render-blocking scripts in <head> (no async/defer)
  const headScripts = head.matchAll(/<script\b([^>]*)>/gi);
  for (const m of headScripts) {
    const attrs = m[1] ?? "";
    // Skip type="application/ld+json" and type="module" (deferred by spec)
    if (/type=["']application\/ld\+json["']/i.test(attrs)) continue;
    if (/type=["']module["']/i.test(attrs)) continue;
    if (/\b(async|defer)\b/i.test(attrs)) continue;
    if (!/\bsrc=/i.test(attrs)) continue; // inline scripts are usually small
    const idx = headStart + (m.index ?? 0);
    issues.push({
      rule: "render-blocking-scripts",
      severity: "WARN",
      filePath: path,
      lineNumber: lineOf(content, idx),
      message:
        "Render-blocking <script src> in <head> without async/defer.",
      suggestion:
        "Add the defer attribute (or async if order doesn't matter) so the parser doesn't stall waiting for the script.",
    });
  }

  // <img> without alt
  const imgRegex = /<img\b[^>]*>/gi;
  for (const m of content.matchAll(imgRegex)) {
    const tag = m[0];
    if (/\balt\s*=/i.test(tag)) continue;
    issues.push({
      rule: "missing-alt-tags",
      severity: "WARN",
      filePath: path,
      lineNumber: lineOf(content, m.index ?? 0),
      message: "<img> without an alt attribute.",
      suggestion:
        'Add alt="…" describing the image. Use alt="" for purely decorative images so screen readers can skip them.',
    });
  }

  // Mixed content / non-https hardcoded asset URLs
  const httpAsset =
    /\b(?:src|href)\s*=\s*["'](http:\/\/[^"']+)["']/gi;
  for (const m of content.matchAll(httpAsset)) {
    const url = m[1] ?? "";
    if (url.includes("localhost") || url.includes("127.0.0.1")) continue;
    issues.push({
      rule: "non-https-asset",
      severity: "INFO",
      filePath: path,
      lineNumber: lineOf(content, m.index ?? 0),
      message: `Insecure http:// URL: ${url.slice(0, 80)}`,
      suggestion:
        "Use https:// (or protocol-relative URLs) to avoid mixed-content warnings on https-served pages.",
    });
  }

  // Broken internal links — best-effort: only flag local hrefs we can resolve.
  for (const issue of checkInternalLinks(path, content, paths)) {
    issues.push(issue);
  }

  return issues;
}

function checkInternalLinks(
  filePath: string,
  content: string,
  paths: Set<string>,
): ScanIssue[] {
  const issues: ScanIssue[] = [];
  const linkRegex = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi;
  for (const m of content.matchAll(linkRegex)) {
    const href = m[1] ?? "";
    if (!isLocalLink(href)) continue;
    const cleaned = href.split("#")[0]?.split("?")[0] ?? "";
    if (!cleaned) continue;
    // Resolve relative to the current file's directory.
    let resolved: string;
    if (cleaned.startsWith("/")) {
      resolved = cleaned.slice(1);
    } else {
      const dir = filePath.substring(0, filePath.lastIndexOf("/") + 1);
      resolved = simplifyPath(dir + cleaned);
    }
    resolved = resolved.toLowerCase();

    // Accept: exact match, or one of common index variants.
    const candidates = [
      resolved,
      `${resolved}.html`,
      `${resolved}.htm`,
      `${resolved}/index.html`,
      `${resolved}/index.htm`,
      resolved.endsWith("/")
        ? `${resolved}index.html`
        : `${resolved}/index.html`,
    ];
    if (candidates.some((c) => paths.has(c))) continue;

    issues.push({
      rule: "broken-internal-link",
      severity: "WARN",
      filePath,
      lineNumber: lineOf(content, m.index ?? 0),
      message: `Broken internal link: ${href}`,
      suggestion:
        "Make sure the target file exists in the repo, or update the href. Static-only check — links handled by your framework's router won't be flagged.",
    });
  }
  return issues;
}

function isLocalLink(href: string): boolean {
  if (!href) return false;
  if (href.startsWith("#")) return false;
  if (href.startsWith("mailto:") || href.startsWith("tel:")) return false;
  if (href.startsWith("javascript:")) return false;
  if (/^https?:\/\//i.test(href)) return false;
  if (href.startsWith("//")) return false;
  return true;
}

function simplifyPath(p: string): string {
  const parts: string[] = [];
  for (const segment of p.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") parts.pop();
    else parts.push(segment);
  }
  return parts.join("/");
}

// ─── Markdown rules ──────────────────────────────────────────────────────────

function scanMarkdown(
  path: string,
  content: string,
  paths: Set<string>,
): ScanIssue[] {
  const issues: ScanIssue[] = [];

  // Front matter check
  const fmMatch = /^---\s*\n([\s\S]*?)\n---/.exec(content);
  const fm = fmMatch?.[1] ?? "";
  if (!/(^|\n)\s*title\s*:/i.test(fm)) {
    issues.push({
      rule: "missing-title",
      severity: "WARN",
      filePath: path,
      lineNumber: 1,
      message: "Markdown file has no `title` in front matter.",
      suggestion:
        "Add a YAML front-matter block with `title:` so static-site generators can produce a proper <title>.",
    });
  }
  if (!/(^|\n)\s*description\s*:/i.test(fm)) {
    issues.push({
      rule: "missing-meta-description",
      severity: "INFO",
      filePath: path,
      lineNumber: 1,
      message: "Markdown file has no `description` in front matter.",
      suggestion:
        "Add `description:` (~150 chars) to front matter — most SSGs map it to <meta name=\"description\">.",
    });
  }

  // ![alt](url) — flag empty alt
  const imgMd = /!\[\]\(([^\s)]+)\)/g;
  for (const m of content.matchAll(imgMd)) {
    issues.push({
      rule: "missing-alt-tags",
      severity: "WARN",
      filePath: path,
      lineNumber: lineOf(content, m.index ?? 0),
      message: "Markdown image with empty alt text.",
      suggestion:
        "Use ![descriptive text](url) — screen readers and search crawlers rely on alt for image comprehension.",
    });
  }

  // Broken relative links
  const linkMd = /(?<!!)\[[^\]]*\]\(([^)\s]+)\)/g;
  for (const m of content.matchAll(linkMd)) {
    const href = m[1] ?? "";
    if (!isLocalLink(href)) continue;
    const cleaned = href.split("#")[0]?.split("?")[0] ?? "";
    if (!cleaned) continue;
    let resolved: string;
    if (cleaned.startsWith("/")) {
      resolved = cleaned.slice(1);
    } else {
      const dir = path.substring(0, path.lastIndexOf("/") + 1);
      resolved = simplifyPath(dir + cleaned);
    }
    resolved = resolved.toLowerCase();
    const candidates = [
      resolved,
      `${resolved}.md`,
      `${resolved}.mdx`,
      `${resolved}/index.md`,
      `${resolved}/readme.md`,
    ];
    if (candidates.some((c) => paths.has(c))) continue;
    issues.push({
      rule: "broken-internal-link",
      severity: "INFO",
      filePath: path,
      lineNumber: lineOf(content, m.index ?? 0),
      message: `Broken markdown link: ${href}`,
      suggestion:
        "Update the relative path or convert to an absolute URL if the target is outside the repo.",
    });
  }

  return issues;
}

// ─── Framework rules (TSX/JSX/Vue/Svelte/Astro) ──────────────────────────────

function scanFramework(path: string, content: string): ScanIssue[] {
  const issues: ScanIssue[] = [];

  // <img> usage that's plainly missing alt. (We can't always tell prop-based
  // alt at static-analysis time, so this is intentionally conservative.)
  const imgRegex = /<img\b([^>]*)\/?>/gi;
  for (const m of content.matchAll(imgRegex)) {
    const attrs = m[1] ?? "";
    if (/\balt\s*=/i.test(attrs)) continue;
    if (/\{\.\.\.[A-Za-z_]/.test(attrs)) continue; // spread props — we can't tell
    issues.push({
      rule: "missing-alt-tags",
      severity: "WARN",
      filePath: path,
      lineNumber: lineOf(content, m.index ?? 0),
      message: "<img> JSX element without an alt prop.",
      suggestion:
        'Add alt="…". For Next.js use <Image alt="…" /> from next/image; for purely decorative images pass alt="".',
    });
  }

  // Inline render-blocking <script src=…> in JSX (rare but happens).
  const scriptRegex = /<script\b([^>]*)\/?>/gi;
  for (const m of content.matchAll(scriptRegex)) {
    const attrs = m[1] ?? "";
    if (!/\bsrc\s*=/i.test(attrs)) continue;
    if (/type\s*=\s*["']application\/ld\+json["']/i.test(attrs)) continue;
    if (/type\s*=\s*["']module["']/i.test(attrs)) continue;
    if (/\b(async|defer)\b/i.test(attrs)) continue;
    issues.push({
      rule: "render-blocking-scripts",
      severity: "INFO",
      filePath: path,
      lineNumber: lineOf(content, m.index ?? 0),
      message:
        "<script src> in component without async/defer. (Frameworks usually handle this — verify whether it's actually rendered into <head>.)",
      suggestion:
        "Use next/script with strategy='afterInteractive' (Next.js), or add defer/async.",
    });
  }

  // Next.js App Router: pages without `metadata` export.
  const isNextAppPage = /\/(app|src\/app)\/.+\/(page|layout)\.(tsx|jsx)$/i.test(
    path,
  );
  if (isNextAppPage) {
    const hasMetadataExport =
      /export\s+(?:const|let|var)\s+metadata\b/.test(content) ||
      /export\s+async\s+function\s+generateMetadata\b/.test(content);
    if (!hasMetadataExport) {
      issues.push({
        rule: "missing-metadata-export",
        severity: "INFO",
        filePath: path,
        lineNumber: 1,
        message:
          "Next.js App Router page/layout without a metadata export.",
        suggestion:
          "Export a `metadata` object (or `generateMetadata` async function) so each page has unique title/description/og tags.",
      });
    }
  }

  return issues;
}

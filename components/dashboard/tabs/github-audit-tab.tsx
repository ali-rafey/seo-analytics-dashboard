"use client";

import { Github, Lock, Plug } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ProductSummary } from "@/lib/types";

/**
 * Coming-soon stub for the GitHub Codebase Audit tab.
 *
 * The full scanner (lib/integrations/github/scanner.ts) and OAuth flow
 * (app/api/integrations/github/*) are already implemented; only this UI is
 * intentionally deferred. We'll wire it back up after checkpoint 6.
 */
export function GithubAuditTab({ product }: { product: ProductSummary }) {
  void product;
  return (
    <div className="space-y-4">
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Github className="h-4 w-4" /> GitHub Codebase Audit
            </CardTitle>
            <Badge variant="outline">Coming soon</Badge>
          </div>
          <CardDescription>
            Connect a repository to scan its codebase for SEO issues — missing
            meta tags, sitemap/robots, alt attributes, render-blocking scripts,
            JSON-LD, deprecated practices, and broken internal links — each
            with file path, line number, and a fix suggestion.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border/40 bg-muted/20 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Status
            </p>
            <p className="text-sm text-muted-foreground">
              GitHub integration will be wired here. The OAuth flow and the
              scanner itself are already built and live in the codebase
              (
              <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                lib/integrations/github/scanner.ts
              </code>
              ); only this tab&apos;s display surface is pending.
            </p>
          </div>

          <Button disabled variant="outline" className="cursor-not-allowed">
            <Plug className="h-4 w-4" /> Connect GitHub
            <Lock className="ml-2 h-3 w-3 text-muted-foreground" />
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">What it&apos;ll detect</CardTitle>
          <CardDescription>
            The audit runs against the default branch and produces a per-file
            issue list.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            "Missing <title> in <head>",
            "Missing meta description",
            "Missing viewport / charset",
            "Missing canonical link",
            "Missing Open Graph + Twitter card tags",
            "<img> tags without alt",
            "Render-blocking <script> without async/defer",
            "Missing JSON-LD structured data",
            "Missing sitemap.xml / robots.txt",
            "Deprecated meta keywords / meta refresh",
            "Insecure http:// asset URLs",
            "Broken internal links",
          ].map((item) => (
            <div
              key={item}
              className="flex items-center gap-2 rounded-md border border-border/40 bg-card/40 px-3 py-2 text-sm text-muted-foreground"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
              {item}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Search, Lock, Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { GitHubRepoSummary } from "@/lib/integrations/github/client";

export function GithubRepoPicker({
  productId,
  repos,
}: {
  productId: string;
  repos: GitHubRepoSummary[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<GitHubRepoSummary | null>(
    repos[0] ?? null,
  );
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return repos;
    const q = query.trim().toLowerCase();
    return repos.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q),
    );
  }, [query, repos]);

  async function onConnect() {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/integrations/github/finalize?productId=${productId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: selected.fullName,
            defaultBranch: selected.defaultBranch,
          }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error("Could not connect repo", { description: data?.error });
        return;
      }
      toast.success("Repository connected");
      router.push(
        `/dashboard?product=${productId}&connected=github`,
      );
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search repositories…"
          className="pl-9"
        />
      </div>

      <div className="max-h-80 overflow-y-auto rounded-lg border border-border/60 scrollbar-thin">
        {filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No repositories match.
          </p>
        ) : (
          <ul className="divide-y divide-border/40">
            {filtered.map((r) => (
              <li key={r.fullName}>
                <button
                  type="button"
                  onClick={() => setSelected(r)}
                  className={cn(
                    "flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm transition-colors",
                    selected?.fullName === r.fullName
                      ? "bg-primary/10"
                      : "hover:bg-card/50",
                  )}
                >
                  {r.private ? (
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <Globe className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-medium">{r.fullName}</p>
                      <p className="shrink-0 text-[11px] text-muted-foreground">
                        {r.defaultBranch}
                      </p>
                    </div>
                    {r.description && (
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {r.description}
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {r.language ?? "—"}
                      {r.updatedAt && (
                        <span>
                          {" · updated "}
                          {new Date(r.updatedAt).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button
        onClick={onConnect}
        disabled={!selected || submitting}
        className="w-full"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Connect {selected?.fullName ?? "repository"}
      </Button>
    </div>
  );
}

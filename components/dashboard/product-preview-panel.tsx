"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Plus, Settings2, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProductSummary } from "@/lib/types";

export function ProductPreviewPanel({
  products,
  activeProduct,
}: {
  products: ProductSummary[];
  activeProduct: ProductSummary;
}) {
  const router = useRouter();

  // Detect "iframe loaded but blocked" — listen for window load + a sanity timeout
  const [embedBlocked, setEmbedBlocked] = useState<string | null>(null);
  const checkedUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (checkedUrlRef.current === activeProduct.url) return;
    checkedUrlRef.current = activeProduct.url;
    setEmbedBlocked(null);
    const ctrl = new AbortController();
    fetch("/api/products/check-embeddable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: activeProduct.url }),
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) {
          setEmbedBlocked(humanizeReason(data.reason, data.detail));
        }
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [activeProduct.url]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border/40 p-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto scrollbar-thin">
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => router.push(`/dashboard?product=${p.id}`)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors",
                p.id === activeProduct.id
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-border/60 bg-card/40 text-muted-foreground hover:text-foreground",
              )}
            >
              {p.logoUrl ? (
                <Image
                  src={p.logoUrl}
                  alt=""
                  width={16}
                  height={16}
                  className="h-4 w-4 rounded-sm object-cover"
                  unoptimized
                />
              ) : (
                <span className="grid h-4 w-4 place-items-center rounded-sm bg-muted text-[9px] font-bold uppercase">
                  {p.name.slice(0, 1)}
                </span>
              )}
              <span className="max-w-[120px] truncate font-medium">
                {p.name}
              </span>
            </button>
          ))}
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={() => router.push("/dashboard/products/new")}
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button asChild size="icon" variant="ghost" aria-label="Manage products">
            <Link href="/dashboard/products">
              <Settings2 className="h-4 w-4" />
            </Link>
          </Button>
          <a
            href={activeProduct.url}
            target="_blank"
            rel="noreferrer"
            className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Open in new tab"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden bg-black/40">
        <iframe
          key={activeProduct.id}
          src={activeProduct.url}
          title={activeProduct.name}
          className="h-full w-full border-0"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          referrerPolicy="no-referrer"
        />

        {embedBlocked && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/70 backdrop-blur-sm">
            <div className="pointer-events-auto mx-4 max-w-md rounded-lg border border-amber-500/30 bg-card/90 p-4 text-sm shadow-2xl">
              <div className="mb-2 flex items-center gap-2 text-amber-300">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-semibold">Live preview blocked</span>
              </div>
              <p className="text-muted-foreground">{embedBlocked}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                The dashboard tabs still work normally — only the embedded
                preview is affected. You can{" "}
                <a
                  href={activeProduct.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  open the site in a new tab
                </a>
                .
              </p>
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
          <div className="pointer-events-auto flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {activeProduct.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {activeProduct.url}
              </p>
            </div>
            {activeProduct.description && (
              <p className="hidden max-w-[60%] truncate text-xs text-muted-foreground md:block">
                {activeProduct.description}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function humanizeReason(reason: string, detail?: string): string {
  switch (reason) {
    case "x-frame-options-deny":
      return "This site sends X-Frame-Options: DENY, which prevents any iframe embedding.";
    case "x-frame-options-sameorigin":
      return "This site only allows iframes from its own origin (X-Frame-Options: SAMEORIGIN).";
    case "x-frame-options-allow-from":
      return "This site uses X-Frame-Options: ALLOW-FROM and restricts which origins can embed it.";
    case "csp-frame-ancestors":
      return `This site's Content-Security-Policy blocks embedding here (${detail ?? "frame-ancestors"}).`;
    case "fetch-failed":
      return `We couldn't reach the URL${detail ? `: ${detail}` : ""}.`;
    case "not-https":
      return "URL must use http or https.";
    default:
      return reason;
  }
}

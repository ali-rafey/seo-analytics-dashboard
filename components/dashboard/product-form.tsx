"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type EmbedStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "ok" }
  | { state: "blocked"; reason: string };

export type ProductFormValues = {
  name: string;
  url: string;
  logoUrl: string;
  description: string;
};

export function ProductForm({
  mode,
  productId,
  initial,
}: {
  mode: "create" | "edit";
  productId?: string;
  initial?: Partial<ProductFormValues>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ProductFormValues>({
    name: initial?.name ?? "",
    url: initial?.url ?? "",
    logoUrl: initial?.logoUrl ?? "",
    description: initial?.description ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [embed, setEmbed] = useState<EmbedStatus>({ state: "idle" });

  // Debounced embed check on URL change
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const url = values.url.trim();
    if (!url) {
      setEmbed({ state: "idle" });
      return;
    }
    try {
      new URL(url);
    } catch {
      setEmbed({ state: "idle" });
      return;
    }
    setEmbed({ state: "checking" });
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/products/check-embeddable", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const data = await res.json();
        if (data.ok) setEmbed({ state: "ok" });
        else
          setEmbed({
            state: "blocked",
            reason: humanizeReason(data.reason, data.detail),
          });
      } catch {
        setEmbed({ state: "idle" });
      }
    }, 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [values.url]);

  function update<K extends keyof ProductFormValues>(
    key: K,
    value: ProductFormValues[K],
  ) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: values.name.trim(),
        url: values.url.trim(),
        logoUrl: values.logoUrl.trim() || undefined,
        description: values.description.trim() || undefined,
      };
      const url = mode === "create" ? "/api/products" : `/api/products/${productId}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(
          mode === "create" ? "Could not create product" : "Could not save changes",
          {
            description:
              data?.issues?.fieldErrors
                ? Object.values(data.issues.fieldErrors).flat().join(", ")
                : data?.error,
          },
        );
        return;
      }
      const data = await res.json();
      toast.success(mode === "create" ? "Product created" : "Saved");
      router.push(`/dashboard?product=${data.product.id}`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>
          {mode === "create" ? "Add a product" : "Edit product"}
        </CardTitle>
        <CardDescription>
          The product URL is loaded into the live preview pane and used as the
          default property identifier across integrations.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              required
              maxLength={80}
              value={values.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Acme Marketing Site"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">URL</Label>
            <Input
              id="url"
              type="url"
              required
              value={values.url}
              onChange={(e) => update("url", e.target.value)}
              placeholder="https://example.com"
            />
            <EmbedStatusLine status={embed} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="logoUrl">Logo URL (optional)</Label>
            <Input
              id="logoUrl"
              type="url"
              value={values.logoUrl}
              onChange={(e) => update("logoUrl", e.target.value)}
              placeholder="https://example.com/favicon.png"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              maxLength={500}
              value={values.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="What does this product do?"
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "create" ? "Create product" : "Save changes"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function EmbedStatusLine({ status }: { status: EmbedStatus }) {
  if (status.state === "idle") return null;
  if (status.state === "checking") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Checking iframe
        embeddability…
      </p>
    );
  }
  if (status.state === "ok") {
    return (
      <p className="flex items-center gap-1.5 text-xs text-emerald-300">
        <ShieldCheck className="h-3 w-3" /> URL is embeddable in the live
        preview.
      </p>
    );
  }
  return (
    <p className="flex items-start gap-1.5 text-xs text-amber-300">
      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
      <span>
        Live preview will be blocked: {status.reason}. You can still save the
        product and use the dashboard tabs.
      </span>
    </p>
  );
}

function humanizeReason(reason: string, detail?: string): string {
  switch (reason) {
    case "x-frame-options-deny":
      return "the site sets X-Frame-Options: DENY";
    case "x-frame-options-sameorigin":
      return "the site only allows embedding from its own origin (X-Frame-Options: SAMEORIGIN)";
    case "x-frame-options-allow-from":
      return "the site uses X-Frame-Options: ALLOW-FROM, restricting embed origin";
    case "csp-frame-ancestors":
      return `the site's Content-Security-Policy blocks embedding (${detail ?? "frame-ancestors"})`;
    case "fetch-failed":
      return `we couldn't reach the URL${detail ? ` (${detail})` : ""}`;
    case "not-https":
      return "URL must use http or https";
    default:
      return reason;
  }
}

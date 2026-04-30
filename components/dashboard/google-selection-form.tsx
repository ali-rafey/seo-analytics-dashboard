"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { GA4Property } from "@/lib/integrations/google/ga4";
import type { GSCSite } from "@/lib/integrations/google/gsc";

export function GoogleSelectionForm({
  productId,
  ga4Properties,
  gscSites,
}: {
  productId: string;
  ga4Properties: GA4Property[];
  gscSites: GSCSite[];
}) {
  const router = useRouter();
  const [propertyId, setPropertyId] = useState(
    ga4Properties[0]?.propertyId ?? "",
  );
  const [siteUrl, setSiteUrl] = useState(gscSites[0]?.siteUrl ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/integrations/google/finalize?productId=${productId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyId: ga4Properties.length ? propertyId : undefined,
            siteUrl: gscSites.length ? siteUrl : undefined,
          }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error("Could not finalize", { description: data?.error });
        return;
      }
      toast.success("Connected");
      router.push(`/dashboard?product=${productId}&connected=google`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {ga4Properties.length > 0 && (
        <div className="space-y-2">
          <Label>Google Analytics 4 property</Label>
          <select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background/40 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {ga4Properties.map((p) => (
              <option key={p.propertyId} value={p.propertyId}>
                {p.displayName} {p.parent ? `· ${p.parent}` : ""} (id {p.propertyId})
              </option>
            ))}
          </select>
        </div>
      )}

      {gscSites.length > 0 && (
        <div className="space-y-2">
          <Label>Search Console site</Label>
          <select
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background/40 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {gscSites.map((s) => (
              <option key={s.siteUrl} value={s.siteUrl}>
                {s.siteUrl} ({s.permissionLevel})
              </option>
            ))}
          </select>
        </div>
      )}

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Connect
      </Button>
    </form>
  );
}

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plug } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Provider = "google" | "github" | "meta" | "linkedin";

const PROVIDER_LABEL: Record<Provider, string> = {
  google: "Google",
  github: "GitHub",
  meta: "Meta",
  linkedin: "LinkedIn",
};

export function IntegrationRequired({
  productId,
  provider,
  scope,
  title,
  description,
  status,
  pendingReview,
  errorMessage,
}: {
  productId: string;
  provider: Provider;
  scope?: "ga4" | "gsc" | "all";
  title: string;
  description: string;
  status?: "DISCONNECTED" | "PENDING_REVIEW" | "CONNECTED" | "ERROR";
  pendingReview?: boolean;
  errorMessage?: string | null;
}) {
  const [connecting, setConnecting] = useState(false);

  function onConnect() {
    setConnecting(true);
    if (provider === "google") {
      const params = new URLSearchParams({ productId });
      if (scope) params.set("scope", scope);
      window.location.href = `/api/integrations/google/connect?${params.toString()}`;
      return;
    }
    if (provider === "github") {
      window.location.href = `/api/integrations/github/connect?productId=${productId}`;
      return;
    }
    setConnecting(false);
    toast.info(`${PROVIDER_LABEL[provider]} integration is pending app review.`);
  }

  if (pendingReview) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{title}</CardTitle>
            <Badge variant="warning">Pending app review</Badge>
          </div>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {PROVIDER_LABEL[provider]} requires an approved app + business
          verification before its analytics API can be used. Until that&apos;s
          complete, this card stays empty rather than showing fabricated
          numbers. Configure {PROVIDER_LABEL[provider]} credentials in{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">.env</code> and
          submit your app for review — see <code>README.md</code> for the
          exact steps.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-dashed">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          {status && <Badge variant="outline">{status.toLowerCase()}</Badge>}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        {errorMessage && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
            {errorMessage}
          </p>
        )}
        <Button onClick={onConnect} disabled={connecting}>
          {connecting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plug className="h-4 w-4" />
          )}
          Connect {PROVIDER_LABEL[provider]}
        </Button>
      </CardContent>
    </Card>
  );
}

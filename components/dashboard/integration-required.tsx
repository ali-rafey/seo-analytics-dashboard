"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plug, RefreshCw } from "lucide-react";

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

/**
 * Heuristic: detect the "Google account had no GA4 property" failure mode so
 * we can show a friendly retry message instead of a raw technical error.
 * All other errors are also smoothed over for non-technical users — the raw
 * `errorMessage` is logged to the console for debugging but never shown.
 */
function isNoGa4PropertyError(errorMessage: string | null | undefined): boolean {
  if (!errorMessage) return false;
  const m = errorMessage.toLowerCase();
  return (
    m.includes("no ga4 properties") ||
    m.includes("no analytics propert") ||
    m.includes("couldn't list ga4 properties") ||
    m.includes("no search console sites") ||
    m.includes("couldn't list search console")
  );
}

export function IntegrationRequired({
  productId,
  // productUrl kept in the signature for backwards compatibility with the
  // tabs that pass it; no longer used inside, since the elaborate setup guide
  // was removed in favor of a simple "make sure you have GA set up" message.
  productUrl: _productUrl,
  provider,
  scope,
  title,
  description,
  status,
  pendingReview,
  errorMessage,
}: {
  productId: string;
  productUrl?: string;
  provider: Provider;
  scope?: "ga4" | "gsc" | "all";
  title: string;
  description: string;
  status?: "DISCONNECTED" | "PENDING_REVIEW" | "CONNECTED" | "ERROR";
  pendingReview?: boolean;
  errorMessage?: string | null;
}) {
  const [connecting, setConnecting] = useState(false);

  // Log raw error for debugging without showing it to the user.
  if (errorMessage && status === "ERROR") {
    if (typeof window !== "undefined") {
      console.warn("[integration]", provider, scope, errorMessage);
    }
  }

  const isGoogle = provider === "google";
  const inErrorState = status === "ERROR";
  const isFriendlyRetry = isGoogle && inErrorState && isNoGa4PropertyError(errorMessage);

  function onConnect(opts: { switchAccount?: boolean } = {}) {
    setConnecting(true);
    if (provider === "google") {
      const params = new URLSearchParams({ productId });
      if (scope) params.set("scope", scope);
      // After an error, show Google's account picker so the user can pick
      // a different account if that's the cause. On a first-time connect
      // we let Google use its default behavior — fewer clicks.
      if (opts.switchAccount || inErrorState) params.set("switchAccount", "1");
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
          numbers.
        </CardContent>
      </Card>
    );
  }

  // Friendly retry state — shown after a failed Google connect attempt.
  // Deliberately minimal: one short sentence, one button. No technical
  // jargon, no setup walkthrough, no error codes — non-technical users
  // should never feel like the app is broken.
  if (isFriendlyRetry) {
    const isGsc = scope === "gsc";
    const productLabel = isGsc ? "Google Search Console" : "Google Analytics";
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            Please make sure you have {productLabel} set up for your website,
            then try again.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => onConnect({ switchAccount: true })} disabled={connecting}>
            {connecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Default state — first-time connect or any non-friendly error. Identical
  // to the first-time view (no error badge, no error text) so users see one
  // consistent screen: a button that says "Connect Google".
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={() => onConnect()} disabled={connecting}>
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

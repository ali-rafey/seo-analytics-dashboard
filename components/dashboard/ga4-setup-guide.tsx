"use client";

import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  UserCog,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Friendly recovery UI shown when a user connects Google but the account they
 * picked has no GA4 property visible. Three escape hatches, in order of
 * likelihood:
 *
 *   1. Try a different Google account (most common — they signed in with
 *      personal Gmail instead of the work account that owns GA4).
 *   2. Step-by-step "create a GA4 property" walkthrough for users who genuinely
 *      don't have one yet.
 *   3. Plain "Try again" — also handles the case where they just added access
 *      and want to retry without the picker.
 */
export function Ga4SetupGuide({
  productId,
  productUrl,
}: {
  productId: string;
  productUrl: string;
}) {
  const [busyAction, setBusyAction] = useState<
    "switch" | "retry" | null
  >(null);

  function go(switchAccount: boolean) {
    setBusyAction(switchAccount ? "switch" : "retry");
    const params = new URLSearchParams({ productId, scope: "ga4" });
    if (switchAccount) params.set("switchAccount", "1");
    window.location.href = `/api/integrations/google/connect?${params.toString()}`;
  }

  return (
    <Card className="border-amber-500/30 bg-amber-500/[0.04]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          We couldn&apos;t find a Google Analytics property
        </CardTitle>
        <CardDescription>
          The Google account you signed in with doesn&apos;t have access to a
          Google Analytics 4 property yet. Pick the option below that matches
          your situation — most people just need to switch accounts.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Option A — switch accounts */}
        <div className="rounded-lg border border-border/60 bg-card/60 p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">
              A
            </div>
            <div className="flex-1 space-y-2">
              <p className="font-semibold">
                I have GA4 set up — just on a different Google account
              </p>
              <p className="text-sm text-muted-foreground">
                Sign in again and pick the Google account that owns or has
                access to your Analytics property (often a work email, not
                personal Gmail).
              </p>
              <Button
                size="sm"
                onClick={() => go(true)}
                disabled={busyAction !== null}
              >
                {busyAction === "switch" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserCog className="h-4 w-4" />
                )}
                Try a different Google account
              </Button>
            </div>
          </div>
        </div>

        {/* Option B — create GA4 from scratch */}
        <div className="rounded-lg border border-border/60 bg-card/60 p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">
              B
            </div>
            <div className="flex-1 space-y-3">
              <p className="font-semibold">
                I don&apos;t have Google Analytics yet — set me up
              </p>
              <p className="text-sm text-muted-foreground">
                It takes about 3 minutes. Open Google Analytics in a new tab
                and follow these steps:
              </p>
              <ol className="space-y-2 text-sm">
                <Step n={1}>
                  Go to{" "}
                  <a
                    href="https://analytics.google.com/analytics/web/?authuser=0#/provision/SignUp"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    analytics.google.com
                    <ExternalLink className="h-3 w-3" />
                  </a>{" "}
                  and click <strong>Start measuring</strong>.
                </Step>
                <Step n={2}>
                  Create an <strong>Account</strong> (e.g. your company name),
                  then a <strong>Property</strong> for{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">
                    {prettyHost(productUrl)}
                  </code>
                  .
                </Step>
                <Step n={3}>
                  When asked to set up data collection, choose <strong>Web</strong>{" "}
                  and add{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">
                    {productUrl}
                  </code>{" "}
                  as the data stream URL.
                </Step>
                <Step n={4}>
                  Skip the Google Tag setup if you want — you can install it
                  later. The property exists as soon as the data stream is
                  created.
                </Step>
                <Step n={5}>
                  Come back here and click{" "}
                  <strong>I&apos;ve created my GA4 property</strong> below.
                </Step>
              </ol>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  asChild
                  className="border-primary/40"
                >
                  <a
                    href="https://analytics.google.com/analytics/web/?authuser=0#/provision/SignUp"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open Google Analytics
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
                <Button
                  size="sm"
                  onClick={() => go(false)}
                  disabled={busyAction !== null}
                >
                  {busyAction === "retry" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  I&apos;ve created my GA4 property
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Option C — plain retry */}
        <div className="flex items-center justify-between rounded-lg border border-dashed border-border/60 bg-card/40 px-4 py-3 text-sm">
          <div>
            <p className="font-medium">Just want to retry the same account?</p>
            <p className="text-xs text-muted-foreground">
              Useful if someone just granted you access in Analytics.
            </p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => go(false)}
            disabled={busyAction !== null}
          >
            {busyAction === "retry" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Try again
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/10 text-[10px] font-bold text-primary">
        {n}
      </span>
      <span className="text-muted-foreground">{children}</span>
    </li>
  );
}

function prettyHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

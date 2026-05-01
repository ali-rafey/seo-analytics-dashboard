"use client";

import { useMemo } from "react";
import { Activity, Clock, Info } from "lucide-react";

import { useSSE } from "@/hooks/use-sse";
import { MetricCard } from "@/components/dashboard/metric-card";
import { IntegrationRequired } from "@/components/dashboard/integration-required";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ProductSummary } from "@/lib/types";
import type { OverviewSnapshot } from "@/lib/data/overview";

export function OverviewTab({ product }: { product: ProductSummary }) {
  const ga4 = product.integrations.find((i) => i.provider === "GOOGLE_ANALYTICS");
  const ga4Connected = ga4?.status === "CONNECTED";

  const { data, status, lastUpdate } = useSSE<{ snapshot: OverviewSnapshot }>(
    ga4Connected ? `/api/stream/${product.id}/overview` : null,
    ["snapshot"],
  );

  const snapshot = data.snapshot;
  const realtime = snapshot?.ga4.realtime;
  const today = snapshot?.ga4.today;

  const sinceUpdate = useMemo(() => {
    if (!lastUpdate) return null;
    return Math.max(0, Math.floor((Date.now() - lastUpdate) / 1000));
  }, [lastUpdate]);

  if (!ga4Connected) {
    return (
      <IntegrationRequired
        productId={product.id}
        provider="google"
        scope="ga4"
        title="Connect Google Analytics 4"
        description="The Overview tab streams live active visitors and today's session metrics from your GA4 property. No data is shown until you connect."
        status={ga4?.status}
        errorMessage={ga4?.errorMessage ?? null}
      />
    );
  }

  if (snapshot?.ga4.error) {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardHeader>
          <CardTitle>Google Analytics error</CardTitle>
          <CardDescription>{snapshot.ga4.error}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          You may need to reconnect Google Analytics — your refresh token may
          have been revoked, or the property is no longer accessible.
        </CardContent>
      </Card>
    );
  }

  const loading = !snapshot;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Overview</h2>
          <p
            className="flex items-center gap-1 text-xs text-muted-foreground"
            title="The dashboard polls GA4 every 5 seconds, but GA4's Realtime API itself has a 30–60 second ingestion lag from the moment a user fires an event to when it appears in the API. 'Live' means as fresh as GA4 publicly exposes."
          >
            Live from GA4 property{" "}
            <code className="rounded bg-muted px-1 py-0.5">
              {snapshot?.ga4.propertyId ?? "—"}
            </code>
            . Auto-refreshes every 5 seconds.
            <Info className="h-3 w-3 cursor-help" />
          </p>
        </div>
        <StreamStatus status={status} sinceUpdate={sinceUpdate} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Active visitors"
          value={realtime?.activeUsers ?? null}
          loading={loading}
          pulse
          accent="green"
          hint="Right now"
        />
        <MetricCard
          label="Sessions today"
          value={today?.sessions ?? null}
          loading={loading}
          accent="cyan"
        />
        <MetricCard
          label="Pageviews"
          value={today?.pageviews ?? null}
          loading={loading}
        />
        <MetricCard
          label="Bounce rate"
          value={today?.bounceRate ?? null}
          format="percent"
          loading={loading}
          accent="amber"
          hint="Today"
        />
        <MetricCard
          label="Avg session"
          value={today?.avgSessionDuration ?? null}
          format="duration"
          loading={loading}
          accent="violet"
        />
        <MetricCard
          label="Total users"
          value={today?.totalUsers ?? null}
          loading={loading}
        />
        <MetricCard
          label="New users"
          value={today?.newUsers ?? null}
          loading={loading}
          accent="cyan"
        />
        <MetricCard
          label="Returning users"
          value={today?.returningUsers ?? null}
          loading={loading}
          accent="pink"
        />
      </div>

      {realtime && realtime.byCountry.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Active visitors by country</CardTitle>
            <CardDescription>Realtime, last 30 minutes</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {realtime.byCountry.slice(0, 10).map((row) => {
                const pct =
                  realtime.activeUsers > 0
                    ? row.users / realtime.activeUsers
                    : 0;
                return (
                  <li
                    key={row.country}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="w-24 shrink-0 truncate text-muted-foreground">
                      {row.country}
                    </span>
                    <div className="relative flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-1.5 rounded-full bg-neon-cyan"
                        style={{ width: `${Math.max(2, pct * 100)}%` }}
                      />
                    </div>
                    <span className="w-10 text-right tabular-nums">
                      {row.users}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StreamStatus({
  status,
  sinceUpdate,
}: {
  status: string;
  sinceUpdate: number | null;
}) {
  const ok = status === "open";
  return (
    <div
      className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/50 px-2.5 py-1 text-xs text-muted-foreground"
      title={`SSE stream: ${status}`}
    >
      <span className="relative flex h-2 w-2">
        {ok && (
          <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-neon-green opacity-75" />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${
            ok ? "bg-neon-green" : "bg-amber-400"
          }`}
        />
      </span>
      {ok ? (
        <span className="flex items-center gap-1">
          <Activity className="h-3 w-3" /> Live
          {sinceUpdate !== null && (
            <span className="text-muted-foreground/70">
              · <Clock className="-mt-0.5 inline h-3 w-3" /> {sinceUpdate}s ago
            </span>
          )}
        </span>
      ) : (
        <span>{status}</span>
      )}
    </div>
  );
}

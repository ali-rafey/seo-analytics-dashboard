"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, RefreshCw } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Doughnut, type DoughnutDatum } from "@/components/charts/doughnut";
import { paletteFor } from "@/components/charts/colors";
import { IntegrationRequired } from "@/components/dashboard/integration-required";
import { PeriodToggle } from "@/components/dashboard/period-toggle";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Badge } from "@/components/ui/badge";
import type { Period } from "@/lib/data/period";
import type { TrafficSnapshot } from "@/lib/data/traffic";
import type { ProductSummary } from "@/lib/types";
import { formatNumber, formatPercent } from "@/lib/utils";

export function TrafficSourcesTab({ product }: { product: ProductSummary }) {
  const ga4 = product.integrations.find(
    (i) => i.provider === "GOOGLE_ANALYTICS",
  );
  const ga4Connected = ga4?.status === "CONNECTED";

  const [period, setPeriod] = useState<Period>("7days");
  const [data, setData] = useState<TrafficSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ga4Connected) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/products/${product.id}/traffic?period=${period}`, {
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<TrafficSnapshot>;
      })
      .then((snap) => {
        setData(snap);
        setLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load");
        setLoading(false);
      });
    return () => controller.abort();
  }, [product.id, period, ga4Connected]);

  if (!ga4Connected) {
    return (
      <IntegrationRequired
        productId={product.id}
        provider="google"
        scope="ga4"
        title="Connect Google Analytics 4"
        description="Traffic sources, channel grouping, and conversion rates come from your GA4 property."
        status={ga4?.status}
        errorMessage={ga4?.errorMessage ?? null}
      />
    );
  }

  const ga = data?.ga4;
  const channels = ga?.channels ?? [];
  const totalSessions = ga?.totalSessions ?? 0;

  const doughnutData: DoughnutDatum[] = channels.map((c) => ({
    name: c.channel,
    value: c.sessions,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Traffic sources</h2>
          <p className="text-xs text-muted-foreground">
            GA4 default channel grouping. Trend arrows compare the selected
            window with the equivalent prior window.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodToggle value={period} onChange={setPeriod} />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPeriod((p) => p)}
            aria-label="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      )}

      {ga?.error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">
            {ga.error}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Channel mix</CardTitle>
            <CardDescription>Share of sessions by channel</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[240px] w-full" />
            ) : channels.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No sessions in this window.
              </p>
            ) : (
              <Doughnut
                data={doughnutData}
                centerLabel="Sessions"
                centerValue={formatNumber(totalSessions)}
              />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">By channel</CardTitle>
            <CardDescription>
              Sessions, users, and conversion rate per channel
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : channels.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No traffic in this window.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 font-medium">Channel</th>
                    <th className="px-2 py-2 text-right font-medium">
                      Sessions
                    </th>
                    <th className="px-2 py-2 text-right font-medium">Users</th>
                    <th className="px-2 py-2 text-right font-medium">CR</th>
                    <th className="px-2 py-2 text-right font-medium">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {channels.map((c, i) => (
                    <tr
                      key={c.channel}
                      className="border-t border-border/40 hover:bg-card/40"
                    >
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-sm"
                            style={{ background: paletteFor(i) }}
                          />
                          <span className="font-medium">{c.channel}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {formatNumber(c.sessions)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {formatNumber(c.users)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {formatPercent(c.conversionRate, 1)}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <TrendArrow pct={c.trendPct} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <MetricCard
          label="Total sessions"
          value={totalSessions}
          loading={loading}
          accent="cyan"
        />
        <MetricCard
          label="Distinct channels"
          value={channels.length}
          loading={loading}
        />
        <MetricCard
          label="Top channel share"
          value={
            totalSessions > 0 && channels[0]
              ? channels[0].sessions / totalSessions
              : 0
          }
          format="percent"
          loading={loading}
          accent="violet"
          hint={channels[0]?.channel}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Top sources</CardTitle>
          <CardDescription>
            sessionSource × sessionMedium pairs (granular per-platform
            breakdown — Facebook, Instagram, LinkedIn, Twitter, etc. appear
            here when GA4 attributes traffic to them).
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : !ga?.topSources.length ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No source data in this window.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 font-medium">Source</th>
                  <th className="px-2 py-2 font-medium">Medium</th>
                  <th className="px-2 py-2 text-right font-medium">Sessions</th>
                  <th className="px-2 py-2 text-right font-medium">Users</th>
                </tr>
              </thead>
              <tbody>
                {ga.topSources.map((s) => (
                  <tr
                    key={`${s.source}-${s.medium}`}
                    className="border-t border-border/40 hover:bg-card/40"
                  >
                    <td className="px-2 py-2 font-medium">{s.source}</td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {s.medium}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {formatNumber(s.sessions)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {formatNumber(s.users)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Meta + LinkedIn pending review banners (no fake numbers) */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Meta (Facebook + Instagram)</CardTitle>
              <Badge variant="warning">Pending app review</Badge>
            </div>
            <CardDescription>
              Native FB/IG traffic figures require a Meta app with
              <code className="mx-1 rounded bg-muted px-1 text-[11px]">
                read_insights
              </code>
              + business verification. Until that&apos;s approved, GA4 captures
              this traffic via the Source/Medium table above.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">LinkedIn</CardTitle>
              <Badge variant="warning">Pending app review</Badge>
            </div>
            <CardDescription>
              LinkedIn Marketing Developer Platform access is required for
              first-party traffic data. GA4 captures the click-through volume
              meanwhile.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}

function TrendArrow({ pct }: { pct: number | null }) {
  if (pct === null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <ArrowRight className="h-3.5 w-3.5" /> new
      </span>
    );
  }
  if (Math.abs(pct) < 0.005) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <ArrowRight className="h-3.5 w-3.5" /> 0%
      </span>
    );
  }
  if (pct > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
        <ArrowUp className="h-3.5 w-3.5" /> {(pct * 100).toFixed(1)}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-rose-300">
      <ArrowDown className="h-3.5 w-3.5" /> {(Math.abs(pct) * 100).toFixed(1)}%
    </span>
  );
}

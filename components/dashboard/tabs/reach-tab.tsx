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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendLine } from "@/components/charts/trend-line";
import { MetricCard } from "@/components/dashboard/metric-card";
import { IntegrationRequired } from "@/components/dashboard/integration-required";
import { PeriodToggle } from "@/components/dashboard/period-toggle";
import type { Period } from "@/lib/data/period";
import type { ReachSnapshot } from "@/lib/data/reach";
import type { ProductSummary } from "@/lib/types";

const REACH_PERIODS: { value: Period; label: string }[] = [
  { value: "7days", label: "7 days" },
  { value: "30days", label: "30 days" },
  { value: "90days", label: "90 days" },
];

export function ReachTab({ product }: { product: ProductSummary }) {
  const gsc = product.integrations.find(
    (i) => i.provider === "GOOGLE_SEARCH_CONSOLE",
  );
  const gscConnected = gsc?.status === "CONNECTED";

  const [period, setPeriod] = useState<Period>("30days");
  const [data, setData] = useState<ReachSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gscConnected) {
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/products/${product.id}/reach?period=${period}`, {
      signal: ctrl.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<ReachSnapshot>;
      })
      .then((snap) => {
        setData(snap);
        setLoading(false);
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load");
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [product.id, period, gscConnected]);

  if (!gscConnected) {
    return (
      <div className="space-y-4">
        <IntegrationRequired
          productId={product.id}
          provider="google"
          scope="gsc"
          title="Connect Google Search Console"
          description="Reach &amp; impressions, click-through rate, average position, and the trend graph all come from Search Console."
          status={gsc?.status}
          errorMessage={gsc?.errorMessage ?? null}
        />
        <SocialPendingReviewBanner />
      </div>
    );
  }

  const summary = data?.gsc.summary;
  const previous = data?.gsc.previous;
  const trend = data?.gsc.trend ?? [];

  const impressionsTrend = previous
    ? deltaPct(summary?.impressions ?? 0, previous.impressions)
    : null;
  const clicksTrend = previous
    ? deltaPct(summary?.clicks ?? 0, previous.clicks)
    : null;
  const ctrTrend = previous ? deltaAbs(summary?.ctr ?? 0, previous.ctr) : null;
  const positionTrend = previous
    ? deltaAbs(previous.position, summary?.position ?? 0) // lower position = better
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Reach &amp; impressions</h2>
          <p className="text-xs text-muted-foreground">
            Google Search Console organic search performance.{" "}
            {data?.gsc.siteUrl && (
              <span>
                Site:{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                  {data.gsc.siteUrl}
                </code>
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodToggle
            value={period}
            onChange={setPeriod}
            options={REACH_PERIODS}
          />
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
      {data?.gsc.error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">
            {data.gsc.error}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ReachMetricCard
          label="Impressions"
          value={summary?.impressions ?? null}
          loading={loading}
          trend={impressionsTrend}
          accent="cyan"
        />
        <ReachMetricCard
          label="Clicks"
          value={summary?.clicks ?? null}
          loading={loading}
          trend={clicksTrend}
          accent="green"
        />
        <ReachMetricCard
          label="Avg CTR"
          value={summary?.ctr ?? null}
          loading={loading}
          format="percent"
          fractionDigits={2}
          trend={ctrTrend}
          trendUnit="ppt"
          accent="violet"
        />
        <ReachMetricCard
          label="Avg position"
          value={summary?.position ?? null}
          loading={loading}
          format="decimal"
          fractionDigits={1}
          trend={positionTrend}
          accent="amber"
          hint="Lower is better"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Trend</CardTitle>
          <CardDescription>
            Daily impressions and clicks across the selected window. Search
            Console data lags 2–3 days; the most recent days will be lower
            than reality until backfilled.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[240px] w-full" />
          ) : trend.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No trend data in this window.
            </p>
          ) : (
            <TrendLine
              data={trend.map((r) => ({
                date: r.date,
                impressions: r.impressions,
                clicks: r.clicks,
              }))}
              series={[
                {
                  key: "impressions",
                  label: "Impressions",
                  color: "hsl(187 100% 60%)",
                  yAxis: "left",
                },
                {
                  key: "clicks",
                  label: "Clicks",
                  color: "hsl(142 90% 55%)",
                  yAxis: "right",
                },
              ]}
            />
          )}
        </CardContent>
      </Card>

      <SocialPendingReviewBanner />
    </div>
  );
}

function ReachMetricCard({
  label,
  value,
  loading,
  format = "integer",
  fractionDigits,
  trend,
  trendUnit = "pct",
  accent,
  hint,
}: {
  label: string;
  value: number | null;
  loading: boolean;
  format?: "integer" | "decimal" | "percent";
  fractionDigits?: number;
  trend: number | null;
  trendUnit?: "pct" | "ppt";
  accent?: "green" | "cyan" | "violet" | "pink" | "amber";
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <div className="mt-1">
              <MetricInline
                value={value}
                loading={loading}
                format={format}
                fractionDigits={fractionDigits}
                accent={accent}
              />
            </div>
            {hint && (
              <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
            )}
          </div>
          {trend !== null && !loading && (
            <TrendChip value={trend} unit={trendUnit} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MetricInline({
  value,
  loading,
  format,
  fractionDigits,
  accent,
}: {
  value: number | null;
  loading: boolean;
  format: "integer" | "decimal" | "percent";
  fractionDigits?: number;
  accent?: "green" | "cyan" | "violet" | "pink" | "amber";
}) {
  if (loading) return <Skeleton className="h-7 w-24" />;
  if (value === null)
    return <span className="text-2xl font-bold text-muted-foreground">—</span>;
  const cls =
    accent === "green"
      ? "text-neon-green"
      : accent === "cyan"
      ? "text-neon-cyan"
      : accent === "violet"
      ? "text-neon-violet"
      : accent === "amber"
      ? "text-neon-amber"
      : "text-foreground";
  let formatted: string;
  if (format === "integer") {
    formatted = Math.round(value).toLocaleString("en-US");
  } else if (format === "percent") {
    formatted = `${(value * 100).toFixed(fractionDigits ?? 1)}%`;
  } else {
    formatted = value.toLocaleString("en-US", {
      minimumFractionDigits: fractionDigits ?? 1,
      maximumFractionDigits: fractionDigits ?? 1,
    });
  }
  return (
    <span className={`text-2xl font-bold tabular-nums ${cls}`}>
      {formatted}
    </span>
  );
}

function TrendChip({ value, unit }: { value: number; unit: "pct" | "ppt" }) {
  if (Math.abs(value) < 0.0005) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
        <ArrowRight className="h-3 w-3" /> 0
      </span>
    );
  }
  const positive = value > 0;
  const label =
    unit === "ppt"
      ? `${(value * 100).toFixed(2)} ppt`
      : `${(value * 100).toFixed(1)}%`;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${
        positive
          ? "bg-emerald-500/10 text-emerald-300"
          : "bg-rose-500/10 text-rose-300"
      }`}
    >
      {positive ? (
        <ArrowUp className="h-3 w-3" />
      ) : (
        <ArrowDown className="h-3 w-3" />
      )}
      {label}
    </span>
  );
}

function SocialPendingReviewBanner() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Meta reach</CardTitle>
            <Badge variant="warning">Pending app review</Badge>
          </div>
          <CardDescription>
            Facebook Page + Instagram Business reach figures require Meta App
            Review with the <code className="rounded bg-muted px-1 text-[11px]">read_insights</code>{" "}
            permission and Business Verification. We render no numbers until
            that&apos;s approved.
          </CardDescription>
        </CardHeader>
      </Card>
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">LinkedIn reach</CardTitle>
            <Badge variant="warning">Pending app review</Badge>
          </div>
          <CardDescription>
            LinkedIn Marketing Developer Platform access is approval-gated.
            This card stays empty rather than fabricating numbers.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / previous;
}

function deltaAbs(current: number, previous: number): number {
  return current - previous;
}

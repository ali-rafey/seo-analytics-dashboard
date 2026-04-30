"use client";

import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  ExternalLink,
  Info,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";

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
import { ScoreGauge } from "@/components/charts/score-gauge";
import { IntegrationRequired } from "@/components/dashboard/integration-required";
import { MetricCard } from "@/components/dashboard/metric-card";
import { cwvBucketLabel } from "@/lib/seo/score";
import type { SeoSnapshot } from "@/lib/data/seo";
import type {
  CoreWebVitals,
  LighthouseAuditResult,
} from "@/lib/integrations/google/pagespeed";
import type { ProductSummary } from "@/lib/types";
import { formatNumber, formatPercent } from "@/lib/utils";

export function SeoScoreTab({ product }: { product: ProductSummary }) {
  const ga4 = product.integrations.find(
    (i) => i.provider === "GOOGLE_ANALYTICS",
  );
  const gsc = product.integrations.find(
    (i) => i.provider === "GOOGLE_SEARCH_CONSOLE",
  );

  const [data, setData] = useState<SeoSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(data === null);
    setRefreshing(data !== null);
    setError(null);
    fetch(`/api/products/${product.id}/seo`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<SeoSnapshot>;
      })
      .then((snap) => {
        setData(snap);
        setLoading(false);
        setRefreshing(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load");
        setLoading(false);
        setRefreshing(false);
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  const score = data?.pagespeed.score?.score;
  const ps = data?.pagespeed;
  const cwv = ps?.mobile?.cwv;
  const audits = ps?.mobile?.audits;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">SEO score</h2>
          <p className="text-xs text-muted-foreground">
            Composite of Lighthouse Performance / SEO / Accessibility +
            Core Web Vitals field data from Google&apos;s CrUX dataset.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={load}
          disabled={refreshing}
        >
          {refreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      )}

      {!loading && !ps?.configured && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-sm">PageSpeed not configured</CardTitle>
            <CardDescription>
              Set <code className="rounded bg-muted px-1 py-0.5">PAGESPEED_API_KEY</code>{" "}
              in <code>.env</code> to enable the Lighthouse audit. Without it
              this tab cannot compute a score.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {!loading && ps?.configured && ps.error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-sm">PageSpeed error</CardTitle>
            <CardDescription>{ps.error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Overall score</CardTitle>
            <CardDescription>
              Mobile audit · {ps?.mobile?.fetchedAt
                ? new Date(ps.mobile.fetchedAt).toLocaleString()
                : "—"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center pt-0">
            {loading ? (
              <Skeleton className="h-[180px] w-[180px] rounded-full" />
            ) : score === undefined ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No score available yet.
              </p>
            ) : (
              <ScoreGauge score={score} />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Lighthouse breakdown</CardTitle>
            <CardDescription>
              Each category is scored 0–100 by Lighthouse on mobile.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <CategoryCard
              label="Performance"
              score={ps?.mobile?.scores.performance ?? null}
              loading={loading}
            />
            <CategoryCard
              label="SEO"
              score={ps?.mobile?.scores.seo ?? null}
              loading={loading}
            />
            <CategoryCard
              label="Accessibility"
              score={ps?.mobile?.scores.accessibility ?? null}
              loading={loading}
            />
            <CategoryCard
              label="Best practices"
              score={ps?.mobile?.scores.bestPractices ?? null}
              loading={loading}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Core Web Vitals</CardTitle>
          <CardDescription>
            {cwv?.fromFieldData
              ? "Real-user (CrUX) field data over the trailing 28 days."
              : "Insufficient field data — site doesn't yet have enough real-user samples in the CrUX dataset."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <CwvCard
            label="LCP"
            description="Largest Contentful Paint"
            metric={cwv?.lcp}
            unit="ms"
            loading={loading}
          />
          <CwvCard
            label={cwv?.inp.value !== null ? "INP" : "FID"}
            description={
              cwv?.inp.value !== null
                ? "Interaction to Next Paint"
                : "First Input Delay"
            }
            metric={cwv?.inp.value !== null ? cwv?.inp : cwv?.fid}
            unit="ms"
            loading={loading}
          />
          <CwvCard
            label="CLS"
            description="Cumulative Layout Shift"
            metric={cwv?.cls}
            unit="score"
            loading={loading}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Page audit</CardTitle>
          <CardDescription>
            Lighthouse SEO &amp; HTML checks on the homepage. Use the GitHub
            tab to scan the full codebase.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {audits ? (
            <>
              <AuditRow audit={audits.metaDescription} />
              <AuditRow audit={audits.documentTitle} />
              <AuditRow audit={audits.viewport} label="Viewport (mobile-friendly)" />
              <AuditRow audit={audits.structuredData} />
              <AuditRow audit={audits.renderBlocking} />
              <AuditRow audit={audits.imageAlt} />
              <AuditRow audit={audits.isOnHttps} />
              <AuditRow audit={audits.canonical} />
              <AuditRow audit={audits.hreflang} />
              <AuditRow audit={audits.robotsTxt} />
            </>
          ) : (
            Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Indexed pages</CardTitle>
              <Badge variant="outline">GSC sitemaps</Badge>
            </div>
            <CardDescription>
              URLs you&apos;ve declared in submitted sitemaps. GSC&apos;s legacy
              &quot;indexed&quot; field was retired in 2018 — to count actually
              indexed pages, use Search Console&apos;s Coverage report directly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!data?.gsc.connected ? (
              <p className="text-sm text-muted-foreground">
                Connect Google Search Console (in the Reach tab) to populate
                this card.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <MetricCard
                  label="Sitemaps"
                  value={data.gsc.sitemaps?.sitemapCount ?? 0}
                  loading={loading}
                />
                <MetricCard
                  label="URLs submitted"
                  value={data.gsc.sitemaps?.totalSubmitted ?? 0}
                  loading={loading}
                  accent="cyan"
                />
                <MetricCard
                  label="Sitemap errors"
                  value={data.gsc.sitemaps?.errors ?? 0}
                  loading={loading}
                  accent={
                    (data.gsc.sitemaps?.errors ?? 0) > 0 ? "amber" : undefined
                  }
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Backlinks</CardTitle>
              <Badge variant="outline">Not available</Badge>
            </div>
            <CardDescription>{data?.backlinks.reason}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              Google&apos;s Search Console &quot;Links&quot; report is only
              available in the web UI — there is no public Google API to read
              backlink counts. Connect a third-party SEO tool to populate this
              card; an integration slot is reserved in the schema.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Keyword rankings</CardTitle>
            <Badge variant="outline">GSC · last 30 days</Badge>
          </div>
          <CardDescription>
            Position is the average ranking your URLs have when they appear for
            this query. Change compares to the previous 30-day window — green
            arrows mean rank improved.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {!gsc || gsc.status !== "CONNECTED" ? (
            <IntegrationRequired
              productId={product.id}
              provider="google"
              scope="gsc"
              title="Connect Google Search Console"
              description="Keyword rankings come from your Search Console site."
            />
          ) : data?.gsc.error ? (
            <p className="text-sm text-destructive">{data.gsc.error}</p>
          ) : !data?.gsc.keywords.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No keyword data in this window.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 font-medium">Keyword</th>
                  <th className="px-2 py-2 text-right font-medium">
                    Position
                  </th>
                  <th className="px-2 py-2 text-right font-medium">
                    Impressions
                  </th>
                  <th className="px-2 py-2 text-right font-medium">Clicks</th>
                  <th className="px-2 py-2 text-right font-medium">CTR</th>
                  <th className="px-2 py-2 text-right font-medium">Change</th>
                </tr>
              </thead>
              <tbody>
                {data.gsc.keywords.slice(0, 30).map((k) => (
                  <tr
                    key={k.keyword}
                    className="border-t border-border/40 hover:bg-card/40"
                  >
                    <td className="max-w-[260px] truncate px-2 py-2 font-medium">
                      {k.keyword}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {k.position.toFixed(1)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {formatNumber(k.impressions)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {formatNumber(k.clicks)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {formatPercent(k.ctr, 1)}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <PositionChange change={k.positionChange} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {ga4 && ga4.status !== "CONNECTED" && (
        <Card className="border-dashed">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Connect Google Analytics in the Overview tab too — combining GA4
              behaviour data with GSC search data unlocks per-keyword
              conversion attribution in a future revision.
            </span>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CategoryCard({
  label,
  score,
  loading,
}: {
  label: string;
  score: number | null;
  loading: boolean;
}) {
  if (loading) return <Skeleton className="h-20 w-full" />;
  const value = score === null ? null : Math.round(score * 100);
  const color =
    value === null
      ? "text-muted-foreground"
      : value >= 90
      ? "text-emerald-300"
      : value >= 50
      ? "text-amber-300"
      : "text-rose-300";
  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>
        {value === null ? "—" : value}
        {value !== null && (
          <span className="text-xs font-normal text-muted-foreground">
            /100
          </span>
        )}
      </p>
    </div>
  );
}

function CwvCard({
  label,
  description,
  metric,
  unit,
  loading,
}: {
  label: string;
  description: string;
  metric: CoreWebVitals["lcp"] | undefined;
  unit: "ms" | "score";
  loading: boolean;
}) {
  if (loading) return <Skeleton className="h-24 w-full" />;
  const bucket = cwvBucketLabel(metric?.category ?? null);
  const tone =
    bucket.tone === "good"
      ? "text-emerald-300"
      : bucket.tone === "warn"
      ? "text-amber-300"
      : bucket.tone === "bad"
      ? "text-rose-300"
      : "text-muted-foreground";

  let display = "—";
  if (metric?.value !== null && metric?.value !== undefined) {
    if (unit === "ms") {
      display = `${Math.round(metric.value).toLocaleString()} ms`;
    } else {
      display = metric.value.toFixed(2);
    }
  }

  return (
    <div className="rounded-lg border border-border/60 bg-card/40 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
        <span className={`text-[11px] font-medium ${tone}`}>{bucket.label}</span>
      </div>
      <p className="mt-1 text-xl font-bold tabular-nums">{display}</p>
      <p className="text-[11px] text-muted-foreground">{description}</p>
    </div>
  );
}

function AuditRow({
  audit,
  label,
}: {
  audit: LighthouseAuditResult;
  label?: string;
}) {
  const passed =
    audit.score === null ? null : audit.score >= 0.9;

  return (
    <div className="flex items-start gap-2 rounded-md border border-border/40 bg-card/30 p-2">
      {passed === null ? (
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      ) : passed ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{label ?? audit.title}</p>
        {audit.displayValue && (
          <p className="text-[11px] text-muted-foreground">
            {audit.displayValue}
          </p>
        )}
      </div>
      {audit.id && (
        <a
          href={`https://web.dev/${audit.id}`}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Learn more"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

function PositionChange({ change }: { change: number | null }) {
  if (change === null)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        new
      </span>
    );
  if (Math.abs(change) < 0.1) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <ArrowRight className="h-3 w-3" /> 0
      </span>
    );
  }
  if (change > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
        <ArrowUp className="h-3 w-3" /> {change.toFixed(1)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-rose-300">
      <ArrowDown className="h-3 w-3" /> {Math.abs(change).toFixed(1)}
    </span>
  );
}

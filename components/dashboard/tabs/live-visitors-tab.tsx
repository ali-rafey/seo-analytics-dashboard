"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import {
  Activity,
  Clock,
  Globe2,
  Info,
  MonitorSmartphone,
  MapPin,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { IntegrationRequired } from "@/components/dashboard/integration-required";
import { useSSE } from "@/hooks/use-sse";
import type { LiveSnapshot } from "@/lib/data/live";
import type { ProductSummary } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

// Lazy-load the map: react-simple-maps + d3-geo + topojson chunk is sizeable
// and only needed when the user opens this tab.
const WorldMap = dynamic(
  () => import("@/components/charts/world-map").then((m) => m.WorldMap),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[360px] w-full" />,
  },
);

export function LiveVisitorsTab({ product }: { product: ProductSummary }) {
  const ga4 = product.integrations.find(
    (i) => i.provider === "GOOGLE_ANALYTICS",
  );
  const ga4Connected = ga4?.status === "CONNECTED";

  const { data, status, lastUpdate } = useSSE<{ snapshot: LiveSnapshot }>(
    ga4Connected ? `/api/stream/${product.id}/live` : null,
    ["snapshot"],
  );

  const snapshot = data.snapshot;
  const live = snapshot?.ga4.data;

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
        description="The live visitors map streams real-time geo, device, page, and source data from your GA4 property."
        status={ga4?.status}
        errorMessage={ga4?.errorMessage ?? null}
      />
    );
  }

  if (snapshot?.ga4.error) {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardHeader>
          <CardTitle>Google Analytics realtime error</CardTitle>
          <CardDescription>{snapshot.ga4.error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const loading = !snapshot;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Live visitors</h2>
          <p
            className="flex items-center gap-1 text-xs text-muted-foreground"
            title="The dashboard polls GA4 every 5 seconds, but GA4's Realtime API itself has a 30–60 second ingestion lag. 'Live' here means as fresh as GA4 publicly exposes — the trailing 30-minute window of users who have fired events."
          >
            Active right now (trailing 30 minutes). Updates every 5 seconds.
            <Info className="h-3 w-3 cursor-help" />
          </p>
        </div>
        <StreamStatus
          status={status}
          sinceUpdate={sinceUpdate}
          activeUsers={live?.totalActiveUsers ?? 0}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Globe2 className="h-4 w-4" /> World map
            </CardTitle>
            <Badge variant="outline">Country dots</Badge>
          </div>
          <CardDescription>
            Each pulsing dot is positioned at the country centroid. Dot size is
            proportional to the number of active users from that country.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[360px] w-full" />
          ) : (
            <WorldMap
              markers={(live?.byCountry ?? []).filter((c) => c.users > 0)}
            />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4" /> Top cities
            </CardTitle>
            <CardDescription>City-level breakdown from GA4</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {loading ? (
              <SkeletonRows />
            ) : !live?.byCity.length ? (
              <Empty />
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 font-medium">City</th>
                    <th className="px-2 py-2 font-medium">Country</th>
                    <th className="px-2 py-2 text-right font-medium">Users</th>
                  </tr>
                </thead>
                <tbody>
                  {live.byCity.slice(0, 10).map((c) => (
                    <tr
                      key={`${c.country}-${c.city}`}
                      className="border-t border-border/40"
                    >
                      <td className="px-2 py-2 font-medium">{c.city}</td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {c.country}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {formatNumber(c.users)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <MonitorSmartphone className="h-4 w-4" /> Device mix
            </CardTitle>
            <CardDescription>Active visitors by device type</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <SkeletonRows />
            ) : !live?.byDevice.length ? (
              <Empty />
            ) : (
              <ul className="space-y-2 text-sm">
                {live.byDevice.map((d) => {
                  const pct =
                    live.totalActiveUsers > 0
                      ? d.users / live.totalActiveUsers
                      : 0;
                  return (
                    <li key={d.device} className="flex items-center gap-3">
                      <span className="w-20 shrink-0 capitalize text-muted-foreground">
                        {d.device}
                      </span>
                      <div className="relative flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-1.5 rounded-full bg-neon-cyan"
                          style={{ width: `${Math.max(2, pct * 100)}%` }}
                        />
                      </div>
                      <span className="w-12 text-right tabular-nums">
                        {d.users}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top active pages</CardTitle>
            <CardDescription>
              Pages currently being viewed (last 30 min)
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {loading ? (
              <SkeletonRows />
            ) : !live?.byPage.length ? (
              <Empty />
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 font-medium">Title</th>
                    <th className="px-2 py-2 font-medium">Path</th>
                    <th className="px-2 py-2 text-right font-medium">Users</th>
                  </tr>
                </thead>
                <tbody>
                  {live.byPage.slice(0, 10).map((p) => (
                    <tr
                      key={`${p.page}-${p.pageTitle}`}
                      className="border-t border-border/40"
                    >
                      <td className="max-w-[200px] truncate px-2 py-2 font-medium">
                        {p.pageTitle}
                      </td>
                      <td className="max-w-[200px] truncate px-2 py-2 text-muted-foreground">
                        <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
                          {p.page}
                        </code>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {p.users}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top sources</CardTitle>
            <CardDescription>Where active visitors arrived from</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {loading ? (
              <SkeletonRows />
            ) : !live?.bySource.length ? (
              <Empty />
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 font-medium">Source</th>
                    <th className="px-2 py-2 font-medium">Medium</th>
                    <th className="px-2 py-2 text-right font-medium">Users</th>
                  </tr>
                </thead>
                <tbody>
                  {live.bySource.slice(0, 10).map((s) => (
                    <tr
                      key={`${s.source}-${s.medium}`}
                      className="border-t border-border/40"
                    >
                      <td className="px-2 py-2 font-medium">{s.source}</td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {s.medium}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {s.users}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Per-individual-visitor session detail (current page <em>per</em>{" "}
            visitor + session duration <em>per</em> visitor) is not exposed
            on the standard GA4 Realtime tier — that requires GA4 360 with
            BigQuery export. The aggregate breakdowns above are what GA4
            publicly exposes; we surface them honestly rather than fabricating
            per-visitor rows.
          </span>
        </CardContent>
      </Card>

      {/* Reach social pending banners — same provider gating as Tab 4 */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Live Meta visitors</CardTitle>
              <Badge variant="warning">Pending app review</Badge>
            </div>
            <CardDescription>
              Live FB / IG audience figures require Meta App Review +
              business verification. We render no numbers until that&apos;s
              approved.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Live LinkedIn visitors</CardTitle>
              <Badge variant="warning">Pending app review</Badge>
            </div>
            <CardDescription>
              LinkedIn Marketing Developer Platform access is approval-gated.
              This card stays empty rather than fabricating numbers.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}

function StreamStatus({
  status,
  sinceUpdate,
  activeUsers,
}: {
  status: string;
  sinceUpdate: number | null;
  activeUsers: number;
}) {
  const ok = status === "open";
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/50 px-3 py-1.5 text-xs">
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
        <span className="font-semibold tabular-nums">
          <AnimatedNumber value={activeUsers} format="integer" />
        </span>
        <span className="text-muted-foreground">
          {activeUsers === 1 ? "visitor" : "visitors"}
        </span>
      </div>
      <div
        className="flex items-center gap-1 rounded-full border border-border/60 bg-card/50 px-2.5 py-1 text-[11px] text-muted-foreground"
        title={`SSE stream: ${status}`}
      >
        {ok ? (
          <>
            <Activity className="h-3 w-3" />
            <span>Live</span>
            {sinceUpdate !== null && (
              <>
                <span>·</span>
                <Clock className="h-3 w-3" />
                <span>{sinceUpdate}s</span>
              </>
            )}
          </>
        ) : (
          <span>{status}</span>
        )}
      </div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

function Empty() {
  return (
    <p className="py-8 text-center text-sm text-muted-foreground">
      No active visitors right now.
    </p>
  );
}

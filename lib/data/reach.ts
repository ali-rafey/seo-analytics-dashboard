import { prisma } from "@/lib/prisma";
import { authorizedClientFor } from "@/lib/integrations/google/refresh";
import {
  fetchGSCDailyTrend,
  fetchGSCSummary,
  gscClientFromIntegration,
  type GSCDailyRow,
  type GSCSummary,
} from "@/lib/integrations/google/gsc";
import { rangeForPeriod, type Period } from "@/lib/data/period";
import { cached, productCacheKey } from "@/lib/redis";

export type ReachSnapshot = {
  productId: string;
  period: Period;
  capturedAt: string;
  gsc: {
    connected: boolean;
    siteUrl?: string;
    error?: string;
    summary?: GSCSummary;
    previous?: GSCSummary;
    trend: GSCDailyRow[];
  };
  meta: { connected: boolean; pendingReview: true };
  linkedin: { connected: boolean; pendingReview: true };
};

export async function getReachSnapshot(
  productId: string,
  period: Period,
): Promise<ReachSnapshot> {
  const gsc = await prisma.integration.findUnique({
    where: {
      productId_provider: { productId, provider: "GOOGLE_SEARCH_CONSOLE" },
    },
  });

  const empty: ReachSnapshot = {
    productId,
    period,
    capturedAt: new Date().toISOString(),
    gsc: { connected: false, trend: [] },
    meta: { connected: false, pendingReview: true },
    linkedin: { connected: false, pendingReview: true },
  };

  if (!gsc || gsc.status !== "CONNECTED") return empty;

  const range = rangeForPeriod(period);

  return cached(
    productCacheKey(productId, "gsc", `reach:${period}`),
    300, // GSC has ~daily granularity; 5-min cache is plenty.
    async () => {
      try {
        const { siteUrl } = gscClientFromIntegration(gsc);
        const oauth = await authorizedClientFor(gsc);

        const [summary, previous, trend] = await Promise.all([
          fetchGSCSummary(oauth, siteUrl, {
            startDate: range.startDate,
            endDate: range.endDate,
          }),
          fetchGSCSummary(oauth, siteUrl, {
            startDate: range.prevStartDate,
            endDate: range.prevEndDate,
          }).catch(() => undefined),
          fetchGSCDailyTrend(oauth, siteUrl, {
            startDate: range.startDate,
            endDate: range.endDate,
          }),
        ]);

        await prisma.integration.update({
          where: { id: gsc.id },
          data: { lastSyncedAt: new Date(), errorMessage: null },
        });

        return {
          productId,
          period,
          capturedAt: new Date().toISOString(),
          gsc: {
            connected: true,
            siteUrl,
            summary,
            previous,
            trend,
          },
          meta: { connected: false, pendingReview: true } as const,
          linkedin: { connected: false, pendingReview: true } as const,
        };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "GSC reach request failed";
        await prisma.integration.update({
          where: { id: gsc.id },
          data: { errorMessage: message, status: "ERROR" },
        });
        return {
          ...empty,
          gsc: { connected: true, trend: [], error: message },
        };
      }
    },
  );
}

import { prisma } from "@/lib/prisma";
import { authorizedClientFor } from "@/lib/integrations/google/refresh";
import {
  fetchGA4Channels,
  fetchGA4TopSources,
  type GA4ChannelRow,
  type GA4SourceRow,
} from "@/lib/integrations/google/ga4";
import { rangeForPeriod, type Period } from "@/lib/data/period";
import { cached, productCacheKey } from "@/lib/redis";

export type TrafficSnapshot = {
  productId: string;
  period: Period;
  capturedAt: string;
  ga4: {
    connected: boolean;
    error?: string;
    channels: GA4ChannelRow[];
    topSources: GA4SourceRow[];
    totalSessions: number;
  };
  // Always present so UI can render the "pending review" cards consistently.
  meta: { connected: boolean; pendingReview: true };
  linkedin: { connected: boolean; pendingReview: true };
};

export async function getTrafficSnapshot(
  productId: string,
  period: Period,
): Promise<TrafficSnapshot> {
  const ga4 = await prisma.integration.findUnique({
    where: {
      productId_provider: { productId, provider: "GOOGLE_ANALYTICS" },
    },
  });

  const empty: TrafficSnapshot = {
    productId,
    period,
    capturedAt: new Date().toISOString(),
    ga4: {
      connected: false,
      channels: [],
      topSources: [],
      totalSessions: 0,
    },
    meta: { connected: false, pendingReview: true },
    linkedin: { connected: false, pendingReview: true },
  };

  if (!ga4 || ga4.status !== "CONNECTED") return empty;

  const propertyId = (ga4.config as { propertyId?: string } | null)?.propertyId;
  if (!propertyId) {
    return {
      ...empty,
      ga4: {
        ...empty.ga4,
        error: "Integration is connected but missing propertyId.",
      },
    };
  }

  const range = rangeForPeriod(period);

  return cached(
    productCacheKey(productId, "ga4", `traffic:${period}`),
    period === "today" ? 30 : 120,
    async () => {
      try {
        const oauth = await authorizedClientFor(ga4);
        const [channels, topSources] = await Promise.all([
          fetchGA4Channels(oauth, propertyId, range),
          fetchGA4TopSources(oauth, propertyId, range, 15),
        ]);
        const totalSessions = channels.reduce((s, c) => s + c.sessions, 0);
        await prisma.integration.update({
          where: { id: ga4.id },
          data: { lastSyncedAt: new Date(), errorMessage: null },
        });
        return {
          productId,
          period,
          capturedAt: new Date().toISOString(),
          ga4: {
            connected: true,
            channels,
            topSources,
            totalSessions,
          },
          meta: { connected: false, pendingReview: true } as const,
          linkedin: { connected: false, pendingReview: true } as const,
        };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "GA4 traffic request failed";
        await prisma.integration.update({
          where: { id: ga4.id },
          data: { errorMessage: message, status: "ERROR" },
        });
        return {
          ...empty,
          ga4: { ...empty.ga4, connected: true, error: message },
        };
      }
    },
  );
}

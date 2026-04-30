import { prisma } from "@/lib/prisma";
import { authorizedClientFor } from "@/lib/integrations/google/refresh";
import {
  fetchGA4Overview,
  fetchGA4Realtime,
  type GA4OverviewSnapshot,
  type GA4RealtimeSnapshot,
} from "@/lib/integrations/google/ga4";
import { cached, productCacheKey } from "@/lib/redis";

export type OverviewSnapshot = {
  productId: string;
  capturedAt: string;
  ga4: {
    connected: boolean;
    propertyId?: string;
    error?: string;
    realtime?: GA4RealtimeSnapshot;
    today?: GA4OverviewSnapshot;
  };
};

export async function getOverviewSnapshot(
  productId: string,
): Promise<OverviewSnapshot> {
  const integration = await prisma.integration.findUnique({
    where: {
      productId_provider: { productId, provider: "GOOGLE_ANALYTICS" },
    },
  });

  if (!integration || integration.status !== "CONNECTED") {
    return {
      productId,
      capturedAt: new Date().toISOString(),
      ga4: { connected: false },
    };
  }

  const propertyId = (integration.config as { propertyId?: string } | null)
    ?.propertyId;
  if (!propertyId) {
    return {
      productId,
      capturedAt: new Date().toISOString(),
      ga4: {
        connected: false,
        error: "Integration is connected but missing propertyId in config.",
      },
    };
  }

  // Cache so multiple SSE listeners and re-renders within 5s share one fetch.
  return cached(
    productCacheKey(productId, "ga4", "overview"),
    5,
    async () => {
      try {
        const oauth = await authorizedClientFor(integration);
        const [realtime, today] = await Promise.all([
          fetchGA4Realtime(oauth, propertyId),
          fetchGA4Overview(oauth, propertyId),
        ]);
        await prisma.integration.update({
          where: { id: integration.id },
          data: { lastSyncedAt: new Date(), errorMessage: null },
        });
        return {
          productId,
          capturedAt: new Date().toISOString(),
          ga4: { connected: true, propertyId, realtime, today },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "GA4 request failed";
        await prisma.integration.update({
          where: { id: integration.id },
          data: { errorMessage: message, status: "ERROR" },
        });
        return {
          productId,
          capturedAt: new Date().toISOString(),
          ga4: { connected: true, propertyId, error: message },
        };
      }
    },
  );
}

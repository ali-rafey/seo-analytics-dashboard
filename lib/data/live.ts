import { prisma } from "@/lib/prisma";
import { authorizedClientFor } from "@/lib/integrations/google/refresh";
import {
  fetchGA4LiveVisitors,
  type GA4LiveSnapshot,
} from "@/lib/integrations/google/ga4";
import { cached, productCacheKey } from "@/lib/redis";

export type LiveSnapshot = {
  productId: string;
  capturedAt: string;
  ga4: {
    connected: boolean;
    propertyId?: string;
    error?: string;
    data?: GA4LiveSnapshot;
  };
};

export async function getLiveSnapshot(
  productId: string,
): Promise<LiveSnapshot> {
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
        error: "Integration is connected but missing propertyId.",
      },
    };
  }

  return cached(
    productCacheKey(productId, "ga4", "live"),
    5,
    async () => {
      try {
        const oauth = await authorizedClientFor(integration);
        const data = await fetchGA4LiveVisitors(oauth, propertyId);
        await prisma.integration.update({
          where: { id: integration.id },
          data: { lastSyncedAt: new Date(), errorMessage: null },
        });
        return {
          productId,
          capturedAt: new Date().toISOString(),
          ga4: { connected: true, propertyId, data },
        };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "GA4 realtime failed";
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

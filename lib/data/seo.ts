import { prisma } from "@/lib/prisma";
import { authorizedClientFor } from "@/lib/integrations/google/refresh";
import {
  fetchGSCKeywords,
  fetchGSCSitemaps,
  gscClientFromIntegration,
  type GSCKeywordRow,
  type GSCSitemapsSummary,
} from "@/lib/integrations/google/gsc";
import {
  fetchPageSpeed,
  type PageSpeedSnapshot,
} from "@/lib/integrations/google/pagespeed";
import { computeSeoScore } from "@/lib/seo/score";
import { rangeForPeriod } from "@/lib/data/period";
import { cached, productCacheKey } from "@/lib/redis";
import { isProviderConfigured } from "@/lib/env";

export type SeoSnapshot = {
  productId: string;
  capturedAt: string;
  pagespeed: {
    configured: boolean;
    error?: string;
    mobile?: PageSpeedSnapshot;
    desktop?: PageSpeedSnapshot;
    score?: ReturnType<typeof computeSeoScore>;
  };
  gsc: {
    connected: boolean;
    error?: string;
    keywords: GSCKeywordRow[];
    sitemaps?: GSCSitemapsSummary;
  };
  /**
   * Backlink count is intentionally not populated. There is no free Google
   * API exposing backlink data; the GSC "Links" report is web-UI only.
   * The dashboard renders a clear empty state explaining this rather than
   * fabricating a number. Connect a third-party SEO tool (Ahrefs, SEMrush,
   * Moz) to populate this card in a future revision.
   */
  backlinks: { available: false; reason: string };
};

export async function getSeoSnapshot(
  productId: string,
): Promise<SeoSnapshot> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { integrations: true },
  });
  if (!product) {
    throw new Error("Product not found");
  }

  const gsc = product.integrations.find(
    (i) => i.provider === "GOOGLE_SEARCH_CONSOLE",
  );

  const base: SeoSnapshot = {
    productId,
    capturedAt: new Date().toISOString(),
    pagespeed: { configured: isProviderConfigured("pagespeed") },
    gsc: { connected: false, keywords: [] },
    backlinks: {
      available: false,
      reason:
        "Backlink data isn't available through a free Google API. Connect Ahrefs, SEMrush, or Moz to populate this card.",
    },
  };

  // Run PageSpeed (cached 30 min — quota-friendly) and GSC in parallel.
  const psPromise = isProviderConfigured("pagespeed")
    ? cached(
        productCacheKey(productId, "pagespeed", `mobile:${product.url}`),
        1800,
        async () => {
          try {
            return { ok: true as const, data: await fetchPageSpeed(product.url, "mobile") };
          } catch (err) {
            return {
              ok: false as const,
              error: err instanceof Error ? err.message : "PageSpeed failed",
            };
          }
        },
      )
    : Promise.resolve({ ok: false as const, error: "Not configured" });

  const gscPromise: Promise<
    | { ok: true; keywords: GSCKeywordRow[]; sitemaps: GSCSitemapsSummary }
    | { ok: false; error: string }
  > =
    gsc && gsc.status === "CONNECTED"
      ? cached(productCacheKey(productId, "gsc", "seo"), 600, async () => {
          try {
            const { siteUrl } = gscClientFromIntegration(gsc);
            const oauth = await authorizedClientFor(gsc);
            const range = rangeForPeriod("30days");
            const [keywords, sitemaps] = await Promise.all([
              fetchGSCKeywords(oauth, siteUrl, range, 50),
              fetchGSCSitemaps(oauth, siteUrl),
            ]);
            return { ok: true as const, keywords, sitemaps };
          } catch (err) {
            return {
              ok: false as const,
              error: err instanceof Error ? err.message : "GSC seo request failed",
            };
          }
        })
      : Promise.resolve({ ok: false as const, error: "GSC not connected" });

  const [psResult, gscResult] = await Promise.all([psPromise, gscPromise]);

  const out: SeoSnapshot = { ...base };

  if (psResult.ok) {
    const ps = psResult.data;
    out.pagespeed = {
      configured: true,
      mobile: ps,
      score: computeSeoScore(ps),
    };
  } else if (isProviderConfigured("pagespeed")) {
    out.pagespeed = { configured: true, error: psResult.error };
  }

  if (gsc && gsc.status === "CONNECTED") {
    if (gscResult.ok) {
      out.gsc = {
        connected: true,
        keywords: gscResult.keywords,
        sitemaps: gscResult.sitemaps,
      };
    } else {
      out.gsc = { connected: true, error: gscResult.error, keywords: [] };
    }
  }

  return out;
}

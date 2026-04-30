import { env } from "@/lib/env";

export type CwvCategory = "FAST" | "AVERAGE" | "SLOW" | null;
export type CwvMetric = {
  /** Numeric percentile (LCP/FID/INP in milliseconds; CLS unitless). */
  value: number | null;
  category: CwvCategory;
};

export type CoreWebVitals = {
  /** Largest Contentful Paint, ms */
  lcp: CwvMetric;
  /** First Input Delay, ms (deprecated, kept for back-compat) */
  fid: CwvMetric;
  /** Cumulative Layout Shift, unitless */
  cls: CwvMetric;
  /** Interaction to Next Paint, ms (replacement for FID since 2024) */
  inp: CwvMetric;
  /** Whether the field data came from real-user CrUX measurements */
  fromFieldData: boolean;
};

export type LighthouseAuditResult = {
  id: string;
  title: string;
  /** 0..1, or null when not applicable / informational only */
  score: number | null;
  displayValue?: string;
  description?: string;
};

export type PageSpeedSnapshot = {
  url: string;
  strategy: "mobile" | "desktop";
  fetchedAt: string;
  /** Lighthouse category scores, 0..1 each */
  scores: {
    performance: number | null;
    seo: number | null;
    accessibility: number | null;
    bestPractices: number | null;
  };
  cwv: CoreWebVitals;
  audits: {
    metaDescription: LighthouseAuditResult;
    documentTitle: LighthouseAuditResult;
    structuredData: LighthouseAuditResult;
    viewport: LighthouseAuditResult;
    renderBlocking: LighthouseAuditResult;
    imageAlt: LighthouseAuditResult;
    isOnHttps: LighthouseAuditResult;
    canonical: LighthouseAuditResult;
    hreflang: LighthouseAuditResult;
    robotsTxt: LighthouseAuditResult;
  };
};

const PAGESPEED_URL =
  "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

function extractMetric(
  raw:
    | {
        percentile?: number;
        category?: "FAST" | "AVERAGE" | "SLOW";
      }
    | undefined,
): CwvMetric {
  if (!raw) return { value: null, category: null };
  // CrUX returns CLS percentile multiplied by 100 (e.g. 12 means 0.12).
  return {
    value:
      typeof raw.percentile === "number" ? raw.percentile : null,
    category: raw.category ?? null,
  };
}

function audit(
  raw:
    | {
        id?: string;
        title?: string;
        score?: number | null;
        displayValue?: string;
        description?: string;
      }
    | undefined,
  fallbackId: string,
): LighthouseAuditResult {
  if (!raw) {
    return { id: fallbackId, title: fallbackId, score: null };
  }
  return {
    id: raw.id ?? fallbackId,
    title: raw.title ?? fallbackId,
    score:
      raw.score === undefined || raw.score === null ? null : Number(raw.score),
    displayValue: raw.displayValue,
    description: raw.description,
  };
}

export async function fetchPageSpeed(
  pageUrl: string,
  strategy: "mobile" | "desktop" = "mobile",
): Promise<PageSpeedSnapshot> {
  if (!env.PAGESPEED_API_KEY) {
    throw new Error(
      "PageSpeed API key not configured. Set PAGESPEED_API_KEY.",
    );
  }

  const u = new URL(PAGESPEED_URL);
  u.searchParams.set("url", pageUrl);
  u.searchParams.set("key", env.PAGESPEED_API_KEY);
  u.searchParams.set("strategy", strategy);
  // Pass each Lighthouse category we care about.
  for (const c of ["PERFORMANCE", "SEO", "ACCESSIBILITY", "BEST_PRACTICES"]) {
    u.searchParams.append("category", c);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  let res: Response;
  try {
    res = await fetch(u.toString(), { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `PageSpeed Insights request failed (${res.status}): ${body.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as Record<string, unknown>;
  const lh = (data.lighthouseResult ?? {}) as Record<string, unknown>;
  const cats = (lh.categories ?? {}) as Record<
    string,
    { score?: number | null }
  >;
  const audits = (lh.audits ?? {}) as Record<string, Record<string, unknown>>;

  const fieldData = (data.loadingExperience ?? {}) as {
    metrics?: Record<
      string,
      { percentile?: number; category?: "FAST" | "AVERAGE" | "SLOW" }
    >;
  };
  const cruxMetrics = fieldData.metrics ?? {};

  const cwv: CoreWebVitals = {
    lcp: extractMetric(cruxMetrics.LARGEST_CONTENTFUL_PAINT_MS),
    fid: extractMetric(cruxMetrics.FIRST_INPUT_DELAY_MS),
    cls: extractMetric(cruxMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE),
    inp: extractMetric(cruxMetrics.INTERACTION_TO_NEXT_PAINT),
    fromFieldData: Object.keys(cruxMetrics).length > 0,
  };

  // CLS percentile is multiplied by 100 in CrUX; normalize to the unitless
  // 0..1ish score that the dashboard displays.
  if (cwv.cls.value !== null) {
    cwv.cls.value = cwv.cls.value / 100;
  }

  return {
    url: pageUrl,
    strategy,
    fetchedAt: new Date().toISOString(),
    scores: {
      performance: cats.performance?.score ?? null,
      seo: cats.seo?.score ?? null,
      accessibility: cats.accessibility?.score ?? null,
      bestPractices: cats["best-practices"]?.score ?? null,
    },
    cwv,
    audits: {
      metaDescription: audit(audits["meta-description"], "meta-description"),
      documentTitle: audit(audits["document-title"], "document-title"),
      structuredData: audit(audits["structured-data"], "structured-data"),
      viewport: audit(audits["viewport"], "viewport"),
      renderBlocking: audit(
        audits["render-blocking-resources"],
        "render-blocking-resources",
      ),
      imageAlt: audit(audits["image-alt"], "image-alt"),
      isOnHttps: audit(audits["is-on-https"], "is-on-https"),
      canonical: audit(audits["canonical"], "canonical"),
      hreflang: audit(audits["hreflang"], "hreflang"),
      robotsTxt: audit(audits["robots-txt"], "robots-txt"),
    },
  };
}

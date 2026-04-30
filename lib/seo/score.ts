import type { CoreWebVitals, PageSpeedSnapshot } from "@/lib/integrations/google/pagespeed";

/**
 * Composes a single 0–100 SEO health score from Lighthouse + Core Web Vitals.
 *
 * Weights:
 *  - Lighthouse Performance      40%
 *  - Lighthouse SEO              30%
 *  - Lighthouse Accessibility    15%
 *  - Core Web Vitals pass rate   15%
 */
export function computeSeoScore(snap: PageSpeedSnapshot): {
  score: number;
  breakdown: {
    performance: number | null;
    seo: number | null;
    accessibility: number | null;
    cwv: number;
  };
} {
  const perf = snap.scores.performance;
  const seo = snap.scores.seo;
  const a11y = snap.scores.accessibility;
  const cwv = cwvPassRate(snap.cwv);

  const components: { value: number; weight: number }[] = [];
  if (perf !== null) components.push({ value: perf, weight: 0.4 });
  if (seo !== null) components.push({ value: seo, weight: 0.3 });
  if (a11y !== null) components.push({ value: a11y, weight: 0.15 });
  components.push({ value: cwv, weight: 0.15 });

  const totalWeight = components.reduce((s, c) => s + c.weight, 0);
  const weightedSum = components.reduce((s, c) => s + c.value * c.weight, 0);
  const score = totalWeight === 0 ? 0 : (weightedSum / totalWeight) * 100;

  return {
    score: Math.round(score),
    breakdown: {
      performance: perf,
      seo,
      accessibility: a11y,
      cwv,
    },
  };
}

function cwvPassRate(cwv: CoreWebVitals): number {
  // If no field data is available, fall back to a neutral 0.5 so we don't
  // wrongly punish or reward sites with too little real-user traffic.
  if (!cwv.fromFieldData) return 0.5;
  const checks = [cwv.lcp.category, cwv.cls.category];
  // Prefer INP if present, otherwise fall back to FID.
  checks.push(cwv.inp.category ?? cwv.fid.category);
  const nonNull = checks.filter((c): c is "FAST" | "AVERAGE" | "SLOW" =>
    c !== null,
  );
  if (nonNull.length === 0) return 0.5;
  const passing = nonNull.filter((c) => c === "FAST").length;
  return passing / nonNull.length;
}

export function cwvBucketLabel(category: "FAST" | "AVERAGE" | "SLOW" | null) {
  if (category === "FAST") return { label: "Good", tone: "good" as const };
  if (category === "AVERAGE")
    return { label: "Needs improvement", tone: "warn" as const };
  if (category === "SLOW") return { label: "Poor", tone: "bad" as const };
  return { label: "Insufficient data", tone: "muted" as const };
}

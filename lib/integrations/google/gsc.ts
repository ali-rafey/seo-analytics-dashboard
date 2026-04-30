import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { decrypt } from "@/lib/crypto";
import { authorizedClient } from "@/lib/integrations/google/oauth";
import type { Integration } from "@prisma/client";

export type GSCSite = {
  siteUrl: string;
  permissionLevel: string;
};

export async function listGSCSites(oauth: OAuth2Client): Promise<GSCSite[]> {
  const wm = google.webmasters({ version: "v3", auth: oauth });
  const res = await wm.sites.list();
  return (res.data.siteEntry ?? [])
    .filter((e) => e.siteUrl)
    .map((e) => ({
      siteUrl: e.siteUrl!,
      permissionLevel: e.permissionLevel ?? "siteUnverifiedUser",
    }));
}

export function gscClientFromIntegration(integration: Integration): {
  oauth: OAuth2Client;
  siteUrl: string;
} {
  if (!integration.accessToken) {
    throw new Error("GSC integration has no access token");
  }
  const accessToken = decrypt(integration.accessToken);
  const refreshToken = integration.refreshToken
    ? decrypt(integration.refreshToken)
    : null;
  const config = (integration.config ?? {}) as { siteUrl?: string };
  if (!config.siteUrl) {
    throw new Error("GSC integration is missing siteUrl in config");
  }
  return {
    oauth: authorizedClient({
      accessToken,
      refreshToken,
      expiryDate: integration.expiresAt?.getTime() ?? null,
    }),
    siteUrl: config.siteUrl,
  };
}

export type GSCSummary = {
  impressions: number;
  clicks: number;
  ctr: number; // 0..1
  position: number;
};

/**
 * Sums (or averages, for ctr/position) Search Console performance data over
 * a date range. Empty rows are normalized to zero.
 */
export async function fetchGSCSummary(
  oauth: OAuth2Client,
  siteUrl: string,
  range: { startDate: string; endDate: string },
): Promise<GSCSummary> {
  const wm = google.webmasters({ version: "v3", auth: oauth });
  const res = await wm.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: range.startDate,
      endDate: range.endDate,
      // No dimensions returns one totals row.
    },
  });
  const row = res.data.rows?.[0];
  return {
    impressions: Math.round(Number(row?.impressions ?? 0)),
    clicks: Math.round(Number(row?.clicks ?? 0)),
    ctr: Number(row?.ctr ?? 0),
    position: Number(row?.position ?? 0),
  };
}

export type GSCDailyRow = {
  date: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
};

export async function fetchGSCDailyTrend(
  oauth: OAuth2Client,
  siteUrl: string,
  range: { startDate: string; endDate: string },
): Promise<GSCDailyRow[]> {
  const wm = google.webmasters({ version: "v3", auth: oauth });
  const res = await wm.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: range.startDate,
      endDate: range.endDate,
      dimensions: ["date"],
      rowLimit: 1000,
    },
  });
  return (res.data.rows ?? []).map((r) => ({
    date: r.keys?.[0] ?? "",
    impressions: Math.round(Number(r.impressions ?? 0)),
    clicks: Math.round(Number(r.clicks ?? 0)),
    ctr: Number(r.ctr ?? 0),
    position: Number(r.position ?? 0),
  }));
}

export type GSCKeywordRow = {
  keyword: string;
  position: number;
  previousPosition: number | null;
  /** Positive = improved (rank number went down). */
  positionChange: number | null;
  impressions: number;
  clicks: number;
  ctr: number;
};

export async function fetchGSCKeywords(
  oauth: OAuth2Client,
  siteUrl: string,
  range: {
    startDate: string;
    endDate: string;
    prevStartDate: string;
    prevEndDate: string;
  },
  rowLimit = 50,
): Promise<GSCKeywordRow[]> {
  const wm = google.webmasters({ version: "v3", auth: oauth });
  const queryFor = async (startDate: string, endDate: string) =>
    wm.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ["query"],
        rowLimit,
      },
    });

  const [current, previous] = await Promise.all([
    queryFor(range.startDate, range.endDate),
    queryFor(range.prevStartDate, range.prevEndDate).catch(() => ({
      data: { rows: [] as Array<{ keys?: string[]; position?: number }> },
    })),
  ]);

  const prevByKw = new Map<string, number>();
  for (const r of previous.data.rows ?? []) {
    const k = r.keys?.[0];
    if (k) prevByKw.set(k, Number(r.position ?? 0));
  }

  return (current.data.rows ?? []).map((r) => {
    const keyword = r.keys?.[0] ?? "";
    const position = Number(r.position ?? 0);
    const previousPosition = prevByKw.get(keyword) ?? null;
    const positionChange =
      previousPosition !== null ? previousPosition - position : null;
    return {
      keyword,
      position,
      previousPosition,
      positionChange,
      impressions: Math.round(Number(r.impressions ?? 0)),
      clicks: Math.round(Number(r.clicks ?? 0)),
      ctr: Number(r.ctr ?? 0),
    };
  });
}

export type GSCSitemapsSummary = {
  /** URLs submitted via sitemap files. GSC API exposes this; the legacy
   * `indexed` field has been removed since 2018, so we don't claim a number
   * for indexed pages here. */
  totalSubmitted: number;
  sitemapCount: number;
  errors: number;
};

export async function fetchGSCSitemaps(
  oauth: OAuth2Client,
  siteUrl: string,
): Promise<GSCSitemapsSummary> {
  const wm = google.webmasters({ version: "v3", auth: oauth });
  const res = await wm.sitemaps.list({ siteUrl });
  let totalSubmitted = 0;
  let errors = 0;
  const sitemaps = res.data.sitemap ?? [];
  for (const s of sitemaps) {
    errors += Number(s.errors ?? 0);
    for (const c of s.contents ?? []) {
      totalSubmitted += Number(c.submitted ?? 0);
    }
  }
  return {
    totalSubmitted,
    sitemapCount: sitemaps.length,
    errors,
  };
}

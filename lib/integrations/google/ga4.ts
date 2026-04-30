import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { authorizedClient } from "@/lib/integrations/google/oauth";
import { decrypt } from "@/lib/crypto";
import type { Integration } from "@prisma/client";

export type GA4Tokens = {
  accessToken: string;
  refreshToken?: string | null;
  expiryDate?: number | null;
};

export type GA4Property = {
  /** Resource name like `properties/123456789` */
  name: string;
  /** Numeric property id `123456789` */
  propertyId: string;
  displayName: string;
  parent?: string | null;
};

export function ga4ClientFromIntegration(integration: Integration): {
  oauth: OAuth2Client;
  propertyId: string;
} {
  if (!integration.accessToken) {
    throw new Error("Integration has no access token");
  }
  const accessToken = decrypt(integration.accessToken);
  const refreshToken = integration.refreshToken
    ? decrypt(integration.refreshToken)
    : null;
  const config = (integration.config ?? {}) as { propertyId?: string };
  if (!config.propertyId) {
    throw new Error("Integration is missing propertyId in config");
  }
  return {
    oauth: authorizedClient({
      accessToken,
      refreshToken,
      expiryDate: integration.expiresAt?.getTime() ?? null,
    }),
    propertyId: config.propertyId,
  };
}

/**
 * List GA4 properties accessible to the authorized user across all their
 * Google Analytics accounts.
 */
export async function listGA4Properties(
  oauth: OAuth2Client,
): Promise<GA4Property[]> {
  const admin = google.analyticsadmin({ version: "v1beta", auth: oauth });
  const accountsRes = await admin.accountSummaries.list({ pageSize: 200 });
  const summaries = accountsRes.data.accountSummaries ?? [];
  const out: GA4Property[] = [];
  for (const acc of summaries) {
    for (const prop of acc.propertySummaries ?? []) {
      const name = prop.property ?? "";
      const propertyId = name.replace(/^properties\//, "");
      if (!propertyId) continue;
      out.push({
        name,
        propertyId,
        displayName: prop.displayName ?? propertyId,
        parent: acc.displayName,
      });
    }
  }
  return out;
}

export type GA4RealtimeSnapshot = {
  activeUsers: number;
  byCountry: { country: string; users: number }[];
};

export async function fetchGA4Realtime(
  oauth: OAuth2Client,
  propertyId: string,
): Promise<GA4RealtimeSnapshot> {
  const data = google.analyticsdata({ version: "v1beta", auth: oauth });
  const res = await data.properties.runRealtimeReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dimensions: [{ name: "country" }],
      metrics: [{ name: "activeUsers" }],
      limit: "100",
    },
  });

  const rows = res.data.rows ?? [];
  let total = 0;
  const byCountry: { country: string; users: number }[] = [];
  for (const row of rows) {
    const country = row.dimensionValues?.[0]?.value ?? "Unknown";
    const users = Number(row.metricValues?.[0]?.value ?? 0);
    total += users;
    byCountry.push({ country, users });
  }
  byCountry.sort((a, b) => b.users - a.users);
  return { activeUsers: total, byCountry };
}

export type GA4OverviewSnapshot = {
  sessions: number;
  totalUsers: number;
  newUsers: number;
  returningUsers: number;
  pageviews: number;
  bounceRate: number; // 0..1
  avgSessionDuration: number; // seconds
};

/**
 * "Today" overview metrics from GA4 Data API. GA4 retired the legacy bounce
 * rate; the modern API exposes it directly as a metric.
 */
export async function fetchGA4Overview(
  oauth: OAuth2Client,
  propertyId: string,
): Promise<GA4OverviewSnapshot> {
  const data = google.analyticsdata({ version: "v1beta", auth: oauth });
  const today = "today";

  const [totals, newReturning] = await Promise.all([
    data.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate: today, endDate: today }],
        metrics: [
          { name: "sessions" },
          { name: "totalUsers" },
          { name: "screenPageViews" },
          { name: "bounceRate" },
          { name: "averageSessionDuration" },
        ],
      },
    }),
    data.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate: today, endDate: today }],
        dimensions: [{ name: "newVsReturning" }],
        metrics: [{ name: "totalUsers" }],
      },
    }),
  ]);

  const totalRow = totals.data.rows?.[0]?.metricValues ?? [];
  const sessions = Number(totalRow[0]?.value ?? 0);
  const totalUsers = Number(totalRow[1]?.value ?? 0);
  const pageviews = Number(totalRow[2]?.value ?? 0);
  const bounceRate = Number(totalRow[3]?.value ?? 0);
  const avgSessionDuration = Number(totalRow[4]?.value ?? 0);

  let newUsers = 0;
  let returningUsers = 0;
  for (const row of newReturning.data.rows ?? []) {
    const dim = row.dimensionValues?.[0]?.value ?? "";
    const value = Number(row.metricValues?.[0]?.value ?? 0);
    if (dim === "new") newUsers += value;
    else if (dim === "returning") returningUsers += value;
  }

  return {
    sessions,
    totalUsers,
    newUsers,
    returningUsers,
    pageviews,
    bounceRate,
    avgSessionDuration,
  };
}

export type GA4ChannelRow = {
  channel: string;
  sessions: number;
  users: number;
  conversionRate: number;
  prevSessions: number;
  trendPct: number | null; // (current - previous) / previous
};

/**
 * Sessions, users, and conversion rate by GA4 default channel grouping.
 * Issues current + previous-period queries in parallel and merges them so each
 * row carries a comparable baseline for the trend arrow.
 */
export async function fetchGA4Channels(
  oauth: OAuth2Client,
  propertyId: string,
  range: {
    startDate: string;
    endDate: string;
    prevStartDate: string;
    prevEndDate: string;
  },
): Promise<GA4ChannelRow[]> {
  const data = google.analyticsdata({ version: "v1beta", auth: oauth });

  const queryFor = async (startDate: string, endDate: string) => {
    const res = await data.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [
          { name: "sessions" },
          { name: "totalUsers" },
          { name: "sessionConversionRate" },
        ],
        orderBys: [
          { metric: { metricName: "sessions" }, desc: true },
        ],
        limit: "25",
      },
    });
    return res.data.rows ?? [];
  };

  const [current, previous] = await Promise.all([
    queryFor(range.startDate, range.endDate),
    queryFor(range.prevStartDate, range.prevEndDate),
  ]);

  const prevByChannel = new Map<string, number>();
  for (const row of previous) {
    const channel = row.dimensionValues?.[0]?.value ?? "Unknown";
    const sessions = Number(row.metricValues?.[0]?.value ?? 0);
    prevByChannel.set(channel, sessions);
  }

  return current.map((row) => {
    const channel = row.dimensionValues?.[0]?.value ?? "Unknown";
    const sessions = Number(row.metricValues?.[0]?.value ?? 0);
    const users = Number(row.metricValues?.[1]?.value ?? 0);
    const conversionRate = Number(row.metricValues?.[2]?.value ?? 0);
    const prevSessions = prevByChannel.get(channel) ?? 0;
    const trendPct =
      prevSessions === 0
        ? sessions === 0
          ? 0
          : null
        : (sessions - prevSessions) / prevSessions;
    return {
      channel,
      sessions,
      users,
      conversionRate,
      prevSessions,
      trendPct,
    };
  });
}

export type GA4LiveSnapshot = {
  totalActiveUsers: number;
  byCountry: { country: string; countryIso: string | null; users: number }[];
  byCity: { city: string; country: string; users: number }[];
  byDevice: { device: string; users: number }[];
  byPage: { page: string; pageTitle: string; users: number }[];
  bySource: { source: string; medium: string; users: number }[];
};

/**
 * Real-time visitor data from GA4 — country/city/device/page/source rollups
 * over the past 30 minutes. GA4 Realtime does NOT expose per-session detail
 * (current page per individual visitor, session duration per visitor) on the
 * standard tier; that requires GA4 360 + BigQuery export. We surface the
 * aggregate breakdowns the API actually returns.
 */
export async function fetchGA4LiveVisitors(
  oauth: OAuth2Client,
  propertyId: string,
): Promise<GA4LiveSnapshot> {
  const data = google.analyticsdata({ version: "v1beta", auth: oauth });

  // We can request multiple dimension breakdowns in parallel — the realtime
  // API charges roughly 1 quota unit per call regardless of dimension count.
  const property = `properties/${propertyId}`;
  const metric = [{ name: "activeUsers" }];
  const limit = "100";

  const [byCountryRes, byCityRes, byDeviceRes, byPageRes, bySourceRes] =
    await Promise.all([
      data.properties.runRealtimeReport({
        property,
        requestBody: {
          dimensions: [{ name: "country" }, { name: "countryId" }],
          metrics: metric,
          limit,
        },
      }),
      data.properties.runRealtimeReport({
        property,
        requestBody: {
          dimensions: [{ name: "city" }, { name: "country" }],
          metrics: metric,
          limit,
        },
      }),
      data.properties.runRealtimeReport({
        property,
        requestBody: {
          dimensions: [{ name: "deviceCategory" }],
          metrics: metric,
          limit,
        },
      }),
      data.properties.runRealtimeReport({
        property,
        requestBody: {
          dimensions: [
            { name: "unifiedScreenName" },
            { name: "unifiedPagePathScreen" },
          ],
          metrics: metric,
          limit,
        },
      }),
      data.properties.runRealtimeReport({
        property,
        requestBody: {
          dimensions: [{ name: "source" }, { name: "medium" }],
          metrics: metric,
          limit,
        },
      }),
    ]);

  const byCountry = (byCountryRes.data.rows ?? []).map((r) => ({
    country: r.dimensionValues?.[0]?.value ?? "Unknown",
    countryIso: r.dimensionValues?.[1]?.value ?? null,
    users: Number(r.metricValues?.[0]?.value ?? 0),
  }));
  const totalActiveUsers = byCountry.reduce((s, r) => s + r.users, 0);

  const byCity = (byCityRes.data.rows ?? []).map((r) => ({
    city: r.dimensionValues?.[0]?.value ?? "Unknown",
    country: r.dimensionValues?.[1]?.value ?? "Unknown",
    users: Number(r.metricValues?.[0]?.value ?? 0),
  }));

  const byDevice = (byDeviceRes.data.rows ?? []).map((r) => ({
    device: r.dimensionValues?.[0]?.value ?? "unknown",
    users: Number(r.metricValues?.[0]?.value ?? 0),
  }));

  const byPage = (byPageRes.data.rows ?? []).map((r) => ({
    pageTitle: r.dimensionValues?.[0]?.value ?? "(unknown)",
    page: r.dimensionValues?.[1]?.value ?? "/",
    users: Number(r.metricValues?.[0]?.value ?? 0),
  }));

  const bySource = (bySourceRes.data.rows ?? []).map((r) => ({
    source: r.dimensionValues?.[0]?.value ?? "(direct)",
    medium: r.dimensionValues?.[1]?.value ?? "(none)",
    users: Number(r.metricValues?.[0]?.value ?? 0),
  }));

  for (const list of [byCountry, byCity, byDevice, byPage, bySource]) {
    list.sort((a, b) => b.users - a.users);
  }

  return {
    totalActiveUsers,
    byCountry,
    byCity,
    byDevice,
    byPage,
    bySource,
  };
}

export type GA4SourceRow = {
  source: string;
  medium: string;
  sessions: number;
  users: number;
};

/**
 * Top sessionSource × sessionMedium combinations — used for the per-platform
 * (Facebook, Instagram, LinkedIn, Twitter, etc.) drilldown table.
 */
export async function fetchGA4TopSources(
  oauth: OAuth2Client,
  propertyId: string,
  range: { startDate: string; endDate: string },
  limit = 15,
): Promise<GA4SourceRow[]> {
  const data = google.analyticsdata({ version: "v1beta", auth: oauth });
  const res = await data.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate: range.startDate, endDate: range.endDate }],
      dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
      metrics: [{ name: "sessions" }, { name: "totalUsers" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: String(limit),
    },
  });
  return (res.data.rows ?? []).map((row) => ({
    source: row.dimensionValues?.[0]?.value ?? "(unknown)",
    medium: row.dimensionValues?.[1]?.value ?? "(none)",
    sessions: Number(row.metricValues?.[0]?.value ?? 0),
    users: Number(row.metricValues?.[1]?.value ?? 0),
  }));
}

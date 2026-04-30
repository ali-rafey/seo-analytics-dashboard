/**
 * Date range helpers for analytics queries.
 *
 * ─── Timezone contract ──────────────────────────────────────────────────────
 * All date arithmetic uses **UTC** (`getUTCFullYear`, `getUTCMonth`, etc.).
 * GA4 and Search Console accept `YYYY-MM-DD` in the **property's configured
 * timezone**, not UTC. This means:
 *
 *   - If your GA4 property is set to "(GMT-08:00) Pacific Time", a query for
 *     "2026-05-01" returns Pacific-Time-1 May data, regardless of what
 *     timezone our server happens to be in.
 *   - The dates we compute here are **calendar dates in UTC**. For users
 *     whose server runs in UTC and whose GA4 property is also UTC, this is
 *     a perfect match. For users whose property is in another timezone, the
 *     dates may be off by one day during the timezone-offset window.
 *
 * Recommendations:
 *   1. Run the deployment in UTC (Vercel does this by default).
 *   2. Set GA4 property timezone to UTC for the cleanest match. If you can't
 *      (some properties are tied to business location), expect 0–1 day of
 *      drift for "today"-period queries near midnight in the property tz.
 *   3. For 7/30/90-day windows, drift is statistically negligible.
 */

export type Period = "today" | "7days" | "30days" | "90days";

export function isPeriod(value: string): value is Period {
  return ["today", "7days", "30days", "90days"].includes(value);
}

export type DateRange = {
  startDate: string; // YYYY-MM-DD (UTC calendar date, see file header)
  endDate: string;
  prevStartDate: string;
  prevEndDate: string;
  days: number;
};

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function fmt(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function daysAgo(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() - n);
  return x;
}

export function rangeForPeriod(period: Period): DateRange {
  const today = new Date();
  const endDate = fmt(today);
  switch (period) {
    case "today": {
      return {
        startDate: endDate,
        endDate,
        prevStartDate: fmt(daysAgo(today, 1)),
        prevEndDate: fmt(daysAgo(today, 1)),
        days: 1,
      };
    }
    case "7days": {
      return {
        startDate: fmt(daysAgo(today, 6)),
        endDate,
        prevStartDate: fmt(daysAgo(today, 13)),
        prevEndDate: fmt(daysAgo(today, 7)),
        days: 7,
      };
    }
    case "30days": {
      return {
        startDate: fmt(daysAgo(today, 29)),
        endDate,
        prevStartDate: fmt(daysAgo(today, 59)),
        prevEndDate: fmt(daysAgo(today, 30)),
        days: 30,
      };
    }
    case "90days": {
      return {
        startDate: fmt(daysAgo(today, 89)),
        endDate,
        prevStartDate: fmt(daysAgo(today, 179)),
        prevEndDate: fmt(daysAgo(today, 90)),
        days: 90,
      };
    }
  }
}

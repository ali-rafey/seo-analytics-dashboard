export type Period = "today" | "7days" | "30days" | "90days";

export function isPeriod(value: string): value is Period {
  return ["today", "7days", "30days", "90days"].includes(value);
}

export type DateRange = {
  startDate: string; // YYYY-MM-DD
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

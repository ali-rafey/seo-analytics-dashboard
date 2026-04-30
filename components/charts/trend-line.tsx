"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type TrendDatum = {
  date: string;
  [series: string]: string | number;
};

export type TrendSeries = {
  key: string;
  label: string;
  color: string;
  yAxis?: "left" | "right";
};

export function TrendLine({
  data,
  series,
  height = 240,
}: {
  data: TrendDatum[];
  series: TrendSeries[];
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 5, right: 8, bottom: 0, left: 0 }}
        >
          <defs>
            {series.map((s) => (
              <linearGradient
                key={s.key}
                id={`grad-${s.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor={s.color} stopOpacity={0.4} />
                <stop offset="95%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid
            stroke="hsl(217 33% 18%)"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            stroke="hsl(215 20% 65%)"
            fontSize={11}
            tickFormatter={(v) => formatDate(v as string)}
            minTickGap={24}
          />
          <YAxis
            yAxisId="left"
            stroke="hsl(215 20% 65%)"
            fontSize={11}
            width={48}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="hsl(215 20% 65%)"
            fontSize={11}
            width={48}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(222 47% 8%)",
              border: "1px solid hsl(217 33% 18%)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(v) => formatDate(String(v))}
            itemStyle={{ color: "hsl(210 40% 98%)" }}
          />
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              fill={`url(#grad-${s.key})`}
              yAxisId={s.yAxis ?? "left"}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatDate(v: string): string {
  if (!v) return "";
  // GSC returns YYYY-MM-DD strings.
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

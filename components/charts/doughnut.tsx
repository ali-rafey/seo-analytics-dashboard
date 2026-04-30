"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { paletteFor } from "./colors";

export type DoughnutDatum = {
  name: string;
  value: number;
};

export function Doughnut({
  data,
  height = 240,
  centerLabel,
  centerValue,
}: {
  data: DoughnutDatum[];
  height?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const filtered = data.filter((d) => d.value > 0);

  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            contentStyle={{
              background: "hsl(222 47% 8%)",
              border: "1px solid hsl(217 33% 18%)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "hsl(210 40% 98%)" }}
            itemStyle={{ color: "hsl(210 40% 98%)" }}
            formatter={(v: number) => [
              `${v.toLocaleString()} (${total > 0 ? ((v / total) * 100).toFixed(1) : "0.0"}%)`,
              "",
            ]}
          />
          <Pie
            data={filtered}
            dataKey="value"
            nameKey="name"
            innerRadius={"55%"}
            outerRadius={"85%"}
            paddingAngle={2}
            stroke="hsl(222 47% 6%)"
            strokeWidth={2}
          >
            {filtered.map((_, i) => (
              <Cell key={i} fill={paletteFor(i)} />
            ))}
          </Pie>
          <Legend
            verticalAlign="bottom"
            wrapperStyle={{ fontSize: 11, color: "hsl(215 20% 65%)" }}
            iconSize={8}
          />
        </PieChart>
      </ResponsiveContainer>
      {(centerLabel || centerValue) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {centerValue && (
            <span className="text-xl font-bold tabular-nums">
              {centerValue}
            </span>
          )}
          {centerLabel && (
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {centerLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { AnimatedNumber } from "@/components/ui/animated-number";

/**
 * Lightweight SVG gauge for the SEO health score. We render an SVG ring
 * directly so the centre slot is easy to place numeric content into.
 */
export function ScoreGauge({
  score,
  size = 180,
  thickness = 12,
}: {
  score: number;
  size?: number;
  thickness?: number;
}) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference * (1 - clamped / 100);

  const color =
    clamped >= 80
      ? "hsl(142 90% 55%)"
      : clamped >= 50
      ? "hsl(38 95% 60%)"
      : "hsl(0 75% 60%)";
  const label =
    clamped >= 80 ? "Healthy" : clamped >= 50 ? "Needs work" : "Poor";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(217 33% 18%)"
            strokeWidth={thickness}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={thickness}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{
              transition: "stroke-dashoffset 0.8s cubic-bezier(.2,.8,.2,1)",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold tabular-nums" style={{ color }}>
            <AnimatedNumber value={clamped} format="integer" />
          </span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            of 100
          </span>
        </div>
      </div>
      <span
        className="text-xs font-medium"
        style={{ color }}
      >
        {label}
      </span>
    </div>
  );
}

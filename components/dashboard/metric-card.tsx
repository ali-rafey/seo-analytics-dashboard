"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  format = "integer",
  fractionDigits,
  pulse,
  hint,
  loading,
  accent,
  className,
}: {
  label: string;
  value: number | null | undefined;
  format?: "integer" | "decimal" | "percent" | "duration";
  fractionDigits?: number;
  pulse?: boolean;
  hint?: string;
  loading?: boolean;
  accent?: "green" | "cyan" | "violet" | "pink" | "amber";
  className?: string;
}) {
  const accentClass =
    accent === "green"
      ? "text-neon-green"
      : accent === "cyan"
      ? "text-neon-cyan"
      : accent === "violet"
      ? "text-neon-violet"
      : accent === "pink"
      ? "text-neon-pink"
      : accent === "amber"
      ? "text-neon-amber"
      : "text-foreground";

  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {pulse && (
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-neon-green opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-neon-green" />
            </span>
          )}
        </div>
        <div className={cn("mt-2 text-2xl font-bold tracking-tight", accentClass)}>
          {loading ? (
            <Skeleton className="h-7 w-24" />
          ) : value === null || value === undefined ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <AnimatedNumber
              value={value}
              format={format}
              fractionDigits={fractionDigits ?? (format === "percent" ? 1 : 0)}
            />
          )}
        </div>
        {hint && (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}

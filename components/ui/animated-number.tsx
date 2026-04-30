"use client";

import { useEffect, useRef, useState } from "react";

type Format = "integer" | "decimal" | "percent" | "duration";

export function AnimatedNumber({
  value,
  format = "integer",
  fractionDigits = 1,
  durationMs = 700,
  className,
}: {
  value: number;
  format?: Format;
  fractionDigits?: number;
  durationMs?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const startRef = useRef(value);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = display;
    startTimeRef.current = null;

    function tick(t: number) {
      if (startTimeRef.current === null) startTimeRef.current = t;
      const elapsed = t - startTimeRef.current;
      const progress = Math.min(1, elapsed / durationMs);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = startRef.current + (value - startRef.current) * eased;
      setDisplay(next);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs]);

  return <span className={className}>{formatValue(display, format, fractionDigits)}</span>;
}

function formatValue(
  value: number,
  format: Format,
  fractionDigits: number,
): string {
  if (!Number.isFinite(value)) return "—";
  switch (format) {
    case "integer":
      return Math.round(value).toLocaleString("en-US");
    case "decimal":
      return value.toLocaleString("en-US", {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      });
    case "percent":
      return `${(value * 100).toFixed(fractionDigits)}%`;
    case "duration": {
      const total = Math.max(0, Math.round(value));
      const m = Math.floor(total / 60);
      const s = total % 60;
      return m === 0 ? `${s}s` : `${m}m ${s}s`;
    }
  }
}

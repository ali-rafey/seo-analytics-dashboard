"use client";

import { cn } from "@/lib/utils";
import type { Period } from "@/lib/data/period";

const OPTIONS: { value: Period; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7days", label: "7 days" },
  { value: "30days", label: "30 days" },
  { value: "90days", label: "90 days" },
];

export function PeriodToggle({
  value,
  onChange,
  options = OPTIONS,
}: {
  value: Period;
  onChange: (next: Period) => void;
  options?: { value: Period; label: string }[];
}) {
  return (
    <div
      role="tablist"
      className="inline-flex items-center rounded-md border border-border/60 bg-card/40 p-0.5 text-xs"
    >
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded px-2.5 py-1 font-medium transition-colors",
            o.value === value
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

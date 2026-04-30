import { cn } from "@/lib/utils";

export function SplitPanel({
  left,
  right,
  className,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid h-[calc(100vh-3.5rem)] grid-cols-1 lg:grid-cols-[40fr_60fr]",
        className,
      )}
    >
      <section className="border-b border-border/40 lg:border-b-0 lg:border-r">
        <div className="h-full overflow-hidden">{left}</div>
      </section>
      <section className="overflow-hidden">
        <div className="h-full overflow-y-auto scrollbar-thin">{right}</div>
      </section>
    </div>
  );
}

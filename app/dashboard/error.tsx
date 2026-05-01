"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * App Router error boundary for /dashboard. Catches anything thrown during
 * server rendering or in a client component on the route. Without this, a
 * single broken integration response or stream blanks the entire screen on
 * refresh — the user just sees nothing.
 *
 * The `reset()` callback re-runs the failed segment (refetches the server
 * component and remounts client components), which fixes most transient
 * issues (cold-start timeout, brief Redis/DB blip).
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to Vercel logs (with digest if available so it can be correlated
    // with server-side stack trace, since Next.js redacts errors client-side).
    console.error("[dashboard] route error:", error.message, error.digest);
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center p-6">
      <div className="max-w-md space-y-4 rounded-lg border border-destructive/40 bg-destructive/5 p-6">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Something went wrong</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          The dashboard hit an unexpected error while loading. This is usually
          a temporary blip — try again in a moment.
        </p>
        {error.digest && (
          <p className="font-mono text-[10px] text-muted-foreground/60">
            Reference: {error.digest}
          </p>
        )}
        <div className="flex gap-2">
          <Button onClick={reset}>
            <RefreshCw className="h-4 w-4" /> Try again
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              if (typeof window !== "undefined") window.location.href = "/dashboard";
            }}
          >
            Reload dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

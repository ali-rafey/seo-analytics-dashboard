import { Loader2 } from "lucide-react";

/**
 * Shown while the server component for /dashboard is fetching session +
 * products. Without this, a slow DB query produces a totally blank screen
 * for the user — especially noticeable on cold-start serverless functions.
 */
export default function DashboardLoading() {
  return (
    <div className="grid h-screen w-full place-items-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm">Loading your dashboard…</p>
      </div>
    </div>
  );
}

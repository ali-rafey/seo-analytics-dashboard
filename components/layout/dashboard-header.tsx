"use client";

import { signOut } from "next-auth/react";
import { Activity, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardHeader({
  user,
}: {
  user: { name: string | null; email: string | null; image: string | null };
}) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/40 bg-background/80 px-6 py-3 backdrop-blur">
      <div className="flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-neon-green opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-neon-green" />
        </span>
        <span className="text-sm font-semibold tracking-tight">
          SEO &amp; Analytics
        </span>
        <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">
          <Activity className="-mt-0.5 mr-1 inline h-3 w-3" />
          Live
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-xs font-medium leading-tight">
            {user.name ?? user.email}
          </p>
          {user.name && (
            <p className="text-[10px] text-muted-foreground leading-tight">
              {user.email}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => signOut({ callbackUrl: "/login" })}
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}

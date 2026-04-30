import Link from "next/link";
import { Activity } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border/40 px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-neon-green opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-neon-green" />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            SEO &amp; Analytics Dashboard
          </span>
        </Link>
        <Link
          href="https://github.com"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          <Activity className="inline h-3.5 w-3.5" /> v0.1
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center p-6">
        {children}
      </main>
    </div>
  );
}

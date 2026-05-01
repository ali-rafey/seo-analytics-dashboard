"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Compass,
  Gauge,
  Globe2,
  LineChart,
  Github,
} from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ProductSummary } from "@/lib/types";
import { OverviewTab } from "@/components/dashboard/tabs/overview-tab";
import { TrafficSourcesTab } from "@/components/dashboard/tabs/traffic-sources-tab";
import { SeoScoreTab } from "@/components/dashboard/tabs/seo-score-tab";
import { ReachTab } from "@/components/dashboard/tabs/reach-tab";
import { GithubAuditTab } from "@/components/dashboard/tabs/github-audit-tab";
import { LiveVisitorsTab } from "@/components/dashboard/tabs/live-visitors-tab";

const VALID_TABS = [
  "overview",
  "traffic",
  "seo",
  "reach",
  "github",
  "live",
] as const;
type TabValue = (typeof VALID_TABS)[number];

function readTabFromHash(): TabValue {
  if (typeof window === "undefined") return "overview";
  const h = window.location.hash.replace(/^#/, "") as TabValue;
  return (VALID_TABS as readonly string[]).includes(h) ? h : "overview";
}

export function DashboardTabs({ product }: { product: ProductSummary }) {
  // Initial state: render with default "overview" on server + first client paint
  // (avoids hydration mismatch — window.location.hash isn't available SSR), then
  // sync from the URL hash in an effect. This makes refresh preserve the tab
  // without forcing the entire page to render client-only.
  const [tab, setTab] = useState<TabValue>("overview");

  useEffect(() => {
    setTab(readTabFromHash());
    const onHashChange = () => setTab(readTabFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  function onTabChange(next: string) {
    if (!(VALID_TABS as readonly string[]).includes(next)) return;
    setTab(next as TabValue);
    // Use history.replaceState rather than pushState so back-button isn't
    // polluted by every tab click.
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.hash = next;
      window.history.replaceState(null, "", url.toString());
    }
  }

  return (
    <div className="flex h-full flex-col p-4">
      <Tabs
        value={tab}
        onValueChange={onTabChange}
        className="flex h-full flex-col"
      >
        <TabsList className="self-start">
          <TabsTrigger value="overview" className="gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="traffic" className="gap-1.5">
            <Compass className="h-3.5 w-3.5" /> Traffic
          </TabsTrigger>
          <TabsTrigger value="seo" className="gap-1.5">
            <Gauge className="h-3.5 w-3.5" /> SEO Score
          </TabsTrigger>
          <TabsTrigger value="reach" className="gap-1.5">
            <LineChart className="h-3.5 w-3.5" /> Reach
          </TabsTrigger>
          <TabsTrigger value="github" className="gap-1.5">
            <Github className="h-3.5 w-3.5" /> Codebase
          </TabsTrigger>
          <TabsTrigger value="live" className="gap-1.5">
            <Globe2 className="h-3.5 w-3.5" /> Live Map
          </TabsTrigger>
        </TabsList>

        <div className="mt-4 flex-1 overflow-y-auto pr-1 scrollbar-thin">
          <TabsContent value="overview"><OverviewTab product={product} /></TabsContent>
          <TabsContent value="traffic"><TrafficSourcesTab product={product} /></TabsContent>
          <TabsContent value="seo"><SeoScoreTab product={product} /></TabsContent>
          <TabsContent value="reach"><ReachTab product={product} /></TabsContent>
          <TabsContent value="github"><GithubAuditTab product={product} /></TabsContent>
          <TabsContent value="live"><LiveVisitorsTab product={product} /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

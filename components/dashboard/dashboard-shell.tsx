"use client";

import { Suspense } from "react";

import { SplitPanel } from "@/components/layout/split-panel";
import { ProductPreviewPanel } from "@/components/dashboard/product-preview-panel";
import { DashboardTabs } from "@/components/dashboard/dashboard-tabs";
import { EmptyDashboard } from "@/components/dashboard/empty-dashboard";
import { ConnectionToaster } from "@/components/dashboard/connection-toaster";
import type { ProductSummary } from "@/lib/types";

export function DashboardShell({
  products,
  activeProductId,
}: {
  products: ProductSummary[];
  activeProductId: string | null;
}) {
  if (products.length === 0 || !activeProductId) {
    return (
      <div className="p-6">
        <Suspense fallback={null}>
          <ConnectionToaster />
        </Suspense>
        <EmptyDashboard />
      </div>
    );
  }

  const activeProduct =
    products.find((p) => p.id === activeProductId) ?? products[0];

  return (
    <>
      <Suspense fallback={null}>
        <ConnectionToaster />
      </Suspense>
      <SplitPanel
        left={
          <ProductPreviewPanel products={products} activeProduct={activeProduct} />
        }
        right={<DashboardTabs product={activeProduct} />}
      />
    </>
  );
}

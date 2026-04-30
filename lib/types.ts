import type { IntegrationProvider, IntegrationStatus } from "@prisma/client";

export type ProductSummary = {
  id: string;
  name: string;
  url: string;
  logoUrl: string | null;
  description: string | null;
  integrations: {
    provider: IntegrationProvider;
    status: IntegrationStatus;
    lastSyncedAt: Date | null;
  }[];
};

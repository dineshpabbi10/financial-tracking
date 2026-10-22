export interface PlaidConnectedAccount {
  id: string;
  name: string;
  mask: string | null;
  type: string;
}

export interface PlaidConnectionSummary {
  id: string;
  institutionName: string;
  accountCount: number;
  accounts: PlaidConnectedAccount[];
  lastSyncedLabel: string;
  lastSyncedExact: string | null;
  lastSyncError: string | null;
}

export interface PlaidOverview {
  configured: boolean;
  env: "sandbox" | "production";
  maxItems: number;
  missing: string[];
  redirectConfigured: boolean;
  webhookConfigured: boolean;
  demo: boolean;
  items: PlaidConnectionSummary[];
  totalItems: number;
}

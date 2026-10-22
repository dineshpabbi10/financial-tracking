import "server-only";
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
} from "plaid";
import { plaidEncryptionKeyConfigured } from "@/lib/plaid/crypto";

const PLAID_ENV_VALUES = ["sandbox", "production"] as const;
export type PlaidEnvironment = (typeof PLAID_ENV_VALUES)[number];

export interface PlaidConfigStatus {
  configured: boolean;
  env: PlaidEnvironment;
  missing: string[];
  redirectUri: string | null;
  webhookConfigured: boolean;
  maxItems: number;
}

function rawEnv(): string {
  return (process.env.PLAID_ENV ?? "production").trim().toLowerCase();
}

export function plaidEnvironment(): PlaidEnvironment {
  const value = rawEnv();
  return (PLAID_ENV_VALUES as readonly string[]).includes(value)
    ? (value as PlaidEnvironment)
    : "production";
}

export function plaidMaxItems(): number {
  const parsed = Number(process.env.PLAID_MAX_ITEMS ?? "10");
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) return 10;
  return parsed;
}

export function plaidRedirectUri(): string | null {
  const value = process.env.PLAID_REDIRECT_URI?.trim();
  return value || null;
}

export function plaidWebhookUrl(): string | null {
  const value = process.env.PLAID_WEBHOOK_URL?.trim();
  return value || null;
}

export function plaidConfigStatus(): PlaidConfigStatus {
  const missing: string[] = [];
  if (!process.env.PLAID_CLIENT_ID?.trim()) missing.push("PLAID_CLIENT_ID");
  if (!process.env.PLAID_SECRET?.trim()) missing.push("PLAID_SECRET");
  if (!plaidEncryptionKeyConfigured()) {
    missing.push("PLAID_TOKEN_ENCRYPTION_KEY");
  }
  if (!(PLAID_ENV_VALUES as readonly string[]).includes(rawEnv())) {
    missing.push("PLAID_ENV (sandbox or production)");
  }
  return {
    configured: missing.length === 0,
    env: plaidEnvironment(),
    missing,
    redirectUri: plaidRedirectUri(),
    webhookConfigured: Boolean(plaidWebhookUrl()),
    maxItems: plaidMaxItems(),
  };
}

export function isPlaidConfigured(): boolean {
  return plaidConfigStatus().configured;
}

export class PlaidConfigurationError extends Error {
  constructor(message = "Plaid is not configured.") {
    super(message);
  }
}

let cachedClient: PlaidApi | null = null;
let cachedSignature = "";

export function getPlaidClient(): PlaidApi {
  const status = plaidConfigStatus();
  if (!status.configured) {
    throw new PlaidConfigurationError(
      `Plaid is missing configuration: ${status.missing.join(", ")}.`,
    );
  }
  const clientId = process.env.PLAID_CLIENT_ID!.trim();
  const secret = process.env.PLAID_SECRET!.trim();
  const signature = `${status.env}|${clientId}|${secret.slice(0, 4)}`;
  if (cachedClient && cachedSignature === signature) return cachedClient;

  const configuration = new Configuration({
    basePath: PlaidEnvironments[status.env],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
        "Plaid-Version": "2020-09-14",
      },
    },
  });
  cachedClient = new PlaidApi(configuration);
  cachedSignature = signature;
  return cachedClient;
}

interface PlaidApiErrorShape {
  response?: {
    data?: {
      error_code?: unknown;
      error_message?: unknown;
      request_id?: unknown;
    };
  };
}

export function plaidErrorDetails(error: unknown): {
  code: string | null;
  requestId: string | null;
  message: string;
} {
  if (error instanceof PlaidConfigurationError) {
    return { code: "CONFIGURATION", requestId: null, message: error.message };
  }
  const shape = error as PlaidApiErrorShape;
  const data = shape?.response?.data;
  const code = typeof data?.error_code === "string" ? data.error_code : null;
  const requestId =
    typeof data?.request_id === "string" ? data.request_id : null;
  const rawMessage =
    typeof data?.error_message === "string"
      ? data.error_message
      : error instanceof Error
        ? error.message
        : "Unknown Plaid error.";
  return { code, requestId, message: rawMessage };
}

/** User-facing messages that never include access tokens or request bodies. */
export function plaidErrorMessage(error: unknown): string {
  const { code, message } = plaidErrorDetails(error);
  switch (code) {
    case "CONFIGURATION":
      return message;
    case "INVALID_API_KEYS":
    case "INVALID_CLIENT_ID":
    case "INVALID_SECRET":
      return "Plaid rejected the configured credentials. Check PLAID_CLIENT_ID and PLAID_SECRET.";
    case "INVALID_PUBLIC_TOKEN":
      return "That Plaid Link session has expired. Please try connecting again.";
    case "INVALID_ACCESS_TOKEN":
      return "This bank connection is no longer valid. Disconnect it and link the bank again.";
    case "ITEM_LOGIN_REQUIRED":
      return "Your bank needs you to sign in again. Disconnect this connection and link the bank again.";
    case "MFA_NOT_SUPPORTED":
    case "ITEM_NOT_SUPPORTED":
      return "Your bank uses a sign-in or MFA method that Plaid cannot support. Try enabling trusted-device or SMS verification at the bank, use a different account, or import statements manually.";
    case "PRODUCT_NOT_READY":
    case "TRANSACTIONS_NOT_READY":
      return "Plaid is still preparing this bank's transactions. Try syncing again in a minute.";
    case "RATE_LIMIT_EXCEEDED":
      return "Plaid is rate limiting requests. Wait a minute and try again.";
    case "INSTITUTION_NOT_RESPONDING":
      return "The bank is not responding through Plaid right now. Try again shortly.";
    case "INSTITUTION_DOWN":
      return "The bank's Plaid connection is temporarily unavailable. Try again later.";
    default:
      return message.length > 300 ? "Plaid could not complete that request." : message;
  }
}

/** Log only safe diagnostic fields; Plaid errors can contain request bodies. */
export function logPlaidError(context: string, error: unknown): void {
  const { code, requestId } = plaidErrorDetails(error);
  console.error(`[plaid] ${context}`, {
    code: code ?? "UNKNOWN",
    requestId,
  });
}

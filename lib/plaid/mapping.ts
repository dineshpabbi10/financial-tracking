import { createHash } from "node:crypto";
import {
  categorizeTransaction,
  type CategoryId,
} from "@/lib/categories";

export type LocalAccountType =
  | "chequing"
  | "savings"
  | "credit"
  | "investment"
  | "loan"
  | "other";

export function plaidAmountToCents(amount: number): number {
  if (!Number.isFinite(amount)) throw new Error("Invalid Plaid amount.");
  const cents = Math.round(amount * 100);
  if (!Number.isSafeInteger(cents) || Math.abs(cents) > 2_000_000_000) {
    throw new Error("Plaid amount is outside the supported range.");
  }
  return cents;
}

export function mapPlaidAccountType(
  type: string,
  subtype: string | null | undefined,
): LocalAccountType {
  const normalizedType = type.toLowerCase();
  const normalizedSubtype = (subtype ?? "").toLowerCase();
  if (normalizedType === "depository") {
    if (normalizedSubtype.includes("checking")) return "chequing";
    if (
      normalizedSubtype.includes("savings") ||
      normalizedSubtype.includes("money market") ||
      normalizedSubtype.includes("cash management")
    ) {
      return "savings";
    }
    return "chequing";
  }
  if (normalizedType === "credit") return "credit";
  if (normalizedType === "loan") return "loan";
  if (normalizedType === "investment") return "investment";
  return "other";
}

export function plaidAccountName(account: {
  name: string;
  official_name?: string | null;
}): string {
  const official = account.official_name?.replace(/\s+/g, " ").trim();
  const name = account.name?.replace(/\s+/g, " ").trim();
  return official || name || "Connected account";
}

export function plaidTransactionHash(transactionId: string): string {
  return createHash("sha256").update(`plaid:${transactionId}`).digest("hex");
}

function mapPlaidCategory(
  category: {
    primary?: string | null;
    detailed?: string | null;
  } | null | undefined,
  amountCents: number,
): CategoryId {
  if (!category) return "other";
  const primary = (category.primary ?? "").toUpperCase();
  const detailed = (category.detailed ?? "").toUpperCase();

  if (primary === "INCOME") return "income";
  if (primary === "TRANSFER_IN" || primary === "TRANSFER_OUT") {
    return "transfers";
  }
  if (primary === "LOAN_PAYMENTS") return "debt";
  if (primary === "BANK_FEES") return "fees";
  if (primary === "RENT_AND_UTILITIES") {
    if (detailed.includes("RENT")) return "housing";
    if (
      detailed.includes("STREAMING") ||
      detailed.includes("SUBSCRIPTION") ||
      detailed.includes("TELEVISION")
    ) {
      return "subscriptions";
    }
    return "utilities";
  }
  if (primary === "FOOD_AND_DRINK") {
    if (detailed.includes("GROCER") || detailed.includes("SUPERMARKET")) {
      return "groceries";
    }
    return "dining";
  }
  if (primary === "TRANSPORTATION") return "transport";
  if (primary === "TRAVEL") return "travel";
  if (primary === "GENERAL_MERCHANDISE") return "shopping";
  if (primary === "MEDICAL") return "health";
  if (primary === "ENTERTAINMENT") return "entertainment";
  if (primary === "INSURANCE") return "insurance";
  if (primary === "PERSONAL_CARE") return "shopping";
  if (primary === "HOME_IMPROVEMENT") return "shopping";
  if (primary === "GENERAL_SERVICES") {
    if (detailed.includes("INSURANCE")) return "insurance";
    if (
      detailed.includes("SUBSCRIPTION") ||
      detailed.includes("STREAMING")
    ) {
      return "subscriptions";
    }
    return "other";
  }
  if (primary === "GOVERNMENT_AND_NON_PROFIT") {
    return amountCents < 0 ? "income" : "other";
  }
  return "other";
}

/**
 * Curated Canadian merchant rules come first. Plaid's richer category is the
 * fallback for merchants our local rules do not recognize.
 */
export function categorizePlaidTransaction(input: {
  merchantName?: string | null;
  name: string;
  amountCents: number;
  personalFinanceCategory?: {
    primary?: string | null;
    detailed?: string | null;
  } | null;
}): CategoryId {
  const local = categorizeTransaction({
    merchantName: input.merchantName,
    name: input.name,
  });
  if (local !== "other") return local;
  return mapPlaidCategory(input.personalFinanceCategory, input.amountCents);
}

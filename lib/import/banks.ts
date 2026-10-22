import type { BankPreset } from "@/lib/import/types";

/**
 * Canadian bank presets. CSV exports vary by product and change over time,
 * so these are hints for auto-detection — every import can be re-mapped.
 */
export const BANK_PRESETS: BankPreset[] = [
  {
    id: "rbc",
    name: "RBC Royal Bank",
    shortName: "RBC",
    description: "Chequing, savings, and RBC credit cards",
    csvSignatures: [
      ["transaction date", "description 1"],
      ["transaction date", "cad$"],
      ["posted date", "description"],
    ],
    dateFormat: "ymd",
    amountConvention: "negative-outflow",
  },
  {
    id: "td",
    name: "TD Canada Trust",
    shortName: "TD",
    description: "Chequing, savings, and TD credit cards",
    csvSignatures: [
      ["date", "description", "debit", "credit"],
      ["transaction date", "description", "debit"],
    ],
    dateFormat: "mdy",
    amountConvention: "negative-outflow",
  },
  {
    id: "scotiabank",
    name: "Scotiabank",
    shortName: "Scotiabank",
    description: "Bank accounts and Scene+ cards",
    csvSignatures: [
      ["date", "description", "amount", "balance"],
      ["transaction date", "description", "amount"],
    ],
    dateFormat: "mdy",
    amountConvention: "negative-outflow",
  },
  {
    id: "bmo",
    name: "BMO Bank of Montreal",
    shortName: "BMO",
    description: "Chequing, savings, and BMO credit cards",
    csvSignatures: [
      ["date", "description", "amount", "balance"],
      ["transaction date", "description", "debit", "credit"],
    ],
    dateFormat: "mdy",
    amountConvention: "negative-outflow",
  },
  {
    id: "cibc",
    name: "CIBC",
    shortName: "CIBC",
    description: "Chequing, savings, and CIBC credit cards",
    csvSignatures: [
      ["date", "description", "debit", "credit"],
      ["transaction date", "description", "amount"],
    ],
    dateFormat: "mdy",
    amountConvention: "negative-outflow",
  },
  {
    id: "amex",
    name: "American Express",
    shortName: "Amex",
    description: "Amex Canada credit card statements",
    csvSignatures: [
      ["date", "description", "amount"],
      ["transaction date", "description", "amount"],
    ],
    dateFormat: "mdy",
    amountConvention: "positive-outflow",
  },
  {
    id: "desjardins",
    name: "Desjardins",
    shortName: "Desjardins",
    description: "Desjardins accounts and cards, English or French",
    csvSignatures: [
      ["date", "description", "debit", "credit"],
      ["date", "libellé", "montant"],
      ["date", "description", "montant", "solde"],
    ],
    dateFormat: "dmy",
    amountConvention: "negative-outflow",
  },
  {
    id: "other",
    name: "Other / generic",
    shortName: "Other",
    description: "Any CSV or PDF statement",
    csvSignatures: [],
    dateFormat: "auto",
    amountConvention: "negative-outflow",
  },
];

export function getBankPreset(id: string | null | undefined): BankPreset | null {
  return BANK_PRESETS.find((preset) => preset.id === id) ?? null;
}

export function bankPresetName(id: string | null | undefined): string {
  return getBankPreset(id)?.name ?? "Other / generic";
}

/** Try to identify a bank from the file name and parsed CSV headers. */
export function detectBankPreset(
  filename: string,
  headers: string[],
): BankPreset | null {
  const filenameLower = filename.toLowerCase();
  const byName = BANK_PRESETS.find(
    (preset) =>
      preset.id !== "other" &&
      (filenameLower.includes(preset.id) ||
        filenameLower.includes(preset.shortName.toLowerCase().replace(/\s/g, ""))),
  );
  if (byName) return byName;

  const headerText = headers.join(" ").toLowerCase();
  let best: { preset: BankPreset; score: number } | null = null;
  for (const preset of BANK_PRESETS) {
    for (const signature of preset.csvSignatures) {
      if (signature.every((part) => headerText.includes(part))) {
        const score = signature.reduce((sum, part) => sum + part.length, 0);
        if (!best || score > best.score) best = { preset, score };
      }
    }
  }
  return best?.preset ?? null;
}

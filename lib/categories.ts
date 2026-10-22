export const CATEGORY_IDS = [
  "housing",
  "groceries",
  "dining",
  "transport",
  "subscriptions",
  "utilities",
  "shopping",
  "health",
  "entertainment",
  "travel",
  "insurance",
  "debt",
  "fees",
  "transfers",
  "income",
  "other",
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export interface CategoryDefinition {
  id: CategoryId;
  label: string;
  color: string;
  /** Can this category have a monthly budget? */
  budgetable: boolean;
  /** Counts toward "spending" totals. */
  spending: boolean;
}

export const CATEGORIES: Record<CategoryId, CategoryDefinition> = {
  housing: { id: "housing", label: "Housing", color: "#9a6a3a", budgetable: true, spending: true },
  groceries: { id: "groceries", label: "Groceries", color: "#2f7d5a", budgetable: true, spending: true },
  dining: { id: "dining", label: "Dining out", color: "#d97706", budgetable: true, spending: true },
  transport: { id: "transport", label: "Transport", color: "#2563eb", budgetable: true, spending: true },
  subscriptions: { id: "subscriptions", label: "Subscriptions", color: "#7c3aed", budgetable: true, spending: true },
  utilities: { id: "utilities", label: "Utilities", color: "#0891b2", budgetable: true, spending: true },
  shopping: { id: "shopping", label: "Shopping", color: "#db2777", budgetable: true, spending: true },
  health: { id: "health", label: "Health & fitness", color: "#dc2626", budgetable: true, spending: true },
  entertainment: { id: "entertainment", label: "Entertainment", color: "#9333ea", budgetable: true, spending: true },
  travel: { id: "travel", label: "Travel", color: "#0d9488", budgetable: true, spending: true },
  insurance: { id: "insurance", label: "Insurance", color: "#64748b", budgetable: true, spending: true },
  debt: { id: "debt", label: "Debt payments", color: "#b45309", budgetable: true, spending: true },
  fees: { id: "fees", label: "Bank fees", color: "#9f1239", budgetable: true, spending: true },
  transfers: { id: "transfers", label: "Transfers", color: "#94a3b8", budgetable: false, spending: false },
  income: { id: "income", label: "Income", color: "#15803d", budgetable: false, spending: false },
  other: { id: "other", label: "Other", color: "#78716c", budgetable: true, spending: true },
};

export const CATEGORY_LIST: CategoryDefinition[] = CATEGORY_IDS.map((id) => CATEGORIES[id]);

export const SPENDING_CATEGORY_IDS = CATEGORY_LIST.filter((c) => c.spending).map((c) => c.id);

export const BUDGETABLE_CATEGORIES = CATEGORY_LIST.filter((c) => c.budgetable);

export function isCategoryId(value: string): value is CategoryId {
  return (CATEGORY_IDS as readonly string[]).includes(value);
}

export function categoryLabel(id: string): string {
  return isCategoryId(id) ? CATEGORIES[id].label : "Other";
}

export function categoryColor(id: string): string {
  return isCategoryId(id) ? CATEGORIES[id].color : CATEGORIES.other.color;
}

export function categoryIsSpending(id: string): boolean {
  return isCategoryId(id) ? CATEGORIES[id].spending : true;
}

/** The category actually shown for a transaction. */
export function effectiveCategory(tx: {
  category: string;
  categoryOverride?: string | null;
}): CategoryId {
  if (tx.categoryOverride && isCategoryId(tx.categoryOverride)) {
    return tx.categoryOverride;
  }
  return isCategoryId(tx.category) ? tx.category : "other";
}

export function categoryLabelForTransaction(tx: {
  category: string;
  categoryOverride?: string | null;
}): string {
  return categoryLabel(effectiveCategory(tx));
}

type Rule = { pattern: RegExp; category: CategoryId };

/**
 * Curated rules for merchants common in Canada. Order matters: more specific
 * rules come first (e.g. "Uber Eats" before "Uber", "Costco Gas" before
 * "Costco").
 */
const MERCHANT_RULES: Rule[] = [
  // Income and government deposits
  { pattern: /\b(payroll|pay roll|salary|direct dep(osit)?|paycheque|paycheck|acme|employer|gig pay|wage)\b/i, category: "income" },
  { pattern: /\b(government of canada|canada revenue|gst credit|tax refund|ccb|ontario trillium)\b/i, category: "income" },
  { pattern: /\b(interest earned|dividend|qualified dividend)\b/i, category: "income" },

  // Housing
  { pattern: /\b(rent(?!al)|mortgage|property tax|strata|condo fee|condo corp|landlord)\b/i, category: "housing" },

  // Transfers and card payments. Keep the explicit "internet transfer" rule
  // before utilities so a bank description like "INTERNET TRANSFER TO CARD"
  // is not mistaken for an internet bill.
  { pattern: /\b(?:internet|online|funds|wire)\s+transfer\b/i, category: "transfers" },

  // Utilities & telecom
  { pattern: /\b(hydro|enbridge|natural gas|electricity|water bill|utility|utilities|toronto water)\b/i, category: "utilities" },
  { pattern: /\b(bell canada|rogers|telus|fido|koodo|freedom mobile|shaw|videotron|cogeco|internet|wireless|telecom|mobile plan)\b/i, category: "utilities" },

  // Subscriptions (before generic entertainment)
  { pattern: /\b(netflix|spotify|disney|disney\+|crave|prime video|amazon prime|apple\.com\/bill|apple one|icloud|youtube premium|audible|adobe|microsoft 365|dropbox|google one|openai|chatgpt|anthropic|claude|midjourney|patreon|substack|kindle unlimited|canva)\b/i, category: "subscriptions" },

  // Insurance
  { pattern: /\b(insurance|intact|belairdirect|aviva|manulife|sun life|desjardins insurance|td insurance|caa)\b/i, category: "insurance" },

  // Debt / loans (credit-card payments are transfers, handled below)
  { pattern: /\b(student loan|auto loan|car loan|line of credit|loc payment|loan payment|loan interest)\b/i, category: "debt" },

  // Fees
  { pattern: /\b(bank fee|service charge|account fee|monthly fee|nsf|overdraft|atm fee|annual fee|interest charge|foreign transaction)\b/i, category: "fees" },

  // Transfers and card payments
  { pattern: /\b(e-?transfer|interac|transfer|tfr|payment thank you|credit card (payment|pmt)|cc payment|card payment|balance transfer)\b/i, category: "transfers" },

  // Transport (specific first)
  { pattern: /\b(uber eats|skip ?the ?dishes|doordash|instacart)\b/i, category: "dining" },
  { pattern: /\b(presto|ttc|go transit|via rail|uber|lyft|petro[- ]?canada|esso|shell|chevron|canadian tire gas|gas bar|fuel|parking|impark|green p|car wash|transit|compass card|exo)\b/i, category: "transport" },

  // Travel
  { pattern: /\b(air canada|westjet|porter airlines|airbnb|booking\.com|expedia|hotel|marriott|hilton|fairmont|flight|airline|vacation|sunwing|transat)\b/i, category: "travel" },

  // Groceries
  { pattern: /\b(loblaws|no frills|nf loblaws|metro|sobeys|safeway|freshco|food basics|superstore|iga|provigo|farm boy|longo'?s|t&t|costco|bulk barn|grocery|grocer|save-on-foods|whole foods|value-mart|walmart groceries|instacart)\b/i, category: "groceries" },

  // Dining
  { pattern: /\b(tim hortons|tim hortons|tims|starbucks|mcdonald'?s?|a&w|popeyes|subway|chipotle|doordash|skip ?the ?dishes|restaurant|cafe|coffee|bistro|pizza|sushi|ramen|shawarma|taco|burger|five guys|harvey'?s|swiss chalet|wendy'?s|the keg|earls|montana'?s|boston pizza|lcbo|beer store|liquor|bakery|donut|doughnut|pub|bar & grill)\b/i, category: "dining" },

  // Health & fitness
  { pattern: /\b(pharmacy|shoppers drug mart|rexall|dentist|dental|medical|clinic|physio|chiro|optometrist|massage|goodlife|planet fitness|fit4less|gym|fitness|yoga|therapy|therapist|wellness)\b/i, category: "health" },

  // Entertainment
  { pattern: /\b(cineplex|landmark|ticketmaster|steam|playstation|xbox|nintendo|eventbrite|movie|theatre|concert|museum|golf)\b/i, category: "entertainment" },

  // Shopping
  { pattern: /\b(amazon|walmart|canadian tire|home depot|ikea|winners|marshalls|dollarama|indigo|best buy|apple store|sephora|lululemon|simons|hudson'?s bay|the bay|sport chek|\bmec\b|uniqlo|zara|h&m|home hardware|rona|staples|petsmart|michaels|wayfair|etsy)\b/i, category: "shopping" },
];

/**
 * Best-effort categorizer for statement descriptions. Curated merchant rules
 * win; anything unrecognized stays in "other" so the user can recategorize it.
 */
export function categorizeTransaction(input: {
  merchantName?: string | null;
  name: string;
}): CategoryId {
  const text = `${input.merchantName ?? ""} ${input.name}`.trim();
  for (const rule of MERCHANT_RULES) {
    if (rule.pattern.test(text)) return rule.category;
  }
  return "other";
}

/** Strip statement noise so the same bill groups together each month. */
export function cleanMerchantName(raw: string): string {
  let value = raw
    .replace(/\s+/g, " ")
    .replace(/\b(POS|PURCHASE|DEBIT|CREDIT|PRE-?AUTHORIZED|RECURRING|ONLINE|INTERAC)\b/gi, " ")
    .replace(/\b(?:TXN|REF|AUTH|TRACE|ID)[#:\s-]*[A-Z0-9]{5,}\b/gi, " ")
    .replace(/#\s*\d{2,}/g, " ")
    .replace(/\b\d{2}\/\d{2}(?:\/\d{2,4})?\b/g, " ")
    .replace(/\b\d{10,}\b/g, " ")
    .replace(/\b(?:ON|BC|AB|QC|MB|SK|NS|NB|NL|PE|YT|NT|NU)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  value = value.replace(/[\s\-–—:*,]+$/g, "").trim();
  return value || raw.trim();
}

export function merchantKey(raw: string): string {
  return cleanMerchantName(raw)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

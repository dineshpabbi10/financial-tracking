import "server-only";
import type { Prisma } from "@prisma/client";
import { addDays, daysInMonth, endOfMonth, lastNMonths, startOfMonth, today } from "@/lib/dates";
import { db } from "@/lib/db";
import { refreshRecurringSeries } from "@/lib/recurring-store";

/**
 * Deterministic demo data. Deliberately Canadian: RBC/Amex accounts, payroll,
 * Toronto rent, Hydro Ottawa, Presto, Canadian subscriptions. Dates are
 * generated relative to today so upcoming bills always look alive.
 */
function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function monthlyDates(day: number, start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  let cursor = startOfMonth(start);
  while (cursor.getTime() <= end.getTime()) {
    const candidate = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), day, 12),
    );
    if (candidate >= start && candidate <= end) dates.push(candidate);
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1, 12));
  }
  return dates;
}

interface DemoRow {
  accountId: string;
  date: Date;
  merchantName: string;
  name: string;
  amountCents: number;
  category: string;
  pending: boolean;
}

export interface DemoSeedResult {
  accounts: number;
  transactions: number;
  recurring: number;
}

const DEMO_BUDGETS_SETTING = "demo.budgetIds";

async function readDemoBudgetIds(): Promise<string[]> {
  const setting = await db.setting.findUnique({
    where: { key: DEMO_BUDGETS_SETTING },
  });
  if (!setting) return [];
  try {
    const parsed: unknown = JSON.parse(setting.value);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

/** Remove only budgets created by the demo, never the user's own limits. */
export async function clearDemoBudgets(): Promise<void> {
  const ids = await readDemoBudgetIds();
  if (ids.length > 0) {
    await db.budget.deleteMany({ where: { id: { in: ids } } });
  }
  await db.setting.deleteMany({ where: { key: DEMO_BUDGETS_SETTING } });
}

export async function clearDemoData(): Promise<{ accountsRemoved: number }> {
  const removed = await db.account.deleteMany({ where: { isDemo: true } });
  await clearDemoBudgets();
  await refreshRecurringSeries();
  return { accountsRemoved: removed.count };
}

export async function seedDemoData(): Promise<DemoSeedResult> {
  const anchor = today();
  const start = lastNMonths(9, anchor)[0].start;

  // Re-seeding clears the previous demo dataset but leaves real accounts.
  await db.account.deleteMany({ where: { isDemo: true } });
  await clearDemoBudgets();

  const chequing = await db.account.create({
    data: {
      name: "Signature No Limit Chequing",
      institution: "RBC Royal Bank",
      bankPreset: "rbc",
      mask: "0451",
      type: "chequing",
      currentBalanceCents: 584_213,
      availableBalanceCents: 584_213,
      currency: "CAD",
      isDemo: true,
    },
  });
  const savings = await db.account.create({
    data: {
      name: "High Interest eSavings",
      institution: "RBC Royal Bank",
      bankPreset: "rbc",
      mask: "8820",
      type: "savings",
      currentBalanceCents: 1_248_055,
      availableBalanceCents: 1_248_055,
      currency: "CAD",
      isDemo: true,
    },
  });
  const visa = await db.account.create({
    data: {
      name: "Avion Visa Infinite",
      institution: "RBC Royal Bank",
      bankPreset: "rbc",
      mask: "1934",
      type: "credit",
      currentBalanceCents: 184_265,
      availableBalanceCents: 525_735,
      currency: "CAD",
      isDemo: true,
    },
  });
  const cobalt = await db.account.create({
    data: {
      name: "Cobalt Card",
      institution: "American Express",
      bankPreset: "amex",
      mask: "3007",
      type: "credit",
      currentBalanceCents: 98_732,
      availableBalanceCents: 240_100,
      currency: "CAD",
      isDemo: true,
    },
  });

  const random = mulberry32(20261022);
  const rows: DemoRow[] = [];

  function add(
    accountId: string,
    date: Date,
    merchantName: string,
    name: string,
    amountCents: number,
    category: string,
    pending = false,
  ) {
    if (date < start || date > anchor) return;
    rows.push({ accountId, date, merchantName, name, amountCents, category, pending });
  }

  function addMonthly(
    accountId: string,
    day: number,
    merchantName: string,
    name: string,
    amount: number | (() => number),
    category: string,
  ) {
    for (const date of monthlyDates(day, start, anchor)) {
      add(
        accountId,
        date,
        merchantName,
        name,
        typeof amount === "function" ? amount() : amount,
        category,
      );
    }
  }

  // --- Recurring income -----------------------------------------------------
  let payday = anchor;
  while (payday.getUTCDay() !== 5) payday = addDays(payday, -1);
  for (let date = payday; date >= start; date = addDays(date, -14)) {
    add(chequing.id, date, "Acme Corp Payroll", "ACME CORP PAYROLL DEPOSIT", -365_000, "income");
  }

  // --- Housing & bills ------------------------------------------------------
  addMonthly(chequing.id, 1, "Maple Grove Property Management", "E-TRANSFER RENT - MAPLE GROVE", 215_000, "housing");
  addMonthly(chequing.id, 2, "RBC", "RBC MONTHLY ACCOUNT FEE", 1_695, "fees");
  addMonthly(chequing.id, 5, "Bell Canada", "BELL CANADA - FIBE INTERNET", 9_450, "utilities");
  addMonthly(chequing.id, 15, "TD Insurance Auto", "TD INSURANCE AUTO PREMIUM", 16_800, "insurance");
  addMonthly(chequing.id, 18, "Hydro Ottawa", "HYDRO OTTAWA BILL PAYMENT", () => 11_800 + Math.floor(random() * 7_000), "utilities");
  addMonthly(chequing.id, 20, "Rogers Wireless", "ROGERS WIRELESS MOBILE", 8_991, "utilities");
  addMonthly(chequing.id, 22, "Desjardins Insurance", "DESJARDINS TENANT INSURANCE", 3_800, "insurance");

  // --- Subscriptions & fitness ---------------------------------------------
  addMonthly(visa.id, 9, "Spotify", "SPOTIFY P0A1B2C3", 1_199, "subscriptions");
  addMonthly(visa.id, 12, "Netflix", "NETFLIX.COM", 1_699, "subscriptions");
  addMonthly(visa.id, 17, "GoodLife Fitness", "GOODLIFE FITNESS CLUB", 5_499, "health");
  addMonthly(cobalt.id, 26, "Adobe", "ADOBE SYSTEMS SOFTWARE", 2_299, "subscriptions");

  // --- Weekly transit -------------------------------------------------------
  for (let date = start; date <= anchor; date = addDays(date, 1)) {
    if (date.getUTCDay() === 2) {
      add(chequing.id, date, "Presto Transit", "PRESTO AUTOLOAD", 2_500, "transport");
    }
  }

  // --- Variable day-to-day spending ----------------------------------------
  const monthStarts: Date[] = [];
  for (let cursor = startOfMonth(start); cursor <= anchor; cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1, 12))) {
    monthStarts.push(cursor);
  }

  const groceryMerchants = [
    ["Loblaws", "LOBLAWS #1042 TORONTO ON"],
    ["Metro", "METRO #372 TORONTO ON"],
    ["Costco Wholesale", "COSTCO WHOLESALE #152"],
    ["No Frills", "NO FRILLS #908"],
  ];
  const diningMerchants = [
    ["Tim Hortons", "TIM HORTONS #4213"],
    ["Starbucks", "STARBUCKS STORE 8842"],
    ["Pizzeria Libretto", "PIZZERIA LIBRETTO"],
    ["A&W", "A&W #0755"],
    ["Banh Mi Boys", "BANH MI BOYS"],
  ];
  const shoppingMerchants = [
    ["Amazon", "AMAZON.CA*2X4RT"],
    ["Canadian Tire", "CANADIAN TIRE #145"],
    ["Winners", "WINNERS #231"],
    ["Sephora", "SEPHORA CANADA"],
    ["LCBO", "LCBO #442"],
  ];

  for (const monthStart of monthStarts) {
    const monthEnd = endOfMonth(monthStart);
    const lastDay = anchor < monthEnd ? anchor.getUTCDate() : daysInMonth(monthStart);
    const pickDate = () => {
      const day = 1 + Math.floor(random() * Math.max(1, lastDay));
      return new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), day, 12));
    };

    const groceryCount = 3 + Math.floor(random() * 3);
    for (let i = 0; i < groceryCount; i++) {
      const [merchant, name] = groceryMerchants[Math.floor(random() * groceryMerchants.length)];
      add(visa.id, pickDate(), merchant, name, 4_200 + Math.floor(random() * 14_500), "groceries");
    }

    const diningCount = 4 + Math.floor(random() * 4);
    for (let i = 0; i < diningCount; i++) {
      const [merchant, name] = diningMerchants[Math.floor(random() * diningMerchants.length)];
      add(chequing.id, pickDate(), merchant, name, 450 + Math.floor(random() * 4_600), "dining");
    }

    const shoppingCount = 1 + Math.floor(random() * 3);
    for (let i = 0; i < shoppingCount; i++) {
      const [merchant, name] = shoppingMerchants[Math.floor(random() * shoppingMerchants.length)];
      add(visa.id, pickDate(), merchant, name, 1_900 + Math.floor(random() * 18_000), merchant === "LCBO" ? "dining" : "shopping");
    }

    if (random() > 0.35) {
      add(cobalt.id, pickDate(), "Uber", "UBER *TRIP", 1_200 + Math.floor(random() * 2_800), "transport");
    }
    if (random() > 0.65) {
      add(visa.id, pickDate(), "Cineplex", "CINEPLEX CINEMAS", 1_500 + Math.floor(random() * 1_200), "entertainment");
    }
    if (random() > 0.6) {
      add(chequing.id, pickDate(), "Interac e-Transfer", "INTERAC E-TRANSFER FROM JORDAN", -(2_000 + Math.floor(random() * 5_000)), "transfers");
    }

    const paymentDate = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 24, 12));
    if (paymentDate <= anchor) {
      add(chequing.id, paymentDate, "RBC Visa Payment", "RBC VISA PAYMENT", 150_000, "transfers");
      add(visa.id, paymentDate, "Payment Thank You", "PAYMENT THANK YOU / THANK YOU", -150_000, "transfers");
    }
  }

  add(visa.id, addDays(anchor, -1), "Loblaws", "LOBLAWS #1042 TORONTO ON", 8_423, "groceries", true);
  add(chequing.id, anchor, "Tim Hortons", "TIM HORTONS #4213", 345, "dining", true);

  // Group into one "statement" import per account.
  const accounts = [
    { account: chequing, bankPreset: "rbc" },
    { account: savings, bankPreset: "rbc" },
    { account: visa, bankPreset: "rbc" },
    { account: cobalt, bankPreset: "amex" },
  ];
  let transactionCount = 0;
  let ref = 0;

  for (const { account, bankPreset } of accounts) {
    const accountRows = rows
      .filter((row) => row.accountId === account.id)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    if (accountRows.length === 0) continue;
    const startDate = accountRows[0].date;
    const endDate = accountRows[accountRows.length - 1].date;
    const batch = await db.importBatch.create({
      data: {
        accountId: account.id,
        filename: `demo-${account.institution.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${account.mask}.csv`,
        fileKind: "demo",
        bankPreset,
        transactionsImported: accountRows.length,
        transactionsSkipped: 0,
        periodStart: startDate,
        periodEnd: endDate,
        isDemo: true,
      },
    });
    const data: Prisma.TransactionCreateManyInput[] = accountRows.map((row) => {
      ref += 1;
      return {
        accountId: account.id,
        importBatchId: batch.id,
        importHash: `demo:${ref}`,
        merchantName: row.merchantName,
        name: row.name,
        amountCents: row.amountCents,
        isoCurrency: "CAD",
        date: row.date,
        category: row.category,
        pending: row.pending,
      };
    });
    await db.transaction.createMany({ data });
    transactionCount += data.length;
  }

  const budgetDefaults: Array<[string, number]> = [
    ["housing", 215_000],
    ["groceries", 70_000],
    ["dining", 30_000],
    ["transport", 25_000],
    ["subscriptions", 10_000],
    ["utilities", 40_000],
    ["shopping", 25_000],
    ["health", 10_000],
    ["insurance", 22_000],
    ["entertainment", 8_000],
    ["fees", 2_000],
  ];
  const existingBudgets = await db.budget.findMany({
    select: { category: true },
  });
  const existingCategories = new Set(
    existingBudgets.map((budget) => budget.category),
  );
  const createdBudgetIds: string[] = [];
  for (const [category, amount] of budgetDefaults) {
    if (existingCategories.has(category)) continue;
    const budget = await db.budget.create({
      data: { category, monthlyLimitCents: amount },
    });
    createdBudgetIds.push(budget.id);
  }
  if (createdBudgetIds.length > 0) {
    await db.setting.create({
      data: {
        key: DEMO_BUDGETS_SETTING,
        value: JSON.stringify(createdBudgetIds),
      },
    });
  }

  const recurring = await refreshRecurringSeries();

  return { accounts: 4, transactions: transactionCount, recurring };
}

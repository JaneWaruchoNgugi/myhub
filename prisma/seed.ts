/**
 * Demo seed. Creates a SEPARATE demo user (demo@myhub.local) with sample data.
 * It never touches any other user's records. Run: npm run db:seed
 * Prices and balances here are illustrative sample data, not real market data.
 */
import { PrismaClient, Prisma, type Frequency } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from "../src/lib/services/defaults";
import { amortize } from "../src/lib/services/loans";

const prisma = new PrismaClient();
const D = Prisma.Decimal;
const DEMO_EMAIL = "demo@myhub.local";
const DEMO_PASSWORD = "demo-password-123";

let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const between = (a: number, b: number) => Math.round(a + rnd() * (b - a));

const day = (y: number, m: number, d: number) => {
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d, last)));
};
const today = (() => {
  const s = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return new Date(`${s}T00:00:00Z`);
})();
const Y = today.getUTCFullYear();
const M = today.getUTCMonth();
const monthDate = (offset: number, d: number) => day(Y, M + offset, d);
const atTime = (offsetDays: number, h: number, min = 0) => new Date(today.getTime() + offsetDays * 86_400_000 + (h - 3) * 3_600_000 + min * 60_000); // Nairobi = UTC+3

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing) {
    await prisma.user.delete({ where: { id: existing.id } }); // cascades only the demo user's data
    console.log("Removed previous demo data");
  }
  const user = await prisma.user.create({ data: { email: DEMO_EMAIL, name: "Demo User", isDemo: true, passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12) } });
  const uid = user.id;
  await prisma.userPreference.create({ data: { userId: uid } });
  await prisma.transactionCategory.createMany({
    data: [
      ...DEFAULT_INCOME_CATEGORIES.map(([name, color]) => ({ userId: uid, name, color, type: "INCOME" as const, isSystem: true })),
      ...DEFAULT_EXPENSE_CATEGORIES.map(([name, color]) => ({ userId: uid, name, color, type: "EXPENSE" as const, isSystem: true })),
    ],
  });
  const cats = Object.fromEntries((await prisma.transactionCategory.findMany({ where: { userId: uid } })).map((c) => [`${c.type}:${c.name}`, c.id]));
  const inc = (n: string) => cats[`INCOME:${n}`];
  const exp = (n: string) => cats[`EXPENSE:${n}`];

  const start = monthDate(-11, 1);
  const acc = async (name: string, type: "CASH" | "BANK" | "MOBILE_MONEY" | "SAVINGS" | "INVESTMENT_CASH", opening: number, color: string, institution?: string) =>
    (await prisma.account.create({ data: { userId: uid, name, type, openingBalance: opening, openingDate: start, color, institution } })).id;
  const mpesa = await acc("M-Pesa", "MOBILE_MONEY", 12000, "#16a34a", "Safaricom");
  const equity = await acc("Equity Bank", "BANK", 145000, "#b91c1c", "Equity Bank Kenya");
  const cash = await acc("Cash wallet", "CASH", 4000, "#64748b");
  const savingsAcc = await acc("CIC Money Market", "SAVINGS", 60000, "#0ea5e9", "CIC Asset Management");
  const broker = await acc("Brokerage cash", "INVESTMENT_CASH", 0, "#6366f1", "Faida Investment Bank");

  type T = Prisma.TransactionUncheckedCreateInput;
  const txns: T[] = [];
  const t = (x: Omit<T, "userId">) => txns.push({ userId: uid, ...x });

  // Recurring salary rule (past occurrences generated as RECURRING)
  const salaryRule = await prisma.recurringRule.create({
    data: { userId: uid, type: "INCOME", amount: 185000, description: "Salary", accountId: equity, categoryId: inc("Salary"), frequency: "MONTHLY", startDate: monthDate(-11, 25), nextDate: monthDate(-11, 25) },
  });
  const transferRule = await prisma.recurringRule.create({
    data: { userId: uid, type: "TRANSFER", amount: 30000, description: "Top up M-Pesa", accountId: equity, toAccountId: mpesa, frequency: "MONTHLY", startDate: monthDate(-11, 26), nextDate: monthDate(-11, 26) },
  });

  for (let o = -11; o <= 0; o++) {
    const inPast = (d: Date) => d <= today;
    const sal = monthDate(o, 25);
    if (inPast(sal)) t({ type: "INCOME", source: "RECURRING", amount: 185000, date: sal, description: "Salary", accountId: equity, categoryId: inc("Salary"), recurringRuleId: salaryRule.id, occurrenceDate: sal });
    const top = monthDate(o, 26);
    if (inPast(top)) t({ type: "TRANSFER", source: "RECURRING", amount: 30000, date: top, description: "Top up M-Pesa", accountId: equity, toAccountId: mpesa, recurringRuleId: transferRule.id, occurrenceDate: top });
    if (rnd() > 0.45) {
      const d = monthDate(o, between(3, 20));
      if (inPast(d)) t({ type: "INCOME", amount: between(15, 65) * 1000, date: d, description: "Freelance web project", accountId: mpesa, categoryId: inc("Freelancing") });
    }
    for (let i = 0; i < 6; i++) {
      const d = monthDate(o, between(1, 28));
      if (inPast(d)) t({ type: "EXPENSE", amount: between(1800, 4800), date: d, description: ["Naivas", "Carrefour", "Quickmart", "Mama mboga", "Java House", "Chicken Inn"][i], accountId: i % 2 ? mpesa : equity, categoryId: exp("Food") });
    }
    for (let i = 0; i < 4; i++) {
      const d = monthDate(o, between(1, 28));
      if (inPast(d)) t({ type: "EXPENSE", amount: between(600, 2400), date: d, description: ["Uber", "Matatu fare", "Fuel", "Bolt"][i], accountId: i === 1 ? cash : mpesa, categoryId: exp("Transport") });
    }
    const fam = monthDate(o, 2);
    if (inPast(fam)) t({ type: "EXPENSE", amount: 10000, date: fam, description: "Support for parents", accountId: mpesa, categoryId: exp("Family") });
    if (rnd() > 0.4) {
      const d = monthDate(o, between(5, 27));
      if (inPast(d)) t({ type: "EXPENSE", amount: between(2000, 9000), date: d, description: "Shopping", accountId: equity, categoryId: exp("Shopping") });
    }
    if (rnd() > 0.5) {
      const d = monthDate(o, between(5, 27));
      if (inPast(d)) t({ type: "EXPENSE", amount: between(1500, 5000), date: d, description: "Weekend outing", accountId: mpesa, categoryId: exp("Entertainment") });
    }
    if (rnd() > 0.75) {
      const d = monthDate(o, between(5, 27));
      if (inPast(d)) t({ type: "EXPENSE", amount: between(2500, 8000), date: d, description: "Clinic visit", accountId: mpesa, categoryId: exp("Healthcare") });
    }
    if (o % 3 === 0) {
      const d = monthDate(o, 10);
      if (inPast(d)) t({ type: "EXPENSE", amount: 12000, date: d, description: "Online course", accountId: equity, categoryId: exp("Education") });
    }
  }
  await prisma.transaction.createMany({ data: txns });
  await prisma.recurringRule.update({ where: { id: salaryRule.id }, data: { nextDate: monthDate(monthDate(0, 25) <= today ? 1 : 0, 25) } });
  await prisma.recurringRule.update({ where: { id: transferRule.id }, data: { nextDate: monthDate(monthDate(0, 26) <= today ? 1 : 0, 26) } });

  // Bills with payment history (each payment linked to exactly one expense)
  const bill = async (name: string, kind: "RENT" | "ELECTRICITY" | "INTERNET" | "WATER", amount: number, dueDay: number, cat: string, account: string, method: string, vary = 0) => {
    const b = await prisma.bill.create({ data: { userId: uid, name, kind, amount, categoryId: exp(cat), accountId: account, nextDueDate: monthDate(-11, dueDay), recurrence: "MONTHLY", paymentMethod: method } });
    let next = monthDate(-11, dueDay);
    for (let o = -11; o <= 0; o++) {
      const due = monthDate(o, dueDay);
      const paid = monthDate(o, Math.max(1, dueDay - between(0, 2)));
      if (due > today || paid > today) break;
      const amt = amount + (vary ? between(-vary, vary) : 0);
      const tx = await prisma.transaction.create({ data: { userId: uid, type: "EXPENSE", source: "BILL", amount: amt, date: paid, description: name, accountId: account, categoryId: exp(cat) } });
      await prisma.billPayment.create({ data: { userId: uid, billId: b.id, dueDate: due, paidDate: paid, amount: amt, paymentMethod: method, transactionId: tx.id } });
      next = monthDate(o + 1, dueDay);
    }
    await prisma.bill.update({ where: { id: b.id }, data: { nextDueDate: next } });
  };
  await bill("Rent", "RENT", 45000, 5, "Rent", equity, "Bank transfer");
  await bill("KPLC electricity", "ELECTRICITY", 3500, 12, "Utilities", mpesa, "M-Pesa Paybill 888880", 600);
  await bill("Safaricom Home Fibre", "INTERNET", 3999, 18, "Internet", mpesa, "M-Pesa Paybill");
  await prisma.bill.create({ data: { userId: uid, name: "Nairobi Water", kind: "WATER", amount: 1200, categoryId: exp("Utilities"), accountId: mpesa, nextDueDate: new Date(today.getTime() - 2 * 86_400_000), recurrence: "MONTHLY", paymentMethod: "M-Pesa" } });

  // Subscriptions with charge history
  const sub = async (name: string, provider: string, amount: number, cycle: "MONTHLY" | "YEARLY", firstOffset: number, dayOfMonth: number, account: string) => {
    const s = await prisma.subscription.create({ data: { userId: uid, name, provider, amount, billingCycle: cycle, nextBillingDate: monthDate(firstOffset, dayOfMonth), categoryId: exp("Subscriptions"), accountId: account, paymentMethod: "Visa •• 4021" } });
    let o = firstOffset;
    let next = monthDate(o, dayOfMonth);
    while (next <= today) {
      const tx = await prisma.transaction.create({ data: { userId: uid, type: "EXPENSE", source: "SUBSCRIPTION", amount, date: next, description: `${name} subscription`, accountId: account, categoryId: exp("Subscriptions") } });
      await prisma.subscriptionCharge.create({ data: { subscriptionId: s.id, billingDate: next, amount, transactionId: tx.id } });
      o += cycle === "MONTHLY" ? 1 : 12;
      next = monthDate(o, dayOfMonth);
    }
    await prisma.subscription.update({ where: { id: s.id }, data: { nextBillingDate: next } });
  };
  await sub("Netflix", "Netflix", 1100, "MONTHLY", -11, 8, equity);
  await sub("Spotify", "Spotify", 390, "MONTHLY", -11, 14, mpesa);
  await sub("GitHub Copilot", "GitHub", 1300, "MONTHLY", -6, 3, equity);
  await sub("Domain renewal", "Namecheap", 1800, "YEARLY", -10, 20, equity);

  // Savings goals: contributions are transfers into the goal's account (no double counting)
  const goal = async (name: string, target: number, targetOffset: number, emergency: boolean, monthly: number, months: number) => {
    const g = await prisma.savingsGoal.create({ data: { userId: uid, name, targetAmount: target, targetDate: monthDate(targetOffset, 28), isEmergencyFund: emergency, priority: emergency ? "HIGH" : "MEDIUM", accountId: savingsAcc } });
    for (let o = -months + 1; o <= 0; o++) {
      const d = monthDate(o, 27);
      if (d > today) break;
      const tx = await prisma.transaction.create({ data: { userId: uid, type: "TRANSFER", source: "SAVINGS", amount: monthly, date: d, description: `Saving towards ${name}`, accountId: equity, toAccountId: savingsAcc } });
      await prisma.savingsContribution.create({ data: { userId: uid, goalId: g.id, type: "CONTRIBUTION", amount: monthly, date: d, transactionId: tx.id } });
    }
    return g;
  };
  const ef = await goal("Emergency fund", 400000, 8, true, 15000, 12);
  // Part of the opening savings balance earmarked to the emergency fund without moving money.
  await prisma.savingsContribution.create({ data: { userId: uid, goalId: ef.id, type: "CONTRIBUTION", amount: 50000, date: start, note: "Existing savings" } });
  await goal("New MacBook", 220000, 4, false, 10000, 7);
  await goal("December holiday", 80000, 1, false, 8000, 5);

  // Loans: principal moves as INFLOW/OUTFLOW, interest as EXPENSE/INCOME
  const loanStart = monthDate(-8, 15);
  const loanDue = monthDate(16, 15);
  const kcbDisb = await prisma.transaction.create({ data: { userId: uid, type: "INFLOW", source: "LOAN", amount: 300000, date: loanStart, description: "Loan received: KCB personal loan", accountId: equity } });
  const kcb = await prisma.loan.create({
    data: { userId: uid, name: "KCB personal loan", direction: "BORROWED", loanType: "BANK", counterparty: "KCB Bank", principal: 300000, interestRate: 13, startDate: loanStart, dueDate: loanDue, frequency: "MONTHLY", accountId: equity, disbursementTxnId: kcbDisb.id },
  });
  const schedule = amortize(300000, 13, loanStart, loanDue, "MONTHLY");
  const intCat = exp("Loan interest");
  for (const row of schedule) {
    if (row.date > today) break;
    const p = await prisma.transaction.create({ data: { userId: uid, type: "OUTFLOW", source: "LOAN", amount: row.principal, date: row.date, description: "KCB personal loan: principal repaid", accountId: equity } });
    const i = await prisma.transaction.create({ data: { userId: uid, type: "EXPENSE", source: "LOAN", amount: row.interest, date: row.date, description: "KCB personal loan: interest", accountId: equity, categoryId: intCat } });
    await prisma.loanRepayment.create({ data: { userId: uid, loanId: kcb.id, date: row.date, principalAmount: row.principal, interestAmount: row.interest, accountId: equity, principalTxnId: p.id, interestTxnId: i.id } });
  }
  const lentDate = monthDate(-3, 4);
  const lentTx = await prisma.transaction.create({ data: { userId: uid, type: "OUTFLOW", source: "LOAN", amount: 20000, date: lentDate, description: "Loan given to Brian", accountId: mpesa } });
  const brian = await prisma.loan.create({
    data: { userId: uid, name: "Loan to Brian", direction: "LENT", loanType: "PERSONAL", counterparty: "Brian Otieno", principal: 20000, interestRate: 0, startDate: lentDate, dueDate: monthDate(1, 4), frequency: "MONTHLY", accountId: mpesa, disbursementTxnId: lentTx.id },
  });
  const back = await prisma.transaction.create({ data: { userId: uid, type: "INFLOW", source: "LOAN", amount: 5000, date: monthDate(-2, 6), description: "Loan to Brian: principal received", accountId: mpesa } });
  await prisma.loanRepayment.create({ data: { userId: uid, loanId: brian.id, date: monthDate(-2, 6), principalAmount: 5000, interestAmount: 0, accountId: mpesa, principalTxnId: back.id } });
  await prisma.loan.create({ data: { userId: uid, name: "Fuliza", direction: "BORROWED", loanType: "MOBILE", counterparty: "Safaricom", principal: 2500, interestRate: 0, startDate: new Date(today.getTime() - 20 * 86_400_000), dueDate: new Date(today.getTime() + 10 * 86_400_000), frequency: "MONTHLY", notes: "Recorded without a cash movement" } });

  // Investments: buys are OUTFLOWs from brokerage cash; prices are sample manual entries
  const fund = await prisma.transaction.create({ data: { userId: uid, type: "TRANSFER", amount: 150000, date: monthDate(-10, 2), description: "Fund brokerage account", accountId: equity, toAccountId: broker } });
  void fund;
  const inv = async (name: string, symbol: string, assetClass: "STOCK" | "MONEY_MARKET" | "TREASURY_BILL" | "ETF", platform: string, buys: { o: number; units: number; price: number }[], prices: number[], sell?: { o: number; units: number; price: number }, divs?: { o: number; amount: number }[]) => {
    const i = await prisma.investment.create({ data: { userId: uid, name, symbol, assetClass, platform, accountId: broker, priceSource: "demo" } });
    let units = new D(0);
    let cost = new D(0);
    for (const b of buys) {
      const d = monthDate(b.o, 5);
      const amount = new D(b.units).times(b.price);
      const tx = await prisma.transaction.create({ data: { userId: uid, type: "OUTFLOW", source: "INVESTMENT", amount, date: d, description: `Bought ${b.units} × ${name}`, accountId: broker } });
      await prisma.investmentTransaction.create({ data: { userId: uid, investmentId: i.id, type: "BUY", date: d, units: b.units, price: b.price, amount, fees: 0, transactionId: tx.id } });
      units = units.plus(b.units);
      cost = cost.plus(amount);
    }
    if (sell) {
      const d = monthDate(sell.o, 18);
      const amount = new D(sell.units).times(sell.price);
      const removed = cost.div(units).times(sell.units).toDecimalPlaces(2);
      const tx = await prisma.transaction.create({ data: { userId: uid, type: "INFLOW", source: "INVESTMENT", amount, date: d, description: `Sold ${sell.units} × ${name}`, accountId: broker } });
      await prisma.investmentTransaction.create({ data: { userId: uid, investmentId: i.id, type: "SELL", date: d, units: sell.units, price: sell.price, amount, fees: 0, costRemoved: removed, realizedGain: amount.minus(removed), transactionId: tx.id } });
      units = units.minus(sell.units);
      cost = cost.minus(removed);
    }
    for (const dv of divs ?? []) {
      const d = monthDate(dv.o, 22);
      const tx = await prisma.transaction.create({ data: { userId: uid, type: "INCOME", source: "INVESTMENT", amount: dv.amount, date: d, description: `Dividend: ${name}`, accountId: broker, categoryId: inc("Investments") } });
      await prisma.investmentTransaction.create({ data: { userId: uid, investmentId: i.id, type: "DIVIDEND", date: d, amount: dv.amount, transactionId: tx.id } });
    }
    const first = Math.min(...buys.map((b) => b.o));
    for (let k = 0; k < prices.length; k++) {
      const o = first + k;
      if (o > 0) break;
      await prisma.investmentPrice.create({ data: { investmentId: i.id, date: monthDate(o, 28) > today ? today : monthDate(o, 28), price: prices[k], source: "demo" } });
    }
    const last = prices[Math.min(prices.length, -first + 1) - 1];
    await prisma.investment.update({ where: { id: i.id }, data: { units, costBasis: cost.toDecimalPlaces(2), currentPrice: last, priceUpdatedAt: new Date(), purchaseDate: monthDate(first, 5) } });
  };
  await inv("Safaricom PLC", "SCOM", "STOCK", "Faida", [{ o: -10, units: 2000, price: 16.5 }, { o: -5, units: 1000, price: 15.2 }], [16.9, 17.4, 16.1, 15.8, 15.5, 15.1, 16.2, 17.0, 17.8, 18.4, 19.1], { o: -2, units: 500, price: 17.8 }, [{ o: -6, amount: 1800 }]);
  await inv("Equity Group Holdings", "EQTY", "STOCK", "Faida", [{ o: -9, units: 400, price: 41 }], [41.5, 40.2, 39.8, 42.1, 43.0, 44.5, 43.9, 45.2, 46.0, 45.6]);
  await inv("Etica Money Market Fund", "ETICA-MMF", "MONEY_MARKET", "Etica Capital", [{ o: -8, units: 30000, price: 1 }], [1.01, 1.02, 1.03, 1.04, 1.05, 1.06, 1.07, 1.08, 1.09]);

  // Budgets (with rollover) for the last 3 months
  for (const o of [-2, -1, 0]) {
    await prisma.budget.create({
      data: {
        userId: uid,
        month: monthDate(o, 1),
        rollover: o === 0,
        items: {
          create: [
            ["Food", 22000],
            ["Transport", 7000],
            ["Shopping", 6000],
            ["Entertainment", 4000],
            ["Utilities", 5000],
            ["Subscriptions", 4500],
            ["Family", 10000],
          ].map(([n, l]) => ({ categoryId: exp(n as string), limit: l as number })),
        },
      },
    });
  }

  // Manual assets & liabilities
  await prisma.asset.createMany({
    data: [
      { userId: uid, name: "Plot in Kitengela (1/8 acre)", type: "PROPERTY", value: 1200000, valuedAt: monthDate(-4, 1) },
      { userId: uid, name: "Toyota Vitz 2014", type: "VEHICLE", value: 650000, valuedAt: monthDate(-2, 1) },
    ],
  });
  await prisma.liability.create({ data: { userId: uid, name: "Credit card", type: "CREDIT_CARD", balance: 23500, asOf: today } });

  // Planner
  await prisma.task.createMany({
    data: [
      { userId: uid, title: "Submit freelance invoice", dueDate: atTime(0, 17), allDay: false, priority: "HIGH", category: "WORK" },
      { userId: uid, title: "Buy groceries", dueDate: atTime(0, 23, 59), priority: "MEDIUM", category: "ERRAND" },
      { userId: uid, title: "Renew driving licence", dueDate: atTime(-2, 23, 59), priority: "HIGH", category: "PERSONAL" },
      { userId: uid, title: "Weekly review", dueDate: atTime(2, 18), allDay: false, priority: "MEDIUM", category: "PERSONAL", recurrence: "WEEKLY" },
      { userId: uid, title: "File KRA returns", dueDate: atTime(12, 23, 59), priority: "URGENT", category: "FINANCE", reminderMinutes: 4320 },
      { userId: uid, title: "Gym session", dueDate: atTime(1, 7), allDay: false, priority: "LOW", category: "HEALTH", recurrence: "DAILY" },
      { userId: uid, title: "Call the landlord about repairs", status: "DONE", completedAt: new Date(), dueDate: atTime(-1, 23, 59), category: "PERSONAL" },
    ],
  });
  await prisma.calendarEvent.createMany({
    data: [
      { userId: uid, title: "Dentist appointment", type: "APPOINTMENT", start: atTime(1, 10), end: atTime(1, 11), location: "Upper Hill Dental" },
      { userId: uid, title: "Client call: e-commerce rebuild", type: "MEETING", start: atTime(2, 14), end: atTime(2, 15) },
      { userId: uid, title: "Chama meeting", type: "MEETING", start: atTime(5, 16), end: atTime(5, 18), location: "Westlands" },
      { userId: uid, title: "Nairobi Tech Week", type: "EVENT", start: atTime(9, 0), end: atTime(10, 23, 59), allDay: true },
    ],
  });

  // Developer workspace
  const p1 = await prisma.devProject.create({
    data: { userId: uid, name: "MYHUB", description: "Personal finance & productivity OS", status: "ACTIVE", startDate: monthDate(-1, 1), deadline: monthDate(2, 15), techStack: ["Next.js", "TypeScript", "Prisma", "PostgreSQL", "Tailwind"], repoUrl: "https://github.com/example/myhub", notes: "Phase 1 to 7 roadmap in README." },
  });
  const p2 = await prisma.devProject.create({
    data: { userId: uid, name: "Chama Manager", description: "Mobile-first app for savings groups with M-Pesa reconciliation", status: "PLANNING", deadline: new Date(today.getTime() + 5 * 86_400_000), techStack: ["React Native", "Supabase"] },
  });
  const dt: [string, "IDEA" | "FEATURE" | "BUG" | "IMPROVEMENT" | "TECH_DEBT" | "RESEARCH", "IDEAS" | "BACKLOG" | "TODO" | "IN_PROGRESS" | "TESTING" | "COMPLETED", string | null, "LOW" | "MEDIUM" | "HIGH"][] = [
    ["AI spending insights", "IDEA", "IDEAS", p1.id, "LOW"],
    ["Daraja API integration research", "RESEARCH", "IDEAS", p2.id, "MEDIUM"],
    ["CSV import for bank statements", "FEATURE", "BACKLOG", p1.id, "HIGH"],
    ["Refactor money helpers", "TECH_DEBT", "BACKLOG", p1.id, "LOW"],
    ["Budget rollover UI", "FEATURE", "TODO", p1.id, "MEDIUM"],
    ["Dark mode chart contrast", "IMPROVEMENT", "TODO", p1.id, "LOW"],
    ["Recurring bills generator", "FEATURE", "IN_PROGRESS", p1.id, "HIGH"],
    ["Fix timezone on calendar drag", "BUG", "TESTING", p1.id, "HIGH"],
    ["Auth & protected routes", "FEATURE", "COMPLETED", p1.id, "HIGH"],
    ["Database schema", "FEATURE", "COMPLETED", p1.id, "HIGH"],
    ["Member onboarding flow", "FEATURE", "BACKLOG", p2.id, "MEDIUM"],
  ];
  const pos: Record<string, number> = {};
  await prisma.devTask.createMany({ data: dt.map(([title, type, status, projectId, priority]) => ({ userId: uid, title, type, status, projectId, priority, position: (pos[status] = (pos[status] ?? -1) + 1) })) });
  await prisma.bookmark.createMany({
    data: [
      { userId: uid, title: "Next.js App Router docs", url: "https://nextjs.org/docs/app", category: "DOCUMENTATION", tags: ["nextjs", "react"], isFavourite: true },
      { userId: uid, title: "Prisma schema reference", url: "https://www.prisma.io/docs/orm/reference/prisma-schema-reference", category: "DOCUMENTATION", tags: ["prisma", "database"] },
      { userId: uid, title: "Safaricom Daraja API", url: "https://developer.safaricom.co.ke/", category: "API", tags: ["mpesa", "payments"], isFavourite: true },
      { userId: uid, title: "shadcn/ui", url: "https://ui.shadcn.com/", category: "TOOL", tags: ["ui", "react"] },
      { userId: uid, title: "Web.dev: Learn performance", url: "https://web.dev/learn/performance", category: "TUTORIAL", tags: ["performance"] },
    ],
  });
  await prisma.learningGoal.createMany({
    data: [
      { userId: uid, name: "Rust", kind: "LANGUAGE", status: "LEARNING", progress: 35, resourceUrl: "https://doc.rust-lang.org/book/" },
      { userId: uid, name: "Kubernetes fundamentals", kind: "TECHNOLOGY", status: "WANT_TO_LEARN", progress: 0 },
      { userId: uid, name: "Next.js advanced patterns", kind: "FRAMEWORK", status: "LEARNING", progress: 70 },
      { userId: uid, name: "AWS Solutions Architect course", kind: "COURSE", status: "PAUSED", progress: 20, targetDate: monthDate(4, 30) },
      { userId: uid, name: "System design", kind: "SKILL", status: "COMPLETED", progress: 100 },
    ],
  });
  await prisma.codeSnippet.createMany({
    data: [
      { userId: uid, title: "Prisma singleton", language: "typescript", tags: ["prisma", "nextjs"], description: "Avoid exhausting connections in dev.", code: 'import { PrismaClient } from "@prisma/client";\n\nconst g = globalThis as unknown as { prisma?: PrismaClient };\nexport const prisma = g.prisma ?? new PrismaClient();\nif (process.env.NODE_ENV !== "production") g.prisma = prisma;' },
      { userId: uid, title: "Monthly totals in SQL", language: "sql", tags: ["postgres"], code: "SELECT date_trunc('month', date) AS m, SUM(amount)\nFROM \"Transaction\"\nWHERE type = 'EXPENSE'\nGROUP BY 1 ORDER BY 1;" },
      { userId: uid, title: "Debounce hook", language: "tsx", tags: ["react", "hooks"], code: "export function useDebounce<T>(value: T, ms = 300) {\n  const [v, setV] = useState(value);\n  useEffect(() => {\n    const t = setTimeout(() => setV(value), ms);\n    return () => clearTimeout(t);\n  }, [value, ms]);\n  return v;\n}" },
    ],
  });
  await prisma.devGoal.createMany({
    data: [
      { userId: uid, title: "Launch Chama Manager MVP", type: "BUILD_SAAS", progress: 15, targetDate: monthDate(5, 30) },
      { userId: uid, title: "Contribute to an open-source project monthly", type: "OPEN_SOURCE", progress: 40 },
      { userId: uid, title: "Deploy MYHUB to production", type: "DEPLOY_PROJECT", progress: 60, targetDate: monthDate(1, 30) },
    ],
  });
  await prisma.note.createMany({
    data: [
      { userId: uid, title: "Financial plan 2026", category: "Finance", isPinned: true, content: "## Priorities\n\n1. Emergency fund: **6 months** of expenses\n2. Clear the KCB loan early\n3. Invest 15% of income\n\n- [x] Open MMF account\n- [ ] Review insurance cover" },
      { userId: uid, title: "Side project ideas", category: "Dev", content: "- Matatu route planner\n- Rent reminder bot\n- `chama` contributions tracker" },
      { userId: uid, title: "Meeting notes: client kickoff", category: "Work", content: "Scope: e-commerce rebuild.\n\n> Deadline end of next month." },
    ],
  });

  // Net-worth history: month-end snapshots rebuilt from the ledger
  const accounts = await prisma.account.findMany({ where: { userId: uid } });
  const invs = await prisma.investment.findMany({ where: { userId: uid }, include: { transactions: true, prices: { orderBy: { date: "asc" } } } });
  const loans = await prisma.loan.findMany({ where: { userId: uid }, include: { repayments: true } });
  const assets = await prisma.asset.findMany({ where: { userId: uid } });
  for (let o = -11; o <= 0; o++) {
    const end = o === 0 ? today : day(Y, M + o + 1, 0);
    let a = new D(0);
    let l = new D(0);
    for (const acc of accounts) {
      const rows = await prisma.transaction.groupBy({ by: ["type"], where: { userId: uid, accountId: acc.id, date: { lte: end } }, _sum: { amount: true } });
      const tin = await prisma.transaction.aggregate({ where: { userId: uid, toAccountId: acc.id, date: { lte: end } }, _sum: { amount: true } });
      let bal = new D(acc.openingBalance).plus(tin._sum.amount ?? 0);
      for (const r of rows) bal = ["INCOME", "INFLOW"].includes(r.type) ? bal.plus(r._sum.amount ?? 0) : bal.minus(r._sum.amount ?? 0);
      a = a.plus(bal);
    }
    for (const i of invs) {
      let units = new D(0);
      for (const tx of i.transactions) if (tx.date <= end) units = tx.type === "BUY" ? units.plus(tx.units) : tx.type === "SELL" ? units.minus(tx.units) : units;
      const price = [...i.prices].reverse().find((p) => p.date <= end)?.price ?? 0;
      a = a.plus(units.times(price));
    }
    for (const ln of loans) {
      if (ln.startDate > end) continue;
      const out = new D(ln.principal).minus(ln.repayments.filter((r) => r.date <= end).reduce((s, r) => s.plus(r.principalAmount), new D(0)));
      if (ln.direction === "LENT") a = a.plus(out);
      else l = l.plus(out);
    }
    for (const as of assets) a = a.plus(as.value);
    l = l.plus(o === 0 ? 23500 : 0);
    await prisma.netWorthSnapshot.create({ data: { userId: uid, date: day(Y, M + o, 1), totalAssets: a.toDecimalPlaces(2), totalLiabilities: l.toDecimalPlaces(2), netWorth: a.minus(l).toDecimalPlaces(2), breakdown: {} } });
  }
  console.log(`Seeded demo user ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

export type { Frequency };

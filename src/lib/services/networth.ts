import "server-only";
import { prisma } from "@/lib/prisma";
import { D, dec, sum, type Dec } from "@/lib/money";
import { accountBalances } from "./ledger";
import { loanSummary } from "./loans";
import { holdingStats } from "./investments";
import { startOfMonth } from "@/lib/dates";

export type NetWorthBreakdown = {
  assets: Record<string, string>;
  liabilities: Record<string, string>;
};

const ACCOUNT_LABEL: Record<string, string> = {
  CASH: "Cash",
  BANK: "Bank balances",
  MOBILE_MONEY: "Mobile money",
  SAVINGS: "Savings accounts",
  INVESTMENT_CASH: "Brokerage cash",
  OTHER: "Other accounts",
};

const LOAN_LABEL: Record<string, string> = {
  PERSONAL: "Personal loans",
  BANK: "Bank loans",
  MOBILE: "Mobile loans",
  CREDIT_CARD: "Credit card debt",
  SACCO: "SACCO loans",
  OTHER: "Other loans",
};

/**
 * Net worth from a single source per item, so nothing is counted twice:
 *  - accounts: ledger balance (savings goals only earmark money inside accounts)
 *  - investments: units × latest manual price (cash used to buy them already left an account)
 *  - money lent: outstanding principal receivable
 *  - manual assets: property, vehicles, other
 *  - liabilities: outstanding borrowed principal + manual liabilities (credit cards etc.)
 */
export async function computeNetWorth(userId: string) {
  const [balances, accounts, investments, loans, assets, liabilities] = await Promise.all([
    accountBalances(userId),
    prisma.account.findMany({ where: { userId }, select: { id: true, type: true } }),
    prisma.investment.findMany({ where: { userId }, select: { units: true, costBasis: true, currentPrice: true } }),
    prisma.loan.findMany({ where: { userId, status: { in: ["ACTIVE", "DEFAULTED"] } }, include: { repayments: true } }),
    prisma.asset.findMany({ where: { userId } }),
    prisma.liability.findMany({ where: { userId } }),
  ]);
  const today = new Date();
  const a: Record<string, Dec> = {};
  const l: Record<string, Dec> = {};
  const add = (bucket: Record<string, Dec>, key: string, v: Dec) => (bucket[key] = (bucket[key] ?? new D(0)).plus(v));

  let cash = new D(0);
  for (const acc of accounts) {
    const bal = balances.get(acc.id) ?? new D(0);
    if (bal.isNeg()) add(l, "Overdrawn accounts", bal.abs());
    else add(a, ACCOUNT_LABEL[acc.type], bal);
    if (acc.type !== "SAVINGS" && acc.type !== "INVESTMENT_CASH") cash = cash.plus(bal);
  }
  const investmentValue = sum(investments.map((i) => holdingStats(i).value));
  if (!investmentValue.isZero()) add(a, "Investments", investmentValue);

  for (const loan of loans) {
    const s = loanSummary(loan, today);
    if (s.outstanding.isZero()) continue;
    if (loan.direction === "LENT") add(a, "Money lent out", s.outstanding);
    else add(l, LOAN_LABEL[loan.loanType], s.outstanding);
  }
  for (const asset of assets) add(a, asset.type === "PROPERTY" ? "Property" : asset.type === "VEHICLE" ? "Vehicles" : "Other assets", dec(asset.value));
  for (const li of liabilities) add(l, li.type === "CREDIT_CARD" ? "Credit card debt" : li.type === "MORTGAGE" ? "Mortgages" : "Other liabilities", dec(li.balance));

  const totalAssets = sum(Object.values(a));
  const totalLiabilities = sum(Object.values(l));
  const savingsAccounts = a["Savings accounts"] ?? new D(0);
  return {
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets.minus(totalLiabilities),
    availableCash: D.max(cash, 0),
    savingsAccounts,
    investmentValue,
    outstandingBorrowed: sum(loans.filter((x) => x.direction === "BORROWED").map((x) => loanSummary(x, today).outstanding)),
    outstandingLent: sum(loans.filter((x) => x.direction === "LENT").map((x) => loanSummary(x, today).outstanding)),
    breakdown: {
      assets: Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v.toString()])),
      liabilities: Object.fromEntries(Object.entries(l).map(([k, v]) => [k, v.toString()])),
    } satisfies NetWorthBreakdown,
  };
}

/** Upserts this month's snapshot so the history chart has a point per month. */
export async function snapshotNetWorth(userId: string, date = new Date()) {
  const nw = await computeNetWorth(userId);
  const month = startOfMonth(date);
  await prisma.netWorthSnapshot.upsert({
    where: { userId_date: { userId, date: month } },
    update: { totalAssets: nw.totalAssets, totalLiabilities: nw.totalLiabilities, netWorth: nw.netWorth, breakdown: nw.breakdown },
    create: { userId, date: month, totalAssets: nw.totalAssets, totalLiabilities: nw.totalLiabilities, netWorth: nw.netWorth, breakdown: nw.breakdown },
  });
  return nw;
}

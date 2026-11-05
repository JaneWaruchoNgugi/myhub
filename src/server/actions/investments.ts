"use server";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, type CurrentUser } from "@/lib/session";
import { fail, handle } from "@/lib/action";
import { audit } from "@/lib/audit";
import { dayFromString } from "@/lib/dates";
import { D, dec } from "@/lib/money";
import { investmentCreateSchema, investmentSchema, investmentTxnSchema, priceUpdateSchema, watchlistSchema } from "@/lib/validation/obligations";
import { recomputeHolding } from "@/lib/services/investments";
import { systemCategory } from "@/lib/services/defaults";
import { opt, ownedAccount } from "../guards";

const refresh = () => revalidatePath("/", "layout");
type Tx = Prisma.TransactionClient;

async function setPrice(tx: Tx, investmentId: string, date: Date, price: Prisma.Decimal | string, source = "manual") {
  await tx.investmentPrice.upsert({ where: { investmentId_date: { investmentId, date } }, update: { price, source }, create: { investmentId, date, price, source } });
  const latest = await tx.investmentPrice.findFirst({ where: { investmentId }, orderBy: { date: "desc" } });
  if (latest) await tx.investment.update({ where: { id: investmentId }, data: { currentPrice: latest.price, priceUpdatedAt: new Date(), priceSource: latest.source } });
}

async function addTrade(
  tx: Tx,
  user: CurrentUser,
  inv: { id: string; name: string },
  v: { type: "BUY" | "SELL" | "DIVIDEND" | "INTEREST"; date: Date; units?: string; price?: string; amount?: string; fees?: string; accountId: string | null; note: string | null },
) {
  if (v.accountId) await ownedAccount(tx, user.id, v.accountId);
  const fees = dec(v.fees || 0);
  let units = new D(0);
  let price = new D(0);
  let amount: Prisma.Decimal;
  if (v.type === "BUY" || v.type === "SELL") {
    units = dec(v.units);
    price = dec(v.price);
    amount = units.times(price).toDecimalPlaces(2, D.ROUND_HALF_UP);
    if (v.type === "SELL" && fees.gt(amount)) fail("Fees can't exceed the sale amount.");
  } else amount = dec(v.amount);

  let transactionId: string | null = null;
  if (v.accountId) {
    const base = { userId: user.id, source: "INVESTMENT" as const, date: v.date, accountId: v.accountId, notes: v.note };
    if (v.type === "BUY") {
      // Buying moves cash into an asset: an OUTFLOW, not an expense.
      const t = await tx.transaction.create({ data: { ...base, type: "OUTFLOW", amount: amount.plus(fees), description: `Bought ${units.toString()} × ${inv.name}` } });
      transactionId = t.id;
    } else if (v.type === "SELL") {
      const t = await tx.transaction.create({ data: { ...base, type: "INFLOW", amount: amount.minus(fees), description: `Sold ${units.toString()} × ${inv.name}` } });
      transactionId = t.id;
    } else {
      const cat = await systemCategory(tx, user.id, "Investments", "INCOME");
      const t = await tx.transaction.create({ data: { ...base, type: "INCOME", categoryId: cat.id, amount, description: `${v.type === "DIVIDEND" ? "Dividend" : "Interest"}: ${inv.name}` } });
      transactionId = t.id;
    }
  }
  const it = await tx.investmentTransaction.create({ data: { userId: user.id, investmentId: inv.id, type: v.type, date: v.date, units, price, amount, fees, note: v.note, transactionId } });
  await recomputeHolding(tx, inv.id);
  if (v.type === "BUY" || v.type === "SELL") await setPrice(tx, inv.id, v.date, price, "trade");
  await audit(tx, user.id, v.type.toLowerCase(), "Investment", inv.id, { txnId: it.id, units: units.toString(), price: price.toString(), amount: amount.toString(), fees: fees.toString() });
}

export async function createInvestment(input: unknown) {
  return handle(async () => {
    const user = await requireUser();
    const v = investmentCreateSchema.parse(input);
    const id = await prisma.$transaction(async (tx) => {
      const accountId = opt(v.accountId);
      if (accountId) await ownedAccount(tx, user.id, accountId);
      const inv = await tx.investment.create({
        data: { userId: user.id, name: v.name, symbol: opt(v.symbol)?.toUpperCase() ?? null, assetClass: v.assetClass, platform: opt(v.platform), accountId, notes: opt(v.notes), purchaseDate: v.purchaseDate ? dayFromString(v.purchaseDate) : null },
      });
      if (v.initialUnits && v.initialPrice) {
        if (!v.purchaseDate) fail("Add the purchase date for the opening position.");
        await addTrade(tx, user, inv, { type: "BUY", date: dayFromString(v.purchaseDate), units: v.initialUnits, price: v.initialPrice, fees: v.initialFees || "0", accountId: v.payFromAccount ? accountId : null, note: "Opening position" });
      }
      return inv.id;
    });
    refresh();
    return id;
  }, "Investment added");
}

export async function updateInvestment(id: string, input: unknown) {
  return handle(async () => {
    const user = await requireUser();
    const v = investmentSchema.parse(input);
    const inv = await prisma.investment.findFirst({ where: { id, userId: user.id } });
    if (!inv) fail("Investment not found.");
    const accountId = opt(v.accountId);
    if (accountId) await ownedAccount(prisma, user.id, accountId);
    await prisma.investment.update({ where: { id }, data: { name: v.name, symbol: opt(v.symbol)?.toUpperCase() ?? null, assetClass: v.assetClass, platform: opt(v.platform), accountId, notes: opt(v.notes) } });
    refresh();
  }, "Investment updated");
}

export async function deleteInvestment(id: string) {
  return handle(async () => {
    const user = await requireUser();
    await prisma.$transaction(async (tx) => {
      const inv = await tx.investment.findFirst({ where: { id, userId: user.id }, include: { transactions: true } });
      if (!inv) fail("Investment not found.");
      const txnIds = inv.transactions.map((t) => t.transactionId).filter((x): x is string => !!x);
      await tx.investment.delete({ where: { id } });
      if (txnIds.length) await tx.transaction.deleteMany({ where: { id: { in: txnIds }, userId: user.id } });
      await audit(tx, user.id, "delete", "Investment", id, { name: inv.name, removedTransactions: txnIds.length });
    });
    refresh();
  }, "Investment and its cash movements deleted");
}

export async function addInvestmentTxn(input: unknown) {
  return handle(async () => {
    const user = await requireUser();
    const v = investmentTxnSchema.parse(input);
    await prisma.$transaction(async (tx) => {
      const inv = await tx.investment.findFirst({ where: { id: v.investmentId, userId: user.id } });
      if (!inv) fail("Investment not found.");
      await addTrade(tx, user, inv, { type: v.type, date: dayFromString(v.date), units: v.units || undefined, price: v.price || undefined, amount: v.amount || undefined, fees: v.fees || "0", accountId: opt(v.accountId), note: opt(v.note) });
    });
    refresh();
  }, "Investment transaction recorded");
}

export async function deleteInvestmentTxn(id: string) {
  return handle(async () => {
    const user = await requireUser();
    await prisma.$transaction(async (tx) => {
      const t = await tx.investmentTransaction.findFirst({ where: { id, userId: user.id } });
      if (!t) fail("Entry not found.");
      await tx.investmentTransaction.delete({ where: { id } });
      if (t.transactionId) await tx.transaction.deleteMany({ where: { id: t.transactionId, userId: user.id } });
      await recomputeHolding(tx, t.investmentId); // throws (and rolls back) if a later sale becomes invalid
      await audit(tx, user.id, "delete", "InvestmentTransaction", id, { type: t.type, amount: t.amount.toString() });
    });
    refresh();
  }, "Entry deleted and holding recalculated");
}

export async function updatePrice(input: unknown) {
  return handle(async () => {
    const user = await requireUser();
    const v = priceUpdateSchema.parse(input);
    await prisma.$transaction(async (tx) => {
      const inv = await tx.investment.findFirst({ where: { id: v.investmentId, userId: user.id } });
      if (!inv) fail("Investment not found.");
      let price = dec(v.value);
      if (v.mode === "VALUE") {
        if (dec(inv.units).isZero()) fail("This holding has no units yet. Record a purchase first.");
        price = price.div(inv.units).toDecimalPlaces(8);
      }
      await setPrice(tx, inv.id, dayFromString(v.date), price, "manual");
      await audit(tx, user.id, "price", "Investment", inv.id, { price: price.toString(), date: v.date });
    });
    refresh();
  }, "Price updated");
}

export async function saveWatchlistItem(id: string | null, input: unknown) {
  return handle(async () => {
    const user = await requireUser();
    const v = watchlistSchema.parse(input);
    const data = { symbol: v.symbol.toUpperCase(), name: v.name, assetClass: v.assetClass, targetPrice: v.targetPrice || null, lastPrice: v.lastPrice || null, notes: opt(v.notes) };
    if (id) {
      const w = await prisma.watchlistItem.findFirst({ where: { id, userId: user.id } });
      if (!w) fail("Watchlist item not found.");
      await prisma.watchlistItem.update({ where: { id }, data });
    } else await prisma.watchlistItem.create({ data: { userId: user.id, ...data } });
    refresh();
  }, "Watchlist updated");
}

export async function deleteWatchlistItem(id: string) {
  return handle(async () => {
    const user = await requireUser();
    const r = await prisma.watchlistItem.deleteMany({ where: { id, userId: user.id } });
    if (!r.count) fail("Watchlist item not found.");
    refresh();
  }, "Removed from watchlist");
}

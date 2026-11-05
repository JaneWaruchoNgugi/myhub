import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUserPage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getFinanceOptions } from "@/lib/services/options";
import { holdingStats } from "@/lib/services/investments";
import { InvestmentDetail } from "./view";

export const metadata: Metadata = { title: "Investment" };

export default async function InvestmentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUserPage();
  const { id } = await params;
  const i = await prisma.investment.findFirst({ where: { id, userId: user.id }, include: { transactions: { orderBy: [{ date: "desc" }, { createdAt: "desc" }] }, prices: { orderBy: { date: "asc" } } } });
  if (!i) notFound();
  const s = holdingStats(i);
  const options = await getFinanceOptions(user.id);
  return (
    <InvestmentDetail
      options={options}
      h={{
        id: i.id,
        name: i.name,
        symbol: i.symbol ?? "",
        assetClass: i.assetClass,
        platform: i.platform ?? "",
        accountId: i.accountId ?? "",
        notes: i.notes ?? "",
        units: i.units.toString(),
        currentPrice: i.currentPrice.toString(),
        priceUpdatedAt: i.priceUpdatedAt?.toISOString() ?? null,
        priceSource: i.priceSource,
        value: s.value.toString(),
        cost: s.cost.toString(),
        unrealized: s.unrealized.toString(),
        unrealizedPct: s.unrealizedPct,
        realized: s.realized.toString(),
        income: s.income.toString(),
      }}
      txns={i.transactions.map((t) => ({ id: t.id, type: t.type, date: t.date.toISOString().slice(0, 10), units: t.units.toString(), price: t.price.toString(), amount: t.amount.toString(), fees: t.fees.toString(), realizedGain: t.realizedGain?.toString() ?? null, note: t.note ?? "", linked: !!t.transactionId }))}
      prices={i.prices.map((p) => ({ date: p.date.toISOString().slice(0, 10), price: p.price.toString(), source: p.source }))}
    />
  );
}

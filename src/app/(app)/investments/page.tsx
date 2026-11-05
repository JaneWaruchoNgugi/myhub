import type { Metadata } from "next";
import { requireUserPage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getFinanceOptions } from "@/lib/services/options";
import { holdingStats, portfolioSeries } from "@/lib/services/investments";
import { addMonths, endOfMonth, todayIn } from "@/lib/dates";
import { sum } from "@/lib/money";
import { PageHeader } from "@/components/shared/page-header";
import { InvestmentsView } from "./view";

export const metadata: Metadata = { title: "Investments" };

export default async function InvestmentsPage() {
  const user = await requireUserPage();
  const today = todayIn(user.prefs.timezone);
  const [invs, watch, options] = await Promise.all([
    prisma.investment.findMany({ where: { userId: user.id }, include: { transactions: true, account: { select: { name: true } } }, orderBy: { name: "asc" } }),
    prisma.watchlistItem.findMany({ where: { userId: user.id }, orderBy: { symbol: "asc" } }),
    getFinanceOptions(user.id),
  ]);
  const monthEnds = Array.from({ length: 12 }, (_, i) => (i === 11 ? today : endOfMonth(addMonths(today, i - 11, 1))));
  const series = await portfolioSeries(user.id, monthEnds);
  const rows = invs.map((i) => {
    const s = holdingStats(i);
    return {
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
    };
  });
  const stats = invs.map((i) => holdingStats(i));
  const byClass = Object.values(
    rows.reduce<Record<string, { assetClass: string; value: number; cost: number; unrealized: number }>>((acc, r) => {
      const e = (acc[r.assetClass] ??= { assetClass: r.assetClass, value: 0, cost: 0, unrealized: 0 });
      e.value += Number(r.value);
      e.cost += Number(r.cost);
      e.unrealized += Number(r.unrealized);
      return acc;
    }, {}),
  );
  return (
    <div>
      <PageHeader title="Investments" description="Holdings, performance and allocation. Prices are updated manually; MYHUB never invents market prices." />
      <InvestmentsView
        rows={rows}
        options={options}
        series={series}
        byClass={byClass}
        watchlist={watch.map((w) => ({ id: w.id, symbol: w.symbol, name: w.name, assetClass: w.assetClass, targetPrice: w.targetPrice?.toString() ?? "", lastPrice: w.lastPrice?.toString() ?? "", notes: w.notes ?? "" }))}
        totals={{
          value: sum(stats.map((s) => s.value)).toString(),
          cost: sum(stats.map((s) => s.cost)).toString(),
          unrealized: sum(stats.map((s) => s.unrealized)).toString(),
          realized: sum(stats.map((s) => s.realized)).toString(),
          income: sum(stats.map((s) => s.income)).toString(),
        }}
      />
    </div>
  );
}

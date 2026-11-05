import type { Metadata } from "next";
import { requireUserPage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { snapshotNetWorth } from "@/lib/services/networth";
import { todayIn } from "@/lib/dates";
import { PageHeader } from "@/components/shared/page-header";
import { NetWorthView } from "./view";

export const metadata: Metadata = { title: "Net worth" };

export default async function NetWorthPage() {
  const user = await requireUserPage();
  const nw = await snapshotNetWorth(user.id, todayIn(user.prefs.timezone));
  const [snaps, assets, liabilities] = await Promise.all([
    prisma.netWorthSnapshot.findMany({ where: { userId: user.id }, orderBy: { date: "asc" } }),
    prisma.asset.findMany({ where: { userId: user.id }, orderBy: { value: "desc" } }),
    prisma.liability.findMany({ where: { userId: user.id }, orderBy: { balance: "desc" } }),
  ]);
  const history = snaps.map((s, i) => ({
    date: s.date.toISOString(),
    netWorth: s.netWorth.toString(),
    assets: s.totalAssets.toString(),
    liabilities: s.totalLiabilities.toString(),
    change: i ? s.netWorth.minus(snaps[i - 1].netWorth).toString() : null,
  }));
  return (
    <div>
      <PageHeader title="Net worth" description="Total assets minus total liabilities. Each item is counted once, from the module that owns it." />
      <NetWorthView
        totals={{ assets: nw.totalAssets.toString(), liabilities: nw.totalLiabilities.toString(), netWorth: nw.netWorth.toString() }}
        breakdown={nw.breakdown}
        history={history}
        assets={assets.map((a) => ({ id: a.id, name: a.name, type: a.type, value: a.value.toString(), valuedAt: a.valuedAt.toISOString().slice(0, 10), notes: a.notes ?? "" }))}
        liabilities={liabilities.map((l) => ({ id: l.id, name: l.name, type: l.type, balance: l.balance.toString(), asOf: l.asOf.toISOString().slice(0, 10), notes: l.notes ?? "" }))}
      />
    </div>
  );
}

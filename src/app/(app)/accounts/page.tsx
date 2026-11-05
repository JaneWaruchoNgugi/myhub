import type { Metadata } from "next";
import { requireUserPage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { accountsWithBalances } from "@/lib/services/ledger";
import { plain, sum } from "@/lib/money";
import { PageHeader } from "@/components/shared/page-header";
import { AccountsView } from "./view";

export const metadata: Metadata = { title: "Accounts" };

export default async function AccountsPage() {
  const user = await requireUserPage();
  const [accounts, raw, counts] = await Promise.all([
    accountsWithBalances(user.id),
    prisma.account.findMany({ where: { userId: user.id } }),
    prisma.transaction.groupBy({ by: ["accountId"], where: { userId: user.id }, _count: true }),
  ]);
  const rawMap = new Map(raw.map((r) => [r.id, r]));
  const countMap = new Map(counts.map((c) => [c.accountId, c._count]));
  const rows = accounts.map((a) => {
    const r = rawMap.get(a.id)!;
    return {
      ...plain(a),
      openingBalance: r.openingBalance.toString(),
      openingDate: r.openingDate.toISOString().slice(0, 10),
      notes: r.notes ?? "",
      txnCount: countMap.get(a.id) ?? 0,
    };
  });
  const total = sum(accounts.filter((a) => !a.isArchived).map((a) => a.balance)).toString();
  return (
    <div>
      <PageHeader title="Accounts" description="Cash, bank, mobile money and savings accounts. Balances are calculated from your transactions." />
      <AccountsView rows={rows} total={total} />
    </div>
  );
}

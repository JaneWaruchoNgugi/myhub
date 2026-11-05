import type { Metadata } from "next";
import { requireUserPage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getFinanceOptions } from "@/lib/services/options";
import { txnOrder, txnWhere, type TxnFilters } from "@/lib/services/queries";
import { dec } from "@/lib/money";
import { PageHeader } from "@/components/shared/page-header";
import { TransactionsView } from "./view";

export const metadata: Metadata = { title: "Transactions" };
const PAGE_SIZE = 50;

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUserPage();
  const sp = await searchParams;
  const f: TxnFilters = { q: sp.q, type: sp.type, account: sp.account, category: sp.category, from: sp.from, to: sp.to, sort: sp.sort, source: sp.source };
  const page = Math.max(1, Number(sp.page) || 1);
  const where = txnWhere(user.id, f);
  const [rows, total, sums, options, allCats, rules] = await Promise.all([
    prisma.transaction.findMany({ where, orderBy: txnOrder(f.sort), skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { account: { select: { name: true } }, toAccount: { select: { name: true } }, category: { select: { name: true, color: true } } } }),
    prisma.transaction.count({ where }),
    prisma.transaction.groupBy({ by: ["type"], where, _sum: { amount: true } }),
    getFinanceOptions(user.id),
    prisma.transactionCategory.findMany({ where: { userId: user.id }, orderBy: { name: "asc" }, select: { id: true, name: true, type: true } }),
    prisma.recurringRule.findMany({ where: { userId: user.id }, orderBy: { nextDate: "asc" }, include: { account: { select: { name: true } }, toAccount: { select: { name: true } }, category: { select: { name: true } } } }),
  ]);
  const allAccounts = await prisma.account.findMany({ where: { userId: user.id }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } });
  const s = (t: string) => dec(sums.find((x) => x.type === t)?._sum.amount).toString();
  return (
    <div>
      <PageHeader title="Transactions" description="Every shilling in and out. Search, filter, edit and export." />
      <TransactionsView
        rows={rows.map((r) => ({
          id: r.id,
          type: r.type,
          source: r.source,
          amount: r.amount.toString(),
          date: r.date.toISOString().slice(0, 10),
          description: r.description,
          notes: r.notes ?? "",
          accountId: r.accountId,
          toAccountId: r.toAccountId ?? "",
          categoryId: r.categoryId ?? "",
          accountName: r.account.name,
          toAccountName: r.toAccount?.name ?? null,
          categoryName: r.category?.name ?? null,
          categoryColor: r.category?.color ?? null,
          recurring: !!r.recurringRuleId,
        }))}
        rules={rules.map((r) => ({
          id: r.id,
          type: r.type,
          amount: r.amount.toString(),
          description: r.description,
          accountId: r.accountId,
          toAccountId: r.toAccountId ?? "",
          categoryId: r.categoryId ?? "",
          frequency: r.frequency,
          startDate: r.startDate.toISOString().slice(0, 10),
          endDate: r.endDate?.toISOString().slice(0, 10) ?? "",
          nextDate: r.nextDate.toISOString().slice(0, 10),
          isActive: r.isActive,
          accountName: r.account.name,
          toAccountName: r.toAccount?.name ?? null,
          categoryName: r.category?.name ?? null,
        }))}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        totals={{ income: s("INCOME"), expense: s("EXPENSE"), transfer: s("TRANSFER") }}
        options={options}
        filterOptions={{ accounts: allAccounts.map((a) => ({ value: a.id, label: a.name })), categories: allCats.map((c) => ({ value: c.id, label: `${c.name} (${c.type === "INCOME" ? "in" : "out"})` })) }}
        filters={f}
        openNew={sp.new === "TRANSFER" || sp.new === "INCOME" || sp.new === "EXPENSE" ? sp.new : null}
      />
    </div>
  );
}

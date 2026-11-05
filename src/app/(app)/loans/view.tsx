"use client";
import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Banknote, Eye, HandCoins, Plus, Percent, TrendingDown, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Money } from "@/components/shared/money";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { RowActions } from "@/components/shared/row-actions";
import { ListToolbar, Pagination, useListControls } from "@/components/shared/list-controls";
import { LoanDialog, RepaymentDialog } from "@/components/forms/obligations";
import { LOAN_STATUS_OPTS, LOAN_TYPE_OPTS, labelOf, type FinanceOptions } from "@/components/forms/options";
import { deleteLoan } from "@/server/actions/loans";
import { formatDay } from "@/lib/format";
import type { LoanRow } from "./data";

export const STATUS_BADGE: Record<string, "success" | "secondary" | "danger" | "default"> = { ACTIVE: "default", PAID_OFF: "success", DEFAULTED: "danger", WRITTEN_OFF: "secondary" };

export function LoansView({ rows, options, summary }: { rows: LoanRow[]; options: FinanceOptions; summary: { owed: string; owedToYou: string; interestYtd: string; debtProgress: number; overdue: number } }) {
  const [tab, setTab] = React.useState<"BORROWED" | "LENT">("BORROWED");
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<LoanRow | null>(null);
  const [repay, setRepay] = React.useState<LoanRow | null>(null);
  const list = rows.filter((r) => r.direction === tab);
  const c = useListControls(list, {
    search: (r, q) => r.name.toLowerCase().includes(q) || r.counterparty.toLowerCase().includes(q),
    filters: [
      { key: "status", label: "Statuses", options: LOAN_STATUS_OPTS, test: (r, v) => r.status === v },
      { key: "type", label: "Types", options: LOAN_TYPE_OPTS, test: (r, v) => r.loanType === v },
    ],
    sorts: [
      { key: "next", label: "Next payment", compare: (a, b) => (a.nextDate ?? "9999").localeCompare(b.nextDate ?? "9999") },
      { key: "outstanding", label: "Outstanding", compare: (a, b) => Number(b.outstanding) - Number(a.outstanding) },
      { key: "rate", label: "Interest rate", compare: (a, b) => Number(b.interestRate) - Number(a.interestRate) },
      { key: "name", label: "Name", compare: (a, b) => a.name.localeCompare(b.name) },
    ],
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="You owe" value={<Money value={summary.owed} />} icon={<HandCoins />} tone="negative" />
        <StatCard label="Owed to you" value={<Money value={summary.owedToYou} />} icon={<Users />} tone="positive" />
        <StatCard label="Interest paid this year" value={<Money value={summary.interestYtd} />} icon={<Percent />} tone="warning" />
        <StatCard label="Debt paid down" value={`${summary.debtProgress}%`} icon={<TrendingDown />} tone="primary" hint={<Progress value={summary.debtProgress} indicatorClassName="bg-emerald-500" className="mt-1" />} />
      </div>
      {summary.overdue ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="size-4" /> {summary.overdue} loan{summary.overdue > 1 ? "s have" : " has"} an overdue instalment.
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={(v) => setTab(v as "BORROWED" | "LENT")}>
        <TabsList>
          <TabsTrigger value="BORROWED">Money I borrowed ({rows.filter((r) => r.direction === "BORROWED").length})</TabsTrigger>
          <TabsTrigger value="LENT">Money I lent ({rows.filter((r) => r.direction === "LENT").length})</TabsTrigger>
        </TabsList>
      </Tabs>

      <ListToolbar controls={c} placeholder="Search loans or people">
        <Button onClick={() => setAdding(true)}>
          <Plus /> Add loan
        </Button>
      </ListToolbar>

      {list.length === 0 ? (
        <EmptyState icon={<HandCoins />} title={tab === "BORROWED" ? "No borrowed loans" : "You haven't lent money"} description="Track bank loans, mobile loans like Fuliza or M-Shwari, SACCO loans and money between friends." action={<Button onClick={() => setAdding(true)}><Plus /> Add loan</Button>} />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loan</TableHead>
                <TableHead className="hidden md:table-cell">Progress</TableHead>
                <TableHead>Next {tab === "BORROWED" ? "payment" : "collection"}</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {c.pageItems.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-normal">
                    <Link href={`/loans/${l.id}`} className="font-medium hover:underline">
                      {l.name}
                    </Link>
                    <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                      {l.counterparty} · {labelOf(LOAN_TYPE_OPTS, l.loanType).split(" (")[0]} · {l.interestRate}% p.a.
                      {l.status !== "ACTIVE" ? <Badge variant={STATUS_BADGE[l.status]}>{labelOf(LOAN_STATUS_OPTS, l.status)}</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell className="hidden w-48 md:table-cell">
                    <Progress value={l.progress} indicatorClassName="bg-emerald-500" />
                    <p className="text-muted-foreground mt-1 text-xs">
                      {l.progress}% of <Money value={l.principal} />
                    </p>
                  </TableCell>
                  <TableCell>
                    {l.nextDate ? (
                      <div>
                        <Money value={l.nextPayment} className="font-medium" />
                        <div className="flex items-center gap-1 text-xs">
                          {l.isOverdue ? <Badge variant="danger">Overdue</Badge> : null}
                          <span className="text-muted-foreground">{formatDay(l.nextDate)}</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    <Money value={l.outstanding} />
                  </TableCell>
                  <TableCell>
                    <RowActions
                      onEdit={() => setEditing(l)}
                      extra={[
                        { label: tab === "BORROWED" ? "Record repayment" : "Record money received", icon: <Banknote />, onSelect: () => setRepay(l), disabled: l.status !== "ACTIVE" && l.status !== "DEFAULTED" },
                        { label: "View schedule & history", icon: <Eye />, onSelect: () => (window.location.href = `/loans/${l.id}`) },
                      ]}
                      onDelete={() => deleteLoan(l.id)}
                      deleteTitle={`Delete "${l.name}"?`}
                      deleteDescription="The loan, its repayments and the transactions they created (disbursement, principal and interest) will be removed. Use this for entries made by mistake."
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <Pagination page={c.page} pageCount={c.pageCount} total={c.total} onPage={c.setPage} />

      <LoanDialog open={adding} onOpenChange={setAdding} options={options} initial={{ direction: tab }} />
      <LoanDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} options={options} initial={editing ?? undefined} />
      {repay ? (
        <RepaymentDialog
          open
          onOpenChange={(o) => !o && setRepay(null)}
          options={options}
          loanId={repay.id}
          direction={repay.direction as "BORROWED" | "LENT"}
          suggested={{ principal: repay.suggestedPrincipal, interest: repay.suggestedInterest, accountId: repay.accountId }}
        />
      ) : null}
    </div>
  );
}

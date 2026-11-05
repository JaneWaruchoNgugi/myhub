"use client";
import * as React from "react";
import { CheckCircle2, History, Plus, Receipt, SkipForward, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Money, useMoney } from "@/components/shared/money";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { RowActions } from "@/components/shared/row-actions";
import { ConfirmDialog } from "@/components/shared/confirm";
import { useRun } from "@/components/shared/use-run";
import { ListToolbar, Pagination, useListControls } from "@/components/shared/list-controls";
import { BillDialog, PayBillDialog } from "@/components/forms/obligations";
import { BILL_KIND_OPTS, RECURRENCE_OPTS, labelOf, type FinanceOptions } from "@/components/forms/options";
import { deleteBill, skipBillPeriod, undoBillPayment } from "@/server/actions/bills";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";

type Payment = { id: string; dueDate: string; paidDate: string; amount: string; method: string; account: string | null; viaLoan: boolean; linked: boolean };
type Row = {
  id: string;
  name: string;
  kind: string;
  amount: string;
  categoryId: string;
  categoryName: string | null;
  accountId: string;
  loanId: string;
  loanName: string | null;
  nextDueDate: string;
  daysUntil: number;
  recurrence: string;
  paymentMethod: string;
  isActive: boolean;
  notes: string;
  payments: Payment[];
};

function dueState(r: Row, reminderDays: number) {
  if (!r.isActive) return { label: r.recurrence === "NONE" && r.payments.length ? "Paid" : "Inactive", variant: "secondary" as const };
  if (r.daysUntil < 0) return { label: `Overdue ${-r.daysUntil}d`, variant: "danger" as const };
  if (r.daysUntil === 0) return { label: "Due today", variant: "warning" as const };
  if (r.daysUntil <= reminderDays) return { label: `Due in ${r.daysUntil}d`, variant: "warning" as const };
  return { label: `In ${r.daysUntil} days`, variant: "outline" as const };
}

export function BillsView({ rows, options, expenses, reminderDays }: { rows: Row[]; options: FinanceOptions; expenses: { id: string; amount: string; date: string; description: string }[]; reminderDays: number }) {
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<Row | null>(null);
  const [paying, setPaying] = React.useState<Row | null>(null);
  const [history, setHistory] = React.useState<Row | null>(null);
  const [undo, setUndo] = React.useState<Payment | null>(null);
  const { run } = useRun();
  const money = useMoney();
  const c = useListControls(rows, {
    search: (r, q) => r.name.toLowerCase().includes(q) || (r.categoryName ?? "").toLowerCase().includes(q),
    filters: [
      { key: "state", label: "States", options: [{ value: "overdue", label: "Overdue" }, { value: "soon", label: `Due within ${reminderDays} days` }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }], test: (r, v) => (v === "overdue" ? r.isActive && r.daysUntil < 0 : v === "soon" ? r.isActive && r.daysUntil >= 0 && r.daysUntil <= reminderDays : v === "active" ? r.isActive : !r.isActive) },
      { key: "kind", label: "Kinds", options: BILL_KIND_OPTS, test: (r, v) => r.kind === v },
    ],
    sorts: [
      { key: "due", label: "Due date", compare: (a, b) => Number(b.isActive) - Number(a.isActive) || a.nextDueDate.localeCompare(b.nextDueDate) },
      { key: "amount", label: "Amount", compare: (a, b) => Number(b.amount) - Number(a.amount) },
      { key: "name", label: "Name", compare: (a, b) => a.name.localeCompare(b.name) },
    ],
  });
  const active = rows.filter((r) => r.isActive);
  const overdue = active.filter((r) => r.daysUntil < 0);
  const next30 = active.filter((r) => r.daysUntil <= 30);
  const paidThisMonth = rows.flatMap((r) => r.payments).filter((p) => p.paidDate.slice(0, 7) === new Date().toISOString().slice(0, 7));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Overdue" value={overdue.length} icon={<AlertTriangle />} tone={overdue.length ? "negative" : "default"} hint={overdue.length ? money(overdue.reduce((a, r) => a + Number(r.amount), 0)) : "All caught up"} />
        <StatCard label="Due in 30 days" value={<Money value={next30.reduce((a, r) => a + Number(r.amount), 0)} />} icon={<Clock />} tone="warning" hint={`${next30.length} bills`} />
        <StatCard label="Paid this month" value={<Money value={paidThisMonth.reduce((a, p) => a + Number(p.amount), 0)} />} icon={<CheckCircle2 />} tone="positive" hint={`${paidThisMonth.length} payments`} />
        <StatCard label="Active bills" value={active.length} icon={<Receipt />} />
      </div>
      <ListToolbar controls={c} placeholder="Search bills">
        <Button onClick={() => setAdding(true)}>
          <Plus /> Add bill
        </Button>
      </ListToolbar>
      {rows.length === 0 ? (
        <EmptyState icon={<Receipt />} title="No bills yet" description="Add rent, KPLC, water, internet, school fees or insurance. Paying a bill records the expense once, and recurring bills roll to the next period." action={<Button onClick={() => setAdding(true)}><Plus /> Add bill</Button>} />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bill</TableHead>
                <TableHead>Next due</TableHead>
                <TableHead className="hidden md:table-cell">Repeats</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="hidden w-28 sm:table-cell" />
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {c.pageItems.map((r) => {
                const s = dueState(r, reminderDays);
                return (
                  <TableRow key={r.id} className={cn(!r.isActive && "opacity-60")}>
                    <TableCell className="whitespace-normal">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-muted-foreground text-xs">
                        {labelOf(BILL_KIND_OPTS, r.kind)}
                        {r.loanName ? ` · repays ${r.loanName}` : r.categoryName ? ` · ${r.categoryName}` : ""}
                        {r.paymentMethod ? ` · ${r.paymentMethod}` : ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{r.isActive ? formatDay(r.nextDueDate) : "—"}</div>
                      <Badge variant={s.variant} className="mt-0.5">
                        {s.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell">{labelOf(RECURRENCE_OPTS, r.recurrence)}</TableCell>
                    <TableCell className="text-right font-medium">
                      <Money value={r.amount} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {r.isActive ? (
                        <Button size="sm" variant={r.daysUntil <= reminderDays ? "default" : "outline"} onClick={() => setPaying(r)}>
                          Mark paid
                        </Button>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <RowActions
                        onEdit={() => setEditing(r)}
                        extra={[
                          ...(r.isActive ? [{ label: "Mark as paid", icon: <CheckCircle2 />, onSelect: () => setPaying(r) }] : []),
                          { label: `Payment history (${r.payments.length})`, icon: <History />, onSelect: () => setHistory(r) },
                          ...(r.isActive && r.recurrence !== "NONE" ? [{ label: "Skip this period", icon: <SkipForward />, onSelect: () => run(() => skipBillPeriod(r.id)) }] : []),
                        ]}
                        onDelete={() => deleteBill(r.id)}
                        deleteTitle={`Delete ${r.name}?`}
                        deleteDescription="The bill is removed. Its past payments stay in your transactions as ordinary expenses."
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
      <Pagination page={c.page} pageCount={c.pageCount} total={c.total} onPage={c.setPage} />

      <BillDialog open={adding} onOpenChange={setAdding} options={options} />
      <BillDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} options={options} initial={editing ?? undefined} />
      {paying ? (
        <PayBillDialog
          open
          onOpenChange={(o) => !o && setPaying(null)}
          options={options}
          bill={{ id: paying.id, name: paying.name, amount: paying.amount, accountId: paying.accountId || null, paymentMethod: paying.paymentMethod || null, isLoan: !!paying.loanId }}
          candidates={expenses
            .filter((e) => Math.abs(Number(e.amount) - Number(paying.amount)) <= Number(paying.amount) * 0.25 || e.description.toLowerCase().includes(paying.name.toLowerCase().split(" ")[0]))
            .slice(0, 20)
            .map((e) => ({ value: e.id, label: `${formatDay(e.date, "short")} · ${e.description} · ${money(e.amount)}` }))}
        />
      ) : null}
      <Dialog open={!!history} onOpenChange={(o) => !o && setHistory(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{history?.name}: payment history</DialogTitle>
            <DialogDescription>Each billing period can be paid once. Undo the latest payment to correct it.</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto px-2 pb-4">
            {history?.payments.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period due</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead className="hidden sm:table-cell">From</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.payments.map((p, i) => (
                    <TableRow key={p.id}>
                      <TableCell>{formatDay(p.dueDate)}</TableCell>
                      <TableCell>
                        {formatDay(p.paidDate)}
                        {p.paidDate > p.dueDate ? <Badge variant="warning" className="ml-1">Late</Badge> : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden text-xs sm:table-cell">{p.viaLoan ? "Loan repayment" : `${p.account ?? "—"}${p.linked ? " (linked)" : ""}`}</TableCell>
                      <TableCell className="text-right">
                        <Money value={p.amount} />
                      </TableCell>
                      <TableCell className="text-right">
                        {i === 0 ? (
                          <Button size="sm" variant="ghost" onClick={() => setUndo(p)}>
                            Undo
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground px-4 py-8 text-center text-sm">No payments recorded yet.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!undo}
        onOpenChange={(o) => !o && setUndo(null)}
        title="Undo this payment?"
        description={undo?.linked ? "The bill goes back to unpaid for that period. The expense you linked is kept." : "The bill goes back to unpaid for that period and the expense it created is removed."}
        confirmLabel="Undo payment"
        action={async () => {
          const r = await undoBillPayment(undo!.id);
          if (r.ok) setHistory(null);
          return r;
        }}
      />
    </div>
  );
}

"use client";
import * as React from "react";
import { CalendarClock, CreditCard, ExternalLink, History, Plus, Repeat, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Money } from "@/components/shared/money";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { RowActions } from "@/components/shared/row-actions";
import { ConfirmDialog } from "@/components/shared/confirm";
import { ListToolbar, Pagination, useListControls } from "@/components/shared/list-controls";
import { ChargeDialog, SubscriptionDialog } from "@/components/forms/obligations";
import { CYCLE_OPTS, SUB_STATUS_OPTS, labelOf, type FinanceOptions } from "@/components/forms/options";
import { deleteSubscription, undoSubscriptionCharge } from "@/server/actions/bills";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  name: string;
  provider: string;
  amount: string;
  billingCycle: string;
  nextBillingDate: string;
  daysUntil: number;
  paymentMethod: string;
  status: string;
  categoryId: string;
  categoryName: string | null;
  accountId: string;
  url: string;
  notes: string;
  monthly: string;
  annual: string;
  charges: { id: string; date: string; amount: string }[];
};

const STATUS: Record<string, "success" | "info" | "secondary" | "outline"> = { ACTIVE: "success", TRIAL: "info", PAUSED: "secondary", CANCELLED: "outline" };

export function SubscriptionsView({ rows, options, totals }: { rows: Row[]; options: FinanceOptions; totals: { monthly: string; annual: string; count: number } }) {
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<Row | null>(null);
  const [charging, setCharging] = React.useState<Row | null>(null);
  const [history, setHistory] = React.useState<Row | null>(null);
  const [undo, setUndo] = React.useState<string | null>(null);
  const c = useListControls(rows, {
    search: (r, q) => r.name.toLowerCase().includes(q) || r.provider.toLowerCase().includes(q),
    filters: [
      { key: "status", label: "Statuses", options: SUB_STATUS_OPTS, test: (r, v) => r.status === v },
      { key: "cycle", label: "Cycles", options: CYCLE_OPTS, test: (r, v) => r.billingCycle === v },
    ],
    sorts: [
      { key: "next", label: "Next billing", compare: (a, b) => a.nextBillingDate.localeCompare(b.nextBillingDate) },
      { key: "cost", label: "Monthly cost", compare: (a, b) => Number(b.monthly) - Number(a.monthly) },
      { key: "name", label: "Name", compare: (a, b) => a.name.localeCompare(b.name) },
    ],
  });
  const soon = rows.filter((r) => (r.status === "ACTIVE" || r.status === "TRIAL") && r.daysUntil <= 7);
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Monthly cost" value={<Money value={totals.monthly} />} icon={<Repeat />} tone="primary" />
        <StatCard label="Annual cost" value={<Money value={totals.annual} />} icon={<CreditCard />} tone="warning" />
        <StatCard label="Active" value={totals.count} icon={<Receipt />} />
        <StatCard label="Renewing in 7 days" value={soon.length} icon={<CalendarClock />} hint={soon.map((s) => s.name).join(", ") || "None"} />
      </div>
      <ListToolbar controls={c} placeholder="Search subscriptions">
        <Button onClick={() => setAdding(true)}>
          <Plus /> Add subscription
        </Button>
      </ListToolbar>
      {rows.length === 0 ? (
        <EmptyState icon={<Repeat />} title="No subscriptions tracked" description="Add Netflix, Spotify, Showmax, cloud hosting, domains or gym memberships to see what they really cost per year." action={<Button onClick={() => setAdding(true)}><Plus /> Add subscription</Button>} />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subscription</TableHead>
                <TableHead>Next billing</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="hidden text-right md:table-cell">Per month</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Per year</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {c.pageItems.map((r) => (
                <TableRow key={r.id} className={cn(r.status === "CANCELLED" && "opacity-60")}>
                  <TableCell className="whitespace-normal">
                    <div className="flex items-center gap-1.5 font-medium">
                      {r.name}
                      {r.url ? (
                        <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" aria-label={`Manage ${r.name}`}>
                          <ExternalLink className="size-3.5" />
                        </a>
                      ) : null}
                    </div>
                    <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
                      <Badge variant={STATUS[r.status]}>{r.status.toLowerCase()}</Badge>
                      {r.provider}
                      {r.paymentMethod ? ` · ${r.paymentMethod}` : ""}
                    </div>
                  </TableCell>
                  <TableCell>
                    {r.status === "CANCELLED" ? (
                      "—"
                    ) : (
                      <>
                        <div className="text-sm">{formatDay(r.nextBillingDate)}</div>
                        <div className={cn("text-xs", r.daysUntil < 0 ? "text-red-600" : "text-muted-foreground")}>{r.daysUntil < 0 ? `${-r.daysUntil}d ago, not recorded` : r.daysUntil === 0 ? "Today" : `in ${r.daysUntil} days`}</div>
                      </>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={r.amount} className="font-medium" />
                    <div className="text-muted-foreground text-xs">{labelOf(CYCLE_OPTS, r.billingCycle).toLowerCase()}</div>
                  </TableCell>
                  <TableCell className="hidden text-right md:table-cell">
                    <Money value={r.monthly} />
                  </TableCell>
                  <TableCell className="hidden text-right lg:table-cell">
                    <Money value={r.annual} />
                  </TableCell>
                  <TableCell>
                    <RowActions
                      onEdit={() => setEditing(r)}
                      extra={[
                        { label: "Record charge", icon: <CreditCard />, onSelect: () => setCharging(r), disabled: r.status === "CANCELLED" || !options.accounts.length },
                        { label: `Charge history (${r.charges.length})`, icon: <History />, onSelect: () => setHistory(r) },
                      ]}
                      onDelete={() => deleteSubscription(r.id)}
                      deleteTitle={`Delete ${r.name}?`}
                      deleteDescription="Past charges stay in your transactions as ordinary expenses."
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <Pagination page={c.page} pageCount={c.pageCount} total={c.total} onPage={c.setPage} />
      <SubscriptionDialog open={adding} onOpenChange={setAdding} options={options} />
      <SubscriptionDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} options={options} initial={editing ?? undefined} />
      {charging ? <ChargeDialog open onOpenChange={(o) => !o && setCharging(null)} options={options} sub={{ id: charging.id, name: charging.name, amount: charging.amount, accountId: charging.accountId || null, nextBillingDate: charging.nextBillingDate }} /> : null}
      <Dialog open={!!history} onOpenChange={(o) => !o && setHistory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{history?.name}: charges</DialogTitle>
            <DialogDescription>Recorded charges (each is also an expense transaction).</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto px-6 pb-6">
            {history?.charges.length ? (
              <ul className="divide-y">
                {history.charges.map((ch, i) => (
                  <li key={ch.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="flex-1">{formatDay(ch.date)}</span>
                    <Money value={ch.amount} />
                    {i === 0 ? (
                      <Button size="sm" variant="ghost" onClick={() => setUndo(ch.id)}>
                        Undo
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground py-6 text-center text-sm">No charges recorded yet.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!undo}
        onOpenChange={(o) => !o && setUndo(null)}
        title="Undo this charge?"
        description="The expense is removed and the next billing date moves back."
        confirmLabel="Undo"
        action={async () => {
          const r = await undoSubscriptionCharge(undo!);
          if (r.ok) setHistory(null);
          return r;
        }}
      />
    </div>
  );
}

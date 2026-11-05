"use client";
import * as React from "react";
import Link from "next/link";
import { Archive, ArchiveRestore, ArrowLeftRight, Plus, Wallet, Banknote, Landmark, Smartphone, PiggyBank, LineChart, CircleDollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Money } from "@/components/shared/money";
import { EmptyState } from "@/components/shared/empty-state";
import { RowActions } from "@/components/shared/row-actions";
import { AccountDialog } from "@/components/forms/finance";
import { deleteAccount, setAccountArchived } from "@/server/actions/accounts";
import { useRun } from "@/components/shared/use-run";
import { ACCOUNT_TYPE_OPTS, labelOf } from "@/components/forms/options";
import { cn } from "@/lib/utils";

type Row = { id: string; name: string; type: string; institution: string | null; color: string | null; isArchived: boolean; balance: string; openingBalance: string; openingDate: string; notes: string; txnCount: number };

const ICON: Record<string, React.ReactNode> = {
  CASH: <Banknote />,
  BANK: <Landmark />,
  MOBILE_MONEY: <Smartphone />,
  SAVINGS: <PiggyBank />,
  INVESTMENT_CASH: <LineChart />,
  OTHER: <CircleDollarSign />,
};

export function AccountsView({ rows, total }: { rows: Row[]; total: string }) {
  const [editing, setEditing] = React.useState<Row | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [showArchived, setShowArchived] = React.useState(false);
  const { run } = useRun();
  const active = rows.filter((r) => !r.isArchived);
  const archived = rows.filter((r) => r.isArchived);
  const list = showArchived ? rows : active;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Total across active accounts</p>
          <Money value={total} className="text-2xl font-semibold" />
        </div>
        <div className="flex gap-2">
          {archived.length ? (
            <Button variant="outline" onClick={() => setShowArchived((s) => !s)}>
              {showArchived ? "Hide" : "Show"} archived ({archived.length})
            </Button>
          ) : null}
          <Button variant="outline" asChild>
            <Link href="/transactions?new=TRANSFER">
              <ArrowLeftRight /> Transfer
            </Link>
          </Button>
          <Button onClick={() => setAdding(true)}>
            <Plus /> Add account
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={<Wallet />} title="No accounts yet" description="Add your M-Pesa, bank accounts and cash with today's balance. Every transaction then updates them automatically." action={<Button onClick={() => setAdding(true)}><Plus /> Add your first account</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((a) => (
            <Card key={a.id} className={cn("relative overflow-hidden", a.isArchived && "opacity-60")}>
              <span className="absolute inset-x-0 top-0 h-1" style={{ background: a.color ?? "#6366f1" }} />
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl [&_svg]:size-5" style={{ background: `${a.color ?? "#6366f1"}1a`, color: a.color ?? "#6366f1" }}>
                    {ICON[a.type]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{a.name}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {labelOf(ACCOUNT_TYPE_OPTS, a.type)}
                      {a.institution ? ` · ${a.institution}` : ""}
                    </p>
                  </div>
                  {a.isArchived ? <Badge variant="secondary">Archived</Badge> : null}
                  <RowActions
                    onEdit={() => setEditing(a)}
                    extra={[
                      { label: "View transactions", icon: <ArrowLeftRight />, onSelect: () => (window.location.href = `/transactions?account=${a.id}`) },
                      a.isArchived
                        ? { label: "Restore", icon: <ArchiveRestore />, onSelect: () => run(() => setAccountArchived(a.id, false)) }
                        : { label: "Archive", icon: <Archive />, onSelect: () => run(() => setAccountArchived(a.id, true)) },
                    ]}
                    onDelete={() => deleteAccount(a.id)}
                    deleteTitle={`Delete ${a.name}?`}
                    deleteDescription={a.txnCount ? `This account has ${a.txnCount} transactions, so it can't be deleted. Archive it instead.` : "This account has no transactions and will be removed."}
                  />
                </div>
                <div>
                  <Money value={a.balance} className={cn("text-2xl font-semibold tracking-tight", Number(a.balance) < 0 && "text-red-600")} />
                  <p className="text-muted-foreground mt-1 text-xs">{a.txnCount} transactions</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <AccountDialog open={adding} onOpenChange={setAdding} />
      <AccountDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        initial={editing ? { id: editing.id, name: editing.name, type: editing.type, institution: editing.institution ?? "", openingBalance: editing.openingBalance, openingDate: editing.openingDate, color: editing.color ?? "#6366f1", notes: editing.notes, isArchived: editing.isArchived } : undefined}
      />
    </>
  );
}

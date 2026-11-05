"use client";
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Download, Plus, Repeat, Search, Trash2, X, Pause, Play, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Money } from "@/components/shared/money";
import { EmptyState } from "@/components/shared/empty-state";
import { RowActions } from "@/components/shared/row-actions";
import { ConfirmDialog } from "@/components/shared/confirm";
import { useRun } from "@/components/shared/use-run";
import { RecurringDialog, TransactionDialog } from "@/components/forms/finance";
import { FREQ_OPTS, labelOf, type FinanceOptions } from "@/components/forms/options";
import { deleteRecurring, deleteTransaction, deleteTransactions, updateRecurring, updateTransactionLabels } from "@/server/actions/transactions";
import { EntityForm } from "@/components/shared/entity-form";
import { txnLabelSchema } from "@/lib/validation/finance";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Option } from "@/components/shared/entity-form";

type Row = {
  id: string;
  type: string;
  source: string;
  amount: string;
  date: string;
  description: string;
  notes: string;
  accountId: string;
  toAccountId: string;
  categoryId: string;
  accountName: string;
  toAccountName: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  recurring: boolean;
};
type Rule = { id: string; type: string; amount: string; description: string; accountId: string; toAccountId: string; categoryId: string; frequency: string; startDate: string; endDate: string; nextDate: string; isActive: boolean; accountName: string; toAccountName: string | null; categoryName: string | null };

const TYPE_LABEL: Record<string, string> = { INCOME: "Income", EXPENSE: "Expense", TRANSFER: "Transfer", INFLOW: "Inflow", OUTFLOW: "Outflow" };
const SOURCE_LABEL: Record<string, string> = { BILL: "Bill", LOAN: "Loan", INVESTMENT: "Investment", SAVINGS: "Savings", SUBSCRIPTION: "Subscription", RECURRING: "Recurring" };
const ALL = "__all__";

function useFilterNav() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  return (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "" || v === ALL) next.delete(k);
      else next.set(k, v);
    }
    if (!("page" in patch)) next.delete("page");
    next.delete("new");
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };
}

export function TransactionsView({
  rows,
  rules,
  total,
  page,
  pageSize,
  totals,
  options,
  filterOptions,
  filters,
  openNew,
}: {
  rows: Row[];
  rules: Rule[];
  total: number;
  page: number;
  pageSize: number;
  totals: { income: string; expense: string; transfer: string };
  options: FinanceOptions;
  filterOptions: { accounts: Option[]; categories: Option[] };
  filters: Record<string, string | undefined>;
  openNew: "INCOME" | "EXPENSE" | "TRANSFER" | null;
}) {
  const nav = useFilterNav();
  const sp = useSearchParams();
  const [q, setQ] = React.useState(filters.q ?? "");
  const [adding, setAdding] = React.useState<"INCOME" | "EXPENSE" | "TRANSFER" | null>(openNew);
  const [editing, setEditing] = React.useState<Row | null>(null);
  const [ruleOpen, setRuleOpen] = React.useState(false);
  const [editingRule, setEditingRule] = React.useState<Rule | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = React.useState(false);
  const { run } = useRun();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const isFiltered = ["q", "type", "account", "category", "from", "to", "source"].some((k) => filters[k]);
  const deletable = rows.filter((r) => r.source === "MANUAL" || r.source === "RECURRING");

  React.useEffect(() => setSelected(new Set()), [rows]);
  React.useEffect(() => {
    const t = setTimeout(() => {
      if ((filters.q ?? "") !== q) nav({ q });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const noAccounts = options.accounts.length === 0;
  const add = (t: "INCOME" | "EXPENSE" | "TRANSFER") => setAdding(t);

  return (
    <Tabs defaultValue="all">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TabsList>
          <TabsTrigger value="all">All transactions</TabsTrigger>
          <TabsTrigger value="recurring">
            <Repeat className="size-3.5" /> Recurring ({rules.length})
          </TabsTrigger>
        </TabsList>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => add("TRANSFER")} disabled={noAccounts}>
            <ArrowLeftRight /> Transfer
          </Button>
          <Button variant="outline" onClick={() => add("INCOME")} disabled={noAccounts}>
            <ArrowDownLeft className="text-emerald-600" /> Income
          </Button>
          <Button onClick={() => add("EXPENSE")} disabled={noAccounts}>
            <Plus /> Expense
          </Button>
        </div>
      </div>
      {noAccounts ? <p className="text-muted-foreground text-sm">Add an account first on the Accounts page.</p> : null}

      <TabsContent value="all" className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { l: "Income", v: totals.income, tone: "income" as const, i: <ArrowDownLeft /> },
            { l: "Expenses", v: totals.expense, tone: "expense" as const, i: <ArrowUpRight /> },
            { l: "Net", v: String(Number(totals.income) - Number(totals.expense)), tone: "auto" as const, i: <ArrowLeftRight /> },
          ].map((s) => (
            <div key={s.l} className="bg-card flex items-center gap-3 rounded-xl border px-4 py-3">
              <span className="text-muted-foreground [&_svg]:size-4">{s.i}</span>
              <span className="text-muted-foreground text-sm">{s.l}{isFiltered ? " (filtered)" : ""}</span>
              <Money value={s.v} tone={s.tone} className="ml-auto font-semibold" />
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:max-w-md">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search description, notes, category" className="bg-card pl-9" aria-label="Search transactions" />
            </div>
            <div className="ml-auto flex shrink-0 gap-2">
            {selected.size ? (
              <Button variant="destructive" size="sm" onClick={() => setBulkConfirm(true)}>
                <Trash2 /> Delete {selected.size}
              </Button>
            ) : null}
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/export/transactions?${sp.toString()}`} download>
                <Download /> CSV
              </a>
            </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect label="Type" value={filters.type} onChange={(v) => nav({ type: v })} options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))} />
            <FilterSelect label="Accounts" value={filters.account} onChange={(v) => nav({ account: v })} options={filterOptions.accounts} />
            <FilterSelect label="Categories" value={filters.category} onChange={(v) => nav({ category: v })} options={[{ value: "none", label: "Uncategorised" }, ...filterOptions.categories]} />
            <div className="bg-card flex h-9 items-center rounded-md border shadow-xs" role="group" aria-label="Date range">
              <input type="date" value={filters.from ?? ""} max={filters.to ?? undefined} onChange={(e) => nav({ from: e.target.value })} className="h-full rounded-l-md bg-transparent px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50" aria-label="From date" />
              <span className="text-muted-foreground px-1 text-xs">to</span>
              <input type="date" value={filters.to ?? ""} min={filters.from ?? undefined} onChange={(e) => nav({ to: e.target.value })} className="h-full rounded-r-md bg-transparent px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50" aria-label="To date" />
            </div>
            <Select value={filters.sort ?? "date_desc"} onValueChange={(v) => nav({ sort: v === "date_desc" ? null : v })}>
              <SelectTrigger className="bg-card h-9 w-auto" aria-label="Sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">Newest first</SelectItem>
                <SelectItem value="date_asc">Oldest first</SelectItem>
                <SelectItem value="amount_desc">Largest amount</SelectItem>
                <SelectItem value="amount_asc">Smallest amount</SelectItem>
              </SelectContent>
            </Select>
            {isFiltered ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQ("");
                  nav({ q: null, type: null, account: null, category: null, from: null, to: null, source: null });
                }}
              >
                <X /> Clear
              </Button>
            ) : null}
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<ArrowLeftRight />}
            title={isFiltered ? "No transactions match these filters" : "No transactions yet"}
            description={isFiltered ? "Try widening the date range or clearing filters." : "Record income and expenses, or set up recurring ones like salary and rent."}
            action={!isFiltered && !noAccounts ? <Button onClick={() => add("EXPENSE")}><Plus /> Add a transaction</Button> : undefined}
          />
        ) : (
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox
                      aria-label="Select all"
                      checked={deletable.length > 0 && selected.size === deletable.length}
                      onCheckedChange={(c) => setSelected(c ? new Set(deletable.map((r) => r.id)) : new Set())}
                    />
                  </TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="hidden md:table-cell">Category</TableHead>
                  <TableHead className="hidden lg:table-cell">Account</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const managed = r.source !== "MANUAL" && r.source !== "RECURRING";
                  const neg = r.type === "EXPENSE" || r.type === "OUTFLOW";
                  const pos = r.type === "INCOME" || r.type === "INFLOW";
                  return (
                    <TableRow key={r.id} data-state={selected.has(r.id) ? "selected" : undefined}>
                      <TableCell>
                        {managed ? (
                          <Lock className="text-muted-foreground size-3.5" aria-label="Managed by another module" />
                        ) : (
                          <Checkbox
                            aria-label={`Select ${r.description}`}
                            checked={selected.has(r.id)}
                            onCheckedChange={(c) =>
                              setSelected((s) => {
                                const n = new Set(s);
                                if (c) n.add(r.id);
                                else n.delete(r.id);
                                return n;
                              })
                            }
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">{formatDay(r.date)}</TableCell>
                      <TableCell className="max-w-[280px] whitespace-normal">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium">{r.description}</span>
                          {r.type === "TRANSFER" || r.type === "INFLOW" || r.type === "OUTFLOW" ? <Badge variant="secondary">{TYPE_LABEL[r.type]}</Badge> : null}
                          {SOURCE_LABEL[r.source] ? <Badge variant="outline" className="text-muted-foreground">{SOURCE_LABEL[r.source]}</Badge> : null}
                        </div>
                        {r.notes ? <p className="text-muted-foreground line-clamp-1 text-xs">{r.notes}</p> : null}
                        <p className="text-muted-foreground text-xs md:hidden">{r.categoryName ?? (r.type === "TRANSFER" ? `${r.accountName} → ${r.toAccountName}` : r.accountName)}</p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {r.categoryName ? (
                          <span className="inline-flex items-center gap-1.5 text-sm">
                            <span className="size-2 rounded-full" style={{ background: r.categoryColor ?? "#94a3b8" }} />
                            {r.categoryName}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden text-sm lg:table-cell">{r.type === "TRANSFER" ? `${r.accountName} → ${r.toAccountName}` : r.accountName}</TableCell>
                      <TableCell className={cn("text-right font-medium tabular", pos && "text-emerald-600 dark:text-emerald-400", neg && "text-foreground")}>
                        {neg ? "−" : pos ? "+" : ""}
                        <Money value={r.amount} />
                      </TableCell>
                      <TableCell>
                        <RowActions
                          onEdit={() => setEditing(r)}
                          onDelete={managed ? undefined : () => deleteTransaction(r.id)}
                          deleteTitle="Delete this transaction?"
                          deleteDescription={`${r.description} will be removed and account balances recalculated.`}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
        {pageCount > 1 || total ? (
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-xs">
              {total} transaction{total === 1 ? "" : "s"} · page {page} of {pageCount}
            </p>
            {pageCount > 1 ? (
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => nav({ page: String(page - 1) })}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => nav({ page: String(page + 1) })}>
                  Next
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Lock className="size-3" /> Locked rows were created by Bills, Loans, Savings, Investments or Subscriptions. Change or delete them there to keep records consistent.
        </p>
      </TabsContent>

      <TabsContent value="recurring">
        <div className="mb-4 flex items-center justify-between gap-2">
          <p className="text-muted-foreground text-sm">Due occurrences are added automatically. Editing a rule never changes past entries.</p>
          <Button onClick={() => setRuleOpen(true)} disabled={noAccounts}>
            <Plus /> New recurring
          </Button>
        </div>
        {rules.length === 0 ? (
          <EmptyState icon={<Repeat />} title="No recurring transactions" description="Salary, rent, chama contributions… set them once and MYHUB records each one on its date." />
        ) : (
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Repeats</TableHead>
                  <TableHead className="hidden md:table-cell">Account</TableHead>
                  <TableHead>Next</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((r) => (
                  <TableRow key={r.id} className={cn(!r.isActive && "opacity-60")}>
                    <TableCell>
                      <div className="font-medium">{r.description}</div>
                      <div className="text-muted-foreground text-xs">
                        {TYPE_LABEL[r.type]}
                        {r.categoryName ? ` · ${r.categoryName}` : ""}
                      </div>
                    </TableCell>
                    <TableCell>{labelOf(FREQ_OPTS, r.frequency)}</TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell">{r.type === "TRANSFER" ? `${r.accountName} → ${r.toAccountName}` : r.accountName}</TableCell>
                    <TableCell>{r.isActive ? formatDay(r.nextDate) : <Badge variant="secondary">Paused</Badge>}</TableCell>
                    <TableCell className="text-right font-medium">
                      <Money value={r.amount} tone={r.type === "INCOME" ? "income" : undefined} />
                    </TableCell>
                    <TableCell>
                      <RowActions
                        onEdit={() => setEditingRule(r)}
                        extra={[
                          {
                            label: r.isActive ? "Pause" : "Resume",
                            icon: r.isActive ? <Pause /> : <Play />,
                            onSelect: () => run(() => updateRecurring(r.id, { ...r, isActive: !r.isActive })),
                          },
                        ]}
                        onDelete={() => deleteRecurring(r.id)}
                        deleteTitle="Delete this recurring rule?"
                        deleteDescription="Transactions it already created are kept."
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </TabsContent>

      <TransactionDialog open={!!adding} onOpenChange={(o) => !o && setAdding(null)} options={options} defaultType={adding ?? "EXPENSE"} />
      <TransactionDialog
        open={!!editing && !isManaged(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        options={{ ...options, accounts: mergeOpt(options.accounts, editing ? [{ value: editing.accountId, label: editing.accountName }, ...(editing.toAccountId ? [{ value: editing.toAccountId, label: editing.toAccountName ?? "" }] : [])] : []) }}
        initial={editing && !isManaged(editing) ? { id: editing.id, type: editing.type, amount: editing.amount, date: editing.date, description: editing.description, notes: editing.notes, accountId: editing.accountId, toAccountId: editing.toAccountId, categoryId: editing.categoryId } : undefined}
      />
      <EntityForm
        open={!!editing && isManaged(editing)}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Edit transaction details"
        description={editing ? `Amount, date and account are managed by ${SOURCE_LABEL[editing.source]}. You can change the description, notes and category here.` : undefined}
        schema={txnLabelSchema}
        fields={[
          { name: "description", label: "Description", type: "text", span: 2 },
          ...(editing?.type === "INCOME" || editing?.type === "EXPENSE"
            ? [{ name: "categoryId", label: "Category", type: "select" as const, allowNone: "Uncategorised", options: editing.type === "INCOME" ? options.incomeCategories : options.expenseCategories, span: 2 as const }]
            : []),
          { name: "notes", label: "Notes", type: "textarea", rows: 2 },
        ]}
        defaultValues={{ description: editing?.description ?? "", notes: editing?.notes ?? "", categoryId: editing?.categoryId ?? "" }}
        onSubmit={(v) => updateTransactionLabels(editing!.id, v)}
      />
      <RecurringDialog open={ruleOpen} onOpenChange={setRuleOpen} options={options} />
      <RecurringDialog open={!!editingRule} onOpenChange={(o) => !o && setEditingRule(null)} options={options} initial={editingRule ?? undefined} />
      <ConfirmDialog
        open={bulkConfirm}
        onOpenChange={setBulkConfirm}
        title={`Delete ${selected.size} transactions?`}
        description="Account balances will be recalculated. This can't be undone."
        action={() => deleteTransactions([...selected])}
      />
    </Tabs>
  );
}

const isManaged = (r: Row) => r.source !== "MANUAL" && r.source !== "RECURRING";

function mergeOpt(a: Option[], b: Option[]) {
  const seen = new Set(a.map((o) => o.value));
  return [...a, ...b.filter((o) => o.value && !seen.has(o.value))];
}

function FilterSelect({ label, value, onChange, options }: { label: string; value?: string; onChange: (v: string) => void; options: Option[] }) {
  return (
    <Select value={value || ALL} onValueChange={onChange}>
      <SelectTrigger className="bg-card h-9 w-auto max-w-[200px] min-w-[120px]" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All {label.toLowerCase()}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

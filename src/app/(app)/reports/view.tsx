"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowDownCircle, ArrowUpCircle, Download, Percent, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/shared/stat-card";
import { Money } from "@/components/shared/money";
import { EmptyState } from "@/components/shared/empty-state";
import { DonutChart, GroupedBarChart, HBarChart, IncomeExpenseChart, NetWorthChart } from "@/components/charts/charts";
import { ASSET_CLASS_OPTS, CYCLE_OPTS, labelOf } from "@/components/forms/options";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";

type Cat = { categoryId: string | null; name: string; color: string; total: string };
type Props = {
  from: string;
  to: string;
  today: string;
  tab?: string;
  cashflow: { income: string; expense: string; net: string; savingsRate: number; months: { month: string; income: string; expense: string; net: string }[] };
  categories: { expense: Cat[]; income: Cat[] };
  budgets: { months: { month: string; limit: string; spent: string; over: number; lines: number }[]; categories: { name: string; limit: string; spent: string; pct: number }[] };
  goals: { id: string; name: string; account: string; status: string; target: string; saved: string; remaining: string; progress: number; forecast: string; targetDate: string; periodNet: string }[];
  loans: {
    rows: { id: string; name: string; direction: string; counterparty: string; status: string; principal: string; repaid: string; interest: string; outstanding: string; progress: number; dueDate: string }[];
    period: { borrowedPrincipal: string; borrowedInterest: string; lentPrincipal: string; lentInterest: string };
  };
  investments: {
    rows: { id: string; name: string; symbol: string; assetClass: string; value: string; cost: string; unrealized: string; unrealizedPct: number; realized: string; income: string; priceSource: string; priceUpdatedAt: string }[];
    totals: { value: string; cost: string; unrealized: string; realized: string; income: string };
    period: { dividends: string; interest: string; bought: string; sold: string };
  };
  networth: { current: { assets: string; liabilities: string; netWorth: string }; snapshots: { date: string; netWorth: string; assets: string; liabilities: string }[]; breakdown: { assets: Record<string, string>; liabilities: Record<string, string> } };
  subscriptions: { rows: { id: string; name: string; status: string; cycle: string; amount: string; monthly: string; annual: string }[]; monthly: string; annual: string; chargedInPeriod: string };
};

const TABS = [
  ["cashflow", "Income & expenses"],
  ["categories", "Categories"],
  ["budgets", "Budgets"],
  ["savings", "Savings"],
  ["loans", "Loans"],
  ["investments", "Investments"],
  ["networth", "Net worth"],
  ["subscriptions", "Subscriptions"],
] as const;
type Tab = (typeof TABS)[number][0];

const FORECAST: Record<string, [string, "success" | "info" | "warning" | "danger" | "secondary"]> = {
  complete: ["Complete", "success"],
  on_track: ["On track", "info"],
  behind: ["Behind", "warning"],
  overdue: ["Past target", "danger"],
  no_deadline: ["No deadline", "secondary"],
};

function shift(day: string, months: number, end = false) {
  const [y, m] = day.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + months + (end ? 1 : 0), end ? 0 : 1));
  return d.toISOString().slice(0, 10);
}

export function ReportsView(p: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = React.useState<Tab>((TABS.find((t) => t[0] === p.tab)?.[0] as Tab) ?? "cashflow");
  const [from, setFrom] = React.useState(p.from);
  const [to, setTo] = React.useState(p.to);
  React.useEffect(() => {
    setFrom(p.from);
    setTo(p.to);
  }, [p.from, p.to]);

  const qs = `from=${p.from}&to=${p.to}`;
  const go = (f: string, t: string) => router.push(`${pathname}?from=${f}&to=${t}&tab=${tab}`);
  const y = Number(p.today.slice(0, 4));
  const presets: [string, string, string][] = [
    ["This month", shift(p.today, 0), shift(p.today, 0, true)],
    ["Last month", shift(p.today, -1), shift(p.today, -1, true)],
    ["Last 3 months", shift(p.today, -2), shift(p.today, 0, true)],
    ["Year to date", `${y}-01-01`, shift(p.today, 0, true)],
    ["Last 12 months", shift(p.today, -11), shift(p.today, 0, true)],
    [`${y - 1}`, `${y - 1}-01-01`, `${y - 1}-12-31`],
  ];

  const csv = (type: string, label = "Export CSV") => (
    <Button asChild variant="outline" size="sm">
      <a href={`/api/export/${type}?${qs}`} download>
        <Download /> {label}
      </a>
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <Card className="gap-3 px-4 py-4">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (from && to) go(from, to);
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="r-from">From</Label>
            <Input id="r-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="r-to">To</Label>
            <Input id="r-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" required />
          </div>
          <Button type="submit">Apply</Button>
          <div className="flex flex-wrap gap-1.5">
            {presets.map(([label, f, t]) => (
              <Button key={label} type="button" size="sm" variant={p.from === f && p.to === t ? "secondary" : "ghost"} onClick={() => go(f, t)}>
                {label}
              </Button>
            ))}
          </div>
        </form>
        <p className="text-muted-foreground text-xs">
          Showing {formatDay(p.from)} to {formatDay(p.to)}. Transfers, loan principal and investment buys/sells are money moving between your own accounts, so they are not counted as income or expenses.
        </p>
      </Card>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as Tab);
          window.history.replaceState(null, "", `${pathname}?${qs}&tab=${v}`);
        }}
      >
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList>
            {TABS.map(([k, l]) => (
              <TabsTrigger key={k} value={k}>
                {l}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      {tab === "cashflow" ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Income" value={<Money value={p.cashflow.income} />} icon={<ArrowDownCircle />} tone="positive" />
            <StatCard label="Expenses" value={<Money value={p.cashflow.expense} />} icon={<ArrowUpCircle />} tone="negative" />
            <StatCard label="Net cash flow" value={<Money value={p.cashflow.net} tone="auto" />} icon={<Scale />} tone="primary" />
            <StatCard label="Savings rate" value={`${p.cashflow.savingsRate}%`} icon={<Percent />} hint="Net cash flow ÷ income" />
          </div>
          <Section title="Monthly income vs expenses" action={csv("monthly")}>
            <IncomeExpenseChart data={p.cashflow.months} />
            <Table className="mt-4">
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Income</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {p.cashflow.months.map((m) => (
                  <TableRow key={m.month}>
                    <TableCell>{formatDay(`${m.month}-01`, "month")}</TableCell>
                    <TableCell className="text-right">
                      <Money value={m.income} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={m.expense} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={m.net} tone="auto" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/transactions?from=${p.from}&to=${p.to}`}>View transactions in this period</Link>
            </Button>
            {csv("transactions", "Export all transactions")}
          </div>
        </>
      ) : null}

      {tab === "categories" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <CategoryCard title="Spending by category" rows={p.categories.expense} action={csv("categories")} empty="No expenses in this period." />
          <CategoryCard title="Income by source" rows={p.categories.income} empty="No income in this period." />
        </div>
      ) : null}

      {tab === "budgets" ? (
        p.budgets.months.length === 0 ? (
          <EmptyState title="No budgets in this period" description="Create a monthly budget to compare planned and actual spending." action={<Button asChild><Link href="/budgets">Go to budgets</Link></Button>} />
        ) : (
          <>
            <Section title="Budget vs actual by month" action={csv("budgets")}>
              <GroupedBarChart
                data={p.budgets.months.map((m) => ({ label: formatDay(`${m.month}-01`, "monthShort"), Budget: Number(m.limit), Spent: Number(m.spent) }))}
                keys={[
                  { key: "Budget", color: "#94a3b8" },
                  { key: "Spent", color: "#6366f1" },
                ]}
              />
              <Table className="mt-4">
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Budgeted</TableHead>
                    <TableHead className="text-right">Spent</TableHead>
                    <TableHead className="text-right">Difference</TableHead>
                    <TableHead className="text-right">Over budget</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {p.budgets.months.map((m) => (
                    <TableRow key={m.month}>
                      <TableCell>
                        <Link className="hover:underline" href={`/budgets?month=${m.month}`}>
                          {formatDay(`${m.month}-01`, "month")}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={m.limit} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={m.spent} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={Number(m.limit) - Number(m.spent)} tone="auto" />
                      </TableCell>
                      <TableCell className="text-right">{m.over ? <Badge variant="danger">{m.over} of {m.lines}</Badge> : <span className="text-muted-foreground text-sm">None</span>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Section>
            <Section title="Category totals across the period">
              <ul className="flex flex-col gap-3">
                {p.budgets.categories.map((c) => (
                  <li key={c.name}>
                    <div className="mb-1 flex justify-between gap-2 text-sm">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted-foreground">
                        <Money value={c.spent} /> of <Money value={c.limit} /> · <span className={cn(c.pct > 100 && "font-medium text-red-600 dark:text-red-400")}>{c.pct}%</span>
                      </span>
                    </div>
                    <Progress value={Math.min(100, c.pct)} indicatorClassName={c.pct > 100 ? "bg-red-500" : c.pct >= 80 ? "bg-amber-500" : undefined} />
                  </li>
                ))}
              </ul>
            </Section>
          </>
        )
      ) : null}

      {tab === "savings" ? (
        p.goals.length === 0 ? (
          <EmptyState title="No savings goals" action={<Button asChild><Link href="/savings">Go to savings</Link></Button>} />
        ) : (
          <Section title="Savings goals" action={<div className="flex gap-2">{csv("goals", "Goals CSV")}{csv("savings", "Contributions CSV")}</div>}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Goal</TableHead>
                  <TableHead className="text-right">Saved</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Target</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Net in period</TableHead>
                  <TableHead className="w-40">Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {p.goals.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="whitespace-normal">
                      <Link href={`/savings/${g.id}`} className="font-medium hover:underline">
                        {g.name}
                      </Link>
                      <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
                        <Badge variant={FORECAST[g.forecast][1]}>{FORECAST[g.forecast][0]}</Badge>
                        {g.account}
                        {g.targetDate ? ` · by ${formatDay(g.targetDate)}` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={g.saved} />
                    </TableCell>
                    <TableCell className="hidden text-right md:table-cell">
                      <Money value={g.target} />
                    </TableCell>
                    <TableCell className="hidden text-right sm:table-cell">
                      <Money value={g.periodNet} tone="auto" sign />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={g.progress} className="flex-1" />
                        <span className="w-10 text-right text-xs tabular-nums">{Math.round(g.progress)}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>
        )
      ) : null}

      {tab === "loans" ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Principal repaid (borrowed)" value={<Money value={p.loans.period.borrowedPrincipal} />} hint="In this period" />
            <StatCard label="Interest paid" value={<Money value={p.loans.period.borrowedInterest} />} tone="negative" hint="Counted as an expense" />
            <StatCard label="Principal received (lent)" value={<Money value={p.loans.period.lentPrincipal} />} hint="In this period" />
            <StatCard label="Interest received" value={<Money value={p.loans.period.lentInterest} />} tone="positive" hint="Counted as income" />
          </div>
          {p.loans.rows.length === 0 ? (
            <EmptyState title="No loans recorded" action={<Button asChild><Link href="/loans">Go to loans</Link></Button>} />
          ) : (
            <Section title="Loan summary" action={<div className="flex gap-2">{csv("loan-summary", "Summary CSV")}{csv("loans", "Repayments CSV")}</div>}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loan</TableHead>
                    <TableHead className="hidden text-right md:table-cell">Principal</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Interest paid</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="w-40">Repaid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {p.loans.rows.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-normal">
                        <Link href={`/loans/${l.id}`} className="font-medium hover:underline">
                          {l.name}
                        </Link>
                        <div className="text-muted-foreground text-xs">
                          {l.direction === "BORROWED" ? "Borrowed from" : "Lent to"} {l.counterparty} · {l.status.replace("_", " ").toLowerCase()}
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-right md:table-cell">
                        <Money value={l.principal} />
                      </TableCell>
                      <TableCell className="hidden text-right sm:table-cell">
                        <Money value={l.interest} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={l.outstanding} className="font-medium" />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={l.progress} className="flex-1" />
                          <span className="w-10 text-right text-xs tabular-nums">{Math.round(l.progress)}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Section>
          )}
        </>
      ) : null}

      {tab === "investments" ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Portfolio value" value={<Money value={p.investments.totals.value} />} hint={<>Cost <Money value={p.investments.totals.cost} /></>} tone="primary" />
            <StatCard label="Unrealized P/L" value={<Money value={p.investments.totals.unrealized} tone="auto" sign />} hint="At your last recorded prices" />
            <StatCard label="Realized P/L (all time)" value={<Money value={p.investments.totals.realized} tone="auto" sign />} />
            <StatCard label="Dividends & interest in period" value={<Money value={Number(p.investments.period.dividends) + Number(p.investments.period.interest)} />} hint={<>Bought <Money value={p.investments.period.bought} /> · Sold <Money value={p.investments.period.sold} /></>} tone="positive" />
          </div>
          {p.investments.rows.length === 0 ? (
            <EmptyState title="No investments recorded" action={<Button asChild><Link href="/investments">Go to investments</Link></Button>} />
          ) : (
            <Section title="Holdings performance" action={csv("investments")}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Holding</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="hidden text-right md:table-cell">Cost</TableHead>
                    <TableHead className="text-right">Unrealized</TableHead>
                    <TableHead className="hidden text-right lg:table-cell">Realized</TableHead>
                    <TableHead className="hidden text-right lg:table-cell">Income</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {p.investments.rows.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="whitespace-normal">
                        <Link href={`/investments/${i.id}`} className="font-medium hover:underline">
                          {i.name}
                        </Link>
                        <div className="text-muted-foreground text-xs">
                          {i.symbol ? `${i.symbol} · ` : ""}
                          {labelOf(ASSET_CLASS_OPTS, i.assetClass)} · price {i.priceUpdatedAt ? `from ${formatDay(i.priceUpdatedAt)}` : "not set"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={i.value} />
                      </TableCell>
                      <TableCell className="hidden text-right md:table-cell">
                        <Money value={i.cost} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={i.unrealized} tone="auto" sign />
                        <div className={cn("text-xs", i.unrealizedPct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>{i.unrealizedPct > 0 ? "+" : ""}{i.unrealizedPct}%</div>
                      </TableCell>
                      <TableCell className="hidden text-right lg:table-cell">
                        <Money value={i.realized} tone="auto" sign />
                      </TableCell>
                      <TableCell className="hidden text-right lg:table-cell">
                        <Money value={i.income} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Section>
          )}
        </>
      ) : null}

      {tab === "networth" ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Net worth today" value={<Money value={p.networth.current.netWorth} />} tone="primary" icon={<Scale />} />
            <StatCard label="Total assets" value={<Money value={p.networth.current.assets} />} tone="positive" />
            <StatCard label="Total liabilities" value={<Money value={p.networth.current.liabilities} />} tone="negative" />
          </div>
          <Section title="Net worth over time (month-end snapshots)" action={csv("networth")}>
            {p.networth.snapshots.length ? <NetWorthChart data={p.networth.snapshots} /> : <p className="text-muted-foreground py-8 text-center text-sm">No snapshots in this period. MYHUB records one each month automatically when you use the app.</p>}
          </Section>
          <div className="grid gap-6 lg:grid-cols-2">
            <BreakdownCard title="Assets" data={p.networth.breakdown.assets} />
            <BreakdownCard title="Liabilities" data={p.networth.breakdown.liabilities} />
          </div>
        </>
      ) : null}

      {tab === "subscriptions" ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Monthly cost (active)" value={<Money value={p.subscriptions.monthly} />} tone="primary" />
            <StatCard label="Annual cost (active)" value={<Money value={p.subscriptions.annual} />} tone="warning" />
            <StatCard label="Charged in period" value={<Money value={p.subscriptions.chargedInPeriod} />} hint="Recorded charges" />
          </div>
          {p.subscriptions.rows.length === 0 ? (
            <EmptyState title="No subscriptions" action={<Button asChild><Link href="/subscriptions">Go to subscriptions</Link></Button>} />
          ) : (
            <Section title="Subscription costs" action={csv("subscriptions")}>
              <HBarChart data={p.subscriptions.rows.filter((s) => s.status === "ACTIVE" || s.status === "TRIAL").map((s) => ({ name: s.name, value: Number(s.annual) })).sort((a, b) => b.value - a.value)} valueLabel="Per year" />
              <Table className="mt-4">
                <TableHeader>
                  <TableRow>
                    <TableHead>Subscription</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Per month</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Per year</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {p.subscriptions.rows.map((s) => (
                    <TableRow key={s.id} className={cn(s.status === "CANCELLED" || s.status === "PAUSED" ? "opacity-60" : "")}>
                      <TableCell>
                        <div className="font-medium">{s.name}</div>
                        <div className="text-muted-foreground text-xs">{s.status.toLowerCase()}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={s.amount} />
                        <div className="text-muted-foreground text-xs">{labelOf(CYCLE_OPTS, s.cycle).toLowerCase()}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={s.monthly} />
                      </TableCell>
                      <TableCell className="hidden text-right sm:table-cell">
                        <Money value={s.annual} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Section>
          )}
        </>
      ) : null}
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function CategoryCard({ title, rows, action, empty }: { title: string; rows: Cat[]; action?: React.ReactNode; empty: string }) {
  const total = rows.reduce((s, r) => s + Number(r.total), 0);
  return (
    <Section title={title} action={action}>
      {rows.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">{empty}</p>
      ) : (
        <>
          <DonutChart data={rows.slice(0, 8).map((r) => ({ name: r.name, value: Number(r.total), color: r.color }))} />
          <ul className="mt-4 divide-y text-sm">
            {rows.map((r) => (
              <li key={r.name} className="flex items-center gap-2 py-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                <span className="flex-1 truncate">{r.name}</span>
                <span className="text-muted-foreground w-12 text-right text-xs tabular-nums">{total ? Math.round((Number(r.total) / total) * 100) : 0}%</span>
                <Money value={r.total} className="w-28 text-right" />
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}

function BreakdownCard({ title, data }: { title: string; data: Record<string, string> }) {
  const rows = Object.entries(data).sort((a, b) => Number(b[1]) - Number(a[1]));
  return (
    <Section title={title}>
      {rows.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">None</p>
      ) : (
        <ul className="divide-y text-sm">
          {rows.map(([k, v]) => (
            <li key={k} className="flex justify-between py-2">
              <span>{k}</span>
              <Money value={v} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

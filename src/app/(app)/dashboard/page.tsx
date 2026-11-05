import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, ArrowRight, Banknote, CalendarClock, CreditCard, Landmark, PiggyBank, Scale, TrendingUp, TrendingDown, Wallet, Receipt, HandCoins, FolderKanban, CheckCircle2 } from "lucide-react";
import { requireUserPage } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { computeNetWorth } from "@/lib/services/networth";
import { byCategory, incomeExpense, monthlySeries } from "@/lib/services/ledger";
import { goalStats } from "@/lib/services/savings";
import { holdingStats } from "@/lib/services/investments";
import { loanSummary } from "@/lib/services/loans";
import { getFinanceOptions } from "@/lib/services/options";
import { addDays, addMonths, endOfMonth, startOfMonth, todayIn, todayRangeIn, diffDays } from "@/lib/dates";
import { formatDay, formatMoney, formatDateTime } from "@/lib/format";
import { sum } from "@/lib/money";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { IncomeExpenseChart, DonutChart, NetWorthChart, HBarChart } from "@/components/charts/charts";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { TaskCheck } from "@/components/dashboard/task-check";
import { titleCase, cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

function greeting(tz: string) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: tz }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default async function DashboardPage() {
  const user = await requireUserPage();
  const uid = user.id;
  const tz = user.prefs.timezone;
  const mp = { currency: user.prefs.currency, locale: user.prefs.locale };
  const today = todayIn(tz);
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const now = new Date();
  const { end: todayEnd } = todayRangeIn(tz);

  const [nw, month, series, spending, snapshots, goals, investments, loans, tasksToday, overdue, events, bills, projects, options, accountCount] = await Promise.all([
    computeNetWorth(uid),
    incomeExpense(uid, monthStart, monthEnd),
    monthlySeries(uid, addMonths(monthStart, -5, 1), monthEnd),
    byCategory(uid, "EXPENSE", monthStart, monthEnd),
    prisma.netWorthSnapshot.findMany({ where: { userId: uid }, orderBy: { date: "desc" }, take: 24 }).then((r) => r.reverse()),
    prisma.savingsGoal.findMany({ where: { userId: uid, status: { in: ["ACTIVE", "COMPLETED"] } }, include: { contributions: true }, orderBy: [{ isEmergencyFund: "desc" }, { priority: "desc" }] }),
    prisma.investment.findMany({ where: { userId: uid }, include: { transactions: true } }),
    prisma.loan.findMany({ where: { userId: uid, status: "ACTIVE" }, include: { repayments: true } }),
    prisma.task.findMany({ where: { userId: uid, status: { in: ["TODO", "IN_PROGRESS"] }, dueDate: { gte: now, lt: todayEnd } }, orderBy: { dueDate: "asc" }, take: 8 }),
    prisma.task.findMany({ where: { userId: uid, status: { in: ["TODO", "IN_PROGRESS"] }, dueDate: { lt: now } }, orderBy: { dueDate: "asc" }, take: 6 }),
    prisma.calendarEvent.findMany({ where: { userId: uid, start: { gte: now, lte: addDays(now, 7) } }, orderBy: { start: "asc" }, take: 5 }),
    prisma.bill.findMany({ where: { userId: uid, isActive: true, nextDueDate: { lte: addDays(today, 14) } }, orderBy: { nextDueDate: "asc" }, take: 6 }),
    prisma.devProject.findMany({ where: { userId: uid, status: { in: ["ACTIVE", "PLANNING"] } }, include: { tasks: { select: { status: true } } }, orderBy: { deadline: "asc" }, take: 4 }),
    getFinanceOptions(uid),
    prisma.account.count({ where: { userId: uid } }),
  ]);

  const goalRows = goals.map((g) => ({ g, s: goalStats(g, today) }));
  const earmarked = sum(goalRows.map((r) => r.s.saved));
  const holdings = investments.map((i) => ({ i, s: holdingStats(i) }));
  const unrealized = sum(holdings.map((h) => h.s.unrealized));
  const invested = sum(holdings.map((h) => h.s.cost));
  const allocation = Object.entries(
    holdings.reduce<Record<string, number>>((acc, h) => {
      acc[h.i.assetClass] = (acc[h.i.assetClass] ?? 0) + h.s.value.toNumber();
      return acc;
    }, {}),
  )
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: titleCase(k), value: v }));
  const loanRows = loans.map((l) => ({ l, s: loanSummary(l, today) })).filter((r) => r.s.next).sort((a, b) => a.s.next!.date.getTime() - b.s.next!.date.getTime());
  const borrowed = loans.filter((l) => l.direction === "BORROWED");
  const borrowedPrincipal = sum(borrowed.map((l) => l.principal));
  const debtProgress = borrowedPrincipal.isZero() ? 0 : sum(borrowed.map((l) => loanSummary(l, today).principalRepaid)).div(borrowedPrincipal).times(100).toNumber();
  const fmt = (v: { toString(): string } | string) => formatMoney(v.toString(), mp);
  const nwPoints = snapshots.map((s) => ({ date: s.date.toISOString(), netWorth: s.netWorth.toString() }));
  // Change since the last snapshot taken before this month started.
  const prevSnap = [...snapshots].reverse().find((s) => s.date < startOfMonth(today));
  const nwChange = prevSnap ? nw.netWorth.minus(prevSnap.netWorth) : null;

  if (accountCount === 0)
    return (
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{greeting(tz)}{user.name ? `, ${user.name.split(" ")[0]}` : ""}</h1>
        <p className="text-muted-foreground mt-1 text-sm">Let&apos;s set up your MYHUB.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            { n: 1, t: "Add your accounts", d: "Cash, bank accounts and mobile money like M-Pesa, with today's balances.", href: "/accounts" },
            { n: 2, t: "Record income & expenses", d: "Or set up recurring ones like salary and rent, and MYHUB adds them for you.", href: "/transactions" },
            { n: 3, t: "Set a budget and goals", d: "Monthly category limits, savings goals and an emergency fund.", href: "/budgets" },
          ].map((s) => (
            <Card key={s.n}>
              <CardHeader>
                <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-full text-sm font-semibold">{s.n}</span>
              </CardHeader>
              <CardContent>
                <h3 className="font-semibold">{s.t}</h3>
                <p className="text-muted-foreground mt-1 text-sm">{s.d}</p>
                <Button asChild variant={s.n === 1 ? "default" : "outline"} size="sm" className="mt-4">
                  <Link href={s.href}>
                    Get started <ArrowRight />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting(tz)}
            {user.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-muted-foreground text-sm">{formatDay(today, "long")} · Here&apos;s where things stand.</p>
        </div>
      </div>

      <QuickActions options={options} />

      {/* Headline */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="from-primary to-indigo-800 border-0 bg-gradient-to-br text-white lg:col-span-1 dark:to-indigo-950">
          <CardContent className="flex h-full flex-col justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-indigo-100 uppercase">
                <Scale className="size-4" /> Net worth
              </div>
              <div className="mt-3 text-[28px] leading-tight font-semibold tracking-tight break-words tabular sm:text-3xl">{fmt(nw.netWorth)}</div>
              {nwChange ? (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-indigo-50 tabular">
                  {nwChange.isNeg() ? <TrendingDown className="size-3.5" /> : <TrendingUp className="size-3.5" />}
                  {nwChange.isNeg() ? "" : "+"}
                  {fmt(nwChange)} since last month
                </div>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-white/10 px-3 py-2">
                <div className="text-xs text-indigo-100">Total assets</div>
                <div className="font-semibold tabular">{fmt(nw.totalAssets)}</div>
              </div>
              <div className="rounded-lg bg-white/10 px-3 py-2">
                <div className="text-xs text-indigo-100">Total liabilities</div>
                <div className="font-semibold tabular">{fmt(nw.totalLiabilities)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-2 gap-4 lg:col-span-2 lg:grid-cols-3">
          <StatCard label="Available cash" value={fmt(nw.availableCash)} icon={<Wallet />} tone="primary" hint="Cash, bank & mobile money" />
          <StatCard label="Total savings" value={fmt(nw.savingsAccounts)} icon={<PiggyBank />} tone="positive" hint={`${fmt(earmarked)} earmarked in goals`} />
          <StatCard
            label="Investments"
            value={fmt(nw.investmentValue)}
            icon={<TrendingUp />}
            tone="primary"
            hint={
              <span className={cn(unrealized.isNeg() ? "text-red-600" : "text-emerald-600")}>
                {formatMoney(unrealized.toString(), mp, { sign: true })} unrealized
              </span>
            }
          />
          <StatCard label="Outstanding loans" value={fmt(nw.outstandingBorrowed)} icon={<CreditCard />} tone="negative" hint={nw.outstandingLent.gt(0) ? `${fmt(nw.outstandingLent)} owed to you` : "Money you owe"} />
          <StatCard label="Income this month" value={fmt(month.income)} icon={<Banknote />} tone="positive" hint={`Expenses ${fmt(month.expense)}`} />
          <StatCard
            label="Savings rate"
            value={`${month.savingsRate.toFixed(1)}%`}
            icon={<Landmark />}
            tone={month.savingsRate >= 20 ? "positive" : month.savingsRate < 0 ? "negative" : "warning"}
            hint={`${formatMoney(month.net.toString(), mp, { sign: true })} net this month`}
          />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <div>
              <CardTitle>Income vs expenses</CardTitle>
              <CardDescription>Last 6 months. Transfers and loan principal excluded.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/reports">
                Reports <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <IncomeExpenseChart data={series} />
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Spending by category</CardTitle>
              <CardDescription>This month</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {spending.length ? (
              <DonutChart data={spending.map((c) => ({ name: c.name, value: Number(c.total), color: c.color }))} />
            ) : (
              <EmptyState className="py-10" title="No spending yet this month" description="Expenses you record will be grouped by category here." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Net worth over time</CardTitle>
              <CardDescription>Monthly snapshots</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/net-worth">
                Details <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>{nwPoints.length > 1 ? <NetWorthChart data={nwPoints} height={230} /> : <EmptyState className="py-10" title="History builds up monthly" description="MYHUB saves a snapshot each month. Come back next month to see the trend." />}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Investment portfolio</CardTitle>
              <CardDescription>
                {fmt(invested)} invested · {holdings.length} holding{holdings.length === 1 ? "" : "s"}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {allocation.length ? (
              <HBarChart data={allocation} valueLabel="Market value" />
            ) : (
              <EmptyState className="py-8" title="No investments yet" description="Track stocks, MMFs, T-bills and more with manual prices." />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Goals & debt */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Savings progress</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/savings">
                All goals <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {goalRows.length === 0 ? <EmptyState className="py-8" title="No savings goals" description="Create goals like an emergency fund, a laptop or school fees." /> : null}
            {goalRows.slice(0, 4).map(({ g, s }) => (
              <Link key={g.id} href={`/savings/${g.id}`} className="group">
                <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium group-hover:underline">
                    {g.name} {g.isEmergencyFund ? <Badge variant="info" className="ml-1">Emergency</Badge> : null}
                  </span>
                  <span className="text-muted-foreground text-xs tabular">
                    {fmt(s.saved)} / {fmt(s.target)}
                  </span>
                </div>
                <Progress value={s.progress} indicatorClassName={s.forecast === "behind" || s.forecast === "overdue" ? "bg-amber-500" : s.progress >= 100 ? "bg-emerald-500" : undefined} />
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Upcoming loan repayments</CardTitle>
              <CardDescription>Debt paid down: {debtProgress.toFixed(0)}%</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/loans">
                Loans <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {borrowed.length ? <Progress value={debtProgress} className="mb-4" indicatorClassName="bg-emerald-500" /> : null}
            {loanRows.length === 0 ? <EmptyState className="py-8" icon={<HandCoins />} title="Nothing due" description="Active loans and their next instalments appear here." /> : null}
            <ul className="divide-y">
              {loanRows.slice(0, 5).map(({ l, s }) => (
                <li key={l.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <Link href={`/loans/${l.id}`} className="block truncate text-sm font-medium hover:underline">
                      {l.name}
                    </Link>
                    <p className="text-muted-foreground text-xs">
                      {l.direction === "BORROWED" ? "You pay" : "You receive"} · due {formatDay(s.next!.date)}
                    </p>
                  </div>
                  {s.isOverdue ? <Badge variant="danger">Overdue</Badge> : null}
                  <span className="text-sm font-medium tabular">{fmt(s.next!.payment)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Productivity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s tasks</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/tasks">
                All <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {tasksToday.length === 0 ? (
              <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
                <CheckCircle2 className="size-4 text-emerald-500" /> Nothing else due today.
              </div>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {tasksToday.map((t) => (
                  <li key={t.id} className="flex items-center gap-2.5 text-sm">
                    <TaskCheck id={t.id} done={false} label={t.title} />
                    <span className="flex-1 truncate">{t.title}</span>
                    {!t.allDay && t.dueDate ? <span className="text-muted-foreground text-xs">{new Intl.DateTimeFormat("en-GB", { timeStyle: "short", timeZone: tz }).format(t.dueDate)}</span> : null}
                  </li>
                ))}
              </ul>
            )}
            {overdue.length ? (
              <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
                  <AlertTriangle className="size-3.5" /> {overdue.length} overdue
                </div>
                <ul className="flex flex-col gap-2">
                  {overdue.map((t) => (
                    <li key={t.id} className="flex items-center gap-2.5 text-sm">
                      <TaskCheck id={t.id} done={false} label={t.title} />
                      <span className="flex-1 truncate">{t.title}</span>
                      <span className="text-muted-foreground text-xs">{formatDateTime(t.dueDate, tz, false)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Upcoming appointments</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/calendar">
                Calendar <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? <p className="text-muted-foreground py-6 text-sm">No events in the next 7 days.</p> : null}
            <ul className="flex flex-col gap-3">
              {events.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <div className="bg-primary/10 text-primary flex w-11 shrink-0 flex-col items-center rounded-lg py-1 text-center">
                    <span className="text-[10px] font-medium uppercase">{new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: tz }).format(e.start)}</span>
                    <span className="text-base leading-none font-semibold">{new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: tz }).format(e.start)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{e.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {e.allDay ? "All day" : new Intl.DateTimeFormat("en-GB", { timeStyle: "short", timeZone: tz }).format(e.start)}
                      {e.location ? ` · ${e.location}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Upcoming bills</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/bills">
                Bills <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {bills.length === 0 ? <EmptyState className="py-8" icon={<Receipt />} title="No bills due soon" description="Bills due in the next 14 days show here." /> : null}
            <ul className="divide-y">
              {bills.map((b) => {
                const d = diffDays(b.nextDueDate, today);
                return (
                  <li key={b.id} className="flex items-center gap-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{b.name}</p>
                      <p className={cn("text-xs", d < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>{d < 0 ? `Overdue by ${-d} day${d === -1 ? "" : "s"}` : d === 0 ? "Due today" : `Due ${formatDay(b.nextDueDate, "short")}`}</p>
                    </div>
                    <span className="text-sm font-medium tabular">{fmt(b.amount)}</span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Dev projects</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dev/projects">
                Projects <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {projects.length === 0 ? <EmptyState className="py-8" icon={<FolderKanban />} title="No active projects" description="Track your builds, backlog and deadlines." /> : null}
            {projects.map((p) => {
              const done = p.tasks.filter((t) => t.status === "COMPLETED").length;
              const pct = p.tasks.length ? Math.round((done / p.tasks.length) * 100) : 0;
              return (
                <div key={p.id}>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{p.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {done}/{p.tasks.length} tasks
                    </span>
                  </div>
                  <Progress value={pct} />
                  {p.deadline ? (
                    <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                      <CalendarClock className="size-3" /> {formatDay(p.deadline)}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

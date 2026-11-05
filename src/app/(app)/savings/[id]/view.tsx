"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpFromLine, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Money, useMoney } from "@/components/shared/money";
import { StatCard } from "@/components/shared/stat-card";
import { RowActions } from "@/components/shared/row-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { NetWorthChart } from "@/components/charts/charts";
import { ContributionDialog, GoalDialog } from "@/components/forms/finance";
import type { FinanceOptions } from "@/components/forms/options";
import { deleteContribution } from "@/server/actions/savings";
import { formatDay } from "@/lib/format";
import { FORECAST, type GoalRow } from "../view";

export function GoalDetail({ goal, history, series, options }: { goal: GoalRow; history: { id: string; type: string; amount: string; date: string; note: string; movement: string | null }[]; series: { date: string; netWorth: string }[]; options: FinanceOptions }) {
  const [edit, setEdit] = React.useState(false);
  const [contrib, setContrib] = React.useState<"CONTRIBUTION" | "WITHDRAWAL" | null>(null);
  const money = useMoney();
  const f = FORECAST[goal.forecast];
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href="/savings">
            <ArrowLeft /> Savings
          </Link>
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
              {goal.name} {goal.isEmergencyFund ? <Badge variant="info">Emergency fund</Badge> : null} <Badge variant={f.variant}>{f.label}</Badge>
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Held in {goal.accountName}
              {goal.description ? ` · ${goal.description}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEdit(true)}>
              <Pencil /> Edit
            </Button>
            <Button variant="outline" onClick={() => setContrib("WITHDRAWAL")} disabled={Number(goal.saved) <= 0}>
              <ArrowUpFromLine /> Withdraw
            </Button>
            <Button onClick={() => setContrib("CONTRIBUTION")}>
              <Plus /> Contribute
            </Button>
          </div>
        </div>
      </div>
      <Card>
        <CardContent>
          <div className="flex items-baseline justify-between">
            <Money value={goal.saved} className="text-3xl font-semibold" />
            <span className="text-muted-foreground">
              of <Money value={goal.targetAmount} />
            </span>
          </div>
          <Progress value={goal.progress} className="mt-3 h-3" indicatorClassName={goal.progress >= 100 ? "bg-emerald-500" : undefined} />
          <p className="text-muted-foreground mt-2 text-sm">{goal.progress}% complete</p>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Remaining" value={<Money value={goal.remaining} />} />
        <StatCard label="Target date" value={goal.targetDate ? formatDay(goal.targetDate) : "—"} />
        <StatCard label="Needed per month" value={goal.requiredMonthly && Number(goal.remaining) > 0 ? money(goal.requiredMonthly) : "—"} />
        <StatCard label="Recent pace" value={`${money(goal.avgMonthly)}/mo`} hint={goal.projectedDate ? `Projected finish ${formatDay(goal.projectedDate)}` : undefined} />
      </div>
      {series.length > 1 ? (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Balance over time</CardTitle>
              <CardDescription>Running total of contributions minus withdrawals</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <NetWorthChart data={series} height={220} />
          </CardContent>
        </Card>
      ) : null}
      <Card className="pb-0">
        <CardHeader>
          <CardTitle>Contribution history</CardTitle>
        </CardHeader>
        {history.length === 0 ? (
          <CardContent className="pb-5">
            <EmptyState title="No contributions yet" description="Add your first contribution to start tracking progress." />
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="hidden sm:table-cell">Money movement</TableHead>
                <TableHead className="hidden md:table-cell">Note</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="text-muted-foreground">{formatDay(h.date)}</TableCell>
                  <TableCell>{h.type === "CONTRIBUTION" ? <Badge variant="success">Contribution</Badge> : <Badge variant="warning">Withdrawal</Badge>}</TableCell>
                  <TableCell className="text-muted-foreground hidden text-sm sm:table-cell">{h.movement ?? "Earmarked only"}</TableCell>
                  <TableCell className="text-muted-foreground hidden max-w-[240px] truncate md:table-cell">{h.note}</TableCell>
                  <TableCell className="text-right font-medium">
                    <Money value={h.type === "CONTRIBUTION" ? h.amount : `-${h.amount}`} tone="auto" />
                  </TableCell>
                  <TableCell>
                    <RowActions onDelete={() => deleteContribution(h.id)} deleteTitle="Remove this entry?" deleteDescription={h.movement ? "The linked transfer between accounts will be reversed too." : "The goal's progress will be recalculated."} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <GoalDialog open={edit} onOpenChange={setEdit} options={options} initial={goal} />
      {contrib ? <ContributionDialog open onOpenChange={(o) => !o && setContrib(null)} options={options} goalId={goal.id} goalAccountId={goal.accountId} type={contrib} /> : null}
    </div>
  );
}

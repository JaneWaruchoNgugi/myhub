"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, Calendar, Eye, PiggyBank, Plus, ShieldCheck, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Money } from "@/components/shared/money";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { RowActions } from "@/components/shared/row-actions";
import { ListToolbar, useListControls } from "@/components/shared/list-controls";
import { ContributionDialog, GoalDialog } from "@/components/forms/finance";
import { GOAL_STATUS_OPTS, PRIORITY_OPTS, type FinanceOptions } from "@/components/forms/options";
import { deleteGoal } from "@/server/actions/savings";
import { formatDay } from "@/lib/format";
import { useMoney } from "@/components/shared/money";
import { cn } from "@/lib/utils";

export type GoalRow = {
  id: string;
  name: string;
  description: string;
  targetAmount: string;
  targetDate: string;
  priority: string;
  status: string;
  isEmergencyFund: boolean;
  accountId: string;
  accountName: string;
  saved: string;
  remaining: string;
  progress: number;
  forecast: string;
  requiredMonthly: string | null;
  avgMonthly: string;
  projectedDate: string | null;
};

export const FORECAST: Record<string, { label: string; variant: "success" | "warning" | "danger" | "secondary" | "info" }> = {
  complete: { label: "Completed", variant: "success" },
  on_track: { label: "On track", variant: "success" },
  behind: { label: "Behind schedule", variant: "warning" },
  overdue: { label: "Past target date", variant: "danger" },
  no_deadline: { label: "No deadline", variant: "secondary" },
};

const PRIORITY_RANK: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export function SavingsView({ rows, options, summary }: { rows: GoalRow[]; options: FinanceOptions; summary: { totalSaved: string; totalTarget: string; savingsBalance: string; coverage: number | null; avgExpense: string; hasEmergency: boolean } }) {
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<GoalRow | null>(null);
  const [contrib, setContrib] = React.useState<{ goal: GoalRow; type: "CONTRIBUTION" | "WITHDRAWAL" } | null>(null);
  const money = useMoney();
  const c = useListControls(rows, {
    search: (r, q) => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q),
    filters: [
      { key: "status", label: "Statuses", options: GOAL_STATUS_OPTS, test: (r, v) => r.status === v },
      { key: "priority", label: "Priorities", options: PRIORITY_OPTS, test: (r, v) => r.priority === v },
    ],
    sorts: [
      { key: "priority", label: "Priority", compare: (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] },
      { key: "progress", label: "Progress", compare: (a, b) => b.progress - a.progress },
      { key: "deadline", label: "Target date", compare: (a, b) => (a.targetDate || "9999").localeCompare(b.targetDate || "9999") },
      { key: "remaining", label: "Amount left", compare: (a, b) => Number(b.remaining) - Number(a.remaining) },
    ],
    pageSize: 12,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Saved in goals" value={<Money value={summary.totalSaved} />} icon={<PiggyBank />} tone="positive" />
        <StatCard label="Active targets" value={<Money value={summary.totalTarget} />} icon={<TrendingUp />} tone="primary" />
        <StatCard label="Savings accounts" value={<Money value={summary.savingsBalance} />} icon={<ArrowDownToLine />} hint="Balance of all savings-type accounts" />
        <StatCard
          label="Emergency cover"
          value={summary.coverage === null ? "—" : `${summary.coverage} months`}
          icon={<ShieldCheck />}
          tone={summary.coverage !== null && summary.coverage >= 6 ? "positive" : "warning"}
          hint={summary.hasEmergency ? `vs ${money(summary.avgExpense)}/month average spend` : "Mark a goal as your emergency fund"}
        />
      </div>

      <ListToolbar controls={c} placeholder="Search goals">
        <Button onClick={() => setAdding(true)} disabled={!options.accounts.length}>
          <Plus /> New goal
        </Button>
      </ListToolbar>

      {rows.length === 0 ? (
        <EmptyState
          icon={<PiggyBank />}
          title="No savings goals yet"
          description={options.accounts.length ? "Start with an emergency fund of 3 to 6 months of expenses, then add goals like a laptop, rent deposit or school fees." : "Add an account first. Goals are held in one of your accounts."}
          action={options.accounts.length ? <Button onClick={() => setAdding(true)}><Plus /> Create a goal</Button> : <Button asChild><Link href="/accounts">Add an account</Link></Button>}
        />
      ) : c.total === 0 ? (
        <EmptyState title="No goals match" description="Clear the filters to see all goals." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {c.pageItems.map((g) => {
            const f = FORECAST[g.forecast];
            return (
              <Card key={g.id} className={cn(g.status === "CANCELLED" && "opacity-60")}>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <Link href={`/savings/${g.id}`} className="font-semibold hover:underline">
                        {g.name}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {g.isEmergencyFund ? <Badge variant="info">Emergency fund</Badge> : null}
                        {g.status !== "ACTIVE" ? <Badge variant="secondary">{g.status.toLowerCase()}</Badge> : <Badge variant={f.variant}>{f.label}</Badge>}
                      </div>
                    </div>
                    <RowActions
                      onEdit={() => setEditing(g)}
                      extra={[
                        { label: "View history", icon: <Eye />, onSelect: () => (window.location.href = `/savings/${g.id}`) },
                        { label: "Withdraw", icon: <ArrowUpFromLine />, onSelect: () => setContrib({ goal: g, type: "WITHDRAWAL" }), disabled: Number(g.saved) <= 0 },
                      ]}
                      onDelete={() => deleteGoal(g.id)}
                      deleteTitle={`Delete "${g.name}"?`}
                      deleteDescription="The goal and its contribution history are removed. Any money it moved between accounts stays where it is."
                    />
                  </div>
                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <Money value={g.saved} className="text-2xl font-semibold" />
                      <span className="text-muted-foreground text-sm">{g.progress}%</span>
                    </div>
                    <Progress value={g.progress} className="mt-2" indicatorClassName={g.progress >= 100 ? "bg-emerald-500" : g.forecast === "behind" || g.forecast === "overdue" ? "bg-amber-500" : undefined} />
                    <p className="text-muted-foreground mt-1.5 text-xs">
                      <Money value={g.remaining} /> left of <Money value={g.targetAmount} /> · in {g.accountName}
                    </p>
                  </div>
                  <div className="text-muted-foreground flex flex-col gap-1 text-xs">
                    {g.targetDate ? (
                      <span className="flex items-center gap-1.5">
                        <Calendar className="size-3.5" /> Target {formatDay(g.targetDate)}
                        {g.requiredMonthly && Number(g.remaining) > 0 ? <> · needs {money(g.requiredMonthly)}/month</> : null}
                      </span>
                    ) : null}
                    {g.projectedDate && Number(g.remaining) > 0 ? <span>At your recent pace ({money(g.avgMonthly)}/month) you&apos;ll finish around {formatDay(g.projectedDate)}.</span> : null}
                  </div>
                  {g.status === "ACTIVE" || g.status === "PAUSED" ? (
                    <Button variant="outline" size="sm" onClick={() => setContrib({ goal: g, type: "CONTRIBUTION" })}>
                      <Plus /> Add contribution
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <GoalDialog open={adding} onOpenChange={setAdding} options={options} />
      <GoalDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} options={options} initial={editing ?? undefined} />
      {contrib ? (
        <ContributionDialog
          open
          onOpenChange={(o) => !o && setContrib(null)}
          options={options}
          goalId={contrib.goal.id}
          goalAccountId={contrib.goal.accountId}
          type={contrib.type}
        />
      ) : null}
    </div>
  );
}

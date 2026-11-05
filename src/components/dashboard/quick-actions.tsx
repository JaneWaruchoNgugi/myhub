"use client";
import * as React from "react";
import { ArrowDownLeft, ArrowUpRight, FolderPlus, HandCoins, ListPlus, PiggyBank, Receipt, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransactionDialog, ContributionDialog } from "@/components/forms/finance";
import { BillDialog, InvestmentDialog, LoanDialog } from "@/components/forms/obligations";
import { ProjectDialog, TaskDialog } from "@/components/forms/productivity";
import type { FinanceOptions } from "@/components/forms/options";
import { toast } from "sonner";

type Kind = "income" | "expense" | "savings" | "loan" | "investment" | "bill" | "task" | "project" | null;

const ACTIONS: { kind: Exclude<Kind, null>; label: string; icon: React.ReactNode; cls: string }[] = [
  { kind: "income", label: "Income", icon: <ArrowDownLeft />, cls: "text-emerald-600 bg-emerald-500/10" },
  { kind: "expense", label: "Expense", icon: <ArrowUpRight />, cls: "text-red-600 bg-red-500/10" },
  { kind: "savings", label: "Savings", icon: <PiggyBank />, cls: "text-sky-600 bg-sky-500/10" },
  { kind: "loan", label: "Loan", icon: <HandCoins />, cls: "text-amber-600 bg-amber-500/10" },
  { kind: "investment", label: "Investment", icon: <TrendingUp />, cls: "text-indigo-600 bg-indigo-500/10" },
  { kind: "bill", label: "Bill", icon: <Receipt />, cls: "text-orange-600 bg-orange-500/10" },
  { kind: "task", label: "Task", icon: <ListPlus />, cls: "text-violet-600 bg-violet-500/10" },
  { kind: "project", label: "Dev project", icon: <FolderPlus />, cls: "text-slate-600 bg-slate-500/10 dark:text-slate-300" },
];

export function QuickActions({ options }: { options: FinanceOptions }) {
  const [open, setOpen] = React.useState<Kind>(null);
  const on = (k: Kind) => (o: boolean) => setOpen(o ? k : null);
  const needAccount = (k: Kind) => {
    if (["income", "expense", "savings"].includes(k ?? "") && options.accounts.length === 0) {
      toast.error("Add an account first (Accounts → Add account).");
      return;
    }
    if (k === "savings" && options.goals.length === 0) {
      toast.error("Create a savings goal first (Savings → New goal).");
      return;
    }
    setOpen(k);
  };
  return (
    <>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {ACTIONS.map((a) => (
          <Button key={a.kind} variant="outline" className="bg-card h-auto flex-col gap-1.5 py-3 text-xs font-medium" onClick={() => needAccount(a.kind)}>
            <span className={`flex size-8 items-center justify-center rounded-lg ${a.cls}`}>{a.icon}</span>
            <span className="truncate">{a.label}</span>
          </Button>
        ))}
      </div>
      <TransactionDialog open={open === "income"} onOpenChange={on("income")} options={options} defaultType="INCOME" />
      <TransactionDialog open={open === "expense"} onOpenChange={on("expense")} options={options} defaultType="EXPENSE" />
      {options.goals.length ? <ContributionDialog open={open === "savings"} onOpenChange={on("savings")} options={options} /> : null}
      <LoanDialog open={open === "loan"} onOpenChange={on("loan")} options={options} />
      <InvestmentDialog open={open === "investment"} onOpenChange={on("investment")} options={options} />
      <BillDialog open={open === "bill"} onOpenChange={on("bill")} options={options} />
      <TaskDialog open={open === "task"} onOpenChange={on("task")} />
      <ProjectDialog open={open === "project"} onOpenChange={on("project")} />
    </>
  );
}

"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, ChevronLeft, ChevronRight, Copy, Loader2, Pencil, PieChart, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Money } from "@/components/shared/money";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm";
import { useRun } from "@/components/shared/use-run";
import { GroupedBarChart } from "@/components/charts/charts";
import { budgetSchema } from "@/lib/validation/finance";
import { copyBudgetToNextMonth, deleteBudget, saveBudget } from "@/server/actions/budgets";
import type { Option } from "@/components/shared/entity-form";
import { cn } from "@/lib/utils";

type Line = { itemId: string; categoryId: string; categoryName: string; color: string; limit: string; carry: string; effectiveLimit: string; spent: string; remaining: string; utilization: number; state: "ok" | "warning" | "over" };
type Budget = { id: string; rollover: boolean; notes: string; totalLimit: string; totalSpent: string; unbudgeted: string; utilization: number; lines: Line[] };

const shift = (m: string, n: number) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};
const lastDay = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10);
};
const label = (m: string) => new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`));

export function BudgetsView({ month, isCurrent, threshold, categories, budget, compare }: { month: string; isCurrent: boolean; threshold: number; categories: Option[]; budget: Budget | null; compare: Record<string, string | number>[] }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [confirmDel, setConfirmDel] = React.useState(false);
  const { run, pending } = useRun();
  const over = budget?.lines.filter((l) => l.state === "over") ?? [];
  const warn = budget?.lines.filter((l) => l.state === "warning") ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" asChild aria-label="Previous month">
          <Link href={`/budgets?month=${shift(month, -1)}`}>
            <ChevronLeft />
          </Link>
        </Button>
        <div className="min-w-[160px] text-center text-lg font-semibold">{label(month)}</div>
        <Button variant="outline" size="icon" asChild aria-label="Next month">
          <Link href={`/budgets?month=${shift(month, 1)}`}>
            <ChevronRight />
          </Link>
        </Button>
        {!isCurrent ? (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/budgets">This month</Link>
          </Button>
        ) : null}
        <div className="ml-auto flex flex-wrap gap-2">
          {budget ? (
            <>
              <Button variant="outline" disabled={pending} onClick={() => run(() => copyBudgetToNextMonth(budget.id), { onSuccess: (r) => router.push(`/budgets?month=${(r as { data?: string }).data}`) })}>
                <Copy /> Copy to next month
              </Button>
              <Button variant="outline" onClick={() => setConfirmDel(true)}>
                <Trash2 /> Delete
              </Button>
              <Button onClick={() => setEditOpen(true)}>
                <Pencil /> Edit budget
              </Button>
            </>
          ) : (
            <Button onClick={() => setEditOpen(true)} disabled={!categories.length}>
              <Plus /> Create budget
            </Button>
          )}
        </div>
      </div>

      {!budget ? (
        <EmptyState icon={<PieChart />} title={`No budget for ${label(month)}`} description="Set spending limits per category. Actual spending is tracked automatically from your expenses." action={<Button onClick={() => setEditOpen(true)}><Plus /> Create budget</Button>} />
      ) : (
        <>
          {over.length || warn.length ? (
            <div className={cn("flex items-start gap-3 rounded-xl border p-4", over.length ? "border-red-500/30 bg-red-500/5" : "border-amber-500/30 bg-amber-500/5")}>
              <AlertTriangle className={cn("mt-0.5 size-5 shrink-0", over.length ? "text-red-600" : "text-amber-600")} />
              <div className="text-sm">
                {over.length ? (
                  <p>
                    <span className="font-semibold">Over budget:</span> {over.map((l) => l.categoryName).join(", ")}.
                  </p>
                ) : null}
                {warn.length ? (
                  <p>
                    <span className="font-semibold">Approaching limit ({threshold}%+):</span> {warn.map((l) => l.categoryName).join(", ")}.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <SummaryTile label="Budgeted" value={<Money value={budget.totalLimit} />} />
            <SummaryTile label="Spent" value={<Money value={budget.totalSpent} />} />
            <SummaryTile label="Remaining" value={<Money value={String(Number(budget.totalLimit) - Number(budget.totalSpent))} tone="auto" />} />
            <SummaryTile label="Unbudgeted spending" value={<Money value={budget.unbudgeted} tone={Number(budget.unbudgeted) > 0 ? "expense" : "muted"} />} />
          </div>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Categories</CardTitle>
                <CardDescription>
                  {budget.utilization}% of the total used{budget.rollover ? " · Rollover on: last month's leftover (or overspend) is carried in" : ""}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {budget.lines.map((l) => (
                <div key={l.itemId}>
                  <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="size-2.5 rounded-full" style={{ background: l.color }} />
                    <Link href={`/transactions?category=${l.categoryId}&from=${month}-01&to=${lastDay(month)}`} className="font-medium hover:underline">
                      {l.categoryName}
                    </Link>
                    {l.state === "over" ? <Badge variant="danger">Over by <Money value={String(-Number(l.remaining))} /></Badge> : l.state === "warning" ? <Badge variant="warning">{l.utilization}%</Badge> : null}
                    <span className="text-muted-foreground ml-auto text-xs tabular">
                      <Money value={l.spent} /> of <Money value={l.effectiveLimit} />
                      {Number(l.carry) !== 0 ? (
                        <span className="ml-1">
                          (<Money value={l.carry} sign /> carried)
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <Progress value={l.utilization} indicatorClassName={l.state === "over" ? "bg-red-500" : l.state === "warning" ? "bg-amber-500" : "bg-emerald-500"} />
                  <p className="text-muted-foreground mt-1 text-xs">{Number(l.remaining) >= 0 ? <>
                        <Money value={l.remaining} /> left
                      </> : "Limit exceeded"}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Budget vs actual</CardTitle>
            <CardDescription>Six months up to {label(month)}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <GroupedBarChart data={compare} keys={[{ key: "Budget", color: "#cbd5e1" }, { key: "Spent", color: "#6366f1" }]} />
        </CardContent>
      </Card>

      <BudgetEditor open={editOpen} onOpenChange={setEditOpen} month={month} budget={budget} categories={categories} />
      {budget ? <ConfirmDialog open={confirmDel} onOpenChange={setConfirmDel} title={`Delete the ${label(month)} budget?`} description="Only the limits are removed. Your transactions aren't affected." action={() => deleteBudget(budget.id)} /> : null}
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-card rounded-xl border p-4">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
      <div className="mt-2 text-lg font-semibold">{value}</div>
    </div>
  );
}

type FormValues = { month: string; rollover: boolean; notes: string; items: { categoryId: string; limit: string }[] };

function BudgetEditor({ open, onOpenChange, month, budget, categories }: { open: boolean; onOpenChange: (o: boolean) => void; month: string; budget: Budget | null; categories: Option[] }) {
  const defaults: FormValues = {
    month,
    rollover: budget?.rollover ?? false,
    notes: budget?.notes ?? "",
    items: budget?.lines.map((l) => ({ categoryId: l.categoryId, limit: l.limit })) ?? [{ categoryId: "", limit: "" }],
  };
  const form = useForm<FormValues>({ resolver: zodResolver(budgetSchema) as never, defaultValues: defaults });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const key = JSON.stringify(defaults);
  React.useEffect(() => {
    if (open) form.reset(JSON.parse(key));
  }, [open, key, form]);
  const items = form.watch("items");
  const total = items.reduce((a, i) => a + (Number(String(i.limit).replace(/,/g, "")) || 0), 0);
  const errs = form.formState.errors;

  const submit = form.handleSubmit(async (v) => {
    const r = await saveBudget(budget?.id ?? null, v);
    if (r.ok) {
      toast.success(r.message ?? "Saved");
      onOpenChange(false);
    } else toast.error(r.error);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{budget ? "Edit budget" : "Create budget"}</DialogTitle>
          <DialogDescription>Set a monthly limit for each expense category you want to track.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="b-month">Month</Label>
              <Input id="b-month" type="month" {...form.register("month")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Category limits</Label>
              {fields.map((f, i) => (
                <div key={f.id} className="flex items-start gap-2">
                  <Controller
                    control={form.control}
                    name={`items.${i}.categoryId`}
                    render={({ field }) => (
                      <Select value={field.value || undefined} onValueChange={field.onChange}>
                        <SelectTrigger className="flex-1" aria-label="Category">
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.value} value={c.value} disabled={items.some((it, j) => j !== i && it.categoryId === c.value)}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <div className="w-36">
                    <Input inputMode="decimal" placeholder="Limit" aria-label="Limit" aria-invalid={!!errs.items?.[i]?.limit} {...form.register(`items.${i}.limit`)} />
                    {errs.items?.[i]?.limit ? <p className="text-destructive mt-1 text-xs">{errs.items[i]?.limit?.message}</p> : null}
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} disabled={fields.length === 1} aria-label="Remove line">
                    <X />
                  </Button>
                </div>
              ))}
              {errs.items?.root?.message || errs.items?.message ? <p className="text-destructive text-xs">{errs.items?.root?.message ?? errs.items?.message}</p> : null}
              <div className="flex items-center justify-between">
                <Button type="button" variant="outline" size="sm" onClick={() => append({ categoryId: "", limit: "" })} disabled={fields.length >= categories.length}>
                  <Plus /> Add category
                </Button>
                <span className="text-muted-foreground text-sm">
                  Total: <Money value={total} className="text-foreground font-semibold" />
                </span>
              </div>
            </div>
            <Controller
              control={form.control}
              name="rollover"
              render={({ field }) => (
                <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border px-3 py-2.5">
                  <span>
                    <span className="block text-sm font-medium">Roll over from last month</span>
                    <span className="text-muted-foreground text-xs">Unspent money (or overspending) in a category adjusts this month&apos;s limit.</span>
                  </span>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </label>
              )}
            />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="b-notes">Notes</Label>
              <Input id="b-notes" {...form.register("notes")} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : null} Save budget
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

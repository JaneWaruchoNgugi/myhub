"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Banknote, CheckCircle2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Money } from "@/components/shared/money";
import { StatCard } from "@/components/shared/stat-card";
import { RowActions } from "@/components/shared/row-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { LoanDialog, RepaymentDialog } from "@/components/forms/obligations";
import { FREQ_OPTS, LOAN_STATUS_OPTS, labelOf, type FinanceOptions } from "@/components/forms/options";
import { deleteRepayment } from "@/server/actions/loans";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LoanRow } from "../data";
import { STATUS_BADGE } from "../view";

type Sched = { n: number; date: string; payment: string; interest: string; principal: string; balance: string; paid: boolean; overdue: boolean };
type Rep = { id: string; date: string; principal: string; interest: string; note: string; fromBill: boolean };

export function LoanDetail({ loan, options, schedule, repayments }: { loan: LoanRow; options: FinanceOptions; schedule: Sched[]; repayments: Rep[] }) {
  const [edit, setEdit] = React.useState(false);
  const [repay, setRepay] = React.useState(false);
  const borrowed = loan.direction === "BORROWED";
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href="/loans">
            <ArrowLeft /> Loans
          </Link>
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
              {loan.name} <Badge variant={STATUS_BADGE[loan.status]}>{labelOf(LOAN_STATUS_OPTS, loan.status)}</Badge>
              {loan.isOverdue ? <Badge variant="danger">Overdue</Badge> : null}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {borrowed ? "Borrowed from" : "Lent to"} {loan.counterparty} · {loan.interestRate}% p.a. · {labelOf(FREQ_OPTS, loan.frequency).toLowerCase()} · {formatDay(loan.startDate)} to {formatDay(loan.dueDate)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEdit(true)}>
              <Pencil /> Edit
            </Button>
            <Button onClick={() => setRepay(true)} disabled={loan.status === "PAID_OFF" || loan.status === "WRITTEN_OFF"}>
              <Banknote /> {borrowed ? "Record repayment" : "Record money received"}
            </Button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Outstanding" value={<Money value={loan.outstanding} />} tone="negative" />
        <StatCard label="Principal repaid" value={<Money value={loan.principalRepaid} />} hint={<Progress value={loan.progress} className="mt-1" indicatorClassName="bg-emerald-500" />} />
        <StatCard label={borrowed ? "Interest paid" : "Interest earned"} value={<Money value={loan.interestPaid} />} hint={<>Scheduled total <Money value={loan.scheduledInterest} /></>} />
        <StatCard label="Next instalment" value={loan.nextPayment ? <Money value={loan.nextPayment} /> : "—"} hint={loan.nextDate ? `Due ${formatDay(loan.nextDate)}` : "Nothing due"} />
      </div>
      {loan.notes ? <p className="text-muted-foreground bg-muted rounded-lg px-4 py-3 text-sm whitespace-pre-wrap">{loan.notes}</p> : null}
      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">Repayment history ({repayments.length})</TabsTrigger>
          <TabsTrigger value="schedule">Repayment schedule ({schedule.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="history">
          <Card className="py-0">
            {repayments.length === 0 ? (
              <CardContent className="py-5">
                <EmptyState title="No repayments yet" description="Record each payment with its principal and interest parts." />
              </CardContent>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Principal</TableHead>
                    <TableHead className="text-right">Interest</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="hidden md:table-cell">Note</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repayments.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{formatDay(r.date)}</TableCell>
                      <TableCell className="text-right">
                        <Money value={r.principal} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={r.interest} />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        <Money value={String(Number(r.principal) + Number(r.interest))} />
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden max-w-[220px] truncate md:table-cell">{r.fromBill ? "Paid via bill" : r.note}</TableCell>
                      <TableCell>
                        {r.fromBill ? null : <RowActions onDelete={() => deleteRepayment(r.id)} deleteTitle="Delete this repayment?" deleteDescription="Its principal and interest transactions will be removed and the balance recalculated." />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
        <TabsContent value="schedule">
          <Card className="py-0">
            <CardHeader className="pt-5">
              <div>
                <CardTitle>Amortization (reducing balance)</CardTitle>
                <CardDescription>The expected plan. Actual repayments may differ.</CardDescription>
              </div>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-right">Payment</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Principal</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Interest</TableHead>
                  <TableHead className="text-right">Balance after</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedule.map((r) => (
                  <TableRow key={r.n} className={cn(r.paid && "text-muted-foreground")}>
                    <TableCell>{r.paid ? <CheckCircle2 className="size-4 text-emerald-500" aria-label="Covered" /> : r.n}</TableCell>
                    <TableCell>
                      {formatDay(r.date)} {r.overdue ? <Badge variant="danger" className="ml-1">Overdue</Badge> : null}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <Money value={r.payment} />
                    </TableCell>
                    <TableCell className="hidden text-right sm:table-cell">
                      <Money value={r.principal} />
                    </TableCell>
                    <TableCell className="hidden text-right sm:table-cell">
                      <Money value={r.interest} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={r.balance} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
      <LoanDialog open={edit} onOpenChange={setEdit} options={options} initial={loan} />
      <RepaymentDialog open={repay} onOpenChange={setRepay} options={options} loanId={loan.id} direction={loan.direction as "BORROWED" | "LENT"} suggested={{ principal: loan.suggestedPrincipal, interest: loan.suggestedInterest, accountId: loan.accountId }} />
    </div>
  );
}

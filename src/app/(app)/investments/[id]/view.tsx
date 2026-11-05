"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Coins, Minus, Pencil, Percent, RefreshCw, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Money } from "@/components/shared/money";
import { StatCard } from "@/components/shared/stat-card";
import { RowActions } from "@/components/shared/row-actions";
import { EmptyState } from "@/components/shared/empty-state";
import { NetWorthChart } from "@/components/charts/charts";
import { InvestmentDialog, InvestmentTxnDialog, PriceDialog } from "@/components/forms/obligations";
import { ASSET_CLASS_OPTS, labelOf, type FinanceOptions } from "@/components/forms/options";
import { deleteInvestmentTxn } from "@/server/actions/investments";
import { formatDay, formatNumber } from "@/lib/format";
import { staleness, type HoldingRow } from "../view";

type Txn = { id: string; type: string; date: string; units: string; price: string; amount: string; fees: string; realizedGain: string | null; note: string; linked: boolean };
const TYPE_BADGE: Record<string, "success" | "warning" | "info" | "default"> = { BUY: "default", SELL: "warning", DIVIDEND: "success", INTEREST: "info" };

export function InvestmentDetail({ h, txns, prices, options }: { h: HoldingRow; txns: Txn[]; prices: { date: string; price: string; source: string }[]; options: FinanceOptions }) {
  const [edit, setEdit] = React.useState(false);
  const [txn, setTxn] = React.useState<"BUY" | "SELL" | "DIVIDEND" | "INTEREST" | null>(null);
  const [price, setPrice] = React.useState(false);
  const st = staleness(h.priceUpdatedAt);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link href="/investments">
            <ArrowLeft /> Investments
          </Link>
        </Button>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
              {h.name} {h.symbol ? <span className="text-muted-foreground font-mono text-base">{h.symbol}</span> : null}
              <Badge variant="secondary">{labelOf(ASSET_CLASS_OPTS, h.assetClass)}</Badge>
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {h.platform || "No platform"} · Price {formatNumber(h.currentPrice)} ({st.label.toLowerCase()}, {h.priceSource === "demo" ? "sample data" : h.priceSource})
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setEdit(true)}>
              <Pencil /> Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPrice(true)}>
              <RefreshCw /> Update price
            </Button>
            <Button variant="outline" size="sm" onClick={() => setTxn("DIVIDEND")}>
              <Coins /> Dividend
            </Button>
            <Button variant="outline" size="sm" onClick={() => setTxn("INTEREST")}>
              <Percent /> Interest
            </Button>
            <Button variant="outline" size="sm" onClick={() => setTxn("SELL")} disabled={Number(h.units) <= 0}>
              <Minus /> Sell
            </Button>
            <Button size="sm" onClick={() => setTxn("BUY")}>
              <ShoppingCart /> Buy
            </Button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Units held" value={formatNumber(h.units)} />
        <StatCard label="Market value" value={<Money value={h.value} />} tone="primary" />
        <StatCard label="Cost basis" value={<Money value={h.cost} />} hint={Number(h.units) ? `Avg ${formatNumber(Number(h.cost) / Number(h.units))} per unit` : undefined} />
        <StatCard label="Unrealized P/L" value={<Money value={h.unrealized} tone="auto" sign />} hint={`${h.unrealizedPct.toFixed(2)}%`} />
        <StatCard label="Realized + income" value={<Money value={String(Number(h.realized) + Number(h.income))} tone="auto" sign />} hint={<>Sales <Money value={h.realized} /> · payouts <Money value={h.income} /></>} />
      </div>
      {prices.length > 1 ? (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Price history</CardTitle>
              <CardDescription>From your manual updates and trade prices</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <NetWorthChart data={prices.map((p) => ({ date: `${p.date}T00:00:00Z`, netWorth: p.price }))} height={220} />
          </CardContent>
        </Card>
      ) : null}
      <Card className="pb-0">
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        {txns.length === 0 ? (
          <CardContent className="pb-5">
            <EmptyState title="No transactions" description="Record a purchase to build your position." />
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Price</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="hidden text-right md:table-cell">Realized</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {txns.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{formatDay(t.date)}</TableCell>
                  <TableCell>
                    <Badge variant={TYPE_BADGE[t.type]}>{t.type.toLowerCase()}</Badge>
                    {t.note ? <p className="text-muted-foreground mt-0.5 text-xs">{t.note}</p> : null}
                  </TableCell>
                  <TableCell className="text-right tabular">{Number(t.units) ? formatNumber(t.units) : "—"}</TableCell>
                  <TableCell className="hidden text-right tabular sm:table-cell">{Number(t.price) ? formatNumber(t.price) : "—"}</TableCell>
                  <TableCell className="text-right">
                    <Money value={t.amount} />
                    {Number(t.fees) ? (
                      <div className="text-muted-foreground text-xs">
                        + fees <Money value={t.fees} />
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="hidden text-right md:table-cell">{t.realizedGain ? <Money value={t.realizedGain} tone="auto" sign /> : "—"}</TableCell>
                  <TableCell>
                    <RowActions onDelete={() => deleteInvestmentTxn(t.id)} deleteTitle="Delete this entry?" deleteDescription={`Units and cost basis will be recalculated${t.linked ? ", and its cash transaction removed" : ""}.`} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      {h.notes ? <p className="text-muted-foreground bg-muted rounded-lg px-4 py-3 text-sm whitespace-pre-wrap">{h.notes}</p> : null}
      <InvestmentDialog open={edit} onOpenChange={setEdit} options={options} initial={h} />
      {txn ? <InvestmentTxnDialog open onOpenChange={(o) => !o && setTxn(null)} options={options} investmentId={h.id} accountId={h.accountId} type={txn} /> : null}
      <PriceDialog open={price} onOpenChange={setPrice} investmentId={h.id} currentPrice={h.currentPrice} />
    </div>
  );
}

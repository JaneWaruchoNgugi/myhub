"use client";
import * as React from "react";
import Link from "next/link";
import { Coins, Eye, LineChart, Minus, Plus, RefreshCw, ShoppingCart, Star, TrendingUp, Wallet, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Money } from "@/components/shared/money";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { RowActions } from "@/components/shared/row-actions";
import { ListToolbar, Pagination, useListControls } from "@/components/shared/list-controls";
import { DonutChart, PortfolioChart } from "@/components/charts/charts";
import { InvestmentDialog, InvestmentTxnDialog, PriceDialog, WatchlistDialog } from "@/components/forms/obligations";
import { ASSET_CLASS_OPTS, labelOf, type FinanceOptions } from "@/components/forms/options";
import { deleteInvestment, deleteWatchlistItem } from "@/server/actions/investments";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export type HoldingRow = {
  id: string;
  name: string;
  symbol: string;
  assetClass: string;
  platform: string;
  accountId: string;
  notes: string;
  units: string;
  currentPrice: string;
  priceUpdatedAt: string | null;
  priceSource: string;
  value: string;
  cost: string;
  unrealized: string;
  unrealizedPct: number;
  realized: string;
  income: string;
};
type Watch = { id: string; symbol: string; name: string; assetClass: string; targetPrice: string; lastPrice: string; notes: string };

export function staleness(iso: string | null) {
  if (!iso) return { label: "No price yet", stale: true };
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return { label: days === 0 ? "Updated today" : `Updated ${days}d ago`, stale: days > 30 };
}

export function InvestmentsView({ rows, options, series, byClass, watchlist, totals }: { rows: HoldingRow[]; options: FinanceOptions; series: { month: string; value: string; cost: string }[]; byClass: { assetClass: string; value: number; cost: number; unrealized: number }[]; watchlist: Watch[]; totals: { value: string; cost: string; unrealized: string; realized: string; income: string } }) {
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<HoldingRow | null>(null);
  const [txn, setTxn] = React.useState<{ h: HoldingRow; type: "BUY" | "SELL" | "DIVIDEND" | "INTEREST" } | null>(null);
  const [price, setPrice] = React.useState<HoldingRow | null>(null);
  const [watchOpen, setWatchOpen] = React.useState(false);
  const [watchEdit, setWatchEdit] = React.useState<Watch | null>(null);
  const c = useListControls(rows, {
    search: (r, q) => r.name.toLowerCase().includes(q) || r.symbol.toLowerCase().includes(q) || r.platform.toLowerCase().includes(q),
    filters: [{ key: "class", label: "Asset classes", options: ASSET_CLASS_OPTS, test: (r, v) => r.assetClass === v }],
    sorts: [
      { key: "value", label: "Market value", compare: (a, b) => Number(b.value) - Number(a.value) },
      { key: "gain", label: "Return %", compare: (a, b) => b.unrealizedPct - a.unrealizedPct },
      { key: "name", label: "Name", compare: (a, b) => a.name.localeCompare(b.name) },
    ],
  });
  const totalPct = Number(totals.cost) ? (Number(totals.unrealized) / Number(totals.cost)) * 100 : 0;

  return (
    <Tabs defaultValue="portfolio">
      <TabsList>
        <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
        <TabsTrigger value="watchlist">
          <Star className="size-3.5" /> Watchlist ({watchlist.length})
        </TabsTrigger>
      </TabsList>
      <TabsContent value="portfolio" className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatCard label="Market value" value={<Money value={totals.value} />} icon={<Wallet />} tone="primary" />
          <StatCard label="Amount invested" value={<Money value={totals.cost} />} icon={<Coins />} hint="Cost basis of current holdings" />
          <StatCard label="Unrealized P/L" value={<Money value={totals.unrealized} tone="auto" sign />} icon={<TrendingUp />} tone={Number(totals.unrealized) >= 0 ? "positive" : "negative"} hint={`${totalPct.toFixed(2)}% on cost`} />
          <StatCard label="Realized P/L" value={<Money value={totals.realized} tone="auto" sign />} icon={<LineChart />} hint="From sales (average cost)" />
          <StatCard label="Dividends & interest" value={<Money value={totals.income} />} icon={<Percent />} tone="positive" />
        </div>
        {rows.length ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
            <Card className="xl:col-span-3">
              <CardHeader>
                <div>
                  <CardTitle>Performance over time</CardTitle>
                  <CardDescription>Month-end value from your recorded prices vs amount invested</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <PortfolioChart data={series} />
              </CardContent>
            </Card>
            <Card className="xl:col-span-2">
              <CardHeader>
                <div>
                  <CardTitle>Allocation</CardTitle>
                  <CardDescription>By asset class</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <DonutChart data={byClass.filter((b) => b.value > 0).map((b) => ({ name: labelOf(ASSET_CLASS_OPTS, b.assetClass), value: b.value }))} />
              </CardContent>
            </Card>
          </div>
        ) : null}
        {byClass.length > 1 ? (
          <Card className="pb-0">
            <CardHeader>
              <CardTitle>Asset class comparison</CardTitle>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset class</TableHead>
                  <TableHead className="text-right">Invested</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Return</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byClass.map((b) => (
                  <TableRow key={b.assetClass}>
                    <TableCell className="font-medium">{labelOf(ASSET_CLASS_OPTS, b.assetClass)}</TableCell>
                    <TableCell className="text-right">
                      <Money value={b.cost} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={b.value} />
                    </TableCell>
                    <TableCell className={cn("text-right", b.unrealized >= 0 ? "text-emerald-600" : "text-red-600")}>{b.cost ? ((b.unrealized / b.cost) * 100).toFixed(2) : "0.00"}%</TableCell>
                    <TableCell className="text-right">{Number(totals.value) ? ((b.value / Number(totals.value)) * 100).toFixed(1) : 0}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : null}

        <ListToolbar controls={c} placeholder="Search holdings">
          <Button onClick={() => setAdding(true)}>
            <Plus /> Add investment
          </Button>
        </ListToolbar>
        {rows.length === 0 ? (
          <EmptyState icon={<TrendingUp />} title="No investments yet" description="Add stocks, ETFs, money market funds, T-bills, bonds or crypto. Record buys and sales, and update prices when you check them." action={<Button onClick={() => setAdding(true)}><Plus /> Add investment</Button>} />
        ) : (
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Holding</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Units</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Price</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Cost</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">P/L</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {c.pageItems.map((h) => {
                  const st = staleness(h.priceUpdatedAt);
                  return (
                    <TableRow key={h.id}>
                      <TableCell className="whitespace-normal">
                        <Link href={`/investments/${h.id}`} className="font-medium hover:underline">
                          {h.name}
                        </Link>
                        <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
                          {h.symbol ? <span className="font-mono">{h.symbol}</span> : null}
                          <Badge variant="secondary">{labelOf(ASSET_CLASS_OPTS, h.assetClass)}</Badge>
                          {h.platform ? <span>{h.platform}</span> : null}
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-right tabular md:table-cell">{formatNumber(h.units)}</TableCell>
                      <TableCell className="hidden text-right lg:table-cell">
                        <div className="tabular">{formatNumber(h.currentPrice)}</div>
                        <div className={cn("text-xs", st.stale ? "text-amber-600" : "text-muted-foreground")}>{st.label}</div>
                      </TableCell>
                      <TableCell className="hidden text-right sm:table-cell">
                        <Money value={h.cost} />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        <Money value={h.value} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={h.unrealized} tone="auto" sign />
                        <div className={cn("text-xs", h.unrealizedPct >= 0 ? "text-emerald-600" : "text-red-600")}>{h.unrealizedPct.toFixed(2)}%</div>
                      </TableCell>
                      <TableCell>
                        <RowActions
                          onEdit={() => setEditing(h)}
                          extra={[
                            { label: "Update price", icon: <RefreshCw />, onSelect: () => setPrice(h) },
                            { label: "Record purchase", icon: <ShoppingCart />, onSelect: () => setTxn({ h, type: "BUY" }) },
                            { label: "Record sale", icon: <Minus />, onSelect: () => setTxn({ h, type: "SELL" }), disabled: Number(h.units) <= 0 },
                            { label: "Record dividend", icon: <Coins />, onSelect: () => setTxn({ h, type: "DIVIDEND" }) },
                            { label: "Record interest", icon: <Percent />, onSelect: () => setTxn({ h, type: "INTEREST" }) },
                            { label: "View details", icon: <Eye />, onSelect: () => (window.location.href = `/investments/${h.id}`) },
                          ]}
                          onDelete={() => deleteInvestment(h.id)}
                          deleteTitle={`Delete ${h.name}?`}
                          deleteDescription="The holding, its history and the cash movements it recorded will be removed. Use this for entries made by mistake."
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
        <Pagination page={c.page} pageCount={c.pageCount} total={c.total} onPage={c.setPage} />
        <p className="text-muted-foreground text-xs">Live market data isn&apos;t connected. The architecture supports a price provider later (see README: Market data).</p>
      </TabsContent>

      <TabsContent value="watchlist">
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setWatchOpen(true)}>
            <Plus /> Add to watchlist
          </Button>
        </div>
        {watchlist.length === 0 ? (
          <EmptyState icon={<Star />} title="Your watchlist is empty" description="Keep an eye on stocks or funds you're considering, with your own target buy price." />
        ) : (
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Class</TableHead>
                  <TableHead className="text-right">Last seen</TableHead>
                  <TableHead className="text-right">Target</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {watchlist.map((w) => {
                  const hit = w.lastPrice && w.targetPrice && Number(w.lastPrice) <= Number(w.targetPrice);
                  return (
                    <TableRow key={w.id}>
                      <TableCell className="font-mono font-medium">{w.symbol}</TableCell>
                      <TableCell>
                        {w.name}
                        {w.notes ? <p className="text-muted-foreground line-clamp-1 text-xs">{w.notes}</p> : null}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{labelOf(ASSET_CLASS_OPTS, w.assetClass)}</TableCell>
                      <TableCell className="text-right tabular">{w.lastPrice ? formatNumber(w.lastPrice) : "—"}</TableCell>
                      <TableCell className="text-right tabular">
                        {w.targetPrice ? formatNumber(w.targetPrice) : "—"} {hit ? <Badge variant="success" className="ml-1">At target</Badge> : null}
                      </TableCell>
                      <TableCell>
                        <RowActions onEdit={() => setWatchEdit(w)} onDelete={() => deleteWatchlistItem(w.id)} deleteTitle={`Remove ${w.symbol}?`} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </TabsContent>

      <InvestmentDialog open={adding} onOpenChange={setAdding} options={options} />
      <InvestmentDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} options={options} initial={editing ?? undefined} />
      {txn ? <InvestmentTxnDialog open onOpenChange={(o) => !o && setTxn(null)} options={options} investmentId={txn.h.id} accountId={txn.h.accountId} type={txn.type} /> : null}
      {price ? <PriceDialog open onOpenChange={(o) => !o && setPrice(null)} investmentId={price.id} currentPrice={price.currentPrice} /> : null}
      <WatchlistDialog open={watchOpen} onOpenChange={setWatchOpen} />
      <WatchlistDialog open={!!watchEdit} onOpenChange={(o) => !o && setWatchEdit(null)} initial={watchEdit ?? undefined} />
    </Tabs>
  );
}

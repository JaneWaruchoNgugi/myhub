"use client";
import * as React from "react";
import { Camera, Info, Plus, Scale, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Money } from "@/components/shared/money";
import { StatCard } from "@/components/shared/stat-card";
import { RowActions } from "@/components/shared/row-actions";
import { useRun } from "@/components/shared/use-run";
import { NetWorthChart, DonutChart } from "@/components/charts/charts";
import { AssetDialog, LiabilityDialog } from "@/components/forms/finance";
import { ASSET_TYPE_OPTS, LIABILITY_TYPE_OPTS, labelOf } from "@/components/forms/options";
import { deleteAsset, deleteLiability, takeSnapshot } from "@/server/actions/networth";
import { formatDay } from "@/lib/format";

type A = { id: string; name: string; type: string; value: string; valuedAt: string; notes: string };
type L = { id: string; name: string; type: string; balance: string; asOf: string; notes: string };

export function NetWorthView({ totals, breakdown, history, assets, liabilities }: { totals: { assets: string; liabilities: string; netWorth: string }; breakdown: { assets: Record<string, string>; liabilities: Record<string, string> }; history: { date: string; netWorth: string; assets: string; liabilities: string; change: string | null }[]; assets: A[]; liabilities: L[] }) {
  const [assetOpen, setAssetOpen] = React.useState(false);
  const [assetEdit, setAssetEdit] = React.useState<A | null>(null);
  const [liabOpen, setLiabOpen] = React.useState(false);
  const [liabEdit, setLiabEdit] = React.useState<L | null>(null);
  const { run, pending } = useRun();
  const last = history.at(-1);
  const prev = history.at(-2);
  const change = last && prev ? Number(last.netWorth) - Number(prev.netWorth) : 0;
  const assetData = Object.entries(breakdown.assets).filter(([, v]) => Number(v) > 0).map(([name, v]) => ({ name, value: Number(v) })).sort((a, b) => b.value - a.value);
  const liabData = Object.entries(breakdown.liabilities).filter(([, v]) => Number(v) > 0).map(([name, v]) => ({ name, value: Number(v) })).sort((a, b) => b.value - a.value);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Net worth" value={<Money value={totals.netWorth} />} icon={<Scale />} tone="primary" hint={prev ? <><Money value={change} tone="auto" sign /> vs last month</> : undefined} />
        <StatCard label="Total assets" value={<Money value={totals.assets} />} icon={<TrendingUp />} tone="positive" />
        <StatCard label="Total liabilities" value={<Money value={totals.liabilities} />} icon={<TrendingDown />} tone="negative" />
      </div>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>History</CardTitle>
            <CardDescription>One snapshot per month, updated automatically</CardDescription>
          </div>
          <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => takeSnapshot())}>
            <Camera /> Refresh snapshot
          </Button>
        </CardHeader>
        <CardContent>{history.length > 1 ? <NetWorthChart data={history} /> : <p className="text-muted-foreground py-10 text-center text-sm">The chart appears once there are two monthly snapshots.</p>}</CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Assets breakdown</CardTitle>
          </CardHeader>
          <CardContent>{assetData.length ? <DonutChart data={assetData} /> : <p className="text-muted-foreground text-sm">No assets yet.</p>}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Liabilities breakdown</CardTitle>
          </CardHeader>
          <CardContent>{liabData.length ? <DonutChart data={liabData.map((d, i) => ({ ...d, color: ["#ef4444", "#f97316", "#f59e0b", "#e11d48", "#b91c1c"][i % 5] }))} /> : <p className="text-muted-foreground text-sm">Debt-free. Nice.</p>}</CardContent>
        </Card>
      </div>
      <div className="flex items-start gap-2 rounded-xl border bg-sky-500/5 p-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-sky-600" />
        <p className="text-muted-foreground">
          Account balances, investments (at your latest recorded prices), money you lent and loans you borrowed are pulled in automatically. Savings goals aren&apos;t added on top because that money already sits in an account. Add only things not tracked elsewhere below.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="pb-0">
          <CardHeader>
            <div>
              <CardTitle>Other assets</CardTitle>
              <CardDescription>Property, vehicles, equipment</CardDescription>
            </div>
            <Button size="sm" onClick={() => setAssetOpen(true)}>
              <Plus /> Add asset
            </Button>
          </CardHeader>
          {assets.length ? (
            <Table>
              <TableBody>
                {assets.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-normal">
                      <div className="font-medium">{a.name}</div>
                      <div className="text-muted-foreground text-xs">
                        {labelOf(ASSET_TYPE_OPTS, a.type)} · valued {formatDay(a.valuedAt)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <Money value={a.value} />
                    </TableCell>
                    <TableCell className="w-10">
                      <RowActions onEdit={() => setAssetEdit(a)} onDelete={() => deleteAsset(a.id)} deleteTitle={`Delete ${a.name}?`} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <CardContent className="text-muted-foreground pb-5 text-sm">No manual assets yet.</CardContent>
          )}
        </Card>
        <Card className="pb-0">
          <CardHeader>
            <div>
              <CardTitle>Other liabilities</CardTitle>
              <CardDescription>Credit cards, tax owed</CardDescription>
            </div>
            <Button size="sm" onClick={() => setLiabOpen(true)}>
              <Plus /> Add liability
            </Button>
          </CardHeader>
          {liabilities.length ? (
            <Table>
              <TableBody>
                {liabilities.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-normal">
                      <div className="font-medium">{l.name}</div>
                      <div className="text-muted-foreground text-xs">
                        {labelOf(LIABILITY_TYPE_OPTS, l.type)} · as of {formatDay(l.asOf)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <Money value={l.balance} />
                    </TableCell>
                    <TableCell className="w-10">
                      <RowActions onEdit={() => setLiabEdit(l)} onDelete={() => deleteLiability(l.id)} deleteTitle={`Delete ${l.name}?`} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <CardContent className="text-muted-foreground pb-5 text-sm">No manual liabilities.</CardContent>
          )}
        </Card>
      </div>
      {history.length ? (
        <Card className="pb-0">
          <CardHeader>
            <CardTitle>Monthly changes</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Assets</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Liabilities</TableHead>
                <TableHead className="text-right">Net worth</TableHead>
                <TableHead className="text-right">Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...history].reverse().map((h) => (
                <TableRow key={h.date}>
                  <TableCell>{new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(h.date))}</TableCell>
                  <TableCell className="hidden text-right sm:table-cell">
                    <Money value={h.assets} />
                  </TableCell>
                  <TableCell className="hidden text-right sm:table-cell">
                    <Money value={h.liabilities} />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <Money value={h.netWorth} />
                  </TableCell>
                  <TableCell className="text-right">{h.change !== null ? <Money value={h.change} tone="auto" sign /> : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : null}
      <AssetDialog open={assetOpen} onOpenChange={setAssetOpen} />
      <AssetDialog open={!!assetEdit} onOpenChange={(o) => !o && setAssetEdit(null)} initial={assetEdit ?? undefined} />
      <LiabilityDialog open={liabOpen} onOpenChange={setLiabOpen} />
      <LiabilityDialog open={!!liabEdit} onOpenChange={(o) => !o && setLiabEdit(null)} initial={liabEdit ?? undefined} />
    </div>
  );
}

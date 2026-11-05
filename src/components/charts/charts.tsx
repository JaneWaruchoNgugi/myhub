"use client";
import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usePrefs } from "@/components/providers";
import { formatMoney } from "@/lib/format";

export const PALETTE = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#0ea5e9",
  "#a855f7",
  "#14b8a6",
  "#f97316",
  "#ec4899",
  "#64748b",
];

function useFmt() {
  const prefs = usePrefs();
  return {
    full: (v: number | string) => formatMoney(v, prefs),
    compact: (v: number | string) => formatMoney(v, prefs, { compact: true }),
  };
}

const monthTick = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return (
    new Intl.DateTimeFormat("en-GB", {
      month: "short",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(y, mo - 1, 1))) +
    (mo === 1 ? ` ${String(y).slice(2)}` : "")
  );
};

function ChartTooltip({
  active,
  payload,
  label,
  fmt,
  labelFmt,
}: {
  active?: boolean;
  payload?: {
    name?: string;
    value?: number;
    color?: string;
    payload?: { fill?: string };
  }[];
  label?: string;
  fmt: (v: number) => string;
  labelFmt?: (l: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover rounded-lg border px-3 py-2 text-xs shadow-md">
      {label ? (
        <div className="mb-1 font-medium">
          {labelFmt ? labelFmt(label) : label}
        </div>
      ) : null}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="size-2 rounded-full"
            style={{ background: p.color ?? p.payload?.fill }}
          />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto pl-3 font-medium tabular">
            {fmt(Number(p.value ?? 0))}
          </span>
        </div>
      ))}
    </div>
  );
}

const axisProps = {
  stroke: "currentColor",
  className: "text-muted-foreground",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

export function IncomeExpenseChart({
  data,
  height = 260,
}: {
  data: { month: string; income: string; expense: string }[];
  height?: number;
}) {
  const f = useFmt();
  const rows = data.map((d) => ({
    month: d.month,
    Income: Number(d.income),
    Expenses: Number(d.expense),
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} barGap={4} margin={{ left: 4, right: 4, top: 8 }}>
        <CartesianGrid
          vertical={false}
          strokeDasharray="3 3"
          className="stroke-border"
        />
        <XAxis dataKey="month" tickFormatter={monthTick} {...axisProps} />
        <YAxis tickFormatter={(v) => f.compact(v)} width={64} {...axisProps} />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.6 }}
          content={<ChartTooltip fmt={f.full} labelFmt={monthTick} />}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12 }}
        />
        <Bar
          dataKey="Income"
          fill="#10b981"
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        />
        <Bar
          dataKey="Expenses"
          fill="#6366f1"
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({
  data,
  height = 220,
}: {
  data: { name: string; value: number; color?: string }[];
  height?: number;
}) {
  const f = useFmt();
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <div className="@container">
      <div className="flex flex-col items-center gap-5 @md:flex-row">
        <div
          className="relative w-full max-w-[220px] shrink-0"
          style={{ height }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                animationDuration={500}
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius="62%"
                outerRadius="92%"
                paddingAngle={2}
                stroke="none"
              >
                {data.map((d, i) => (
                  <Cell key={i} fill={d.color ?? PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip fmt={f.full} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-muted-foreground text-[11px]">Total</span>
            <span className="text-sm font-semibold tabular">
              {f.compact(total)}
            </span>
          </div>
        </div>
        <ul className="flex w-full min-w-0 flex-col gap-1.5 text-sm">
          {data.slice(0, 7).map((d, i) => (
            <li key={d.name} className="flex items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-sm"
                style={{ background: d.color ?? PALETTE[i % PALETTE.length] }}
              />
              <span className="min-w-0 flex-1 truncate">{d.name}</span>
              <span className="text-muted-foreground w-9 text-right text-xs tabular">
                {total ? Math.round((d.value / total) * 100) : 0}%
              </span>
              <span className="w-20 text-right text-xs font-medium tabular">
                {f.compact(d.value)}
              </span>
            </li>
          ))}
          {data.length > 7 ? (
            <li className="text-muted-foreground text-xs">
              +{data.length - 7} more
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

export function NetWorthChart({
  data,
  height = 260,
}: {
  data: {
    date: string;
    netWorth: string;
    assets?: string;
    liabilities?: string;
  }[];
  height?: number;
}) {
  const f = useFmt();
  const rows = data.map((d) => ({
    month: d.date.slice(0, 7),
    "Net worth": Number(d.netWorth),
    Assets: Number(d.assets ?? 0),
    Liabilities: Number(d.liabilities ?? 0),
  }));
  const showAll = data.some((d) => d.assets !== undefined);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={rows} margin={{ left: 4, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="nwFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          vertical={false}
          strokeDasharray="3 3"
          className="stroke-border"
        />
        <XAxis dataKey="month" tickFormatter={monthTick} {...axisProps} />
        <YAxis tickFormatter={(v) => f.compact(v)} width={64} {...axisProps} />
        <Tooltip content={<ChartTooltip fmt={f.full} labelFmt={monthTick} />} />
        {showAll ? (
          <Area
            type="monotone"
            dataKey="Assets"
            stroke="#10b981"
            fill="none"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
        ) : null}
        {showAll ? (
          <Area
            type="monotone"
            dataKey="Liabilities"
            stroke="#ef4444"
            fill="none"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
        ) : null}
        <Area
          animationDuration={500}
          type="monotone"
          dataKey="Net worth"
          stroke="#6366f1"
          strokeWidth={2.5}
          fill="url(#nwFill)"
        />
        {showAll ? (
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12 }}
          />
        ) : null}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function PortfolioChart({
  data,
  height = 260,
}: {
  data: { month: string; value: string; cost: string }[];
  height?: number;
}) {
  const f = useFmt();
  const rows = data.map((d) => ({
    month: d.month,
    "Market value": Number(d.value),
    "Amount invested": Number(d.cost),
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ left: 4, right: 8, top: 8 }}>
        <CartesianGrid
          vertical={false}
          strokeDasharray="3 3"
          className="stroke-border"
        />
        <XAxis dataKey="month" tickFormatter={monthTick} {...axisProps} />
        <YAxis tickFormatter={(v) => f.compact(v)} width={64} {...axisProps} />
        <Tooltip content={<ChartTooltip fmt={f.full} labelFmt={monthTick} />} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12 }}
        />
        <Line
          type="monotone"
          dataKey="Market value"
          stroke="#6366f1"
          strokeWidth={2.5}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="Amount invested"
          stroke="#94a3b8"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function HBarChart({
  data,
  height,
  valueLabel = "Value",
}: {
  data: { name: string; value: number; value2?: number; color?: string }[];
  height?: number;
  valueLabel?: string;
}) {
  const f = useFmt();
  const h = height ?? Math.max(160, data.length * 38);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid
          horizontal={false}
          strokeDasharray="3 3"
          className="stroke-border"
        />
        <XAxis
          type="number"
          tickFormatter={(v) => f.compact(v)}
          {...axisProps}
        />
        <YAxis type="category" dataKey="name" width={110} {...axisProps} />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.6 }}
          content={<ChartTooltip fmt={f.full} />}
        />
        <Bar
          dataKey="value"
          name={valueLabel}
          radius={[0, 4, 4, 0]}
          maxBarSize={22}
        >
          {data.map((d, i) => (
            <Cell key={i} fill={d.color ?? PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GroupedBarChart({
  data,
  keys,
  height = 260,
}: {
  data: Record<string, string | number>[];
  keys: { key: string; color: string }[];
  height?: number;
}) {
  const f = useFmt();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
        <CartesianGrid
          vertical={false}
          strokeDasharray="3 3"
          className="stroke-border"
        />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis tickFormatter={(v) => f.compact(v)} width={64} {...axisProps} />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.6 }}
          content={<ChartTooltip fmt={f.full} />}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12 }}
        />
        {keys.map((k) => (
          <Bar
            key={k.key}
            dataKey={k.key}
            fill={k.color}
            radius={[4, 4, 0, 0]}
            maxBarSize={26}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

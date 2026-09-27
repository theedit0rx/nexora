"use client";

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
import { compactMoney, num, percent } from "@/lib/utils";

type ChartValue = number | string | readonly (string | number)[] | undefined;

const AXIS = { stroke: "rgba(148,163,184,0.35)", fontSize: 10.5 } as const;
const TOOLTIP_STYLE = {
  background: "#0d1117",
  border: "1px solid #1c2536",
  borderRadius: 10,
  fontSize: 11.5,
  color: "#e6edf7",
  boxShadow: "0 20px 50px -24px rgba(0,0,0,0.9)",
} as const;

/* ------------------------------------------------------------------ funnel */

export function FunnelChart({ data }: { data: Array<{ stage: string; count: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="space-y-1.5">
      {data.map((d, i) => {
        const width = Math.max(3, (d.count / max) * 100);
        const prev = i > 0 ? data[i - 1]!.count : d.count;
        const conv = prev > 0 ? d.count / prev : null;
        return (
          <div key={d.stage} className="group">
            <div className="flex items-center justify-between gap-3 text-[11px]">
              <span className="truncate text-ink-muted">{d.stage}</span>
              <span className="flex shrink-0 items-center gap-2">
                {conv !== null && i > 0 && (
                  <span className="tnum text-[10px] text-ink-faint">{(conv * 100).toFixed(0)}%</span>
                )}
                <span className="tnum font-semibold text-ink">{num(d.count)}</span>
              </span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-600 to-accent-500 transition-[width] duration-700"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------- mini area */

export function MiniAreaChart({
  data,
  height = 56,
}: {
  data: Array<{ label: string; value: number }>;
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="nexoraMini" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" hide />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v: ChartValue) => compactMoney(Number(v ?? 0))}
            labelStyle={{ color: "#94a3b8" }}
          />
          <Area type="monotone" dataKey="value" stroke="#818cf8" strokeWidth={2} fill="url(#nexoraMini)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* --------------------------------------------------------------- revenue */

export function RevenueChart({
  data,
  currency = "INR",
}: {
  data: Array<{ month: string; revenue: number; count: number }>;
  currency?: string;
}) {
  const formatted = data.map((d) => ({
    ...d,
    label: d.month.slice(2),
  }));
  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formatted} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="nexoraRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} {...AXIS} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v: number) => compactMoney(v, currency)}
            {...AXIS}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v: ChartValue) => compactMoney(Number(v ?? 0), currency)}
            labelFormatter={(l) => `Month ${l}`}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke="#34d399"
            strokeWidth={2}
            fill="url(#nexoraRevenue)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* --------------------------------------------------------------- bars */

export type ValueFormat = "count" | "money" | "percent";

export function BarsChart({
  data,
  dataKey = "value",
  nameKey = "label",
  color = "#6366f1",
  height = 220,
  format = "count",
  currency = "INR",
}: {
  data: Array<Record<string, unknown>>;
  dataKey?: string;
  nameKey?: string;
  color?: string;
  height?: number;
  /** Serialisable value formatter — a function prop cannot cross the server boundary. */
  format?: ValueFormat;
  currency?: string;
}) {
  const formatValue = (v: number) =>
    format === "money" ? compactMoney(v, currency) : format === "percent" ? percent(v) : num(v);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={nameKey} tickLine={false} axisLine={false} interval={0} {...AXIS} />
          <YAxis tickLine={false} axisLine={false} width={40} tickFormatter={(v: number) => num(v)} {...AXIS} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: ChartValue) => formatValue(Number(v ?? 0))} />
          <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} maxBarSize={38} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* --------------------------------------------------------------- stacked */

export function StackedBarsChart({
  data,
  keys,
  height = 220,
}: {
  data: Array<Record<string, unknown>>;
  keys: Array<{ key: string; color: string; label: string }>;
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} {...AXIS} />
          <YAxis tickLine={false} axisLine={false} width={40} {...AXIS} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
          {keys.map((k) => (
            <Bar key={k.key} dataKey={k.key} name={k.label} stackId="a" fill={k.color} maxBarSize={38} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* --------------------------------------------------------------- lines */

export function LinesChart({
  data,
  lines,
  height = 220,
}: {
  data: Array<Record<string, unknown>>;
  lines: Array<{ key: string; color: string; label: string }>;
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} {...AXIS} />
          <YAxis tickLine={false} axisLine={false} width={40} {...AXIS} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
          {lines.map((l) => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              name={l.label}
              stroke={l.color}
              strokeWidth={2}
              dot={{ r: 2.5, fill: l.color }}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* --------------------------------------------------------------- donut */

export function DonutChart({
  data,
  height = 200,
}: {
  data: Array<{ label: string; value: number; color: string }>;
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: ChartValue) => num(Number(v ?? 0))} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius="55%"
            outerRadius="82%"
            paddingAngle={2}
            stroke="none"
          >
            {data.map((d) => (
              <Cell key={d.label} fill={d.color} />
            ))}
          </Pie>
          <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/* --------------------------------------------------------------- horizontal */

export function HorizontalBars({
  data,
  color = "#6366f1",
}: {
  data: Array<{ label: string; value: number; note?: string }>;
  color?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.label}>
          <div className="flex items-center justify-between gap-3 text-[11.5px]">
            <span className="truncate text-ink-muted">{d.label}</span>
            <span className="tnum shrink-0 font-semibold text-ink">{num(d.value)}</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{ width: `${Math.max(2, (d.value / max) * 100)}%`, background: color }}
            />
          </div>
          {d.note && <p className="mt-0.5 text-[10.5px] text-ink-faint">{d.note}</p>}
        </div>
      ))}
    </div>
  );
}

export { Cell };

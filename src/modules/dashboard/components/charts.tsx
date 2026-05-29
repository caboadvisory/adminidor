"use client";

import { useLocale } from "next-intl";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TopProject, WeeklyHours } from "@/modules/dashboard/types";

const PRIMARY = "#7797ae";
const GRID = "#e4ded1";
const AXIS = "#5a6b75";

const tooltipStyle = {
  backgroundColor: "#ffffff",
  border: `1px solid ${GRID}`,
  borderRadius: 8,
  fontSize: 12,
  color: "#2b3a44",
} as const;

export function WeeklyHoursChart({ data }: { data: WeeklyHours[] }) {
  const locale = useLocale();
  const fmt = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
  const rows = data.map((d) => ({
    label: fmt.format(new Date(`${d.weekStart}T00:00:00`)),
    hours: d.hours,
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fill: AXIS, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: GRID }}
          />
          <YAxis
            tick={{ fill: AXIS, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: "rgba(119,151,174,0.08)" }}
            formatter={(value) => [`${value} h`, ""]}
          />
          <Bar dataKey="hours" fill={PRIMARY} radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TopProjectsChart({
  data,
  locale,
}: {
  data: TopProject[];
  locale: string;
}) {
  const numFmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const rows = data.map((d) => ({
    name: d.projectName ?? "—",
    amount: d.amount,
    currency: d.currency ?? "",
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: 12, left: 8, bottom: 4 }}
        >
          <XAxis
            type="number"
            tick={{ fill: AXIS, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            tickFormatter={(v: number) => numFmt.format(v)}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: AXIS, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={120}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: "rgba(119,151,174,0.08)" }}
            formatter={(value, _name, item) => {
              const currency =
                (item as { payload?: { currency?: string } } | undefined)
                  ?.payload?.currency ?? "";
              return [
                `${numFmt.format(Number(value))}${currency ? ` ${currency}` : ""}`,
                "",
              ];
            }}
          />
          <Bar dataKey="amount" fill={PRIMARY} radius={[0, 4, 4, 0]} maxBarSize={28}>
            {rows.map((_, i) => (
              <Cell key={i} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

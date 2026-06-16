"use client";

import { Card, CardHeader, CardTitle, CardContent } from "./card";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { colors } from "../tokens";

const CHART_COLORS = [colors.blue600, colors.gold, colors.success, colors.warning, "#8B5CF6", "#EC4899"];

export interface ChartCardProps {
  title: string;
  type: "line" | "bar" | "pie";
  data: Record<string, unknown>[];
  dataKey?: string;
  xKey?: string;
  height?: number;
}

export function ChartCard({ title, type, data, dataKey = "value", xKey = "name", height = 300 }: ChartCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-section-title">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          {type === "line" ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
              <XAxis dataKey={xKey} tick={{ fontSize: 12, fill: colors.muted }} />
              <YAxis tick={{ fontSize: 12, fill: colors.muted }} />
              <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${colors.border}` }} />
              <Line type="monotone" dataKey={dataKey} stroke={colors.blue600} strokeWidth={2} dot={{ fill: colors.blue600 }} />
            </LineChart>
          ) : type === "bar" ? (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
              <XAxis dataKey={xKey} tick={{ fontSize: 12, fill: colors.muted }} />
              <YAxis tick={{ fontSize: 12, fill: colors.muted }} />
              <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${colors.border}` }} />
              <Bar dataKey={dataKey} fill={colors.blue600} radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <PieChart>
              <Pie
                data={data}
                dataKey={dataKey}
                nameKey={xKey}
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, border: `1px solid ${colors.border}` }} />
              <Legend />
            </PieChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

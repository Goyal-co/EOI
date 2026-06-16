"use client";

import { cn, formatPercent } from "../lib/utils";
import { Card } from "./card";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";

export interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  growth?: number;
  sparklineData?: number[];
  onClick?: () => void;
  className?: string;
}

export function StatCard({ title, value, icon: Icon, growth, sparklineData, onClick, className }: StatCardProps) {
  const isPositive = growth !== undefined && growth >= 0;

  return (
    <Card
      className={cn(
        "p-5 cursor-default hover:shadow-card",
        onClick && "cursor-pointer transition-shadow hover:shadow-card-hover",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 border border-blue-100">
          <Icon className="h-5 w-5 text-blue-600" />
        </div>
        {growth !== undefined && (
          <div className={cn("flex items-center gap-1 text-xs font-medium", isPositive ? "text-success" : "text-error")}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {formatPercent(growth)}
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-semibold text-foreground tracking-tight">{value}</p>
        <p className="text-caption mt-0.5">{title}</p>
      </div>
      {sparklineData && sparklineData.length > 0 && (
        <div className="mt-3 flex items-end gap-0.5 h-8">
          {sparklineData.map((val, i) => {
            const max = Math.max(...sparklineData);
            const height = max > 0 ? (val / max) * 100 : 0;
            return (
              <div
                key={i}
                className="flex-1 rounded-sm bg-blue-600/20 hover:bg-blue-600/40 transition-colors"
                style={{ height: `${Math.max(height, 8)}%` }}
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}

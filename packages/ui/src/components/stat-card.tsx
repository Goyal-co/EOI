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
        "cursor-default p-3.5 hover:shadow-card sm:p-5",
        onClick && "cursor-pointer transition-shadow hover:shadow-card-hover active:scale-[0.99]",
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 sm:h-10 sm:w-10">
          <Icon className="h-4 w-4 text-blue-600 sm:h-5 sm:w-5" />
        </div>
        {growth !== undefined && (
          <div className={cn("flex items-center gap-1 text-[10px] font-medium sm:text-xs", isPositive ? "text-success" : "text-error")}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {formatPercent(growth)}
          </div>
        )}
      </div>
      <div className="mt-2.5 sm:mt-3">
        <p className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{value}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground sm:text-sm">{title}</p>
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

"use client";

import { Card } from "./card";
import { Button } from "./button";
import { StatusBadge } from "./status-badge";
import { cn, formatCurrency } from "../lib/utils";
import { MapPin, Users, FileText, TrendingUp } from "lucide-react";

export interface ProjectCardProps {
  name: string;
  location: string;
  imageUrl?: string;
  startingPrice?: number;
  eoiStatus: string;
  tags?: string[];
  totalLeads?: number;
  totalEois?: number;
  leadOnlyCount?: number;
  eoiLeadCount?: number;
  totalClosures?: number;
  conversionRate?: number;
  onViewDetails?: () => void;
  /** @deprecated Brochures removed from cards — kept for call-site compatibility */
  onViewBrochure?: () => void;
  onSubmitEOI?: () => void;
  onPunchLead?: () => void;
  className?: string;
}

export function ProjectCard({
  name,
  location,
  imageUrl,
  startingPrice,
  eoiStatus,
  tags = [],
  totalLeads,
  totalEois,
  leadOnlyCount,
  eoiLeadCount,
  conversionRate,
  onViewDetails,
  onSubmitEOI,
  onPunchLead,
  className,
}: ProjectCardProps) {
  const visibleTags = tags.filter((tag) => tag.trim().length > 0);

  return (
    <Card
      className={cn(
        "overflow-hidden group",
        onViewDetails && "cursor-pointer",
        className,
      )}
      onClick={onViewDetails}
    >
      <div className="relative h-40 bg-gradient-to-br from-blue-100 to-blue-200 overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl font-bold text-blue-600/20">
            {name.charAt(0)}
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-foreground min-w-0">{name}</h3>
          <div className="shrink-0">
            <StatusBadge status={eoiStatus === "OPEN" ? "OPEN" : "CLOSED_PROJECT"} />
          </div>
        </div>
        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
          <MapPin className="h-3.5 w-3.5" />
          {location}
        </div>
        {startingPrice ? (
          <p className="text-sm font-medium text-gold mt-2">
            {formatCurrency(startingPrice)} / sqft
          </p>
        ) : null}
        {visibleTags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {visibleTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-md border border-gold/30 bg-gold-light/60 px-2 py-0.5 text-[11px] font-medium text-navy"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
        {(totalLeads !== undefined || totalEois !== undefined) && (
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            {totalLeads !== undefined && (
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{totalLeads} Leads</span>
            )}
            {totalEois !== undefined && (
              <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{totalEois} EOIs</span>
            )}
            {leadOnlyCount !== undefined && leadOnlyCount > 0 && (
              <span className="flex items-center gap-1">{leadOnlyCount} Lead</span>
            )}
            {eoiLeadCount !== undefined && eoiLeadCount > 0 && (
              <span className="flex items-center gap-1">{eoiLeadCount} EOI leads</span>
            )}
            {conversionRate !== undefined && (
              <span className="flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" />{conversionRate}%</span>
            )}
          </div>
        )}
        <div className="flex gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
          {onViewDetails && (
            <Button variant="outline" size="sm" className="flex-1" onClick={onViewDetails}>View Details</Button>
          )}
          {onSubmitEOI && eoiStatus === "OPEN" && (
            <Button variant="gold" size="sm" className="flex-1" onClick={onSubmitEOI}>Submit EOI</Button>
          )}
          {onPunchLead && eoiStatus !== "OPEN" && (
            <Button variant="gold" size="sm" className="flex-1" onClick={onPunchLead}>Punch Lead</Button>
          )}
        </div>
      </div>
    </Card>
  );
}

"use client";

import React from "react";
import { ChevronDown, ArrowUpRight } from "lucide-react";
import { GlassPanel } from "@/components/ui";

export interface WeeklyTrendCardProps {
  totalXp?: number;
  growthRateText?: string;
  dataPoints?: number[];
}

export function WeeklyTrendCard({
  totalXp = 2450,
  growthRateText = "较上周 ↑ 18%",
  dataPoints = [600, 1200, 1000, 1450, 1250, 1800, 2450],
}: WeeklyTrendCardProps) {
  // Days of week
  const days = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

  // Normalize points to SVG coordinates (width 260, height 80, padding 10)
  const maxVal = 3000;
  const minVal = 0;
  const chartWidth = 260;
  const chartHeight = 80;
  const paddingX = 12;
  const paddingY = 8;

  const points = dataPoints.map((val, idx) => {
    const x = paddingX + (idx / (dataPoints.length - 1)) * (chartWidth - paddingX * 2);
    const normalized = (val - minVal) / (maxVal - minVal);
    const y = chartHeight - paddingY - normalized * (chartHeight - paddingY * 2);
    return { x, y, val };
  });

  // Generate cubic bezier curve string
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    const cp1x = curr.x + (next.x - curr.x) / 2;
    const cp1y = curr.y;
    const cp2x = curr.x + (next.x - curr.x) / 2;
    const cp2y = next.y;
    pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
  }

  // Generate closed area fill path
  const areaD = `${pathD} L ${points[points.length - 1].x} ${chartHeight} L ${points[0].x} ${chartHeight} Z`;

  return (
    <GlassPanel
      variant="base"
      border="default"
      className="p-5 rounded-2xl shadow-[var(--shadow-card)] flex flex-col justify-between min-h-[260px]"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-serif font-bold text-base text-[var(--text-primary)] tracking-wide">
          本周趋势
        </h3>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover-neutral)] transition-colors cursor-pointer"
        >
          <span>XP 总量</span>
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>

      {/* Stats Numbers Row */}
      <div className="flex items-center justify-between mt-1 mb-2">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            {totalXp.toLocaleString()}
          </span>
          <span className="text-xs font-mono text-[var(--text-muted)]">XP</span>
          <span className="inline-flex items-center text-xs font-mono text-[var(--state-success-text)] bg-[var(--state-success-bg)] px-1.5 py-0.5 rounded border border-[var(--state-success-border)]">
            {growthRateText}
            <ArrowUpRight className="h-2.5 w-2.5 ml-0.5" />
          </span>
        </div>

        {/* Small Tag on Right */}
        <div className="text-right">
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-[var(--text-muted)]">
            累计 {totalXp.toLocaleString()} XP
          </span>
        </div>
      </div>

      {/* Smooth Golden Bezier Curve Chart */}
      <div className="relative w-full my-auto">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-20 overflow-visible">
          <defs>
            <linearGradient id="trendAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--gold-400)" stopOpacity="0.25" />
              <stop offset="60%" stopColor="var(--gold-400)" stopOpacity="0.08" />
              <stop offset="100%" stopColor="var(--gold-400)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="trendLineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--gold-500)" />
              <stop offset="50%" stopColor="var(--gold-400)" />
              <stop offset="100%" stopColor="var(--gold-300)" />
            </linearGradient>
          </defs>

          {/* Area Fill */}
          <path d={areaD} fill="url(#trendAreaGrad)" />

          {/* Golden Line Curve */}
          <path
            d={pathD}
            fill="none"
            stroke="url(#trendLineGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Data Points */}
          {points.map((pt, i) => (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={i === points.length - 1 ? "3.5" : "2.5"}
              fill={i === points.length - 1 ? "var(--gold-400)" : "#ffffff"}
              stroke="var(--gold-400)"
              strokeWidth="2"
            />
          ))}
        </svg>

        {/* X-Axis Day Labels */}
        <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)] mt-1 px-1">
          {days.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
      </div>
    </GlassPanel>
  );
}

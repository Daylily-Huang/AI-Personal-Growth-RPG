"use client";

import React, { useState } from "react";
import { Sparkles, ChevronRight } from "lucide-react";
import { GlassPanel } from "@/components/ui";

export interface AiInsightCardProps {
  insights?: string[];
  onViewDetails?: () => void;
}

export function AiInsightCard({
  insights = [
    "你在「深度工作」上的专注时长逐步提升，太棒了！保持稳定的节奏能进一步提升你的综合表现。",
    "系统观察到你在 Rust 核心语法的实践中展现出卓越的持续性，知识节点连接已达成熟阈值。",
    "早间专注模式的效率提升了 24%，建议将高复杂度任务安排在晨间心流高峰期。",
    "复盘记录的深度分析显示你的反思习惯正在稳步强化，自我进化模型已完成阶段校准。",
  ],
  onViewDetails,
}: AiInsightCardProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <GlassPanel
      variant="base"
      border="default"
      className="p-5 rounded-2xl shadow-[var(--shadow-card)] flex flex-col justify-between min-h-[260px] relative overflow-hidden"
    >
      {/* Top Header */}
      <div className="flex items-center gap-1.5 text-[var(--text-primary)]">
        <h3 className="font-serif font-bold text-base tracking-wide">
          AI 洞察
        </h3>
        <Sparkles className="h-4 w-4 text-[var(--gold-400)] fill-[var(--gold-300)]/40 shrink-0" />
      </div>

      {/* Middle Layout: Text Left + Luminous Orb Right */}
      <div className="flex items-center justify-between gap-4 my-2">
        {/* Left Insight Text & CTA */}
        <div className="flex-1 min-w-0 pr-1">
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-3">
            {insights[activeIndex]}
          </p>
          <button
            type="button"
            onClick={onViewDetails}
            className="mt-4 inline-flex items-center gap-1 text-xs font-[var(--font-weight-medium)] px-3 py-1.5 rounded-lg bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--border-hover-neutral)] transition-all shadow-xs cursor-pointer focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]"
          >
            <span>查看详细分析</span>
            <ChevronRight className="h-3 w-3 text-[var(--text-muted)]" />
          </button>
        </div>

        {/* Right Artwork: Floating Luminous Water-Moon Pearl (水月明珠拟态) */}
        <div className="w-28 h-28 shrink-0 relative flex items-center justify-center select-none" aria-hidden="true">
          <svg viewBox="0 0 120 120" fill="none" className="w-full h-full">
            <defs>
              {/* Pearl Radial Gradient */}
              <radialGradient id="pearlGrad" cx="38%" cy="32%" r="65%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="25%" stopColor="#f7f2e7" />
                <stop offset="65%" stopColor="#e2d7c5" />
                <stop offset="100%" stopColor="#bfa98e" />
              </radialGradient>

              {/* Water Ripples Gradient */}
              <linearGradient id="rippleGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--gold-300)" stopOpacity="0" />
                <stop offset="50%" stopColor="var(--gold-400)" stopOpacity="0.4" />
                <stop offset="100%" stopColor="var(--gold-300)" stopOpacity="0" />
              </linearGradient>

              {/* Outer Glow */}
              <radialGradient id="pearlGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="var(--gold-300)" stopOpacity="0.5" />
                <stop offset="60%" stopColor="var(--gold-400)" stopOpacity="0.15" />
                <stop offset="100%" stopColor="var(--gold-500)" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Ripple Waves */}
            <ellipse cx="60" cy="74" rx="46" ry="12" stroke="url(#rippleGrad)" strokeWidth="1" />
            <ellipse cx="60" cy="74" rx="34" ry="9" stroke="url(#rippleGrad)" strokeWidth="1.2" />
            <ellipse cx="60" cy="74" rx="22" ry="6" stroke="url(#rippleGrad)" strokeWidth="1.5" />

            {/* Orbital Golden Rings (绕珠金环) */}
            <ellipse
              cx="60"
              cy="58"
              rx="48"
              ry="16"
              stroke="var(--gold-400)"
              strokeWidth="1.2"
              transform="rotate(-18 60 58)"
              opacity="0.45"
            />
            <ellipse
              cx="60"
              cy="58"
              rx="40"
              ry="13"
              stroke="var(--gold-300)"
              strokeWidth="1"
              transform="rotate(12 60 58)"
              opacity="0.35"
            />

            {/* Ambient Pearl Glow */}
            <circle cx="60" cy="56" r="32" fill="url(#pearlGlow)" />

            {/* Core Luminous Pearl */}
            <circle cx="60" cy="56" r="21" fill="url(#pearlGrad)" filter="drop-shadow(0 4px 10px rgba(184,130,24,0.25))" />
            {/* Top Light Glint */}
            <circle cx="53" cy="48" r="4.5" fill="#ffffff" opacity="0.85" />
            <circle cx="50" cy="45" r="1.8" fill="#ffffff" />
          </svg>
        </div>
      </div>

      {/* Bottom Carousel Dots */}
      <div className="flex items-center justify-center gap-1.5 pt-1">
        {insights.map((_, idx) => (
          <button
            key={idx}
            type="button"
            aria-label={`切换至第 ${idx + 1} 条洞察`}
            onClick={() => setActiveIndex(idx)}
            className={`w-1.5 h-1.5 rounded-full transition-all cursor-pointer ${
              idx === activeIndex
                ? "w-4 bg-[var(--text-primary)]"
                : "bg-[var(--border-default)] hover:bg-[var(--text-muted)]"
            }`}
          />
        ))}
      </div>
    </GlassPanel>
  );
}

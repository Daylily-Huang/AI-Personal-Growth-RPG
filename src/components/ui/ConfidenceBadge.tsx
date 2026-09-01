"use client";

import React, { forwardRef } from "react";
import { Sparkles, Brain, ShieldAlert, ShieldCheck } from "lucide-react";

export type ConfidenceVariant = "mastery" | "assessment" | "knowledge";

export interface ConfidenceBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant: ConfidenceVariant;
  score: number; // 0.00 to 1.00
  showLabel?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const variantNames: Record<ConfidenceVariant, string> = {
  mastery: "掌握保持置信度",
  assessment: "AI评估置信度",
  knowledge: "知识图谱置信度",
};

export const ConfidenceBadge = forwardRef<HTMLSpanElement, ConfidenceBadgeProps>(
  (
    {
      variant,
      score,
      showLabel = true,
      size = "md",
      className = "",
      ...props
    },
    ref
  ) => {
    // Defensive normalization between 0.00 and 1.00
    const safeScore = Number.isFinite(score)
      ? Math.min(1, Math.max(0, score))
      : 0;
    const percentage = Math.round(safeScore * 100);

    // Thresholds: High >= 0.80, Medium 0.50 - 0.79, Low < 0.50
    let tier: "high" | "medium" | "low";
    let tierClasses = "";
    let Icon = Sparkles;

    if (safeScore >= 0.80) {
      tier = "high";
      tierClasses =
        "bg-[var(--confidence-high-bg)] border-[var(--confidence-high-border)] text-[var(--confidence-high-text)]";
      Icon = ShieldCheck;
    } else if (safeScore >= 0.50) {
      tier = "medium";
      tierClasses =
        "bg-[var(--confidence-medium-bg)] border-[var(--confidence-medium-border)] text-[var(--confidence-medium-text)]";
      Icon = variant === "assessment" ? Sparkles : Brain;
    } else {
      tier = "low";
      tierClasses =
        "bg-[var(--confidence-low-bg)] border-[var(--confidence-low-border)] text-[var(--confidence-low-text)]";
      Icon = ShieldAlert;
    }

    const sizeClass = size === "sm" ? "px-1.5 py-0.5 text-[10px] gap-1" : "px-2 py-0.5 text-xs gap-1.5";

    return (
      <span
        ref={ref}
        data-testid="confidence-badge"
        data-variant={variant}
        data-tier={tier}
        data-score={safeScore}
        aria-label={`${variantNames[variant]}: ${percentage}% (${tier})`}
        title={`${variantNames[variant]}: ${percentage}%`}
        className={`inline-flex items-center rounded-full border font-mono font-[var(--font-weight-medium)] select-none ${tierClasses} ${sizeClass} ${className}`}
        {...props}
      >
        <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
        <span data-testid="confidence-badge-value">{percentage}%</span>
        {showLabel && (
          <span
            data-testid="confidence-badge-tier"
            className="text-[10px] uppercase tracking-wider opacity-80"
          >
            {tier === "high" ? "高" : tier === "medium" ? "中" : "低"}
          </span>
        )}
      </span>
    );
  }
);

ConfidenceBadge.displayName = "ConfidenceBadge";

"use client";

import React, { forwardRef } from "react";

export interface MasteryBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  level: number; // Strictly 0 to 10 (M0 - M10)
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: {
    container: "gap-1 px-1.5 py-0.5 text-xs",
    diamondClass: "w-2.5 h-2.5",
  },
  md: {
    container: "gap-1.5 px-2 py-0.5 text-xs",
    diamondClass: "w-3 h-3",
  },
  lg: {
    container: "gap-2 px-2.5 py-1 text-sm",
    diamondClass: "w-3.5 h-3.5",
  },
};

/**
 * Renders a single diamond supporting:
 * - "empty": ◇
 * - "half":  ◐ (left half filled with gold)
 * - "full":  ◆ (solid gold filled)
 */
function Diamond({ state, className }: { state: "empty" | "half" | "full"; className: string }) {
  const clipId = React.useId();

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      data-state={state}
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width="12" height="24" />
        </clipPath>
      </defs>

      {/* Diamond Outline (All states) */}
      <path
        d="M12 2L22 12L12 22L2 12Z"
        stroke="var(--border-default)"
        strokeWidth="2"
        strokeLinejoin="round"
        className="text-[var(--border-default)]"
      />

      {/* Full Solid Diamond Fill */}
      {state === "full" && (
        <path
          d="M12 3.5L20.5 12L12 20.5L3.5 12Z"
          fill="var(--gold-400)"
          className="text-[var(--gold-400)] drop-shadow-[var(--glow-gold-subtle)]"
        />
      )}

      {/* Half Left Diamond Fill */}
      {state === "half" && (
        <g clipPath={`url(#${clipId})`}>
          <path
            d="M12 3.5L20.5 12L12 20.5L3.5 12Z"
            fill="var(--gold-400)"
            className="text-[var(--gold-400)] drop-shadow-[var(--glow-gold-subtle)]"
          />
        </g>
      )}
    </svg>
  );
}

export const MasteryBadge = forwardRef<HTMLSpanElement, MasteryBadgeProps>(
  (
    {
      level,
      size = "md",
      className = "",
      ...props
    },
    ref
  ) => {
    // Defensive normalization: strictly integer 0 to 10
    const safeLevel = Number.isFinite(level)
      ? Math.min(10, Math.max(0, Math.round(level)))
      : 0;

    // Derive the exact 5-diamond states for 10 half-steps:
    const diamonds: Array<"empty" | "half" | "full"> = [];
    for (let i = 0; i < 5; i++) {
      const stepForDiamond = (i + 1) * 2;
      if (safeLevel >= stepForDiamond) {
        diamonds.push("full");
      } else if (safeLevel === stepForDiamond - 1) {
        diamonds.push("half");
      } else {
        diamonds.push("empty");
      }
    }

    const { container, diamondClass } = sizeClasses[size];

    return (
      <span
        ref={ref}
        data-testid="mastery-badge"
        data-mastery-level={safeLevel}
        aria-label={`技能造诣等级 M${safeLevel}`}
        title={`造诣 M${safeLevel}`}
        className={`inline-flex items-center rounded-[var(--radius-sm)] bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-[var(--gold-400)] select-none font-mono ${container} ${className}`}
        {...props}
      >
        <span
          data-testid="mastery-badge-label"
          className="font-[var(--font-weight-bold)] text-[var(--gold-400)] tracking-tight"
        >
          M{safeLevel}
        </span>

        <span data-testid="mastery-diamonds" className="inline-flex items-center gap-0.5">
          {diamonds.map((state, idx) => (
            <Diamond key={idx} state={state} className={diamondClass} />
          ))}
        </span>
      </span>
    );
  }
);

MasteryBadge.displayName = "MasteryBadge";

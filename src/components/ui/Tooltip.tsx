"use client";

import React, { useState, useId, cloneElement } from "react";

export type TooltipPosition = "top" | "bottom" | "left" | "right";

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement<{
    onMouseEnter?: (e: React.MouseEvent) => void;
    onMouseLeave?: (e: React.MouseEvent) => void;
    onFocus?: (e: React.FocusEvent) => void;
    onBlur?: (e: React.FocusEvent) => void;
    onKeyDown?: (e: React.KeyboardEvent) => void;
    "aria-describedby"?: string;
  }>;
  position?: TooltipPosition;
  className?: string;
}

const positionClasses: Record<TooltipPosition, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

export function Tooltip({
  content,
  children,
  position = "top",
  className = "",
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const tooltipId = useId();

  const showTooltip = () => setVisible(true);
  const hideTooltip = () => setVisible(false);

  const existingDescribedBy = children.props["aria-describedby"];
  const resolvedDescribedBy = visible
    ? existingDescribedBy
      ? `${existingDescribedBy} ${tooltipId}`
      : tooltipId
    : existingDescribedBy || undefined;

  // Clone child to attach accessible listeners and preserve merged aria-describedby
  const trigger = cloneElement(children, {
    "aria-describedby": resolvedDescribedBy,
    onMouseEnter: (e: React.MouseEvent) => {
      children.props.onMouseEnter?.(e);
      showTooltip();
    },
    onMouseLeave: (e: React.MouseEvent) => {
      children.props.onMouseLeave?.(e);
      hideTooltip();
    },
    onFocus: (e: React.FocusEvent) => {
      children.props.onFocus?.(e);
      showTooltip();
    },
    onBlur: (e: React.FocusEvent) => {
      children.props.onBlur?.(e);
      hideTooltip();
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      children.props.onKeyDown?.(e);
      if (e.key === "Escape") {
        hideTooltip();
      }
    },
  });

  return (
    <div data-testid="tooltip-wrapper" className="relative inline-flex items-center">
      {trigger}

      {visible && (
        <div
          id={tooltipId}
          role="tooltip"
          data-testid="tooltip-content"
          data-position={position}
          className={`absolute z-[var(--z-tooltip)] px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-overlay)] border border-[var(--border-default)] text-xs text-[var(--text-primary)] whitespace-nowrap shadow-[var(--shadow-card)] pointer-events-none transition-opacity duration-[var(--duration-fast)] select-none ${positionClasses[position]} ${className}`}
        >
          {content}
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState, useId, useRef, useEffect, useLayoutEffect, useCallback, cloneElement, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const emptySubscribe = () => () => {};
function useIsClient() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export type TooltipPosition = "top" | "bottom" | "left" | "right";

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement<{
    "aria-describedby"?: string;
  }>;
  position?: TooltipPosition;
  className?: string;
}

export function Tooltip({
  content,
  children,
  position = "top",
  className = "",
}: TooltipProps) {
  const isClient = useIsClient();
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; transform: string }>({
    top: 0,
    left: 0,
    transform: "none",
  });

  const wrapperRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();

  const updatePosition = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    let top = 0;
    let left = 0;
    let transform = "none";

    switch (position) {
      case "top":
        top = rect.top - 8;
        left = rect.left + rect.width / 2;
        transform = "translate(-50%, -100%)";
        break;
      case "bottom":
        top = rect.bottom + 8;
        left = rect.left + rect.width / 2;
        transform = "translate(-50%, 0)";
        break;
      case "left":
        top = rect.top + rect.height / 2;
        left = rect.left - 8;
        transform = "translate(-100%, -50%)";
        break;
      case "right":
        top = rect.top + rect.height / 2;
        left = rect.right + 8;
        transform = "translate(0, -50%)";
        break;
    }

    setCoords({ top, left, transform });
  }, [position]);

  const showTooltip = () => {
    updatePosition();
    setVisible(true);
  };

  const hideTooltip = () => {
    setVisible(false);
  };

  useIsomorphicLayoutEffect(() => {
    if (visible) {
      updatePosition();
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
      return () => {
        window.removeEventListener("resize", updatePosition);
        window.removeEventListener("scroll", updatePosition, true);
      };
    }
  }, [visible, updatePosition]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLSpanElement>) => {
    if (e.defaultPrevented) return;

    if (e.key === "Escape" && visible) {
      e.preventDefault();
      e.stopPropagation();
      hideTooltip();
    }
  };

  const existingDescribedBy = children.props["aria-describedby"];
  const resolvedDescribedBy = visible
    ? existingDescribedBy
      ? `${existingDescribedBy} ${tooltipId}`
      : tooltipId
    : existingDescribedBy || undefined;

  const trigger = cloneElement(children, {
    "aria-describedby": resolvedDescribedBy,
  });

  const portalContent = visible && isClient && typeof document !== "undefined" && (
    createPortal(
      <div
        id={tooltipId}
        role="tooltip"
        data-testid="tooltip-content"
        data-position={position}
        style={{
          top: `${coords.top}px`,
          left: `${coords.left}px`,
          transform: coords.transform,
        }}
        className={`fixed z-[var(--z-tooltip)] px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-overlay)] border border-[var(--border-default)] text-xs text-[var(--text-primary)] whitespace-nowrap shadow-[var(--shadow-card)] pointer-events-none transition-opacity duration-[var(--duration-fast)] select-none ${className}`}
      >
        {content}
      </div>,
      document.body
    )
  );

  return (
    <span
      ref={wrapperRef}
      data-testid="tooltip-wrapper"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
      onKeyDown={handleKeyDown}
      className="relative inline-flex items-center"
    >
      {trigger}
      {portalContent}
    </span>
  );
}

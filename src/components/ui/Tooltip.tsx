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
  const [resolvedPosition, setResolvedPosition] = useState<TooltipPosition>(position);
  const [coords, setCoords] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  const wrapperRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();

  const updatePosition = useCallback(() => {
    const el = wrapperRef.current;
    if (!el || typeof window === "undefined") return;

    const tr = el.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 8;

    // Use actual rendered dimensions of the tooltip element if mounted
    const tip = tooltipRef.current;
    const tipRect = tip ? tip.getBoundingClientRect() : null;
    const tipWidth = tipRect && tipRect.width > 0 ? tipRect.width : 120;
    const tipHeight = tipRect && tipRect.height > 0 ? tipRect.height : 32;

    let side = position;

    // Viewport collision flipping based on real rendered dimensions
    if (position === "top" && tr.top - 8 - tipHeight < padding) {
      side = "bottom";
    } else if (position === "bottom" && tr.bottom + 8 + tipHeight > viewportHeight - padding) {
      side = "top";
    } else if (position === "left" && tr.left - 8 - tipWidth < padding) {
      side = "right";
    } else if (position === "right" && tr.right + 8 + tipWidth > viewportWidth - padding) {
      side = "left";
    }

    setResolvedPosition(side);

    let top = 0;
    let left = 0;

    switch (side) {
      case "top": {
        top = tr.top - 8 - tipHeight;
        left = tr.left + (tr.width - tipWidth) / 2;
        break;
      }
      case "bottom": {
        top = tr.bottom + 8;
        left = tr.left + (tr.width - tipWidth) / 2;
        break;
      }
      case "left": {
        top = tr.top + (tr.height - tipHeight) / 2;
        left = tr.left - 8 - tipWidth;
        break;
      }
      case "right": {
        top = tr.top + (tr.height - tipHeight) / 2;
        left = tr.right + 8;
        break;
      }
    }

    // Precise rectangle clamping within viewport bounds
    if (left + tipWidth > viewportWidth - padding) {
      left = viewportWidth - padding - tipWidth;
    }
    if (left < padding) {
      left = padding;
    }

    if (top + tipHeight > viewportHeight - padding) {
      top = viewportHeight - padding - tipHeight;
    }
    if (top < padding) {
      top = padding;
    }

    setCoords({ top, left });
  }, [position]);

  const showTooltip = () => {
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
        ref={tooltipRef}
        id={tooltipId}
        role="tooltip"
        data-testid="tooltip-content"
        data-position={resolvedPosition}
        style={{
          top: `${coords.top}px`,
          left: `${coords.left}px`,
          maxWidth: "calc(100vw - 16px)",
        }}
        className={`fixed z-[var(--z-tooltip)] px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-overlay)] border border-[var(--border-default)] text-xs text-[var(--text-primary)] max-w-[calc(100vw-16px)] break-words shadow-[var(--shadow-card)] pointer-events-none transition-opacity duration-[var(--duration-fast)] select-none ${className}`}
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

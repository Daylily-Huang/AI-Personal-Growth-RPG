"use client";

import React, { forwardRef } from "react";

export type GlassVariant = "ground" | "base" | "raised" | "overlay";
export type GlassBlur = "sm" | "md" | "lg" | "xl" | "2xl";
export type GlassBorder = "subtle" | "default" | "raised" | "gold" | "none";

export interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: GlassVariant;
  blur?: GlassBlur;
  border?: GlassBorder;
  highlightTop?: boolean;
  as?: React.ElementType;
  children?: React.ReactNode;
  className?: string;
}

const variantClasses: Record<GlassVariant, string> = {
  ground: "bg-[var(--surface-ground)]",
  base: "bg-[var(--surface-base)]",
  raised: "bg-[var(--surface-raised)]",
  overlay: "bg-[var(--surface-overlay)]",
};

const blurClasses: Record<GlassBlur, string> = {
  sm: "backdrop-blur-[var(--glass-blur-sm)]",
  md: "backdrop-blur-[var(--glass-blur-md)]",
  lg: "backdrop-blur-[var(--glass-blur-lg)]",
  xl: "backdrop-blur-[var(--glass-blur-xl)]",
  "2xl": "backdrop-blur-[var(--glass-blur-2xl)]",
};

const borderClasses: Record<GlassBorder, string> = {
  subtle: "border border-[var(--border-subtle)]",
  default: "border border-[var(--border-default)]",
  raised: "border border-[var(--border-raised)]",
  gold: "border border-[var(--border-gold-subtle)]",
  none: "border-0",
};

export const GlassPanel = forwardRef<HTMLDivElement, GlassPanelProps>(
  (
    {
      variant = "base",
      blur = "md",
      border = "default",
      highlightTop = true,
      as: Component = "div",
      children,
      className = "",
      ...props
    },
    ref
  ) => {
    return (
      <Component
        ref={ref}
        data-testid="glass-panel"
        data-variant={variant}
        data-border={border}
        className={`relative rounded-[var(--radius-lg)] ${variantClasses[variant]} ${blurClasses[blur]} ${borderClasses[border]} ${
          highlightTop && border !== "none" ? "shadow-[inset_0_1px_0_0_var(--border-highlight-top)]" : ""
        } ${className}`}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

GlassPanel.displayName = "GlassPanel";

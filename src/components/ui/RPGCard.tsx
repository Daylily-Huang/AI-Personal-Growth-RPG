"use client";

import React, { forwardRef } from "react";
import { GlassPanel } from "./GlassPanel";

export type EntityType =
  | "activity"
  | "quest"
  | "skill"
  | "knowledge"
  | "artifact"
  | "evidence"
  | "generic";

export interface RPGCardProps extends React.HTMLAttributes<HTMLDivElement> {
  entityType?: EntityType;
  selected?: boolean;
  interactive?: boolean;
  children?: React.ReactNode;
  className?: string;
}

const entityHoverBorderClasses: Record<EntityType, string> = {
  activity: "hover:border-[var(--entity-activity-border)] hover:shadow-[var(--shadow-card)]",
  quest: "hover:border-[var(--entity-quest-border)] hover:shadow-[var(--shadow-card)]",
  skill: "hover:border-[var(--entity-skill-border)] hover:shadow-[var(--shadow-card)]",
  knowledge: "hover:border-[var(--entity-knowledge-border)] hover:shadow-[var(--shadow-card)]",
  artifact: "hover:border-[var(--entity-artifact-border)] hover:shadow-[var(--shadow-card)]",
  evidence: "hover:border-[var(--entity-evidence-border)] hover:shadow-[var(--shadow-card)]",
  generic: "hover:border-[var(--border-hover-neutral)] hover:bg-[var(--surface-hover-neutral)]",
};

export const RPGCard = forwardRef<HTMLDivElement, RPGCardProps>(
  (
    {
      entityType = "generic",
      selected = false,
      interactive,
      children,
      className = "",
      onClick,
      onKeyDown,
      ...props
    },
    ref
  ) => {
    // Actionable only when onClick is explicitly supplied
    const isActionable = Boolean(onClick) && interactive !== false;

    const borderStyleClasses = selected
      ? "border-[var(--selection-neutral-border)] bg-[var(--selection-neutral-bg)] shadow-[var(--shadow-card)]"
      : "";

    const interactiveClasses = isActionable
      ? `cursor-pointer transition-all duration-[var(--duration-fast)] ease-[var(--ease-out-gentle)] hover:[transform:var(--hover-surface-elevation)] focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)] focus-visible:outline-offset-[var(--focus-ring-offset)] ${
          selected ? "" : entityHoverBorderClasses[entityType]
        }`
      : "";

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(e);
      if (!isActionable || e.defaultPrevented) return;

      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        if (e.key === " " || e.key === "Spacebar") {
          e.preventDefault(); // Prevent page scroll on space
        }
        e.currentTarget.click();
      }
    };

    return (
      <GlassPanel
        ref={ref}
        variant="base"
        border="default"
        data-testid="rpg-card"
        data-entity-type={entityType}
        data-selected={selected ? "true" : undefined}
        data-interactive={isActionable ? "true" : undefined}
        tabIndex={isActionable ? 0 : undefined}
        role={isActionable ? "button" : undefined}
        onClick={onClick}
        onKeyDown={isActionable ? handleKeyDown : onKeyDown}
        className={`p-4 lg:p-5 shadow-[var(--shadow-card)] ${borderStyleClasses} ${interactiveClasses} ${className}`}
        {...props}
      >
        {children}
      </GlassPanel>
    );
  }
);

RPGCard.displayName = "RPGCard";

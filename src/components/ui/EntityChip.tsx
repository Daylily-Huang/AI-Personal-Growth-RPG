"use client";

import React, { forwardRef } from "react";
import { X, Zap, Scroll, Swords, Leaf, Gem, Stamp, Tag } from "lucide-react";
import { EntityType } from "./RPGCard";

export interface EntityChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  entityType?: EntityType;
  label: string;
  icon?: React.ReactNode;
  count?: number | string;
  removable?: boolean;
  onRemove?: (e: React.MouseEvent) => void;
  onClick?: (e: React.MouseEvent) => void;
  size?: "sm" | "md";
  className?: string;
}

const entityStyleMap: Record<EntityType, { classes: string; defaultIcon: React.ComponentType<{ className?: string }> }> = {
  activity: {
    classes: "bg-[var(--entity-activity-bg)] border-[var(--entity-activity-border)] text-[var(--entity-activity-text)]",
    defaultIcon: Zap,
  },
  quest: {
    classes: "bg-[var(--entity-quest-bg)] border-[var(--entity-quest-border)] text-[var(--entity-quest-text)]",
    defaultIcon: Scroll,
  },
  skill: {
    classes: "bg-[var(--entity-skill-bg)] border-[var(--entity-skill-border)] text-[var(--entity-skill-text)]",
    defaultIcon: Swords,
  },
  knowledge: {
    classes: "bg-[var(--entity-knowledge-bg)] border-[var(--entity-knowledge-border)] text-[var(--entity-knowledge-text)]",
    defaultIcon: Leaf,
  },
  artifact: {
    classes: "bg-[var(--entity-artifact-bg)] border-[var(--entity-artifact-border)] text-[var(--entity-artifact-text)]",
    defaultIcon: Gem,
  },
  evidence: {
    classes: "bg-[var(--entity-evidence-bg)] border-[var(--entity-evidence-border)] text-[var(--entity-evidence-text)]",
    defaultIcon: Stamp,
  },
  generic: {
    classes: "bg-[var(--surface-raised)] border-[var(--border-default)] text-[var(--text-secondary)]",
    defaultIcon: Tag,
  },
};

export const EntityChip = forwardRef<HTMLSpanElement, EntityChipProps>(
  (
    {
      entityType = "generic",
      label,
      icon,
      count,
      removable = false,
      onRemove,
      onClick,
      size = "md",
      className = "",
      ...props
    },
    ref
  ) => {
    const isInteractive = Boolean(onClick);
    const { classes, defaultIcon: DefaultIcon } = entityStyleMap[entityType];
    const sizeClasses = size === "sm" ? "px-2 py-0.5 text-[11px] gap-1.5" : "px-2.5 py-1 text-xs gap-2";

    const handleRemove = (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemove?.(e);
    };

    return (
      <span
        ref={ref}
        data-testid="entity-chip"
        data-entity-type={entityType}
        role={isInteractive ? "button" : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        onClick={onClick}
        className={`inline-flex items-center rounded-full border font-[var(--font-weight-medium)] select-none transition-colors duration-[var(--duration-fast)] ${classes} ${sizeClasses} ${
          isInteractive ? "cursor-pointer hover:bg-opacity-80 focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]" : ""
        } ${className}`}
        {...props}
      >
        {icon ? (
          <span className="shrink-0">{icon}</span>
        ) : (
          <DefaultIcon className="w-3 h-3 shrink-0" aria-hidden="true" />
        )}

        <span data-testid="entity-chip-label" className="truncate">
          {label}
        </span>

        {count !== undefined && (
          <span
            data-testid="entity-chip-count"
            className="px-1.5 py-0.2 rounded-full bg-[var(--surface-ground)] text-[10px] font-mono opacity-80"
          >
            {count}
          </span>
        )}

        {removable && (
          <button
            type="button"
            data-testid="entity-chip-remove"
            aria-label={`移除 ${label}`}
            onClick={handleRemove}
            className="w-3.5 h-3.5 rounded-full hover:bg-[var(--surface-hover-neutral)] flex items-center justify-center -mr-0.5 ml-0.5 transition-colors"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        )}
      </span>
    );
  }
);

EntityChip.displayName = "EntityChip";

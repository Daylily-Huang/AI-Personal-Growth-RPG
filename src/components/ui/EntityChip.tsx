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
  onRemove?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onClick?: (e: React.MouseEvent<HTMLButtonElement | HTMLSpanElement>) => void;
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

    const handleRemove = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      onRemove?.(e);
    };

    const content = (
      <>
        {icon ? (
          <span className="shrink-0">{icon}</span>
        ) : (
          <DefaultIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        )}

        <span data-testid="entity-chip-label" className="truncate text-xs">
          {label}
        </span>

        {count !== undefined && (
          <span
            data-testid="entity-chip-count"
            className="px-1.5 py-0.5 rounded-full bg-[var(--surface-ground)] text-xs font-mono opacity-80"
          >
            {count}
          </span>
        )}
      </>
    );

    return (
      <span
        ref={ref}
        data-testid="entity-chip"
        data-entity-type={entityType}
        data-size={size}
        className={`inline-flex items-center rounded-full border font-[var(--font-weight-medium)] select-none transition-colors duration-[var(--duration-fast)] min-h-[var(--touch-target-min)] ${classes} ${className}`}
        {...props}
      >
        {isInteractive ? (
          <button
            type="button"
            data-testid="entity-chip-button"
            onClick={onClick}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full min-h-[var(--touch-target-min)] cursor-pointer hover:bg-white/5 focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)] focus-visible:outline-offset-[var(--focus-ring-offset)]"
          >
            {content}
          </button>
        ) : (
          <span className="inline-flex items-center gap-2 px-3 py-1.5">
            {content}
          </span>
        )}

        {removable && (
          <button
            type="button"
            data-testid="entity-chip-remove"
            aria-label={`移除 ${label}`}
            onClick={handleRemove}
            className="inline-flex items-center justify-center w-8 h-8 mr-1 rounded-full min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </span>
    );
  }
);

EntityChip.displayName = "EntityChip";

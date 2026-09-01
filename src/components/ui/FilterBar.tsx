"use client";

import React, { forwardRef } from "react";
import { RotateCcw } from "lucide-react";

export interface FilterOption {
  id: string;
  label: string;
  count?: number | string;
  icon?: React.ReactNode;
}

export interface FilterBarProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  options: FilterOption[];
  activeId: string | string[];
  onChange: (id: string) => void;
  multiple?: boolean;
  onReset?: () => void;
  resetLabel?: string;
  ariaLabel?: string;
  className?: string;
}

export const FilterBar = forwardRef<HTMLDivElement, FilterBarProps>(
  (
    {
      options,
      activeId,
      onChange,
      multiple = false,
      onReset,
      resetLabel = "重置筛选",
      ariaLabel = "选项筛选",
      className = "",
      ...props
    },
    ref
  ) => {
    const isSelected = (id: string): boolean => {
      if (Array.isArray(activeId)) {
        return activeId.includes(id);
      }
      return activeId === id;
    };

    const hasActiveFilters = Array.isArray(activeId)
      ? activeId.length > 0
      : Boolean(activeId && activeId !== "all");

    return (
      <div
        ref={ref}
        role="toolbar"
        aria-label={ariaLabel}
        data-testid="filter-bar"
        data-multiple={multiple ? "true" : undefined}
        className={`flex items-center flex-wrap gap-2 min-h-[var(--touch-target-min)] ${className}`}
        {...props}
      >
        {options.map((option) => {
          const selected = isSelected(option.id);

          return (
            <button
              key={option.id}
              type="button"
              data-testid={`filter-bar-option-${option.id}`}
              data-selected={selected ? "true" : undefined}
              aria-pressed={selected}
              onClick={() => onChange(option.id)}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-[var(--font-weight-medium)] border transition-all duration-[var(--duration-fast)] cursor-pointer select-none min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)] focus-visible:outline-offset-[var(--focus-ring-offset)] ${
                selected
                  ? "bg-[var(--selection-neutral-bg)] border-[var(--selection-neutral-border)] text-[var(--selection-neutral-text)] shadow-[var(--shadow-card)]"
                  : "bg-[var(--surface-base)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover-neutral)] hover:border-[var(--border-default)] hover:text-[var(--text-primary)]"
              }`}
            >
              {option.icon && <span className="shrink-0">{option.icon}</span>}
              <span>{option.label}</span>
              {option.count !== undefined && (
                <span
                  data-testid={`filter-bar-count-${option.id}`}
                  className={`px-1.5 py-0.5 rounded-full text-xs font-mono ${
                    selected
                      ? "bg-[var(--surface-raised)] text-[var(--text-primary)]"
                      : "bg-[var(--surface-ground)] text-[var(--text-muted)]"
                  }`}
                >
                  {option.count}
                </span>
              )}
            </button>
          );
        })}

        {onReset && hasActiveFilters && (
          <button
            type="button"
            onClick={onReset}
            data-testid="filter-bar-reset"
            aria-label={resetLabel}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover-neutral)] min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] transition-colors cursor-pointer focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{resetLabel}</span>
          </button>
        )}
      </div>
    );
  }
);

FilterBar.displayName = "FilterBar";

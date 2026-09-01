"use client";

import React, { forwardRef } from "react";
import { GlassPanel } from "./GlassPanel";

export interface SectionCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const SectionCard = forwardRef<HTMLDivElement, SectionCardProps>(
  (
    {
      title,
      subtitle,
      icon,
      action,
      footer,
      children,
      className = "",
      ...props
    },
    ref
  ) => {
    const hasHeader = Boolean(title || subtitle || icon || action);

    return (
      <GlassPanel
        ref={ref}
        variant="base"
        border="default"
        data-testid="section-card"
        className={`flex flex-col overflow-hidden shadow-[var(--shadow-card)] ${className}`}
        {...props}
      >
        {hasHeader && (
          <div
            data-testid="section-card-header"
            className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--border-subtle)]"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {icon && (
                <div data-testid="section-card-icon" className="shrink-0 text-[var(--text-secondary)]">
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                {title && (
                  <h3
                    data-testid="section-card-title"
                    className="font-serif font-[var(--font-weight-semibold)] text-base text-[var(--text-primary)] tracking-[var(--tracking-wide)] truncate"
                  >
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p
                    data-testid="section-card-subtitle"
                    className="text-xs text-[var(--text-muted)] truncate"
                  >
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
            {action && (
              <div data-testid="section-card-action" className="shrink-0">
                {action}
              </div>
            )}
          </div>
        )}

        <div data-testid="section-card-body" className="p-5 flex-1">
          {children}
        </div>

        {footer && (
          <div
            data-testid="section-card-footer"
            className="px-5 py-3.5 border-t border-[var(--border-subtle)] bg-[var(--surface-hover-neutral)] flex items-center justify-between gap-3 text-xs text-[var(--text-muted)]"
          >
            {footer}
          </div>
        )}
      </GlassPanel>
    );
  }
);

SectionCard.displayName = "SectionCard";

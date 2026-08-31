"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";

export interface InspectorDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  status?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function InspectorDrawer({
  open,
  onClose,
  title,
  status,
  actions,
  children,
  className = "",
}: InspectorDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Store trigger focus and handle Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Esc") {
        e.preventDefault();
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
      window.addEventListener("keydown", handleKeyDown);

      // Shift focus into the drawer container for keyboard accessibility
      const focusable = drawerRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable) {
        focusable.focus();
      } else {
        drawerRef.current?.focus();
      }
    } else {
      window.removeEventListener("keydown", handleKeyDown);
      // Restore focus to triggering element when closed
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === "function") {
        previousActiveElementRef.current.focus();
      }
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      data-testid="inspector-drawer-root"
      className="fixed inset-0 z-[var(--z-drawer)] overflow-hidden"
    >
      {/* Backdrop */}
      <div
        data-testid="inspector-drawer-backdrop"
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 z-[var(--z-modal-backdrop)] bg-[var(--surface-modal-backdrop)] backdrop-blur-[var(--glass-blur-sm)] transition-opacity duration-[var(--duration-fast)]"
      />

      {/* Slide-over Drawer Panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="inspector-drawer-title"
        tabIndex={-1}
        data-testid="inspector-drawer-panel"
        className={`fixed right-0 top-0 bottom-0 z-[var(--z-drawer)] bg-[var(--surface-overlay)] border-l border-[var(--border-raised)] shadow-[var(--shadow-overlay)] flex flex-col transition-transform duration-[var(--duration-drawer)] ease-[var(--ease-drawer)] max-w-full 
          /* Responsive Widths */
          w-full h-[var(--drawer-sheet-mobile-height)] bottom-0 top-auto rounded-t-[var(--radius-xl)] border-t border-l-0
          md:h-full md:bottom-0 md:top-0 md:rounded-none md:border-t-0 md:border-l md:w-[var(--drawer-width-tablet)]
          lg:w-[var(--drawer-width-desktop)]
          xl:w-[var(--drawer-width-wide)]
          ${className}`}
      >
        {/* Drawer Header */}
        <div
          data-testid="inspector-drawer-header"
          className="h-[var(--header-height)] px-4 lg:px-6 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3 shrink-0"
        >
          <div className="flex items-center gap-2 min-w-0">
            {title && (
              <h2
                id="inspector-drawer-title"
                data-testid="inspector-drawer-title"
                className="font-serif font-[var(--font-weight-semibold)] text-base text-[var(--text-primary)] tracking-[var(--tracking-wide)] truncate"
              >
                {title}
              </h2>
            )}
            {status && (
              <div data-testid="inspector-drawer-status" className="shrink-0">
                {status}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            data-testid="inspector-drawer-close"
            aria-label="关闭抽屉"
            className="w-8 h-8 rounded-[var(--radius-md)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover-neutral)] flex items-center justify-center min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] transition-colors duration-[var(--duration-fast)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Scroll Body */}
        <div
          data-testid="inspector-drawer-body"
          className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4"
        >
          {children}
        </div>

        {/* Optional Drawer Footer Actions */}
        {actions && (
          <div
            data-testid="inspector-drawer-footer"
            className="p-4 lg:px-6 border-t border-[var(--border-subtle)] bg-[var(--surface-base)] shrink-0 flex items-center justify-end gap-3"
          >
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

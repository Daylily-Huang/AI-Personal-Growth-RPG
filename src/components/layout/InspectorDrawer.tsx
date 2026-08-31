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
  mode?: "modal" | "push" | "auto";
  className?: string;
}

export function InspectorDrawer({
  open,
  onClose,
  title,
  status,
  actions,
  children,
  mode = "auto",
  className = "",
}: InspectorDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  const isPurePush = mode === "push";

  // Focus trap: Handle Tab, Shift+Tab, and Escape keys (active for modal modes)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Esc") {
        e.preventDefault();
        onClose();
        return;
      }

      if (isPurePush) return; // Non-modal push panels preserve normal document tab flow

      if (e.key === "Tab") {
        if (!drawerRef.current) return;

        const focusableElements = drawerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );

        if (focusableElements.length === 0) {
          e.preventDefault();
          drawerRef.current.focus();
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          // Shift + Tab: if on first element, cycle to last
          if (document.activeElement === firstElement || !drawerRef.current.contains(document.activeElement)) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab: if on last element, cycle to first
          if (document.activeElement === lastElement || !drawerRef.current.contains(document.activeElement)) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    },
    [onClose, isPurePush]
  );

  useEffect(() => {
    if (open) {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
      window.addEventListener("keydown", handleKeyDown);

      if (!isPurePush) {
        // Shift initial focus into the modal drawer
        const focusable = drawerRef.current?.querySelector<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable) {
          focusable.focus();
        } else {
          drawerRef.current?.focus();
        }
      }
    } else {
      window.removeEventListener("keydown", handleKeyDown);
      // Restore focus to triggering element when closed
      if (
        previousActiveElementRef.current &&
        typeof previousActiveElementRef.current.focus === "function" &&
        document.body.contains(previousActiveElementRef.current)
      ) {
        previousActiveElementRef.current.focus();
      }
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, handleKeyDown, isPurePush]);

  if (!open) return null;

  const hasTitle = Boolean(title);

  return (
    <div
      data-testid="inspector-drawer-root"
      data-mode={mode}
      className={`fixed inset-0 z-[var(--z-drawer)] flex flex-col justify-end md:flex-row md:justify-end overflow-hidden pointer-events-none ${
        isPurePush ? "md:pointer-events-none" : ""
      }`}
    >
      {/* Backdrop (rendered for modal / auto modes, hidden in push mode) */}
      {!isPurePush && (
        <div
          data-testid="inspector-drawer-backdrop"
          onClick={onClose}
          aria-hidden="true"
          className="absolute inset-0 bg-[var(--surface-modal-backdrop)] backdrop-blur-[var(--glass-blur-sm)] transition-opacity duration-[var(--duration-fast)] pointer-events-auto"
        />
      )}

      {/* Slide-over Drawer Panel */}
      <div
        ref={drawerRef}
        role={isPurePush ? "region" : "dialog"}
        aria-modal={isPurePush ? undefined : "true"}
        aria-labelledby={hasTitle ? "inspector-drawer-title" : undefined}
        aria-label={!hasTitle ? "检查器" : undefined}
        tabIndex={-1}
        data-testid="inspector-drawer-panel"
        className={`relative z-10 pointer-events-auto bg-[var(--surface-overlay)] border-[var(--border-raised)] shadow-[var(--shadow-overlay)] flex flex-col transition-transform ease-[var(--ease-drawer)] max-w-full 
          w-full h-[var(--drawer-sheet-mobile-height)] rounded-t-[var(--radius-xl)] border-t duration-[var(--duration-drawer-mobile)]
          md:h-full md:rounded-none md:border-t-0 md:border-l md:duration-[var(--duration-drawer)] md:w-[var(--drawer-width-tablet)]
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
            {hasTitle && (
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

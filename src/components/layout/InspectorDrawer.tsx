"use client";

import React, { useEffect, useRef, useCallback, useSyncExternalStore } from "react";
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

function getIsXlSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const xlToken = getComputedStyle(document.documentElement)
      .getPropertyValue("--breakpoint-xl")
      .trim();
    if (!xlToken) return false;
    return window.matchMedia(`(min-width: ${xlToken})`).matches;
  } catch {
    return false;
  }
}

function subscribeToXlBreakpoint(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  try {
    const xlToken = getComputedStyle(document.documentElement)
      .getPropertyValue("--breakpoint-xl")
      .trim();
    if (!xlToken) return () => {};
    const mq = window.matchMedia(`(min-width: ${xlToken})`);
    mq.addEventListener("change", callback);
    return () => mq.removeEventListener("change", callback);
  } catch {
    return () => {};
  }
}

/**
 * Token-aware responsive hook that reads the frozen --breakpoint-xl authority
 * via useSyncExternalStore without hardcoding raw numbers in TypeScript.
 */
function useIsXlBreakpoint(): boolean {
  return useSyncExternalStore(
    subscribeToXlBreakpoint,
    getIsXlSnapshot,
    () => false
  );
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
  const drawerRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const prevIsPushRef = useRef<boolean | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const isXl = useIsXlBreakpoint();
  const isPush = mode === "push" || (mode === "auto" && isXl);

  // Helper to focus first focusable element inside drawer
  const focusInsideDrawer = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      if (!drawerRef.current) return;
      const focusable = drawerRef.current.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable) {
        focusable.focus();
      } else {
        drawerRef.current.focus();
      }
    });
  }, []);

  // 1. Lifecycle: Opener capture, Mode transitions, and Focus containment
  useEffect(() => {
    if (open) {
      if (!wasOpenRef.current) {
        // A. Closed -> Open
        openerRef.current = document.activeElement as HTMLElement | null;
        wasOpenRef.current = true;
        if (!isPush) {
          focusInsideDrawer();
        }
      } else {
        // Breakpoint / mode transition while open
        if (prevIsPushRef.current === true && !isPush) {
          // B. Push -> Modal while open
          // If current activeElement is outside drawer, move focus into the now-active modal
          if (!drawerRef.current || !drawerRef.current.contains(document.activeElement)) {
            focusInsideDrawer();
          }
        } else if (prevIsPushRef.current === false && isPush) {
          // C. Modal -> Push while open: cancel any pending modal focus RAF
          if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
          }
        }
      }
      prevIsPushRef.current = isPush;
    } else {
      if (wasOpenRef.current) {
        // D. Open -> Closed
        wasOpenRef.current = false;
        prevIsPushRef.current = null;
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        if (
          openerRef.current &&
          typeof openerRef.current.focus === "function" &&
          document.body.contains(openerRef.current)
        ) {
          openerRef.current.focus();
        }
      }
    }
  }, [open, isPush, focusInsideDrawer]);

  // E. Cleanup on unmount while open
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (
        wasOpenRef.current &&
        openerRef.current &&
        typeof openerRef.current.focus === "function" &&
        document.body.contains(openerRef.current)
      ) {
        openerRef.current.focus();
      }
    };
  }, []);

  // 2. Keyboard Handler: Escape dismiss & Modal Focus Trapping
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Esc") {
        e.preventDefault();
        onClose();
        return;
      }

      if (isPush) return; // Structural push mode preserves normal document Tab flow

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
    [onClose, isPush]
  );

  useEffect(() => {
    if (open) {
      window.addEventListener("keydown", handleKeyDown);
    } else {
      window.removeEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  const hasTitle = Boolean(title);

  // Single Stable Subtree: aside root and children remain mounted across responsive transitions
  return (
    <aside
      ref={drawerRef}
      role={isPush ? "region" : undefined}
      aria-labelledby={isPush && hasTitle ? "inspector-drawer-title" : undefined}
      aria-label={isPush && !hasTitle ? "检查器" : undefined}
      tabIndex={-1}
      data-testid="inspector-drawer-root"
      data-mode={isPush ? "push" : "modal"}
      className={
        isPush
          ? `relative z-10 shrink-0 h-full w-[var(--drawer-width-wide)] bg-[var(--surface-overlay)] border-l border-[var(--border-raised)] shadow-[var(--shadow-overlay)] flex flex-col ${className}`
          : `fixed inset-0 z-[var(--z-drawer)] flex flex-col justify-end md:flex-row md:justify-end overflow-hidden ${className}`
      }
    >
      {/* Backdrop: rendered in modal mode only */}
      {!isPush && (
        <div
          data-testid="inspector-drawer-backdrop"
          onClick={onClose}
          aria-hidden="true"
          className="absolute inset-0 bg-[var(--surface-modal-backdrop)] backdrop-blur-[var(--glass-blur-sm)] transition-opacity duration-[var(--duration-fast)]"
        />
      )}

      {/* Slide-over Drawer Panel */}
      <div
        role={!isPush ? "dialog" : undefined}
        aria-modal={!isPush ? "true" : undefined}
        aria-labelledby={!isPush && hasTitle ? "inspector-drawer-title" : undefined}
        aria-label={!isPush && !hasTitle ? "检查器" : undefined}
        tabIndex={-1}
        data-testid="inspector-drawer-panel"
        className={
          isPush
            ? "flex flex-col h-full w-full"
            : `relative z-10 bg-[var(--surface-overlay)] border-[var(--border-raised)] shadow-[var(--shadow-overlay)] flex flex-col transition-transform ease-[var(--ease-drawer)] max-w-full 
              w-full h-[var(--drawer-sheet-mobile-height)] rounded-t-[var(--radius-xl)] border-t duration-[var(--duration-drawer-mobile)]
              md:h-full md:rounded-none md:border-t-0 md:border-l md:duration-[var(--duration-drawer)] md:w-[var(--drawer-width-tablet)]
              lg:w-[var(--drawer-width-desktop)]
              xl:w-[var(--drawer-width-wide)]`
        }
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
    </aside>
  );
}

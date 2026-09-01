"use client";

import React, { useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export type ModalSize = "sm" | "md" | "lg" | "wide";

export interface BaseModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: ModalSize;
  closeOnEscape?: boolean;
  closeOnBackdropClick?: boolean;
  className?: string;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: "max-w-[var(--modal-max-width-sm)]",
  md: "max-w-[var(--modal-max-width-default)]",
  lg: "max-w-[var(--modal-max-width-wide)]",
  wide: "max-w-[var(--workspace-max-width)]",
};

export function BaseModal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  closeOnEscape = true,
  closeOnBackdropClick = true,
  className = "",
}: BaseModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  // 1. Focus capture on open & restoration on close / unmount
  useIsomorphicLayoutEffect(() => {
    if (open) {
      if (!wasOpenRef.current) {
        openerRef.current = document.activeElement as HTMLElement | null;
        wasOpenRef.current = true;

        // Schedule focus inside modal on next frame
        requestAnimationFrame(() => {
          if (!modalRef.current) return;
          const focusable = modalRef.current.querySelector<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          );
          if (focusable) {
            focusable.focus();
          } else {
            modalRef.current.focus();
          }
        });
      }
    } else {
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        if (
          openerRef.current &&
          typeof openerRef.current.focus === "function" &&
          document.body.contains(openerRef.current)
        ) {
          openerRef.current.focus();
        }
      }
    }
  }, [open]);

  // Cleanup on unmount while open
  useIsomorphicLayoutEffect(() => {
    return () => {
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

  // 2. Keyboard handling: Escape & Focus Trap
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Esc") {
        if (closeOnEscape) {
          e.preventDefault();
          onClose();
        }
        return;
      }

      if (e.key === "Tab") {
        if (!modalRef.current) return;

        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );

        if (focusableElements.length === 0) {
          e.preventDefault();
          modalRef.current.focus();
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement || !modalRef.current.contains(document.activeElement)) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement || !modalRef.current.contains(document.activeElement)) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    },
    [closeOnEscape, onClose]
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
  const hasDesc = Boolean(description);

  return (
    <div
      data-testid="base-modal-root"
      className="fixed inset-0 z-[var(--z-modal-backdrop)] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
    >
      {/* Modal Backdrop */}
      <div
        data-testid="base-modal-backdrop"
        onClick={closeOnBackdropClick ? onClose : undefined}
        aria-hidden="true"
        className="fixed inset-0 bg-[var(--surface-modal-backdrop)] backdrop-blur-[var(--glass-blur-md)] transition-opacity duration-[var(--duration-modal)]"
      />

      {/* Modal Dialog Panel */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={hasTitle ? "base-modal-title" : undefined}
        aria-describedby={hasDesc ? "base-modal-desc" : undefined}
        aria-label={!hasTitle ? "对话框" : undefined}
        tabIndex={-1}
        data-testid="base-modal-panel"
        className={`relative z-[var(--z-modal)] w-full rounded-[var(--radius-xl)] bg-[var(--surface-overlay)] border border-[var(--border-raised)] shadow-[var(--shadow-overlay)] flex flex-col max-h-[90vh] overflow-hidden transition-transform duration-[var(--duration-modal)] ease-[var(--ease-out-gentle)] ${sizeClasses[size]} ${className}`}
      >
        {/* Modal Header */}
        {hasTitle && (
          <div
            data-testid="base-modal-header"
            className="flex items-center justify-between gap-3 px-6 py-4 border-b border-[var(--border-subtle)] shrink-0"
          >
            <div className="min-w-0">
              <h2
                id="base-modal-title"
                data-testid="base-modal-title"
                className="font-serif font-[var(--font-weight-semibold)] text-lg text-[var(--text-primary)] tracking-[var(--tracking-wide)] truncate"
              >
                {title}
              </h2>
              {description && (
                <p
                  id="base-modal-desc"
                  data-testid="base-modal-desc"
                  className="text-xs text-[var(--text-muted)] mt-0.5 truncate"
                >
                  {description}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              data-testid="base-modal-close"
              aria-label="关闭对话框"
              className="w-8 h-8 rounded-[var(--radius-md)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover-neutral)] flex items-center justify-center min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div data-testid="base-modal-body" className="p-6 overflow-y-auto flex-1 space-y-4">
          {children}
        </div>

        {/* Modal Footer */}
        {footer && (
          <div
            data-testid="base-modal-footer"
            className="px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--surface-base)] flex items-center justify-end gap-3 shrink-0"
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

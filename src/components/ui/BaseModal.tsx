"use client";

import React, { useEffect, useLayoutEffect, useRef, useId, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const emptySubscribe = () => () => {};
function useIsClient() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export interface BaseModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  ariaLabel?: string;
  description?: React.ReactNode;
  descriptionId?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeOnEscape?: boolean;
  closeOnBackdropClick?: boolean;
  className?: string;
}

export function BaseModal({
  open,
  onClose,
  title,
  ariaLabel,
  description,
  descriptionId: externalDescId,
  children,
  footer,
  closeOnEscape = true,
  closeOnBackdropClick = true,
  className = "",
}: BaseModalProps) {
  const isClient = useIsClient();
  const modalRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);

  const reactId = useId();
  const defaultTitleId = `modal-title-${reactId}`;
  const defaultDescId = `modal-desc-${reactId}`;

  const hasTitle = Boolean(title);
  const hasDesc = Boolean(description);
  const hasHeader = hasTitle || hasDesc;
  const resolvedDescId = externalDescId || (hasDesc ? defaultDescId : undefined);

  // 1. Focus capture on open & restoration on close / unmount
  useIsomorphicLayoutEffect(() => {
    if (open) {
      if (!wasOpenRef.current) {
        openerRef.current = document.activeElement as HTMLElement | null;
        wasOpenRef.current = true;

        const focusInside = () => {
          if (!modalRef.current) return;
          const focusable = modalRef.current.querySelector<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          );
          if (focusable) {
            focusable.focus();
          } else {
            modalRef.current.focus();
          }
        };

        // Immediate synchronous focus attempt in layout phase
        focusInside();

        // RAF fallback to guarantee focus if DOM was pending
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null;
          if (modalRef.current && !modalRef.current.contains(document.activeElement)) {
            focusInside();
          }
        });
      }
    } else {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
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
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
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

  // 2. Keyboard handling: Scoped to modal root to prevent window event leaking to underlying Drawers
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.defaultPrevented) return;

    if (e.key === "Escape" || e.key === "Esc") {
      // Consume Escape so it does not bubble to window/document or underlying drawers
      e.stopPropagation();
      e.preventDefault();
      if (closeOnEscape) {
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
  };

  if (!open || !isClient || typeof document === "undefined") return null;

  const modalTree = (
    <div
      data-testid="base-modal-root"
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-[var(--z-modal-backdrop)] flex items-end md:items-center justify-center p-0 md:p-6 overflow-y-auto"
    >
      {/* Modal Backdrop */}
      <div
        data-testid="base-modal-backdrop"
        onClick={closeOnBackdropClick ? onClose : undefined}
        aria-hidden="true"
        className="fixed inset-0 z-[var(--z-modal-backdrop)] bg-[var(--surface-modal-backdrop)] backdrop-blur-[var(--glass-blur-md)] transition-opacity duration-[var(--duration-modal)]"
      />

      {/* Modal Dialog Panel: Base = Fullscreen Sheet, md = max-width-sm, lg = max-width-default, xl = max-width-wide */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={hasTitle ? defaultTitleId : undefined}
        aria-describedby={resolvedDescId}
        aria-label={!hasTitle ? ariaLabel || "对话框" : undefined}
        tabIndex={-1}
        data-testid="base-modal-panel"
        className={`relative z-[var(--z-modal)] w-full h-full rounded-none md:h-auto md:max-w-[var(--modal-max-width-sm)] lg:max-w-[var(--modal-max-width-default)] xl:max-w-[var(--modal-max-width-wide)] md:rounded-[var(--radius-xl)] bg-[var(--surface-overlay)] border-0 md:border md:border-[var(--border-raised)] shadow-[var(--shadow-overlay)] flex flex-col overflow-hidden transition-transform duration-[var(--duration-modal)] ease-[var(--ease-out-gentle)] ${className}`}
      >
        {/* Modal Header */}
        {hasHeader && (
          <div
            data-testid="base-modal-header"
            className="flex items-center justify-between gap-3 px-6 py-4 border-b border-[var(--border-subtle)] shrink-0"
          >
            <div className="min-w-0">
              {hasTitle && (
                <h2
                  id={defaultTitleId}
                  data-testid="base-modal-title"
                  className="font-serif font-[var(--font-weight-semibold)] text-lg text-[var(--text-primary)] tracking-[var(--tracking-wide)] truncate"
                >
                  {title}
                </h2>
              )}
              {hasDesc && (
                <p
                  id={defaultDescId}
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
              className="rounded-[var(--radius-md)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover-neutral)] flex items-center justify-center min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] transition-colors cursor-pointer focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]"
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

  return createPortal(modalTree, document.body);
}

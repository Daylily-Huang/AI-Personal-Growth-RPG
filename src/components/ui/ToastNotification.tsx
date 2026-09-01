"use client";

import React, { forwardRef } from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, Info, Bell, X } from "lucide-react";

export type ToastVariant = "success" | "warning" | "danger" | "info" | "neutral";

export interface ToastNotificationProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  variant?: ToastVariant;
  title?: React.ReactNode;
  message: React.ReactNode;
  icon?: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}

interface ToastConfig {
  classes: string;
  defaultIcon: React.ComponentType<{ className?: string }>;
}

const toastConfigs: Record<ToastVariant, ToastConfig> = {
  success: {
    classes: "border-[var(--state-success-border)] text-[var(--state-success-text)]",
    defaultIcon: CheckCircle2,
  },
  warning: {
    classes: "border-[var(--state-warning-border)] text-[var(--state-warning-text)]",
    defaultIcon: AlertTriangle,
  },
  danger: {
    classes: "border-[var(--state-danger-border)] text-[var(--state-danger-text)]",
    defaultIcon: AlertCircle,
  },
  info: {
    classes: "border-[var(--state-info-border)] text-[var(--state-info-text)]",
    defaultIcon: Info,
  },
  neutral: {
    classes: "border-[var(--border-raised)] text-[var(--text-primary)]",
    defaultIcon: Bell,
  },
};

export const ToastNotification = forwardRef<HTMLDivElement, ToastNotificationProps>(
  (
    {
      variant = "neutral",
      title,
      message,
      icon,
      onDismiss,
      className = "",
      ...props
    },
    ref
  ) => {
    const config = toastConfigs[variant];
    const DefaultIcon = config.defaultIcon;
    const isAlert = variant === "danger";

    return (
      <div
        ref={ref}
        role={isAlert ? "alert" : "status"}
        aria-live={isAlert ? "assertive" : "polite"}
        data-testid="toast-notification"
        data-variant={variant}
        className={`relative z-[var(--z-toast)] flex items-start gap-3 p-4 rounded-[var(--radius-lg)] bg-[var(--surface-overlay)] border backdrop-blur-[var(--glass-blur-lg)] shadow-[var(--shadow-raised)] max-w-md w-full transition-all duration-[var(--duration-fast)] ease-[var(--ease-out-gentle)] ${config.classes} ${className}`}
        {...props}
      >
        <div data-testid="toast-icon" className="shrink-0 mt-0.5">
          {icon ? icon : <DefaultIcon className="w-5 h-5" aria-hidden="true" />}
        </div>

        <div className="flex-1 min-w-0">
          {title && (
            <h4
              data-testid="toast-title"
              className="text-sm font-[var(--font-weight-semibold)] text-[var(--text-primary)] tracking-[var(--tracking-wide)] truncate"
            >
              {title}
            </h4>
          )}
          <div
            data-testid="toast-message"
            className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed"
          >
            {message}
          </div>
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            data-testid="toast-dismiss"
            aria-label="关闭提示"
            className="min-w-[var(--touch-target-min)] min-h-[var(--touch-target-min)] rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover-neutral)] flex items-center justify-center shrink-0 -mr-2 -mt-2 transition-colors cursor-pointer focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }
);

ToastNotification.displayName = "ToastNotification";

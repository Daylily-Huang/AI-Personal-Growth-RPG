"use client";

import React, { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { ButtonProps } from "./PrimaryButton";

const sizeClasses = {
  sm: "px-3 py-1.5 text-xs min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)]",
  md: "px-4 py-2 text-sm min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)]",
  lg: "px-6 py-3 text-base min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)]",
};

export const SecondaryButton = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      loading = false,
      disabled = false,
      icon,
      size = "md",
      children,
      className = "",
      type = "button",
      "aria-busy": customAriaBusy,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;
    const isBusy = loading ? true : customAriaBusy;

    return (
      <button
        ref={ref}
        type={type}
        data-testid="secondary-button"
        {...props}
        disabled={isDisabled}
        aria-busy={isBusy}
        className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-[var(--font-weight-medium)] bg-[var(--surface-base)] border border-[var(--border-default)] text-[var(--text-primary)] transition-all duration-[var(--duration-fast)] ease-[var(--ease-out-gentle)] hover:bg-[var(--surface-hover-neutral)] hover:border-[var(--border-hover-neutral)] active:duration-[var(--duration-instant)] active:ease-[var(--ease-in-out-subtle)] active:[transform:var(--active-surface-depression)] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:[transform:none] cursor-pointer focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)] focus-visible:outline-offset-[var(--focus-ring-offset)] select-none ${sizeClasses[size]} ${className}`}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
        ) : icon ? (
          <span className="shrink-0">{icon}</span>
        ) : null}
        <span>{children}</span>
      </button>
    );
  }
);

SecondaryButton.displayName = "SecondaryButton";

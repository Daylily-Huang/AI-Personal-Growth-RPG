"use client";

import React, { forwardRef } from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  icon?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
  className?: string;
}

const sizeClasses = {
  sm: "px-3 py-1.5 text-xs min-h-[36px]",
  md: "px-4 py-2 text-sm min-h-[var(--touch-target-min)]",
  lg: "px-6 py-3 text-base min-h-[50px]",
};

export const PrimaryButton = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      loading = false,
      disabled = false,
      icon,
      size = "md",
      children,
      className = "",
      type = "button",
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        data-testid="primary-button"
        className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] font-[var(--font-weight-semibold)] bg-[var(--gold-400)] text-[var(--text-inverse)] shadow-[var(--glow-gold-subtle)] transition-all duration-[var(--duration-fast)] ease-[var(--ease-out-gentle)] hover:bg-[var(--gold-300)] hover:shadow-[var(--glow-gold-focus)] active:scale-[0.985] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:active:scale-100 cursor-pointer focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)] focus-visible:outline-offset-[var(--focus-ring-offset)] select-none ${sizeClasses[size]} ${className}`}
        {...props}
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

PrimaryButton.displayName = "PrimaryButton";

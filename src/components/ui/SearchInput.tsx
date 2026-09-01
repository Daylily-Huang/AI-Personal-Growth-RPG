"use client";

import React, { forwardRef } from "react";
import { Search, X } from "lucide-react";

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onClear?: () => void;
  ariaLabel?: string;
  className?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      onChange,
      placeholder = "搜索...",
      onClear,
      ariaLabel = "搜索",
      className = "",
      ...props
    },
    ref
  ) => {
    const handleClear = () => {
      onChange("");
      onClear?.();
    };

    return (
      <div
        data-testid="search-input-wrapper"
        className={`relative flex items-center w-full min-h-[var(--touch-target-min)] ${className}`}
      >
        <div className="absolute left-3.5 flex items-center pointer-events-none text-[var(--text-muted)]">
          <Search className="w-4 h-4" aria-hidden="true" />
        </div>

        <input
          ref={ref}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          data-testid="search-input"
          className="w-full h-10 pl-10 pr-9 rounded-[var(--radius-md)] bg-[var(--surface-base)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors duration-[var(--duration-fast)] hover:border-[var(--border-hover-neutral)] focus:border-[var(--border-raised)] focus:bg-[var(--surface-raised)] focus:outline-none focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)] focus-visible:outline-offset-[var(--focus-ring-offset)]"
          {...props}
        />

        {value && (
          <button
            type="button"
            onClick={handleClear}
            data-testid="search-input-clear"
            aria-label="清除搜索"
            className="absolute right-2.5 w-6 h-6 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover-neutral)] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = "SearchInput";

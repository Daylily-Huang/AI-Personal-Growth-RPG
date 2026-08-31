"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./AppSidebar";

export interface MobileNavProps {
  className?: string;
}

export function MobileNav({ className = "" }: MobileNavProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="移动端底部导航"
      data-testid="mobile-nav"
      className={`fixed bottom-0 left-0 right-0 z-[var(--z-header)] md:hidden h-[var(--mobile-nav-height)] bg-[var(--surface-overlay)] backdrop-blur-[var(--glass-blur-xl)] border-t border-[var(--border-subtle)] flex items-center justify-around px-2 select-none ${className}`}
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        if (item.disabled) {
          return (
            <div
              key={item.href}
              data-testid={`mobile-nav-disabled-${item.label}`}
              className="flex flex-col items-center justify-center min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] text-[var(--text-disabled)] cursor-not-allowed opacity-50"
              aria-disabled="true"
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </div>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            data-testid={`mobile-nav-${item.href.slice(1)}`}
            data-active={isActive}
            aria-current={isActive ? "page" : undefined}
            className={`flex flex-col items-center justify-center min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] px-2 py-1 rounded-[var(--radius-sm)] transition-colors duration-[var(--duration-fast)] relative ${
              isActive
                ? "text-[var(--selection-neutral-text)] font-[var(--font-weight-semibold)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>

            {/* Active Neutral Indicator Dot */}
            {isActive && (
              <div
                data-testid="mobile-active-indicator"
                className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full bg-[var(--selection-neutral-indicator)]"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

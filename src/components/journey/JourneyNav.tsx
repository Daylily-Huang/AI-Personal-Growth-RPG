"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenText, CalendarRange, ClipboardCheck } from "lucide-react";

const JOURNEY_ITEMS = [
  { href: "/journey/seasons", label: "赛季", icon: CalendarRange },
  { href: "/journey/reviews", label: "复盘", icon: ClipboardCheck },
  { href: "/journey/journal", label: "日志", icon: BookOpenText },
] as const;

export function JourneyNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="成长旅程导航"
      className="flex w-full gap-1 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-base)] p-1 shadow-[var(--shadow-card)]"
    >
      {JOURNEY_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            data-testid={`journey-nav-${item.href.split("/").at(-1)}`}
            className={`inline-flex min-h-[var(--touch-target-min)] min-w-[8rem] flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] px-4 py-2 text-sm font-[var(--font-weight-medium)] transition-colors focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)] ${
              active
                ? "bg-[var(--selection-neutral-bg)] text-[var(--selection-neutral-text)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover-neutral)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function RewardsNav() {
  const pathname = usePathname();
  return <nav aria-label="心愿与成就导航" className="mb-6 flex min-w-0 gap-1 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-base)] p-1">
    {[{ href: "/rewards/wishes", label: "心愿与积分" }, { href: "/rewards/milestones", label: "成就记录" }].map(item => {
      const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
      return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
        className={`inline-flex min-h-[var(--touch-target-min)] min-w-0 flex-1 items-center justify-center rounded-[var(--radius-md)] px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)] ${active ? "bg-[var(--selection-neutral-bg)] text-[var(--selection-neutral-text)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover-neutral)]"}`}>{item.label}</Link>;
    })}
  </nav>;
}

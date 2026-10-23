"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis, LayoutDashboard, Scroll, FolderGit2 } from "lucide-react";
import { isWorkspaceRoute, matchesRoute } from "@/lib/navigation";
export interface MobileNavProps { className?: string; onOpenNavigation?: () => void }
const primary = [{ href: "/dashboard", label: "今天", icon: LayoutDashboard }, { href: "/quests", label: "任务", icon: Scroll }, { href: "/artifacts", label: "作品", icon: FolderGit2 }];
export function MobileNav({ className = "", onOpenNavigation }: MobileNavProps) {
  const pathname = usePathname(), moreActive = isWorkspaceRoute(pathname) && !primary.some(item => matchesRoute(pathname, item.href));
  const base = "flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-xs focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)] ";
  return <nav aria-label="移动端底部导航" data-testid="mobile-nav" className={"fixed bottom-0 left-0 right-0 z-[var(--z-header)] flex h-[var(--mobile-nav-height)] items-center justify-around border-t border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-[var(--glass-blur-xl)] md:hidden " + className}>
    {primary.map(item => { const active = matchesRoute(pathname, item.href), Icon = item.icon; return <Link key={item.href} href={item.href} aria-label={item.label} data-testid={"mobile-nav-" + item.href.slice(1)} data-active={active} aria-current={active ? "page" : undefined} className={base + (active ? "font-semibold text-[var(--selection-neutral-text)]" : "text-[var(--text-muted)]")}><Icon className="h-5 w-5" aria-hidden="true" /><span>{item.label}</span>{active && <span data-testid="mobile-active-indicator" aria-hidden="true" className="h-1 w-1 rounded-full bg-[var(--selection-neutral-indicator)]" />}</Link>; })}
    <button type="button" onClick={onOpenNavigation} aria-label="更多页面" aria-haspopup="dialog" data-testid="mobile-nav-more" data-active={moreActive} className={base + (moreActive ? "font-semibold text-[var(--selection-neutral-text)]" : "text-[var(--text-muted)]")}><Ellipsis className="h-5 w-5" aria-hidden="true" /><span>更多</span>{moreActive && <span data-testid="mobile-active-indicator" aria-hidden="true" className="h-1 w-1 rounded-full bg-[var(--selection-neutral-indicator)]" />}</button>
  </nav>;
}

"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, X, ArrowUpRight } from "lucide-react";
import { searchNavigation } from "@/lib/navigation";
export function NavigationDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), search = useRef<HTMLInputElement>(null), results = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState(""); const pathname = usePathname(), initialPath = useRef(pathname);
  const destinations = searchNavigation(query);
  useEffect(() => {
    const element = dialog.current; if (!element) return;
    const previous = document.activeElement; element.showModal(); search.current?.focus();
    return () => { element.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  useEffect(() => { if (pathname !== initialPath.current) onClose(); }, [pathname, onClose]);
  function moveFocus(event: React.KeyboardEvent) {
    if (event.isDefaultPrevented() || event.nativeEvent.isComposing) return;
    if (event.key === "Tab") {
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href]') ?? []);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first && last) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last && first) { event.preventDefault(); first.focus(); }
      return;
    }
    const links = Array.from(results.current?.querySelectorAll<HTMLAnchorElement>("a") ?? []);
    const index = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) || !links.length) return;
    if (event.target === search.current && (event.key === "Home" || event.key === "End")) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? links.length - 1 : event.key === "ArrowDown" ? (index + 1) % links.length : (index < 0 ? links.length - 1 : (index - 1 + links.length) % links.length);
    links[next].focus(); links[next].scrollIntoView?.({ block: "nearest" });
  }
  return <dialog ref={dialog} aria-labelledby="navigation-title" aria-describedby="navigation-description" onCancel={event => { event.preventDefault(); onClose(); }} onClose={onClose} onKeyDown={moveFocus} onClick={event => { if (event.target === event.currentTarget) onClose(); }} className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-xl max-h-[85dvh] overflow-y-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-0 text-[var(--text-primary)] shadow-2xl backdrop:bg-black/35 backdrop:backdrop-blur-sm">
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3"><h2 id="navigation-title" className="font-serif text-xl">想去哪里？</h2><button type="button" aria-label="关闭页面导航" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-[var(--surface-hover-neutral)]"><X className="h-5 w-5" aria-hidden="true" /></button></div>
      <p id="navigation-description" className="mb-4 text-sm text-[var(--text-secondary)]">搜索页面和操作入口。不会读取你的文件或向 AI 发送内容。</p>
      <label className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-raised)] bg-[var(--surface-ground)] px-3"><Search className="h-4 w-4 shrink-0" aria-hidden="true" /><input ref={search} type="search" autoComplete="off" maxLength={80} value={query} onChange={event => setQuery(event.target.value)} aria-label="搜索页面和操作" placeholder="试试：任务、月度复盘、本地资料…" className="min-h-11 w-full min-w-0 bg-transparent text-base outline-none" /></label>
      <p role="status" aria-live="polite" className="mt-3 text-xs text-[var(--text-muted)]">{destinations.length ? destinations.length + " 个入口 · ↑ ↓ 选择，Enter 打开，Esc 关闭" : "没有匹配的页面，试试任务、资料、复盘或帮助。"}</p>
      <ul ref={results} aria-label="匹配页面" className="mt-2 space-y-1">{destinations.map(item => <li key={item.href}><Link href={item.href} prefetch={false} onClick={onClose} aria-current={pathname === item.href ? "page" : undefined} className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 py-3 hover:bg-[var(--surface-hover-neutral)] focus-visible:bg-[var(--surface-hover-neutral)] focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]"><span className="min-w-0"><span className="block font-medium">{item.label}</span><span className="mt-0.5 block text-sm text-[var(--text-secondary)]">{item.description}</span></span><ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" /></Link></li>)}</ul>
    </div>
  </dialog>;
}

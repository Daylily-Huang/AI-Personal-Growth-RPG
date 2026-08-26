// src/app/knowledge/components/KnowledgeFilterPanel.tsx
// Stage 6C Knowledge Map Filter & Progressive Navigation Panel

import {
  Layers,
  Search,
  SlidersHorizontal,
  CheckCircle2,
  Sparkles,
  Archive,
  BookOpen,
  Quote,
  FolderTree,
  RotateCcw,
  Network,
} from "lucide-react";
import type { KnowledgeNodeType } from "@/lib/knowledge/types";
import type { KnowledgeFilters } from "./controller";

export interface DomainItem {
  id: string;
  name: string;
  slug: string;
  nodeCount: number;
}

export interface KnowledgeFilterPanelProps {
  domains: DomainItem[];
  totalCandidateNodes: number;
  filters: KnowledgeFilters;
  rootNodeTitle: string | null;
  onFilterChange: (updates: Partial<KnowledgeFilters>) => void;
  onResetFilters: () => void;
}

export default function KnowledgeFilterPanel({
  domains,
  totalCandidateNodes,
  filters,
  rootNodeTitle,
  onFilterChange,
  onResetFilters,
}: KnowledgeFilterPanelProps) {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 text-zinc-200">
      {/* Search Input */}
      <div className="relative mb-5">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
        />
        <input
          data-testid="search-input"
          value={filters.search}
          onChange={(e) => onFilterChange({ search: e.target.value })}
          placeholder="搜索概念、命题或主题…"
          aria-label="搜索知识图谱"
          className="w-full rounded-lg border border-white/10 bg-black/40 px-8 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
        />
      </div>

      {/* Progressive Ego-Graph Root Status (if active) */}
      {filters.rootNodeId && (
        <div
          data-testid="progressive-root-box"
          className="mb-5 rounded-lg border border-emerald-500/40 bg-emerald-950/30 p-3"
        >
          <div className="flex items-center justify-between gap-1 pb-1 text-xs font-semibold text-emerald-300">
            <div className="flex items-center gap-1.5 truncate">
              <Network className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">焦点展开: {rootNodeTitle || "锚点节点"}</span>
            </div>
            <button
              type="button"
              data-testid="reset-root-btn"
              onClick={() => onFilterChange({ rootNodeId: null })}
              title="退出局部展开"
              className="rounded p-1 text-emerald-400 hover:bg-emerald-900/50 hover:text-emerald-200"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-400">
            <span>展开跳数 (Depth):</span>
            <div className="flex gap-1">
              {[1, 2, 3].map((d) => (
                <button
                  key={d}
                  type="button"
                  data-testid={`depth-btn-${d}`}
                  onClick={() => onFilterChange({ depth: d })}
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    filters.depth === d
                      ? "bg-emerald-600 text-white font-bold"
                      : "bg-black/40 text-zinc-400 hover:bg-white/10"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Domain Hierarchy List */}
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-400">
          <span className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" /> 领域分类 (Domains)
          </span>
          <span className="text-[10px] font-normal text-zinc-500">
            {totalCandidateNodes} 节点
          </span>
        </div>

        <div className="space-y-1">
          <button
            type="button"
            data-testid="domain-all-btn"
            onClick={() => onFilterChange({ domainId: null })}
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
              filters.domainId === null
                ? "bg-emerald-950/60 font-medium text-emerald-300 border border-emerald-500/30"
                : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
            }`}
          >
            <span>全部领域</span>
            <span className="text-[10px] text-zinc-500">{totalCandidateNodes}</span>
          </button>

          {domains.map((dom) => (
            <button
              key={dom.id}
              type="button"
              data-testid={`domain-btn-${dom.id}`}
              onClick={() => onFilterChange({ domainId: dom.id })}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                filters.domainId === dom.id
                  ? "bg-sky-950/60 font-medium text-sky-300 border border-sky-500/30"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              }`}
            >
              <span className="truncate">{dom.name}</span>
              <span className="text-[10px] text-zinc-500">{dom.nodeCount}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Node Type Filter */}
      <div className="mb-5">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          <SlidersHorizontal className="h-3.5 w-3.5" /> 实体类型 (Node Type)
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            data-testid="node-type-all-btn"
            onClick={() => onFilterChange({ nodeType: "all" })}
            className={`rounded-lg px-2 py-1.5 text-center text-xs transition-colors ${
              filters.nodeType === "all"
                ? "bg-white/15 font-semibold text-zinc-100"
                : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
            }`}
          >
            全部类型
          </button>

          {(
            [
              { id: "concept", label: "概念 (Concept)", icon: BookOpen },
              { id: "claim", label: "命题 (Claim)", icon: Quote },
              { id: "topic", label: "主题 (Topic)", icon: FolderTree },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const isSelected = filters.nodeType === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`node-type-${item.id}-btn`}
                onClick={() =>
                  onFilterChange({
                    nodeType: item.id as KnowledgeNodeType,
                  })
                }
                className={`flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-colors ${
                  isSelected
                    ? "bg-sky-950/70 font-semibold text-sky-300 border border-sky-500/40"
                    : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                }`}
              >
                <Icon className="h-3 w-3" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Epistemic Authority / Status Filter */}
      <div className="mb-5">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> 认识论权威状态 (Authority)
        </div>

        <div className="space-y-1.5">
          <button
            type="button"
            data-testid="status-all-btn"
            onClick={() => onFilterChange({ status: "all" })}
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
              filters.status === "all"
                ? "bg-white/15 font-semibold text-zinc-100"
                : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
            }`}
          >
            <span>活跃事实 (Verified + Proposed)</span>
            <span className="text-[10px] text-zinc-500">默认</span>
          </button>

          <button
            type="button"
            data-testid="status-verified-btn"
            onClick={() => onFilterChange({ status: "verified" })}
            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
              filters.status === "verified"
                ? "bg-emerald-950/70 font-semibold text-emerald-300 border border-emerald-500/40"
                : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span>已验证事实 [VERIFIED]</span>
          </button>

          <button
            type="button"
            data-testid="status-inferred-btn"
            onClick={() => onFilterChange({ status: "inferred" })}
            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
              filters.status === "inferred"
                ? "bg-amber-950/70 font-semibold text-amber-300 border border-amber-500/40"
                : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span>AI 提案 [AI PROPOSED]</span>
          </button>

          <button
            type="button"
            data-testid="status-archived-btn"
            onClick={() => onFilterChange({ status: "archived" })}
            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
              filters.status === "archived"
                ? "bg-zinc-800 font-semibold text-zinc-300 border border-zinc-600"
                : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
            }`}
          >
            <Archive className="h-3.5 w-3.5 text-zinc-400" />
            <span>已归档历史 [ARCHIVED]</span>
          </button>
        </div>
      </div>

      {/* Reset Filters CTA */}
      <div className="mt-auto pt-4">
        <button
          type="button"
          data-testid="reset-filters-btn"
          onClick={onResetFilters}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-black/20 py-2 text-xs text-zinc-400 hover:bg-white/5 hover:text-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          重置全部筛选
        </button>
      </div>
    </div>
  );
}

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
    <div className="[&_button]:min-h-[var(--touch-target-min)] [&_button]:min-w-[var(--touch-target-min)] [&_input]:min-h-[var(--touch-target-min)] [&_button[aria-pressed=true]]:bg-[var(--selection-neutral-bg)] [&_button[aria-pressed=true]]:text-[var(--selection-neutral-text)] [&_button[aria-pressed=true]]:outline [&_button[aria-pressed=true]]:outline-[var(--selection-neutral-border)] flex h-full flex-col overflow-y-auto p-4 text-[var(--text-primary)]">
      {/* Search Input */}
      <div className="relative mb-5">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-secondary)]"
        />
        <input
          data-testid="search-input"
          value={filters.search}
          onChange={(e) => onFilterChange({ search: e.target.value })}
          placeholder="搜索概念、命题或主题…"
          aria-label="搜索知识图谱"
          className="min-h-[var(--touch-target-min)] w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-ground)] px-8 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]"
        />
      </div>

      {/* Progressive Ego-Graph Root Status (if active) */}
      {filters.rootNodeId && (
        <div
          data-testid="progressive-root-box"
          className="mb-5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3"
        >
          <div className="flex items-center justify-between gap-1 pb-1 text-xs font-semibold text-[var(--authority-verified-text)]">
            <div className="flex items-center gap-1.5 truncate">
              <Network className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">焦点展开: {rootNodeTitle || "锚点节点"}</span>
            </div>
            <button
              type="button"
              data-testid="reset-root-btn"
              onClick={() => onFilterChange({ rootNodeId: null })}
              title="退出局部展开"
              aria-label="退出局部展开"
              className="rounded p-1 text-[var(--authority-verified-text)] hover:bg-[var(--surface-raised)] hover:text-[var(--authority-verified-text)]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
            <span>展开跳数 (Depth):</span>
            <div className="flex gap-1">
              {[1, 2, 3].map((d) => (
                <button
                  key={d}
                  type="button"
                  data-testid={`depth-btn-${d}`}
                  aria-pressed={filters.depth === d}
                  onClick={() => onFilterChange({ depth: d })}
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    filters.depth === d
                      ? "bg-[var(--surface-raised)] text-[var(--text-primary)] font-bold"
                      : "bg-[var(--surface-ground)] text-[var(--text-secondary)] hover:bg-[var(--surface-ground)]"
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
        <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          <span className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" /> 领域分类 (Domains)
          </span>
          <span className="text-[10px] font-normal text-[var(--text-secondary)]">
            {totalCandidateNodes} 节点
          </span>
        </div>

        <div className="space-y-1">
          <button
            type="button"
            data-testid="domain-all-btn"
            aria-pressed={filters.domainId === null}
            onClick={() => onFilterChange({ domainId: null })}
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
              filters.domainId === null
                ? "bg-[var(--surface-raised)] font-medium text-[var(--authority-verified-text)] border border-[var(--border-subtle)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-ground)] hover:text-[var(--text-primary)]"
            }`}
          >
            <span>全部领域</span>
            <span className="text-[10px] text-[var(--text-secondary)]">{totalCandidateNodes}</span>
          </button>

          {domains.map((dom) => (
            <button
              key={dom.id}
              type="button"
              data-testid={`domain-btn-${dom.id}`}
              aria-pressed={filters.domainId === dom.id}
              onClick={() => onFilterChange({ domainId: dom.id })}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                filters.domainId === dom.id
                  ? "bg-[var(--surface-raised)] font-medium text-[var(--entity-knowledge-text)] border border-[var(--border-subtle)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-ground)] hover:text-[var(--text-primary)]"
              }`}
            >
              <span className="truncate">{dom.name}</span>
              <span className="text-[10px] text-[var(--text-secondary)]">{dom.nodeCount}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Node Type Filter */}
      <div className="mb-5">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          <SlidersHorizontal className="h-3.5 w-3.5" /> 实体类型 (Node Type)
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            data-testid="node-type-all-btn"
            aria-pressed={filters.nodeType === "all"}
            onClick={() => onFilterChange({ nodeType: "all" })}
            className={`rounded-lg px-2 py-1.5 text-center text-xs transition-colors ${
              filters.nodeType === "all"
                ? "bg-[var(--surface-ground)] font-semibold text-[var(--text-primary)]"
                : "bg-[var(--surface-ground)] text-[var(--text-secondary)] hover:bg-[var(--surface-ground)] hover:text-[var(--text-primary)]"
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
                aria-pressed={isSelected}
                onClick={() =>
                  onFilterChange({
                    nodeType: item.id as KnowledgeNodeType,
                  })
                }
                className={`flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-colors ${
                  isSelected
                    ? "bg-[var(--surface-raised)] font-semibold text-[var(--entity-knowledge-text)] border border-[var(--border-subtle)]"
                    : "bg-[var(--surface-ground)] text-[var(--text-secondary)] hover:bg-[var(--surface-ground)] hover:text-[var(--text-primary)]"
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
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          <CheckCircle2 className="h-3.5 w-3.5 text-[var(--authority-verified-text)]" /> 认识论权威状态 (Authority)
        </div>

        <div className="space-y-1.5">
          <button
            type="button"
            data-testid="status-all-btn"
            aria-pressed={filters.status === "all"}
            onClick={() => onFilterChange({ status: "all" })}
            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
              filters.status === "all"
                ? "bg-[var(--surface-ground)] font-semibold text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-ground)] hover:text-[var(--text-primary)]"
            }`}
          >
            <span>活跃知识 (Verified + Proposed)</span>
            <span className="text-[10px] text-[var(--text-secondary)]">默认</span>
          </button>

          <button
            type="button"
            data-testid="status-verified-btn"
            aria-pressed={filters.status === "verified"}
            onClick={() => onFilterChange({ status: "verified" })}
            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
              filters.status === "verified"
                ? "bg-[var(--surface-raised)] font-semibold text-[var(--authority-verified-text)] border border-[var(--border-subtle)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-ground)] hover:text-[var(--text-primary)]"
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-[var(--authority-verified-text)]" />
            <span>已验证事实 [VERIFIED]</span>
          </button>

          <button
            type="button"
            data-testid="status-inferred-btn"
            aria-pressed={filters.status === "inferred"}
            onClick={() => onFilterChange({ status: "inferred" })}
            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
              filters.status === "inferred"
                ? "bg-[var(--surface-raised)] font-semibold text-[var(--authority-inferred-text)] border border-[var(--border-subtle)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-ground)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-[var(--authority-inferred-text)]" />
            <span>AI 提案 [AI PROPOSED]</span>
          </button>

          <button
            type="button"
            data-testid="status-archived-btn"
            aria-pressed={filters.status === "archived"}
            onClick={() => onFilterChange({ status: "archived" })}
            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
              filters.status === "archived"
                ? "bg-[var(--surface-raised)] font-semibold text-[var(--text-secondary)] border border-[var(--border-subtle)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-ground)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Archive className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
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
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-ground)] py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-ground)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          重置全部筛选
        </button>
      </div>
    </div>
  );
}

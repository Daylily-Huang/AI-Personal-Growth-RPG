import type { SkillDerivedState } from "@/lib/store/types";
import {
  STATE_FILTER_OPTIONS,
  type DomainListItem,
} from "./presentation";

export default function DomainFilterPanel({
  domains,
  totalCount,
  activeDomainId,
  onSelectDomain,
  stateFilter,
  onSelectState,
}: {
  domains: DomainListItem[];
  totalCount: number;
  activeDomainId: string | null;
  onSelectDomain: (domainId: string | null) => void;
  stateFilter: SkillDerivedState | "all";
  onSelectState: (filter: SkillDerivedState | "all") => void;
}) {
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-3">
      <section aria-label="领域筛选">
        <h3 className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          领域
        </h3>
        <button
          type="button"
          onClick={() => onSelectDomain(null)}
          aria-pressed={activeDomainId === null}
          className={`flex w-full items-center justify-between rounded-[var(--radius-md)] px-2.5 py-1.5 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)] ${
            activeDomainId === null
              ? "bg-[var(--selection-neutral-bg)] border border-[var(--selection-neutral-border)] text-[var(--selection-neutral-text)] font-medium shadow-[var(--shadow-card)]"
              : "border border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover-neutral)] hover:text-[var(--text-primary)]"
          }`}
        >
          <span>全部领域</span>
          <span className="text-xs text-[var(--text-muted)]">{totalCount}</span>
        </button>
        <ul className="mt-0.5 space-y-0.5">
          {domains.map((domain) => (
            <li key={domain.id}>
              <button
                type="button"
                onClick={() => onSelectDomain(domain.id)}
                aria-pressed={activeDomainId === domain.id}
                style={{ paddingLeft: `${10 + domain.depth * 14}px` }}
                className={`flex w-full items-center justify-between rounded-[var(--radius-md)] py-1.5 pr-2.5 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)] ${
                  activeDomainId === domain.id
                    ? "bg-[var(--selection-neutral-bg)] border border-[var(--selection-neutral-border)] text-[var(--selection-neutral-text)] font-medium shadow-[var(--shadow-card)]"
                    : "border border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover-neutral)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span className="truncate" title={domain.name}>
                  {domain.name}
                </span>
                <span className="ml-2 shrink-0 text-xs text-[var(--text-muted)]">
                  {domain.count}
                </span>
              </button>
            </li>
          ))}
          {domains.length === 0 ? (
            <li className="px-2.5 py-1.5 text-xs text-[var(--text-muted)]">暂无领域</li>
          ) : null}
        </ul>
      </section>

      <section aria-label="状态筛选">
        <h3 className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          状态
        </h3>
        <div className="flex flex-wrap gap-1.5 px-1">
          {STATE_FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelectState(option.value)}
              aria-pressed={stateFilter === option.value}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)] ${
                stateFilter === option.value
                  ? "border-[var(--selection-neutral-border)] bg-[var(--selection-neutral-bg)] text-[var(--selection-neutral-text)] font-medium shadow-[var(--shadow-card)]"
                  : "border-[var(--border-subtle)] bg-[var(--surface-base)] text-[var(--text-muted)] hover:border-[var(--border-default)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-hover-neutral)]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

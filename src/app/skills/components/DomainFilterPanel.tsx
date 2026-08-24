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
        <h2 className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          领域
        </h2>
        <button
          type="button"
          onClick={() => onSelectDomain(null)}
          aria-pressed={activeDomainId === null}
          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 ${
            activeDomainId === null
              ? "bg-emerald-500/15 font-medium text-emerald-200"
              : "text-zinc-300 hover:bg-white/5"
          }`}
        >
          <span>全部领域</span>
          <span className="text-xs text-zinc-500">{totalCount}</span>
        </button>
        <ul className="mt-0.5 space-y-0.5">
          {domains.map((domain) => (
            <li key={domain.id}>
              <button
                type="button"
                onClick={() => onSelectDomain(domain.id)}
                aria-pressed={activeDomainId === domain.id}
                style={{ paddingLeft: `${10 + domain.depth * 14}px` }}
                className={`flex w-full items-center justify-between rounded-lg py-1.5 pr-2.5 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 ${
                  activeDomainId === domain.id
                    ? "bg-emerald-500/15 font-medium text-emerald-200"
                    : "text-zinc-300 hover:bg-white/5"
                }`}
              >
                <span className="truncate" title={domain.name}>
                  {domain.name}
                </span>
                <span className="ml-2 shrink-0 text-xs text-zinc-500">
                  {domain.count}
                </span>
              </button>
            </li>
          ))}
          {domains.length === 0 ? (
            <li className="px-2.5 py-1.5 text-xs text-zinc-500">暂无领域</li>
          ) : null}
        </ul>
      </section>

      <section aria-label="状态筛选">
        <h2 className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          状态
        </h2>
        <div className="flex flex-wrap gap-1.5 px-1">
          {STATE_FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelectState(option.value)}
              aria-pressed={stateFilter === option.value}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 ${
                stateFilter === option.value
                  ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200"
                  : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-zinc-200"
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

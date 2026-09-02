"use client";

import React from "react";
import type { XpTransaction } from "@/lib/store/types";
import { TrendingUp } from "lucide-react";
import { SectionCard } from "@/components/ui";

export interface RecentGrowthFeedProps {
  transactions: XpTransaction[];
}

export function RecentGrowthFeed({ transactions }: RecentGrowthFeedProps) {
  if (transactions.length === 0) return null;

  return (
    <SectionCard
      title="Recent Growth"
      icon={<TrendingUp className="h-5 w-5 text-[var(--state-success-text)] shrink-0" />}
      className="p-5"
    >
      <ul className="divide-y divide-[var(--border-subtle)]">
        {transactions.slice(0, 6).map((tx) => (
          <li key={tx.id} className="flex items-center justify-between gap-4 py-3 first:pt-1 last:pb-1">
            <div className="min-w-0">
              <div className="truncate text-sm font-[var(--font-weight-medium)] text-[var(--text-primary)]">
                {tx.reason}
              </div>
              <div className="text-xs text-[var(--text-muted)] font-mono mt-0.5">
                {tx.skillName} · {new Date(tx.createdAt).toLocaleString()}
              </div>
              {tx.repetitionPenalty != null ? (
                <div className="mt-1 text-xs text-[var(--gold-600)] font-mono">
                  {tx.repetitionPenalty < 1
                    ? `重复 ×${tx.repetitionPenalty}（第 ${tx.repetitionCount} 次类似，服务器判定）`
                    : `无重复惩罚（第 ${tx.repetitionCount} 次类似，服务器判定）`}
                </div>
              ) : null}
            </div>
            <div className="shrink-0 rounded-full bg-[var(--state-success-bg)] border border-[var(--state-success-border)] px-3 py-1 text-xs font-bold font-mono text-[var(--state-success-text)]">
              +{tx.amount} XP
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

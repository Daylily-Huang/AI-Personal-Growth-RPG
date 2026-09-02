"use client";

import React from "react";
import type { MasteryVerification } from "@/lib/store/types";
import { ShieldAlert } from "lucide-react";
import { SectionCard } from "@/components/ui";

export interface PendingVerificationsProps {
  verifications: MasteryVerification[];
}

export function PendingVerifications({ verifications }: PendingVerificationsProps) {
  if (verifications.length === 0) return null;

  return (
    <SectionCard
      title="Mastery 待验证"
      icon={<ShieldAlert className="h-5 w-5 text-[var(--state-info-text)] shrink-0" />}
      className="p-5 space-y-3"
    >
      <ul className="space-y-2">
        {verifications.map((v) => (
          <li
            key={v.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3.5 py-2.5 text-sm shadow-xs"
          >
            <span className="flex items-center gap-2">
              <span className="font-[var(--font-weight-medium)] text-[var(--text-primary)]">
                {v.skillName}
              </span>
              <span className="font-mono text-xs text-[var(--gold-500)] font-[var(--font-weight-semibold)]">
                M{v.fromLevel} → M{v.toLevel}
              </span>
            </span>
            <span className="text-xs font-mono text-[var(--text-muted)]">
              E{v.evidenceLevel} · Pending · 尚未授予
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-[var(--text-muted)]">
        这些升级需要验证以后才会真正生效（不会自动授予）。
      </p>
    </SectionCard>
  );
}

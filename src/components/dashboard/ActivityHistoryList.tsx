"use client";

import React from "react";
import type { Activity } from "@/lib/store/types";
import { BookOpen } from "lucide-react";
import { SectionCard } from "@/components/ui";

export interface ActivityHistoryListProps {
  activities: Activity[];
}

export function ActivityHistoryList({ activities }: ActivityHistoryListProps) {
  if (activities.length === 0) return null;

  return (
    <SectionCard
      title="近期活动记录 (Activity Log)"
      icon={<BookOpen className="h-5 w-5 text-[var(--entity-activity-text)] shrink-0" />}
      className="p-5 sm:p-6 rounded-2xl shadow-[var(--shadow-card)]"
    >
      <ul className="divide-y divide-[var(--border-subtle)]">
        {activities.slice(0, 10).map((activity) => (
          <li key={activity.id} className="flex items-center justify-between gap-4 py-3 first:pt-1 last:pb-1">
            <div className="min-w-0">
              <div className="truncate text-sm font-[var(--font-weight-medium)] text-[var(--text-primary)]">
                {activity.title}
              </div>
              <div className="text-xs text-[var(--text-muted)] font-mono mt-0.5">
                <span className="capitalize">{activity.status}</span> · {new Date(activity.createdAt).toLocaleString()}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

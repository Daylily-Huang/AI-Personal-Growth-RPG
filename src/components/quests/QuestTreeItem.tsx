"use client";

import React, { useState } from "react";
import type { QuestStatus, QuestTreeNode } from "@/lib/store/types";
import { QuestCard } from "./QuestCard";
import { ChevronDown, ChevronRight } from "lucide-react";

export interface QuestTreeItemProps {
  node: QuestTreeNode;
  level?: number;
  onUpdateStatus: (id: string, s: QuestStatus) => void;
  onUpdateProgress: (id: string, p: number) => void;
  onDelete: (id: string) => void;
}

export function QuestTreeItem({
  node,
  level = 0,
  onUpdateStatus,
  onUpdateProgress,
  onDelete,
}: QuestTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const children = node.children ?? [];
  const hasChildren = children.length > 0;

  return (
    <div
      className={`flex flex-col gap-2 ${
        level > 0 ? "ml-4 sm:ml-6 pl-3 sm:pl-4 border-l border-[var(--border-subtle)]" : ""
      }`}
      role="treeitem"
      aria-selected={false}
      aria-expanded={hasChildren ? isExpanded : undefined}
    >
      <div className="relative">
        <QuestCard
          quest={node}
          hasChildren={hasChildren}
          childrenCount={children.length}
          onUpdateStatus={onUpdateStatus}
          onUpdateProgress={onUpdateProgress}
          onDelete={onDelete}
        />
        {hasChildren && (
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="absolute top-3 right-3 p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-raised)] transition-colors min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] flex items-center justify-center cursor-pointer"
            aria-label={isExpanded ? "折叠子任务" : "展开子任务"}
            title={isExpanded ? "折叠子任务" : "展开子任务"}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {hasChildren && isExpanded ? (
        <div className="flex flex-col gap-2 mt-1" role="group">
          {children.map((child) => (
            <QuestTreeItem
              key={child.id}
              node={child}
              level={level + 1}
              onUpdateStatus={onUpdateStatus}
              onUpdateProgress={onUpdateProgress}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

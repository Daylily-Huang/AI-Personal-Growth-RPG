// src/app/knowledge/components/EditNodeMetadataModal.tsx
// Stage 6C Modal for whitelisted Node Metadata Updates (PATCH /api/knowledge/[id])

import { useState } from "react";
import { BaseModal } from "@/components/ui/BaseModal";
import { Loader2, Save, AlertCircle } from "lucide-react";
import { updateKnowledgeNodeMetadata } from "./controller";
import type { DomainItem } from "./KnowledgeFilterPanel";

export interface EditNodeMetadataModalProps {
  nodeId: string;
  initialTitle: string;
  initialDescription: string | null;
  initialDomainId: string | null;
  initialIsArchived: boolean;
  domains: DomainItem[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditNodeMetadataModal({
  nodeId,
  initialTitle,
  initialDescription,
  initialDomainId,
  initialIsArchived,
  domains,
  isOpen,
  onClose,
  onSuccess,
}: EditNodeMetadataModalProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [domainId, setDomainId] = useState<string | null>(initialDomainId);
  const [isArchived, setIsArchived] = useState(initialIsArchived);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync / reset editable state from latest props whenever modal opens or props refresh (React 19 render-phase sync)
  const [prevProps, setPrevProps] = useState({
    isOpen,
    initialTitle,
    initialDescription,
    initialDomainId,
    initialIsArchived,
  });

  if (
    isOpen !== prevProps.isOpen ||
    (isOpen &&
      (initialTitle !== prevProps.initialTitle ||
        initialDescription !== prevProps.initialDescription ||
        initialDomainId !== prevProps.initialDomainId ||
        initialIsArchived !== prevProps.initialIsArchived))
  ) {
    setPrevProps({
      isOpen,
      initialTitle,
      initialDescription,
      initialDomainId,
      initialIsArchived,
    });
    if (isOpen) {
      setTitle(initialTitle);
      setDescription(initialDescription ?? "");
      setDomainId(initialDomainId);
      setIsArchived(initialIsArchived);
      setError(null);
    }
  }

  if (!isOpen) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("节点标题不能为空");
      return;
    }

    setSaving(true);
    setError(null);

    const res = await updateKnowledgeNodeMetadata(nodeId, {
      title: title.trim(),
      description: description.trim() ? description.trim() : null,
      domainId: domainId || null,
      isArchived,
    });

    setSaving(false);
    if (!res.success) {
      setError(res.error || "更新失败");
      return;
    }

    onSuccess();
    onClose();
  }

  return (
    <BaseModal open={isOpen} onClose={() => { if (!saving) onClose(); }} title="编辑知识节点元数据">
        <form onSubmit={handleSave} className="mt-4 space-y-4 text-xs">
          {error && (
            <div
              data-testid="edit-node-error"
              className="flex items-center gap-2 rounded-lg border border-[var(--state-danger-border)] bg-[var(--state-danger-bg)] p-2.5 text-[var(--state-danger-text)]"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Title Input */}
          <div>
            <label htmlFor="node-title-input" className="mb-1 block font-medium text-[var(--text-secondary)]">
              节点名称 / 标题 <span className="text-[var(--state-danger-text)]">*</span>
            </label>
            <input
              id="node-title-input"
              data-testid="edit-node-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-ground)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]"
              required
            />
          </div>

          {/* Description Input */}
          <div>
            <label htmlFor="node-desc-input" className="mb-1 block font-medium text-[var(--text-secondary)]">
              知识阐释 / 详细描述
            </label>
            <textarea
              id="node-desc-input"
              data-testid="edit-node-desc-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="添加该概念、命题的详细定义或上下文阐释…"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-ground)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]"
            />
          </div>

          {/* Domain Selector */}
          <div>
            <label htmlFor="node-domain-select" className="mb-1 block font-medium text-[var(--text-secondary)]">
              所属领域 (Domain)
            </label>
            <select
              id="node-domain-select"
              data-testid="edit-node-domain-select"
              value={domainId ?? ""}
              onChange={(e) => setDomainId(e.target.value ? e.target.value : null)}
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-ground)] px-3 py-2 text-xs text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]"
            >
              <option value="">未分类领域</option>
              {domains.map((dom) => (
                <option key={dom.id} value={dom.id}>
                  {dom.name}
                </option>
              ))}
            </select>
          </div>

          {/* Archive Toggle */}
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="node-archive-checkbox"
              data-testid="edit-node-archive-checkbox"
              checked={isArchived}
              onChange={(e) => setIsArchived(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--border-subtle)] bg-[var(--surface-ground)] text-[var(--authority-verified-text)] focus:ring-[var(--focus-ring-color)]"
            />
            <label htmlFor="node-archive-checkbox" className="font-medium text-[var(--text-secondary)]">
              将该节点归档 (Archived，不在默认活跃图谱中显示)
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] pt-4">
            <button
              type="button"
              data-testid="cancel-edit-metadata-btn"
              onClick={onClose}
              className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-ground)] hover:text-[var(--text-primary)]"
            >
              取消
            </button>
            <button
              type="submit"
              data-testid="save-node-metadata-btn"
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--surface-raised)] px-4 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-raised)] disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              保存修改
            </button>
          </div>
        </form>
    </BaseModal>
  );
}

// src/app/knowledge/components/EditNodeMetadataModal.tsx
// Stage 6C Modal for whitelisted Node Metadata Updates (PATCH /api/knowledge/[id])

import { useState } from "react";
import { X, Loader2, Save, AlertCircle } from "lucide-react";
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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-node-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0d1320] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h3 id="edit-node-modal-title" className="text-sm font-semibold text-zinc-100">
            编辑知识节点元数据
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="rounded p-1 text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-4 text-xs">
          {error && (
            <div
              data-testid="edit-node-error"
              className="flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-950/40 p-2.5 text-rose-300"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Title Input */}
          <div>
            <label htmlFor="node-title-input" className="mb-1 block font-medium text-zinc-300">
              节点名称 / 标题 <span className="text-rose-400">*</span>
            </label>
            <input
              id="node-title-input"
              data-testid="edit-node-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
              required
            />
          </div>

          {/* Description Input */}
          <div>
            <label htmlFor="node-desc-input" className="mb-1 block font-medium text-zinc-300">
              知识阐释 / 详细描述
            </label>
            <textarea
              id="node-desc-input"
              data-testid="edit-node-desc-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="添加该概念、命题的详细定义或上下文阐释…"
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
            />
          </div>

          {/* Domain Selector */}
          <div>
            <label htmlFor="node-domain-select" className="mb-1 block font-medium text-zinc-300">
              所属领域 (Domain)
            </label>
            <select
              id="node-domain-select"
              data-testid="edit-node-domain-select"
              value={domainId ?? ""}
              onChange={(e) => setDomainId(e.target.value ? e.target.value : null)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
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
              className="h-4 w-4 rounded border-white/10 bg-black/40 text-emerald-500 focus:ring-emerald-400"
            />
            <label htmlFor="node-archive-checkbox" className="font-medium text-zinc-300">
              将该节点归档 (Archived，不在默认活跃图谱中显示)
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
            >
              取消
            </button>
            <button
              type="submit"
              data-testid="save-node-metadata-btn"
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              保存修改
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { BaseModal } from "@/components/ui/BaseModal";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SecondaryButton } from "@/components/ui/SecondaryButton";
import {
  Sparkles,
  Network,
  Scroll,
  Zap,
  ShieldCheck,
  Trash2,
  AlertCircle,
} from "lucide-react";
import type {
  ArtifactDetail,
  ManageArtifactLinksInput,
} from "@/types/artifact";

export interface ArtifactLinkManagerModalProps {
  open: boolean;
  detail: ArtifactDetail | null;
  onClose: () => void;
  onLinksUpdated: () => Promise<void>;
}

type TabType = "skills" | "knowledge" | "quests" | "activities" | "evidence";

export function ArtifactLinkManagerModal({
  open,
  detail,
  onClose,
  onLinksUpdated,
}: ArtifactLinkManagerModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("skills");

  // New Link inputs per tab
  const [skillIdInput, setSkillIdInput] = useState("");
  const [skillDemonstrationLevel, setSkillDemonstrationLevel] = useState<number>(3);

  const [knowledgeNodeIdInput, setKnowledgeNodeIdInput] = useState("");
  const [knowledgeRelationType, setKnowledgeRelationType] = useState<"cites" | "implements" | "synthesizes" | "evaluates">("synthesizes");

  const [questIdInput, setQuestIdInput] = useState("");
  const [questIsPrimary, setQuestIsPrimary] = useState(false);

  const [activityIdInput, setActivityIdInput] = useState("");
  const [activityRole, setActivityRole] = useState<"produced" | "referenced" | "modified">("produced");

  const [evidenceIdInput, setEvidenceIdInput] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!detail) return null;
  const { artifact, links } = detail;

  const handleDetach = async (category: TabType, id: string) => {
    setSubmitting(true);
    setErrorMessage(null);

    const payload: ManageArtifactLinksInput = {};

    switch (category) {
      case "skills":
        payload.skills = [{ skillId: id, action: "detach" }];
        break;
      case "knowledge":
        payload.knowledgeNodes = [{ nodeId: id, action: "detach" }];
        break;
      case "quests":
        payload.quests = [{ questId: id, action: "detach" }];
        break;
      case "activities":
        payload.activities = [{ activityId: id, action: "detach" }];
        break;
      case "evidence":
        payload.evidence = [{ evidenceId: id, action: "detach" }];
        break;
    }

    try {
      const res = await fetch(`/api/artifacts/${artifact.id}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setErrorMessage(errData.error || `解绑关联失败 (${res.status})`);
        return;
      }

      await onLinksUpdated();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "解绑请求失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAttachSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = skillIdInput.trim();
    if (!id) return;

    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/artifacts/${artifact.id}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skills: [
            {
              skillId: id,
              action: "attach",
              demonstrationLevel: Number(skillDemonstrationLevel),
            },
          ],
        }),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setErrorMessage(errData.error || `关联技能失败 (${res.status})`);
        return;
      }

      setSkillIdInput("");
      await onLinksUpdated();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "关联技能失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAttachKnowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = knowledgeNodeIdInput.trim();
    if (!id) return;

    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/artifacts/${artifact.id}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          knowledgeNodes: [
            {
              nodeId: id,
              action: "attach",
              relationType: knowledgeRelationType,
            },
          ],
        }),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setErrorMessage(errData.error || `关联知识节点失败 (${res.status})`);
        return;
      }

      setKnowledgeNodeIdInput("");
      await onLinksUpdated();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "关联知识节点失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAttachQuest = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = questIdInput.trim();
    if (!id) return;

    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/artifacts/${artifact.id}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quests: [
            {
              questId: id,
              action: "attach",
              isPrimaryDeliverable: questIsPrimary,
            },
          ],
        }),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setErrorMessage(errData.error || `关联任务失败 (${res.status})`);
        return;
      }

      setQuestIdInput("");
      await onLinksUpdated();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "关联任务失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAttachActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = activityIdInput.trim();
    if (!id) return;

    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/artifacts/${artifact.id}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activities: [
            {
              activityId: id,
              action: "attach",
              activityRole,
            },
          ],
        }),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setErrorMessage(errData.error || `关联活动失败 (${res.status})`);
        return;
      }

      setActivityIdInput("");
      await onLinksUpdated();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "关联活动失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAttachEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = evidenceIdInput.trim();
    if (!id) return;

    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/artifacts/${artifact.id}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evidence: [
            {
              evidenceId: id,
              action: "attach",
            },
          ],
        }),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setErrorMessage(errData.error || `关联实证失败 (${res.status})`);
        return;
      }

      setEvidenceIdInput("");
      await onLinksUpdated();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "关联实证失败");
    } finally {
      setSubmitting(false);
    }
  };

  const tabs: Array<{ id: TabType; label: string; icon: React.ReactNode; count: number }> = [
    {
      id: "skills",
      label: "技能",
      icon: <Sparkles className="w-3.5 h-3.5" />,
      count: links.skills?.length || 0,
    },
    {
      id: "knowledge",
      label: "知识节点",
      icon: <Network className="w-3.5 h-3.5" />,
      count: links.knowledgeNodes?.length || 0,
    },
    {
      id: "quests",
      label: "任务",
      icon: <Scroll className="w-3.5 h-3.5" />,
      count: links.quests?.length || 0,
    },
    {
      id: "activities",
      label: "活动",
      icon: <Zap className="w-3.5 h-3.5" />,
      count: links.activities?.length || 0,
    },
    {
      id: "evidence",
      label: "实证",
      icon: <ShieldCheck className="w-3.5 h-3.5" />,
      count: links.evidence?.length || 0,
    },
  ];

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title={`管理造物关联拓扑: ${artifact.title}`}
      footer={
        <SecondaryButton type="button" onClick={onClose} data-testid="link-manager-close">
          完成并关闭
        </SecondaryButton>
      }
    >
      <div data-testid="artifact-link-manager-modal" className="space-y-4 text-left">
        {errorMessage && (
          <div
            data-testid="link-manager-error"
            className="flex items-start gap-2 p-3 rounded-[var(--radius-md)] bg-[var(--state-danger-bg)] border border-[var(--state-danger-border)] text-[var(--state-danger-text)] text-xs leading-relaxed"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 1. Category Tab Selection */}
        <div className="flex items-center gap-1 border-b border-[var(--border-subtle)] pb-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setErrorMessage(null);
              }}
              data-testid={`link-tab-${tab.id}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-[var(--font-weight-medium)] transition-colors cursor-pointer shrink-0 ${
                activeTab === tab.id
                  ? "bg-[var(--surface-raised)] text-[var(--selection-neutral-text)] border border-[var(--border-raised)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover-neutral)]"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-[var(--surface-ground)]">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* 2. Tab Content Panel */}
        <div className="space-y-4">
          {/* TAB: Skills */}
          {activeTab === "skills" && (
            <div className="space-y-3">
              <form onSubmit={handleAttachSkill} className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  value={skillIdInput}
                  onChange={(e) => setSkillIdInput(e.target.value)}
                  placeholder="输入技能 UUID (skillId)"
                  data-testid="link-skill-id-input"
                  className="flex-1 min-w-[200px] px-3 py-1.5 text-xs rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] font-mono text-[var(--text-primary)] focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]"
                />
                <select
                  value={skillDemonstrationLevel}
                  onChange={(e) => setSkillDemonstrationLevel(Number(e.target.value))}
                  data-testid="link-skill-demo-level-select"
                  className="px-3 py-1.5 text-xs rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] text-[var(--text-primary)] cursor-pointer"
                >
                  <option value={1}>示范等级 1/5</option>
                  <option value={2}>示范等级 2/5</option>
                  <option value={3}>示范等级 3/5</option>
                  <option value={4}>示范等级 4/5</option>
                  <option value={5}>示范等级 5/5</option>
                </select>
                <PrimaryButton
                  type="submit"
                  disabled={submitting || !skillIdInput.trim()}
                  loading={submitting}
                  size="sm"
                  data-testid="link-skill-submit"
                >
                  关联技能
                </PrimaryButton>
              </form>

              <div className="space-y-2">
                <h5 className="text-xs font-[var(--font-weight-semibold)] text-[var(--text-secondary)]">已关联技能列表</h5>
                {links.skills && links.skills.length > 0 ? (
                  links.skills.map((s) => (
                    <div
                      key={s.id}
                      data-testid={`manage-linked-skill-${s.id}`}
                      className="flex items-center justify-between p-2.5 rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-subtle)] text-xs"
                    >
                      <div>
                        <div className="font-[var(--font-weight-medium)] text-[var(--text-primary)]">{s.name}</div>
                        <div className="text-[11px] text-[var(--text-muted)] font-mono">
                          ID: {s.id} · 示范等级: {s.demonstrationLevel}/5
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDetach("skills", s.id)}
                        disabled={submitting}
                        data-testid={`detach-skill-${s.id}`}
                        className="text-[var(--state-danger-text)] hover:opacity-80 p-1 rounded-[var(--radius-sm)] cursor-pointer"
                        title="解除关联"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-[var(--text-disabled)] italic py-2">暂无关联技能</div>
                )}
              </div>
            </div>
          )}

          {/* TAB: Knowledge Nodes */}
          {activeTab === "knowledge" && (
            <div className="space-y-3">
              <form onSubmit={handleAttachKnowledge} className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  value={knowledgeNodeIdInput}
                  onChange={(e) => setKnowledgeNodeIdInput(e.target.value)}
                  placeholder="输入知识节点 UUID (nodeId)"
                  data-testid="link-knowledge-id-input"
                  className="flex-1 min-w-[200px] px-3 py-1.5 text-xs rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] font-mono text-[var(--text-primary)] focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]"
                />
                <select
                  value={knowledgeRelationType}
                  onChange={(e) =>
                    setKnowledgeRelationType(
                      e.target.value as
                        | "cites"
                        | "implements"
                        | "synthesizes"
                        | "evaluates"
                    )
                  }
                  data-testid="link-knowledge-relation-select"
                  className="px-3 py-1.5 text-xs rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] text-[var(--text-primary)] cursor-pointer"
                >
                  <option value="synthesizes">synthesizes (综合)</option>
                  <option value="implements">implements (实现)</option>
                  <option value="cites">cites (引用)</option>
                  <option value="evaluates">evaluates (评估)</option>
                </select>
                <PrimaryButton
                  type="submit"
                  disabled={submitting || !knowledgeNodeIdInput.trim()}
                  loading={submitting}
                  size="sm"
                  data-testid="link-knowledge-submit"
                >
                  关联知识
                </PrimaryButton>
              </form>

              <div className="space-y-2">
                <h5 className="text-xs font-[var(--font-weight-semibold)] text-[var(--text-secondary)]">已关联知识节点列表</h5>
                {links.knowledgeNodes && links.knowledgeNodes.length > 0 ? (
                  links.knowledgeNodes.map((kn) => (
                    <div
                      key={kn.id}
                      data-testid={`manage-linked-knowledge-${kn.id}`}
                      className="flex items-center justify-between p-2.5 rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-subtle)] text-xs"
                    >
                      <div>
                        <div className="font-[var(--font-weight-medium)] text-[var(--text-primary)]">{kn.title}</div>
                        <div className="text-[11px] text-[var(--text-muted)] font-mono">
                          ID: {kn.id} · 关系: {kn.relationType} · 状态: {kn.verificationStatus}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDetach("knowledge", kn.id)}
                        disabled={submitting}
                        data-testid={`detach-knowledge-${kn.id}`}
                        className="text-[var(--state-danger-text)] hover:opacity-80 p-1 rounded-[var(--radius-sm)] cursor-pointer"
                        title="解除关联"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-[var(--text-disabled)] italic py-2">暂无知识关联</div>
                )}
              </div>
            </div>
          )}

          {/* TAB: Quests */}
          {activeTab === "quests" && (
            <div className="space-y-3">
              <form onSubmit={handleAttachQuest} className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  value={questIdInput}
                  onChange={(e) => setQuestIdInput(e.target.value)}
                  placeholder="输入任务 UUID (questId)"
                  data-testid="link-quest-id-input"
                  className="flex-1 min-w-[200px] px-3 py-1.5 text-xs rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] font-mono text-[var(--text-primary)] focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]"
                />
                <label className="flex items-center gap-1.5 text-xs text-[var(--text-primary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={questIsPrimary}
                    onChange={(e) => setQuestIsPrimary(e.target.checked)}
                    data-testid="link-quest-is-primary-checkbox"
                    className="accent-[var(--gold-400)]"
                  />
                  <span>主交付物</span>
                </label>
                <PrimaryButton
                  type="submit"
                  disabled={submitting || !questIdInput.trim()}
                  loading={submitting}
                  size="sm"
                  data-testid="link-quest-submit"
                >
                  关联任务
                </PrimaryButton>
              </form>

              <div className="space-y-2">
                <h5 className="text-xs font-[var(--font-weight-semibold)] text-[var(--text-secondary)]">已关联任务列表</h5>
                {links.quests && links.quests.length > 0 ? (
                  links.quests.map((q) => (
                    <div
                      key={q.id}
                      data-testid={`manage-linked-quest-${q.id}`}
                      className="flex items-center justify-between p-2.5 rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-subtle)] text-xs"
                    >
                      <div>
                        <div className="font-[var(--font-weight-medium)] text-[var(--text-primary)]">{q.title}</div>
                        <div className="text-[11px] text-[var(--text-muted)] font-mono">
                          ID: {q.id} · {q.isPrimaryDeliverable ? "主交付物" : "普通关联"} · {q.status}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDetach("quests", q.id)}
                        disabled={submitting}
                        data-testid={`detach-quest-${q.id}`}
                        className="text-[var(--state-danger-text)] hover:opacity-80 p-1 rounded-[var(--radius-sm)] cursor-pointer"
                        title="解除关联"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-[var(--text-disabled)] italic py-2">暂无关联任务</div>
                )}
              </div>
            </div>
          )}

          {/* TAB: Activities */}
          {activeTab === "activities" && (
            <div className="space-y-3">
              <form onSubmit={handleAttachActivity} className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  value={activityIdInput}
                  onChange={(e) => setActivityIdInput(e.target.value)}
                  placeholder="输入活动 UUID (activityId)"
                  data-testid="link-activity-id-input"
                  className="flex-1 min-w-[200px] px-3 py-1.5 text-xs rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] font-mono text-[var(--text-primary)] focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]"
                />
                <select
                  value={activityRole}
                  onChange={(e) =>
                    setActivityRole(
                      e.target.value as "produced" | "modified" | "referenced"
                    )
                  }
                  data-testid="link-activity-role-select"
                  className="px-3 py-1.5 text-xs rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] text-[var(--text-primary)] cursor-pointer"
                >
                  <option value="produced">produced (产出)</option>
                  <option value="modified">modified (修改)</option>
                  <option value="referenced">referenced (引用)</option>
                </select>
                <PrimaryButton
                  type="submit"
                  disabled={submitting || !activityIdInput.trim()}
                  loading={submitting}
                  size="sm"
                  data-testid="link-activity-submit"
                >
                  关联活动
                </PrimaryButton>
              </form>

              <div className="space-y-2">
                <h5 className="text-xs font-[var(--font-weight-semibold)] text-[var(--text-secondary)]">已关联活动列表</h5>
                {links.activities && links.activities.length > 0 ? (
                  links.activities.map((a) => (
                    <div
                      key={a.id}
                      data-testid={`manage-linked-activity-${a.id}`}
                      className="flex items-center justify-between p-2.5 rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-subtle)] text-xs"
                    >
                      <div>
                        <div className="font-[var(--font-weight-medium)] text-[var(--text-primary)]">{a.title}</div>
                        <div className="text-[11px] text-[var(--text-muted)] font-mono">
                          ID: {a.id} · 角色: {a.activityRole}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDetach("activities", a.id)}
                        disabled={submitting}
                        data-testid={`detach-activity-${a.id}`}
                        className="text-[var(--state-danger-text)] hover:opacity-80 p-1 rounded-[var(--radius-sm)] cursor-pointer"
                        title="解除关联"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-[var(--text-disabled)] italic py-2">暂无产出活动</div>
                )}
              </div>
            </div>
          )}

          {/* TAB: Evidence */}
          {activeTab === "evidence" && (
            <div className="space-y-3">
              <form onSubmit={handleAttachEvidence} className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  value={evidenceIdInput}
                  onChange={(e) => setEvidenceIdInput(e.target.value)}
                  placeholder="输入实证记录 UUID (evidenceId)"
                  data-testid="link-evidence-id-input"
                  className="flex-1 min-w-[200px] px-3 py-1.5 text-xs rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] font-mono text-[var(--text-primary)] focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]"
                />
                <PrimaryButton
                  type="submit"
                  disabled={submitting || !evidenceIdInput.trim()}
                  loading={submitting}
                  size="sm"
                  data-testid="link-evidence-submit"
                >
                  关联实证
                </PrimaryButton>
              </form>

              <div className="space-y-2">
                <h5 className="text-xs font-[var(--font-weight-semibold)] text-[var(--text-secondary)]">已关联实证列表</h5>
                {links.evidence && links.evidence.length > 0 ? (
                  links.evidence.map((ev) => (
                    <div
                      key={ev.id}
                      data-testid={`manage-linked-evidence-${ev.id}`}
                      className="flex items-center justify-between p-2.5 rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-subtle)] text-xs"
                    >
                      <div>
                        <div className="font-[var(--font-weight-medium)] text-[var(--text-primary)]">
                          E{ev.evidenceLevel} · {ev.description || "实证凭据"}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] font-mono">ID: {ev.id}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDetach("evidence", ev.id)}
                        disabled={submitting}
                        data-testid={`detach-evidence-${ev.id}`}
                        className="text-[var(--state-danger-text)] hover:opacity-80 p-1 rounded-[var(--radius-sm)] cursor-pointer"
                        title="解除关联"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-[var(--text-disabled)] italic py-2">暂无实证凭据</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </BaseModal>
  );
}

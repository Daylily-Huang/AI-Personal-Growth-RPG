"use client";

import React, { useState, useEffect } from "react";
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
  Plus,
  Trash2,
  AlertCircle,
  Save,
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

type TabKey = "skills" | "knowledge" | "quests" | "activities" | "evidence";

interface StagedSkill {
  skillId: string;
  name: string;
  level: number;
  demonstrationLevel: number;
  isNew?: boolean;
}

interface StagedKnowledge {
  nodeId: string;
  title: string;
  nodeType: string;
  verificationStatus: string;
  relationType: "cites" | "implements" | "synthesizes" | "evaluates";
  isNew?: boolean;
}

interface StagedQuest {
  questId: string;
  title: string;
  status: string;
  isPrimaryDeliverable: boolean;
  isNew?: boolean;
}

interface StagedActivity {
  activityId: string;
  title: string;
  activityRole: "produced" | "modified" | "referenced";
  isNew?: boolean;
}

interface StagedEvidence {
  evidenceId: string;
  evidenceLevel: number;
  description: string;
  verified: boolean;
  isNew?: boolean;
}

function ArtifactLinkManagerModalInner({
  detail,
  onClose,
  onLinksUpdated,
}: {
  detail: ArtifactDetail;
  onClose: () => void;
  onLinksUpdated: () => Promise<void>;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("skills");

  // Staged Active Links (initialized directly from detail.links)
  const [stagedSkills, setStagedSkills] = useState<StagedSkill[]>(() =>
    detail.links.skills.map((s) => ({
      skillId: s.id,
      name: s.name,
      level: s.level,
      demonstrationLevel: s.demonstrationLevel,
    }))
  );
  const [stagedKnowledge, setStagedKnowledge] = useState<StagedKnowledge[]>(() =>
    detail.links.knowledgeNodes.map((k) => ({
      nodeId: k.id,
      title: k.title,
      nodeType: k.nodeType,
      verificationStatus: k.verificationStatus,
      relationType: (k.relationType as "cites" | "implements" | "synthesizes" | "evaluates") || "synthesizes",
    }))
  );
  const [stagedQuests, setStagedQuests] = useState<StagedQuest[]>(() =>
    detail.links.quests.map((q) => ({
      questId: q.id,
      title: q.title,
      status: q.status,
      isPrimaryDeliverable: q.isPrimaryDeliverable,
    }))
  );
  const [stagedActivities, setStagedActivities] = useState<StagedActivity[]>(() =>
    detail.links.activities.map((a) => ({
      activityId: a.id,
      title: a.title,
      activityRole: a.activityRole,
    }))
  );
  const [stagedEvidence, setStagedEvidence] = useState<StagedEvidence[]>(() =>
    detail.links.evidence.map((e) => ({
      evidenceId: e.id,
      evidenceLevel: e.evidenceLevel,
      description: e.description,
      verified: e.verified,
    }))
  );

  // Detached original IDs tracking
  const [detachedSkillIds, setDetachedSkillIds] = useState<string[]>([]);
  const [detachedKnowledgeIds, setDetachedKnowledgeIds] = useState<string[]>([]);
  const [detachedQuestIds, setDetachedQuestIds] = useState<string[]>([]);
  const [detachedActivityIds, setDetachedActivityIds] = useState<string[]>([]);
  const [detachedEvidenceIds, setDetachedEvidenceIds] = useState<string[]>([]);

  // Available options loaded from read APIs
  const [availableSkills, setAvailableSkills] = useState<Array<{ id: string; name: string; level: number }>>([]);
  const [availableKnowledge, setAvailableKnowledge] = useState<Array<{ id: string; title: string; nodeType: string }>>([]);
  const [availableQuests, setAvailableQuests] = useState<Array<{ id: string; title: string }>>([]);
  const [availableActivities, setAvailableActivities] = useState<Array<{ id: string; title: string }>>([]);

  // Form Inputs for Adding Links
  const [skillIdInput, setSkillIdInput] = useState("");
  const [skillDemoLevel, setSkillDemoLevel] = useState(3);

  const [knowledgeNodeIdInput, setKnowledgeNodeIdInput] = useState("");
  const [knowledgeRelationType, setKnowledgeRelationType] = useState<
    "cites" | "implements" | "synthesizes" | "evaluates"
  >("synthesizes");

  const [questIdInput, setQuestIdInput] = useState("");
  const [isPrimaryDeliverable, setIsPrimaryDeliverable] = useState(false);

  const [activityIdInput, setActivityIdInput] = useState("");
  const [activityRole, setActivityRole] = useState<"produced" | "modified" | "referenced">("produced");

  const [evidenceIdInput, setEvidenceIdInput] = useState("");
  const [evidenceLevelInput, setEvidenceLevelInput] = useState(3);
  const [evidenceDescInput, setEvidenceDescInput] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load available entities from read APIs
  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((data: { nodes?: Array<{ id: string; name?: string; title?: string; level?: number }> }) => {
        if (data.nodes) {
          setAvailableSkills(
            data.nodes.map((n) => ({
              id: n.id,
              name: n.name || n.title || n.id,
              level: n.level ?? 1,
            }))
          );
        }
      })
      .catch(() => {});

    fetch("/api/knowledge")
      .then((r) => r.json())
      .then((data: { nodes?: Array<{ id: string; title?: string; node_type?: string }> }) => {
        if (data.nodes) {
          setAvailableKnowledge(
            data.nodes.map((n) => ({
              id: n.id,
              title: n.title || n.id,
              nodeType: n.node_type || "concept",
            }))
          );
        }
      })
      .catch(() => {});

    fetch("/api/quests")
      .then((r) => r.json())
      .then((data: { quests?: Array<{ id: string; title?: string }> }) => {
        if (data.quests) {
          setAvailableQuests(
            data.quests.map((q) => ({
              id: q.id,
              title: q.title || q.id,
            }))
          );
        }
      })
      .catch(() => {});

    fetch("/api/activities")
      .then((r) => r.json())
      .then((data: { activities?: Array<{ id: string; title?: string; raw_input?: string }> }) => {
        if (data.activities) {
          setAvailableActivities(
            data.activities.map((a) => ({
              id: a.id,
              title: a.title || a.raw_input || a.id,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  const { artifact } = detail;

  // Staged Handlers (Pure Local In-Memory Mutations)
  const handleStageSkill = (e: React.FormEvent) => {
    e.preventDefault();
    const id = skillIdInput.trim();
    if (!id) return;
    if (stagedSkills.some((s) => s.skillId === id)) {
      setErrorMessage("该技能已在关联列表中");
      return;
    }
    const found = availableSkills.find((s) => s.id === id);
    setStagedSkills((prev) => [
      ...prev,
      {
        skillId: id,
        name: found ? found.name : `Skill (${id.slice(0, 8)})`,
        level: found ? found.level : 1,
        demonstrationLevel: Number(skillDemoLevel),
        isNew: true,
      },
    ]);
    setDetachedSkillIds((prev) => prev.filter((x) => x !== id));
    setSkillIdInput("");
    setErrorMessage(null);
  };

  const handleDetachSkill = (skillId: string) => {
    const item = stagedSkills.find((s) => s.skillId === skillId);
    setStagedSkills((prev) => prev.filter((s) => s.skillId !== skillId));
    if (item && !item.isNew) {
      setDetachedSkillIds((prev) => [...prev, skillId]);
    }
  };

  const handleStageKnowledge = (e: React.FormEvent) => {
    e.preventDefault();
    const id = knowledgeNodeIdInput.trim();
    if (!id) return;
    if (stagedKnowledge.some((k) => k.nodeId === id)) {
      setErrorMessage("该知识节点已在关联列表中");
      return;
    }
    const found = availableKnowledge.find((k) => k.id === id);
    setStagedKnowledge((prev) => [
      ...prev,
      {
        nodeId: id,
        title: found ? found.title : `Knowledge (${id.slice(0, 8)})`,
        nodeType: found ? found.nodeType : "concept",
        verificationStatus: "verified",
        relationType: knowledgeRelationType,
        isNew: true,
      },
    ]);
    setDetachedKnowledgeIds((prev) => prev.filter((x) => x !== id));
    setKnowledgeNodeIdInput("");
    setErrorMessage(null);
  };

  const handleDetachKnowledge = (nodeId: string) => {
    const item = stagedKnowledge.find((k) => k.nodeId === nodeId);
    setStagedKnowledge((prev) => prev.filter((k) => k.nodeId !== nodeId));
    if (item && !item.isNew) {
      setDetachedKnowledgeIds((prev) => [...prev, nodeId]);
    }
  };

  const handleStageQuest = (e: React.FormEvent) => {
    e.preventDefault();
    const id = questIdInput.trim();
    if (!id) return;
    if (stagedQuests.some((q) => q.questId === id)) {
      setErrorMessage("该任务已在关联列表中");
      return;
    }
    const found = availableQuests.find((q) => q.id === id);
    setStagedQuests((prev) => [
      ...prev,
      {
        questId: id,
        title: found ? found.title : `Quest (${id.slice(0, 8)})`,
        status: "active",
        isPrimaryDeliverable,
        isNew: true,
      },
    ]);
    setDetachedQuestIds((prev) => prev.filter((x) => x !== id));
    setQuestIdInput("");
    setErrorMessage(null);
  };

  const handleDetachQuest = (questId: string) => {
    const item = stagedQuests.find((q) => q.questId === questId);
    setStagedQuests((prev) => prev.filter((q) => q.questId !== questId));
    if (item && !item.isNew) {
      setDetachedQuestIds((prev) => [...prev, questId]);
    }
  };

  const handleStageActivity = (e: React.FormEvent) => {
    e.preventDefault();
    const id = activityIdInput.trim();
    if (!id) return;
    if (stagedActivities.some((a) => a.activityId === id)) {
      setErrorMessage("该活动已在关联列表中");
      return;
    }
    const found = availableActivities.find((a) => a.id === id);
    setStagedActivities((prev) => [
      ...prev,
      {
        activityId: id,
        title: found ? found.title : `Activity (${id.slice(0, 8)})`,
        activityRole,
        isNew: true,
      },
    ]);
    setDetachedActivityIds((prev) => prev.filter((x) => x !== id));
    setActivityIdInput("");
    setErrorMessage(null);
  };

  const handleDetachActivity = (activityId: string) => {
    const item = stagedActivities.find((a) => a.activityId === activityId);
    setStagedActivities((prev) => prev.filter((a) => a.activityId !== activityId));
    if (item && !item.isNew) {
      setDetachedActivityIds((prev) => [...prev, activityId]);
    }
  };

  const handleStageEvidence = (e: React.FormEvent) => {
    e.preventDefault();
    const id = evidenceIdInput.trim();
    if (!id) return;
    if (stagedEvidence.some((ev) => ev.evidenceId === id)) {
      setErrorMessage("该实证已在关联列表中");
      return;
    }
    setStagedEvidence((prev) => [
      ...prev,
      {
        evidenceId: id,
        evidenceLevel: Number(evidenceLevelInput),
        description: evidenceDescInput.trim() || `Evidence (${id.slice(0, 8)})`,
        verified: true,
        isNew: true,
      },
    ]);
    setDetachedEvidenceIds((prev) => prev.filter((x) => x !== id));
    setEvidenceIdInput("");
    setEvidenceDescInput("");
    setErrorMessage(null);
  };

  const handleDetachEvidence = (evidenceId: string) => {
    const item = stagedEvidence.find((ev) => ev.evidenceId === evidenceId);
    setStagedEvidence((prev) => prev.filter((ev) => ev.evidenceId !== evidenceId));
    if (item && !item.isNew) {
      setDetachedEvidenceIds((prev) => [...prev, evidenceId]);
    }
  };

  // Batch Save Single Request
  const handleBatchSave = async () => {
    setSubmitting(true);
    setErrorMessage(null);

    const payload: ManageArtifactLinksInput = {};

    // Skills
    const skillOps: Array<{ skillId: string; action: "attach" | "detach"; demonstrationLevel?: number }> = [];
    stagedSkills.filter((s) => s.isNew).forEach((s) => {
      skillOps.push({ skillId: s.skillId, action: "attach", demonstrationLevel: s.demonstrationLevel });
    });
    detachedSkillIds.forEach((id) => {
      skillOps.push({ skillId: id, action: "detach" });
    });
    if (skillOps.length > 0) payload.skills = skillOps;

    // Knowledge
    const knOps: Array<{ nodeId: string; action: "attach" | "detach"; relationType?: "cites" | "implements" | "synthesizes" | "evaluates" }> = [];
    stagedKnowledge.filter((k) => k.isNew).forEach((k) => {
      knOps.push({ nodeId: k.nodeId, action: "attach", relationType: k.relationType });
    });
    detachedKnowledgeIds.forEach((id) => {
      knOps.push({ nodeId: id, action: "detach" });
    });
    if (knOps.length > 0) payload.knowledgeNodes = knOps;

    // Quests
    const questOps: Array<{ questId: string; action: "attach" | "detach"; isPrimaryDeliverable?: boolean }> = [];
    stagedQuests.filter((q) => q.isNew).forEach((q) => {
      questOps.push({ questId: q.questId, action: "attach", isPrimaryDeliverable: q.isPrimaryDeliverable });
    });
    detachedQuestIds.forEach((id) => {
      questOps.push({ questId: id, action: "detach" });
    });
    if (questOps.length > 0) payload.quests = questOps;

    // Activities
    const actOps: Array<{ activityId: string; action: "attach" | "detach"; activityRole?: "produced" | "modified" | "referenced" }> = [];
    stagedActivities.filter((a) => a.isNew).forEach((a) => {
      actOps.push({ activityId: a.activityId, action: "attach", activityRole: a.activityRole });
    });
    detachedActivityIds.forEach((id) => {
      actOps.push({ activityId: id, action: "detach" });
    });
    if (actOps.length > 0) payload.activities = actOps;

    // Evidence
    const evOps: Array<{ evidenceId: string; action: "attach" | "detach" }> = [];
    stagedEvidence.filter((e) => e.isNew).forEach((e) => {
      evOps.push({ evidenceId: e.evidenceId, action: "attach" });
    });
    detachedEvidenceIds.forEach((id) => {
      evOps.push({ evidenceId: id, action: "detach" });
    });
    if (evOps.length > 0) payload.evidence = evOps;

    const hasOps = Object.keys(payload).length > 0;
    if (!hasOps) {
      onClose();
      setSubmitting(false);
      return;
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
        const errData = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMessage(errData.error || `保存拓扑关系失败 (${res.status})`);
        return;
      }

      await onLinksUpdated();
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "网络错误，保存失败");
    } finally {
      setSubmitting(false);
    }
  };

  const footer = (
    <>
      <SecondaryButton
        type="button"
        onClick={onClose}
        disabled={submitting}
        data-testid="link-manager-cancel"
      >
        取消 (丢弃修改)
      </SecondaryButton>
      <PrimaryButton
        type="button"
        onClick={handleBatchSave}
        loading={submitting}
        disabled={submitting}
        icon={<Save className="w-4 h-4" />}
        data-testid="link-manager-submit"
      >
        保存全部关联变动 (Batch Save)
      </PrimaryButton>
    </>
  );

  return (
    <BaseModal
      open={true}
      onClose={() => !submitting && onClose()}
      title={`管理造物关联拓扑: ${artifact.title}`}
      footer={footer}
    >
      <div className="space-y-4 text-left">
        {errorMessage && (
          <div
            data-testid="link-manager-error"
            className="flex items-start gap-2 p-3 rounded-[var(--radius-md)] bg-[var(--state-danger-bg)] border border-[var(--state-danger-border)] text-[var(--state-danger-text)] text-xs"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 5-Tab Navigation Header */}
        <div
          role="tablist"
          aria-label="关联关系分类"
          className="flex items-center gap-1 p-1 rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-subtle)] overflow-x-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "skills"}
            onClick={() => setActiveTab("skills")}
            data-testid="link-tab-skills"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-[var(--font-weight-medium)] transition-colors shrink-0 cursor-pointer min-h-[var(--touch-target-min)] ${
              activeTab === "skills"
                ? "bg-[var(--surface-base)] text-[var(--entity-skill-text)] shadow-sm font-[var(--font-weight-semibold)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>技能谱 ({stagedSkills.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "knowledge"}
            onClick={() => setActiveTab("knowledge")}
            data-testid="link-tab-knowledge"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-[var(--font-weight-medium)] transition-colors shrink-0 cursor-pointer min-h-[var(--touch-target-min)] ${
              activeTab === "knowledge"
                ? "bg-[var(--surface-base)] text-[var(--entity-knowledge-text)] shadow-sm font-[var(--font-weight-semibold)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>知识图 ({stagedKnowledge.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "quests"}
            onClick={() => setActiveTab("quests")}
            data-testid="link-tab-quests"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-[var(--font-weight-medium)] transition-colors shrink-0 cursor-pointer min-h-[var(--touch-target-min)] ${
              activeTab === "quests"
                ? "bg-[var(--surface-base)] text-[var(--entity-quest-text)] shadow-sm font-[var(--font-weight-semibold)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Scroll className="w-3.5 h-3.5" />
            <span>任务志 ({stagedQuests.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "activities"}
            onClick={() => setActiveTab("activities")}
            data-testid="link-tab-activities"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-[var(--font-weight-medium)] transition-colors shrink-0 cursor-pointer min-h-[var(--touch-target-min)] ${
              activeTab === "activities"
                ? "bg-[var(--surface-base)] text-[var(--entity-activity-text)] shadow-sm font-[var(--font-weight-semibold)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>活动记录 ({stagedActivities.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "evidence"}
            onClick={() => setActiveTab("evidence")}
            data-testid="link-tab-evidence"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-[var(--font-weight-medium)] transition-colors shrink-0 cursor-pointer min-h-[var(--touch-target-min)] ${
              activeTab === "evidence"
                ? "bg-[var(--surface-base)] text-[var(--authority-verified-text)] shadow-sm font-[var(--font-weight-semibold)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>实证记录 ({stagedEvidence.length})</span>
          </button>
        </div>

        {/* Tab 1: Skills */}
        {activeTab === "skills" && (
          <div role="tabpanel" className="space-y-4">
            <form onSubmit={handleStageSkill} className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-base)] border border-[var(--border-subtle)] space-y-3">
              <div className="text-xs font-[var(--font-weight-semibold)] text-[var(--text-primary)]">
                添加技能关联 (Attach Skill)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <select
                    value={skillIdInput}
                    onChange={(e) => setSkillIdInput(e.target.value)}
                    data-testid="link-skill-select"
                    className="w-full px-3 py-1.5 text-xs rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] text-[var(--text-primary)] cursor-pointer"
                  >
                    <option value="">-- 选择已有技能 --</option>
                    {availableSkills.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (Lv.{s.level})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    value={skillDemoLevel}
                    onChange={(e) => setSkillDemoLevel(Number(e.target.value))}
                    data-testid="link-skill-demo-level-select"
                    className="w-full px-3 py-1.5 text-xs rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] text-[var(--text-primary)] cursor-pointer"
                  >
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <option key={lvl} value={lvl}>
                        示范等级 {lvl}/5
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={skillIdInput}
                  onChange={(e) => setSkillIdInput(e.target.value)}
                  placeholder="或直接输入/粘贴技能 UUID (skillId)"
                  data-testid="link-skill-id-input"
                  className="flex-1 px-3 py-1.5 text-xs rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] font-mono text-[var(--text-primary)]"
                />
                <PrimaryButton
                  type="submit"
                  disabled={!skillIdInput.trim()}
                  icon={<Plus className="w-3.5 h-3.5" />}
                  data-testid="link-skill-submit"
                >
                  暂存关联
                </PrimaryButton>
              </div>
            </form>

            <div className="space-y-2">
              <div className="text-xs font-[var(--font-weight-medium)] text-[var(--text-secondary)]">
                当前暂存技能关联 ({stagedSkills.length} 项):
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {stagedSkills.map((skill) => (
                  <div
                    key={skill.skillId}
                    className="flex items-center justify-between p-2.5 rounded-[var(--radius-sm)] bg-[var(--surface-ground)] border border-[var(--border-subtle)] text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-[var(--font-weight-medium)] text-[var(--text-primary)]">{skill.name}</span>
                      <span className="px-2 py-0.5 rounded-[var(--radius-sm)] text-xs font-mono text-[var(--entity-skill-text)] bg-[var(--entity-skill-bg)]">
                        示范 {skill.demonstrationLevel}/5
                      </span>
                      {skill.isNew && (
                        <span className="px-1.5 py-0.5 rounded-[var(--radius-sm)] text-xs text-[var(--state-success-text)] bg-[var(--state-success-bg)]">
                          待保存添加
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDetachSkill(skill.skillId)}
                      data-testid={`detach-skill-${skill.skillId}`}
                      aria-label={`移除技能 ${skill.name}`}
                      className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--state-danger-text)] hover:bg-[var(--state-danger-bg)] transition-colors min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Knowledge */}
        {activeTab === "knowledge" && (
          <div role="tabpanel" className="space-y-4">
            <form onSubmit={handleStageKnowledge} className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-base)] border border-[var(--border-subtle)] space-y-3">
              <div className="text-xs font-[var(--font-weight-semibold)] text-[var(--text-primary)]">
                添加知识节点关联 (Attach Knowledge Node)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <select
                    value={knowledgeNodeIdInput}
                    onChange={(e) => setKnowledgeNodeIdInput(e.target.value)}
                    data-testid="link-knowledge-select"
                    className="w-full px-3 py-1.5 text-xs rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] text-[var(--text-primary)] cursor-pointer"
                  >
                    <option value="">-- 选择已有知识节点 --</option>
                    {availableKnowledge.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.title} ({k.nodeType})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    value={knowledgeRelationType}
                    onChange={(e) =>
                      setKnowledgeRelationType(
                        e.target.value as "cites" | "implements" | "synthesizes" | "evaluates"
                      )
                    }
                    data-testid="link-knowledge-relation-select"
                    className="w-full px-3 py-1.5 text-xs rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] text-[var(--text-primary)] cursor-pointer"
                  >
                    <option value="synthesizes">synthesizes (综合)</option>
                    <option value="implements">implements (实现)</option>
                    <option value="cites">cites (引用)</option>
                    <option value="evaluates">evaluates (评估)</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={knowledgeNodeIdInput}
                  onChange={(e) => setKnowledgeNodeIdInput(e.target.value)}
                  placeholder="或直接输入/粘贴节点 UUID (nodeId)"
                  data-testid="link-knowledge-id-input"
                  className="flex-1 px-3 py-1.5 text-xs rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] font-mono text-[var(--text-primary)]"
                />
                <PrimaryButton
                  type="submit"
                  disabled={!knowledgeNodeIdInput.trim()}
                  icon={<Plus className="w-3.5 h-3.5" />}
                  data-testid="link-knowledge-submit"
                >
                  暂存关联
                </PrimaryButton>
              </div>
            </form>

            <div className="space-y-2">
              <div className="text-xs font-[var(--font-weight-medium)] text-[var(--text-secondary)]">
                当前暂存知识节点关联 ({stagedKnowledge.length} 项):
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {stagedKnowledge.map((node) => (
                  <div
                    key={node.nodeId}
                    className="flex items-center justify-between p-2.5 rounded-[var(--radius-sm)] bg-[var(--surface-ground)] border border-[var(--border-subtle)] text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-[var(--font-weight-medium)] text-[var(--text-primary)]">{node.title}</span>
                      <span className="px-2 py-0.5 rounded-[var(--radius-sm)] text-xs font-mono text-[var(--text-muted)] bg-[var(--surface-hover-neutral)]">
                        {node.relationType}
                      </span>
                      {node.isNew && (
                        <span className="px-1.5 py-0.5 rounded-[var(--radius-sm)] text-xs text-[var(--state-success-text)] bg-[var(--state-success-bg)]">
                          待保存添加
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDetachKnowledge(node.nodeId)}
                      data-testid={`detach-knowledge-${node.nodeId}`}
                      aria-label={`移除知识节点 ${node.title}`}
                      className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--state-danger-text)] hover:bg-[var(--state-danger-bg)] transition-colors min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Quests */}
        {activeTab === "quests" && (
          <div role="tabpanel" className="space-y-4">
            <form onSubmit={handleStageQuest} className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-base)] border border-[var(--border-subtle)] space-y-3">
              <div className="text-xs font-[var(--font-weight-semibold)] text-[var(--text-primary)]">
                添加任务关联 (Attach Quest)
              </div>
              <select
                value={questIdInput}
                onChange={(e) => setQuestIdInput(e.target.value)}
                data-testid="link-quest-select"
                className="w-full px-3 py-1.5 text-xs rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] text-[var(--text-primary)] cursor-pointer"
              >
                <option value="">-- 选择已有任务 --</option>
                {availableQuests.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.title}
                  </option>
                ))}
              </select>
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPrimaryDeliverable}
                    onChange={(e) => setIsPrimaryDeliverable(e.target.checked)}
                    className="rounded accent-[var(--entity-artifact-text)]"
                  />
                  <span>设定为任务主交付物 (isPrimaryDeliverable)</span>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={questIdInput}
                  onChange={(e) => setQuestIdInput(e.target.value)}
                  placeholder="或直接输入任务 UUID (questId)"
                  data-testid="link-quest-id-input"
                  className="flex-1 px-3 py-1.5 text-xs rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] font-mono text-[var(--text-primary)]"
                />
                <PrimaryButton
                  type="submit"
                  disabled={!questIdInput.trim()}
                  icon={<Plus className="w-3.5 h-3.5" />}
                  data-testid="link-quest-submit"
                >
                  暂存关联
                </PrimaryButton>
              </div>
            </form>

            <div className="space-y-2">
              <div className="text-xs font-[var(--font-weight-medium)] text-[var(--text-secondary)]">
                当前暂存任务关联 ({stagedQuests.length} 项):
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {stagedQuests.map((quest) => (
                  <div
                    key={quest.questId}
                    className="flex items-center justify-between p-2.5 rounded-[var(--radius-sm)] bg-[var(--surface-ground)] border border-[var(--border-subtle)] text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-[var(--font-weight-medium)] text-[var(--text-primary)]">{quest.title}</span>
                      {quest.isPrimaryDeliverable && (
                        <span className="px-2 py-0.5 rounded-[var(--radius-sm)] text-xs font-mono text-[var(--entity-quest-text)] bg-[var(--entity-quest-bg)]">
                          主交付物
                        </span>
                      )}
                      {quest.isNew && (
                        <span className="px-1.5 py-0.5 rounded-[var(--radius-sm)] text-xs text-[var(--state-success-text)] bg-[var(--state-success-bg)]">
                          待保存添加
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDetachQuest(quest.questId)}
                      data-testid={`detach-quest-${quest.questId}`}
                      aria-label={`移除任务 ${quest.title}`}
                      className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--state-danger-text)] hover:bg-[var(--state-danger-bg)] transition-colors min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Activities */}
        {activeTab === "activities" && (
          <div role="tabpanel" className="space-y-4">
            <form onSubmit={handleStageActivity} className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-base)] border border-[var(--border-subtle)] space-y-3">
              <div className="text-xs font-[var(--font-weight-semibold)] text-[var(--text-primary)]">
                添加活动关联 (Attach Activity)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <select
                    value={activityIdInput}
                    onChange={(e) => setActivityIdInput(e.target.value)}
                    data-testid="link-activity-select"
                    className="w-full px-3 py-1.5 text-xs rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] text-[var(--text-primary)] cursor-pointer"
                  >
                    <option value="">-- 选择已有活动记录 --</option>
                    {availableActivities.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    value={activityRole}
                    onChange={(e) =>
                      setActivityRole(
                        e.target.value as "produced" | "modified" | "referenced"
                      )
                    }
                    data-testid="link-activity-role-select"
                    className="w-full px-3 py-1.5 text-xs rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] text-[var(--text-primary)] cursor-pointer"
                  >
                    <option value="produced">produced (产出)</option>
                    <option value="modified">modified (修改)</option>
                    <option value="referenced">referenced (引用)</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={activityIdInput}
                  onChange={(e) => setActivityIdInput(e.target.value)}
                  placeholder="或直接输入活动 UUID (activityId)"
                  data-testid="link-activity-id-input"
                  className="flex-1 px-3 py-1.5 text-xs rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] font-mono text-[var(--text-primary)]"
                />
                <PrimaryButton
                  type="submit"
                  disabled={!activityIdInput.trim()}
                  icon={<Plus className="w-3.5 h-3.5" />}
                  data-testid="link-activity-submit"
                >
                  暂存关联
                </PrimaryButton>
              </div>
            </form>

            <div className="space-y-2">
              <div className="text-xs font-[var(--font-weight-medium)] text-[var(--text-secondary)]">
                当前暂存活动关联 ({stagedActivities.length} 项):
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {stagedActivities.map((act) => (
                  <div
                    key={act.activityId}
                    className="flex items-center justify-between p-2.5 rounded-[var(--radius-sm)] bg-[var(--surface-ground)] border border-[var(--border-subtle)] text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-[var(--font-weight-medium)] text-[var(--text-primary)]">{act.title}</span>
                      <span className="px-2 py-0.5 rounded-[var(--radius-sm)] text-xs font-mono text-[var(--text-muted)] bg-[var(--surface-hover-neutral)]">
                        {act.activityRole}
                      </span>
                      {act.isNew && (
                        <span className="px-1.5 py-0.5 rounded-[var(--radius-sm)] text-xs text-[var(--state-success-text)] bg-[var(--state-success-bg)]">
                          待保存添加
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDetachActivity(act.activityId)}
                      data-testid={`detach-activity-${act.activityId}`}
                      aria-label={`移除活动 ${act.title}`}
                      className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--state-danger-text)] hover:bg-[var(--state-danger-bg)] transition-colors min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Evidence */}
        {activeTab === "evidence" && (
          <div role="tabpanel" className="space-y-4">
            <form onSubmit={handleStageEvidence} className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-base)] border border-[var(--border-subtle)] space-y-3">
              <div className="text-xs font-[var(--font-weight-semibold)] text-[var(--text-primary)]">
                添加实证关联 (Attach Evidence Record)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    value={evidenceIdInput}
                    onChange={(e) => setEvidenceIdInput(e.target.value)}
                    placeholder="输入实证记录 UUID (evidenceId)"
                    data-testid="link-evidence-id-input"
                    className="w-full px-3 py-1.5 text-xs rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] font-mono text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <select
                    value={evidenceLevelInput}
                    onChange={(e) => setEvidenceLevelInput(Number(e.target.value))}
                    data-testid="link-evidence-level-select"
                    className="w-full px-3 py-1.5 text-xs rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] text-[var(--text-primary)] cursor-pointer"
                  >
                    {[0, 1, 2, 3, 4, 5, 6].map((lvl) => (
                      <option key={lvl} value={lvl}>
                        实证等级 E{lvl}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={evidenceDescInput}
                  onChange={(e) => setEvidenceDescInput(e.target.value)}
                  placeholder="实证描述备注 (可选)"
                  className="flex-1 px-3 py-1.5 text-xs rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] text-[var(--text-primary)]"
                />
                <PrimaryButton
                  type="submit"
                  disabled={!evidenceIdInput.trim()}
                  icon={<Plus className="w-3.5 h-3.5" />}
                  data-testid="link-evidence-submit"
                >
                  暂存关联
                </PrimaryButton>
              </div>
            </form>

            <div className="space-y-2">
              <div className="text-xs font-[var(--font-weight-medium)] text-[var(--text-secondary)]">
                当前暂存实证关联 ({stagedEvidence.length} 项):
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {stagedEvidence.map((ev) => (
                  <div
                    key={ev.evidenceId}
                    className="flex items-center justify-between p-2.5 rounded-[var(--radius-sm)] bg-[var(--surface-ground)] border border-[var(--border-subtle)] text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-[var(--font-weight-medium)] text-[var(--text-primary)]">{ev.description}</span>
                      <span className="px-2 py-0.5 rounded-[var(--radius-sm)] text-xs font-mono text-[var(--authority-verified-text)] bg-[var(--authority-verified-bg)]">
                        E{ev.evidenceLevel}
                      </span>
                      {ev.isNew && (
                        <span className="px-1.5 py-0.5 rounded-[var(--radius-sm)] text-xs text-[var(--state-success-text)] bg-[var(--state-success-bg)]">
                          待保存添加
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDetachEvidence(ev.evidenceId)}
                      data-testid={`detach-evidence-${ev.evidenceId}`}
                      aria-label={`移除实证 ${ev.description}`}
                      className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--state-danger-text)] hover:bg-[var(--state-danger-bg)] transition-colors min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] flex items-center justify-center cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </BaseModal>
  );
}

export function ArtifactLinkManagerModal(props: ArtifactLinkManagerModalProps) {
  if (!props.open || !props.detail) return null;
  return (
    <ArtifactLinkManagerModalInner
      key={props.detail.artifact.id}
      detail={props.detail}
      onClose={props.onClose}
      onLinksUpdated={props.onLinksUpdated}
    />
  );
}

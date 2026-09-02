// @vitest-environment jsdom
// tests/stage7c-ui.test.tsx
// Phase 4 — Stage 7C Artifact UI & Proposal Resolution Comprehensive Test Suite

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { execSync } from "node:child_process";
import {
  ArtifactTypeBadge,
  ArtifactCard,
  ArtifactInspectorContent,
  ArtifactCreateModal,
  ArtifactEditModal,
  ArtifactLinkManagerModal,
  ArtifactProposalResolutionPicker,
  ARTIFACT_TYPE_LABELS,
} from "@/components/artifacts";
import ArtifactsPage from "@/app/artifacts/page";
import DashboardPage from "@/app/dashboard/page";
import type {
  ArtifactWithCounts,
  ArtifactDetail,
  ArtifactType,
  ArtifactProposal,
} from "@/types/artifact";
import type { DashboardSnapshot, Assessment } from "@/lib/store/types";

// Mock next/navigation
const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  usePathname: () => "/artifacts",
}));

const mockArtifactWithCounts: ArtifactWithCounts = {
  id: "art-1111-1111",
  userId: "user-test",
  title: "ReactFlow 架构设计规范 RFC",
  normalizedTitle: "reactflow 架构设计规范 rfc",
  artifactType: "design_spec",
  summary: "针对 Stage 6C 知识图谱画布的三列布局与 CAS 模态框技术架构。",
  description: "详细记录了节点扩展、缩放控制、力导向模拟以及与技能树联动的交互契约。",
  lifecycleStatus: "active",
  version: "1.2",
  storagePath: null,
  externalUrl: "https://github.com/Daylily-Huang/AI-Personal-Growth-RPG/pull/8",
  reusabilityScore: 0.9,
  metadata: { framework: "ReactFlow", pages: 12 },
  isArchived: false,
  archivedAt: null,
  createdAt: "2026-08-26T10:00:00Z",
  updatedAt: "2026-08-26T12:00:00Z",
  counts: {
    skills: 2,
    knowledgeNodes: 3,
    quests: 1,
    activities: 2,
    evidence: 1,
  },
};

const mockArtifactDetail: ArtifactDetail = {
  artifact: mockArtifactWithCounts,
  links: {
    skills: [
      {
        id: "skill-uuid-1",
        name: "前端工程化",
        level: 4,
        demonstrationLevel: 5,
      },
      {
        id: "skill-uuid-2",
        name: "交互设计",
        level: 2,
        demonstrationLevel: 3,
      },
    ],
    knowledgeNodes: [
      {
        id: "node-uuid-1",
        title: "React Flow State Architecture",
        nodeType: "concept",
        verificationStatus: "verified",
        relationType: "synthesizes",
      },
      {
        id: "node-uuid-2",
        title: "D3 Force Simulation",
        nodeType: "concept",
        verificationStatus: "verified",
        relationType: "implements",
      },
    ],
    quests: [
      {
        id: "quest-uuid-1",
        title: "交付知识图谱画布",
        status: "active",
        isPrimaryDeliverable: true,
      },
    ],
    activities: [
      {
        id: "act-uuid-1",
        title: "编写 ReactFlow 画布技术方案",
        activityRole: "produced",
        completedAt: "2026-08-26T10:00:00Z",
      },
    ],
    evidence: [
      {
        id: "ev-uuid-1",
        evidenceLevel: 4,
        description: "完整的架构设计文档与评审决议",
        verified: true,
      },
    ],
  },
};

describe("Stage 7C Artifact UI Test Suite", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // ==========================================
  // 1. ArtifactTypeBadge
  // ==========================================
  describe("ArtifactTypeBadge", () => {
    const types: ArtifactType[] = [
      "document",
      "code_repository",
      "design_spec",
      "data_analysis",
      "presentation",
      "synthesis_note",
      "creative_work",
      "other",
    ];

    types.forEach((type) => {
      it(`renders canonical type "${type}" with label "${ARTIFACT_TYPE_LABELS[type]}"`, () => {
        render(<ArtifactTypeBadge type={type} />);
        const badge = screen.getByTestId("artifact-type-badge");
        expect(badge).toBeDefined();
        expect(badge.getAttribute("data-artifact-type")).toBe(type);
        expect(badge.textContent).toContain(ARTIFACT_TYPE_LABELS[type]);
      });
    });
  });

  // ==========================================
  // 2. ArtifactCard
  // ==========================================
  describe("ArtifactCard", () => {
    it("renders title, version, summary, reusability score and relationship counts", () => {
      render(<ArtifactCard artifact={mockArtifactWithCounts} />);

      expect(screen.getByTestId("artifact-title").textContent).toContain("ReactFlow 架构设计规范 RFC");
      expect(screen.getByTestId("artifact-version").textContent).toContain("v1.2");
      expect(screen.getByTestId("artifact-summary-preview").textContent).toContain("针对 Stage 6C 知识图谱画布");
      expect(screen.getByTestId("artifact-relation-counts").textContent).toContain("2 技能");
      expect(screen.getByTestId("artifact-relation-counts").textContent).toContain("3 知识");
      expect(screen.getByTestId("artifact-relation-counts").textContent).toContain("1 任务");
      expect(screen.getByTestId("artifact-relation-counts").textContent).toContain("2 活动");
      expect(screen.getByTestId("artifact-relation-counts").textContent).toContain("1 实证");
    });

    it("triggers onClick on click and Enter/Space keyboard events", () => {
      const handleClick = vi.fn();
      render(<ArtifactCard artifact={mockArtifactWithCounts} onClick={handleClick} />);

      const card = screen.getByTestId(`artifact-card-${mockArtifactWithCounts.id}`);
      fireEvent.click(card);
      expect(handleClick).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(card, { key: "Enter" });
      expect(handleClick).toHaveBeenCalledTimes(2);

      fireEvent.keyDown(card, { key: " " });
      expect(handleClick).toHaveBeenCalledTimes(3);
    });

    it("reflects selected state via data-selected", () => {
      const { rerender } = render(<ArtifactCard artifact={mockArtifactWithCounts} selected={false} />);
      const card = screen.getByTestId(`artifact-card-${mockArtifactWithCounts.id}`);
      expect(card.getAttribute("data-selected")).toBeNull();

      rerender(<ArtifactCard artifact={mockArtifactWithCounts} selected={true} />);
      expect(card.getAttribute("data-selected")).toBe("true");
    });
  });

  // ==========================================
  // 3. ArtifactInspectorContent
  // ==========================================
  describe("ArtifactInspectorContent", () => {
    it("renders all metadata and formatted demonstrationLevel without confusing with Mastery M0-M10", () => {
      render(<ArtifactInspectorContent detail={mockArtifactDetail} />);

      expect(screen.getByTestId("inspector-artifact-title").textContent).toContain("ReactFlow 架构设计规范 RFC");
      expect(screen.getByTestId("inspector-artifact-version").textContent).toContain("v1.2");
      expect(screen.getByTestId("inspector-external-url").getAttribute("href")).toBe(mockArtifactWithCounts.externalUrl);
      expect(screen.getByTestId("inspector-artifact-summary").textContent).toContain("针对 Stage 6C 知识图谱画布");
      expect(screen.getByTestId("inspector-artifact-description").textContent).toContain("详细记录了节点扩展");

      // Invariant: demonstrationLevel 1..5 is displayed as "示范等级 X/5", NEVER M0-M10
      const demoLevels = screen.getAllByTestId("demonstration-level");
      expect(demoLevels[0].textContent).toContain("示范等级 5/5");
      expect(demoLevels[0].textContent).not.toContain("M5");
      expect(demoLevels[1].textContent).toContain("示范等级 3/5");
      expect(demoLevels[1].textContent).not.toContain("M3");

      // Primary deliverable on quest
      expect(screen.getByText("主交付物")).toBeDefined();

      // Activity role
      expect(screen.getByText("produced")).toBeDefined();

      // Evidence record
      expect(screen.getByText("E4")).toBeDefined();
    });

    it("toggles relational accordions on click", () => {
      render(<ArtifactInspectorContent detail={mockArtifactDetail} />);

      const skillsToggle = screen.getByTestId("accordion-skills-toggle");
      expect(screen.getByTestId("accordion-skills-content")).toBeDefined();

      fireEvent.click(skillsToggle);
      expect(screen.queryByTestId("accordion-skills-content")).toBeNull();

      fireEvent.click(skillsToggle);
      expect(screen.getByTestId("accordion-skills-content")).toBeDefined();
    });

    it("triggers edit and manage links callbacks", () => {
      const handleEdit = vi.fn();
      const handleManageLinks = vi.fn();
      render(
        <ArtifactInspectorContent
          detail={mockArtifactDetail}
          onEdit={handleEdit}
          onManageLinks={handleManageLinks}
        />
      );

      fireEvent.click(screen.getByTestId("inspector-edit-btn"));
      expect(handleEdit).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByTestId("inspector-manage-links-btn"));
      expect(handleManageLinks).toHaveBeenCalledTimes(1);
    });

    it("handles archive and restore status toggling", async () => {
      const handleStatusChange = vi.fn().mockResolvedValue(undefined);
      render(
        <ArtifactInspectorContent
          detail={mockArtifactDetail}
          onStatusChange={handleStatusChange}
        />
      );

      const archiveBtn = screen.getByTestId("inspector-archive-toggle-btn");
      expect(archiveBtn.textContent).toContain("归档造物");

      fireEvent.click(archiveBtn);
      expect(handleStatusChange).toHaveBeenCalledWith("archived", true);
    });

    it("handles delete with 409 referenced_by_provenance fail-closed error", async () => {
      const handleDelete = vi.fn().mockResolvedValue({
        ok: false,
        code: "referenced_by_provenance",
        error: "Cannot delete artifact referenced by knowledge provenance or evidence records.",
      });

      render(
        <ArtifactInspectorContent
          detail={mockArtifactDetail}
          onDelete={handleDelete}
        />
      );

      // Open delete dialog
      fireEvent.click(screen.getByTestId("inspector-delete-btn"));
      expect(screen.getByText("确认删除造物")).toBeDefined();

      // Confirm delete
      const confirmBtn = screen.getByRole("button", { name: "确认删除" });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(handleDelete).toHaveBeenCalledTimes(1);
        expect(screen.getByText("无法物理删除此造物")).toBeDefined();
        expect(screen.getByText(/建议使用/)).toBeDefined();
      });
    });
  });

  // ==========================================
  // 4. ArtifactCreateModal
  // ==========================================
  describe("ArtifactCreateModal", () => {
    it("validates required title and submits POST /api/artifacts successfully", async () => {
      const handleCreated = vi.fn();
      const handleClose = vi.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          artifact: {
            ...mockArtifactWithCounts,
            id: "new-art-uuid",
            title: "新系统白皮书",
          },
        }),
      });

      render(
        <ArtifactCreateModal
          open={true}
          onClose={handleClose}
          onCreated={handleCreated}
        />
      );

      // Fill in form
      const titleInput = screen.getByTestId("create-artifact-title");
      fireEvent.change(titleInput, { target: { value: "新系统白皮书" } });

      const summaryInput = screen.getByTestId("create-artifact-summary");
      fireEvent.change(summaryInput, { target: { value: "白皮书简述" } });

      const submitBtn = screen.getByTestId("create-artifact-submit");
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/artifacts",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining("新系统白皮书"),
          })
        );
        expect(handleCreated).toHaveBeenCalledWith(
          expect.objectContaining({ id: "new-art-uuid", title: "新系统白皮书" })
        );
        expect(handleClose).toHaveBeenCalled();
      });
    });

    it("displays 409 conflict error when duplicate title is encountered", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          error: "已存在同名造物标题，请使用唯一的标题命名",
        }),
      });

      render(
        <ArtifactCreateModal
          open={true}
          onClose={vi.fn()}
          onCreated={vi.fn()}
        />
      );

      const titleInput = screen.getByTestId("create-artifact-title");
      fireEvent.change(titleInput, { target: { value: "重复的标题" } });

      const submitBtn = screen.getByTestId("create-artifact-submit");
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByTestId("create-artifact-error").textContent).toContain("已存在同名造物标题");
      });
    });
  });

  // ==========================================
  // 5. ArtifactEditModal
  // ==========================================
  describe("ArtifactEditModal", () => {
    it("pre-populates fields and sends PATCH /api/artifacts/[id]", async () => {
      const handleUpdated = vi.fn();
      const handleClose = vi.fn();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          artifact: {
            ...mockArtifactWithCounts,
            title: "修改后的标题",
          },
        }),
      });

      render(
        <ArtifactEditModal
          open={true}
          artifact={mockArtifactWithCounts}
          onClose={handleClose}
          onUpdated={handleUpdated}
        />
      );

      const titleInput = screen.getByTestId("edit-artifact-title") as HTMLInputElement;
      expect(titleInput.value).toBe("ReactFlow 架构设计规范 RFC");

      fireEvent.change(titleInput, { target: { value: "修改后的标题" } });

      const submitBtn = screen.getByTestId("edit-artifact-submit");
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/artifacts/${mockArtifactWithCounts.id}`,
          expect.objectContaining({
            method: "PATCH",
            body: expect.stringContaining("修改后的标题"),
          })
        );
        expect(handleUpdated).toHaveBeenCalled();
        expect(handleClose).toHaveBeenCalled();
      });
    });
  });

  // ==========================================
  // 6. ArtifactLinkManagerModal
  // ==========================================
  describe("ArtifactLinkManagerModal", () => {
    it("allows batch attaching and detaching relationships across 5 tabs", async () => {
      const handleLinksUpdated = vi.fn().mockResolvedValue(undefined);

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      });

      render(
        <ArtifactLinkManagerModal
          open={true}
          detail={mockArtifactDetail}
          onClose={vi.fn()}
          onLinksUpdated={handleLinksUpdated}
        />
      );

      // 1. Skills tab: attach skill
      const skillIdInput = screen.getByTestId("link-skill-id-input");
      fireEvent.change(skillIdInput, { target: { value: "new-skill-uuid" } });

      const attachSkillBtn = screen.getByTestId("link-skill-submit");
      fireEvent.click(attachSkillBtn);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/artifacts/${mockArtifactDetail.artifact.id}/links`,
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({
              skills: [
                {
                  skillId: "new-skill-uuid",
                  action: "attach",
                  demonstrationLevel: 3,
                },
              ],
            }),
          })
        );
        expect(handleLinksUpdated).toHaveBeenCalled();
      });

      // 2. Detach skill
      const detachSkillBtn = screen.getByTestId("detach-skill-skill-uuid-1");
      fireEvent.click(detachSkillBtn);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/artifacts/${mockArtifactDetail.artifact.id}/links`,
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({
              skills: [
                {
                  skillId: "skill-uuid-1",
                  action: "detach",
                },
              ],
            }),
          })
        );
      });

      // 3. Switch to Knowledge tab and attach
      fireEvent.click(screen.getByTestId("link-tab-knowledge"));
      const knInput = screen.getByTestId("link-knowledge-id-input");
      fireEvent.change(knInput, { target: { value: "new-kn-uuid" } });

      fireEvent.click(screen.getByTestId("link-knowledge-submit"));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/artifacts/${mockArtifactDetail.artifact.id}/links`,
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({
              knowledgeNodes: [
                {
                  nodeId: "new-kn-uuid",
                  action: "attach",
                  relationType: "synthesizes",
                },
              ],
            }),
          })
        );
      });
    });
  });

  // ==========================================
  // 7. ArtifactProposalResolutionPicker
  // ==========================================
  describe("ArtifactProposalResolutionPicker", () => {
    const proposals: ArtifactProposal[] = [
      {
        title: "神经可塑性综述论文",
        artifactType: "document",
        summary: "关于 LTP 机制的 12 页综述论文",
        reusabilityScore: 0.85,
      },
      {
        title: "突触机制研讨演讲稿",
        artifactType: "presentation",
        summary: "45 分钟研讨汇报 PPT",
        reusabilityScore: 0.7,
      },
    ];

    it("preserves exact proposalIndex and supports create, existing, and ignore modes", () => {
      const handleChange = vi.fn();
      render(
        <ArtifactProposalResolutionPicker
          proposals={proposals}
          onChange={handleChange}
        />
      );

      // Initial emission: proposal 0 and 1 are default 'create'
      expect(handleChange).toHaveBeenCalledWith(
        [
          {
            proposalIndex: 0,
            resolution: "create",
            approvedOverrides: {
              title: "神经可塑性综述论文",
              artifactType: "document",
              reusabilityScore: 0.85,
            },
          },
          {
            proposalIndex: 1,
            resolution: "create",
            approvedOverrides: {
              title: "突触机制研讨演讲稿",
              artifactType: "presentation",
              reusabilityScore: 0.7,
            },
          },
        ],
        true
      );

      // Switch proposal 1 to 'ignore'
      fireEvent.click(screen.getByTestId("proposal-1-resolution-ignore"));

      expect(handleChange).toHaveBeenLastCalledWith(
        [
          {
            proposalIndex: 0,
            resolution: "create",
            approvedOverrides: {
              title: "神经可塑性综述论文",
              artifactType: "document",
              reusabilityScore: 0.85,
            },
          },
          {
            proposalIndex: 1,
            resolution: "ignore",
          },
        ],
        true
      );

      // Switch proposal 0 to 'existing' (requires valid artifactId)
      fireEvent.click(screen.getByTestId("proposal-0-resolution-existing"));

      // Without artifactId, isValid is false
      expect(handleChange).toHaveBeenLastCalledWith(
        expect.any(Array),
        false
      );

      // Enter existing artifactId
      const artIdInput = screen.getByTestId("proposal-0-existing-artifact-id");
      fireEvent.change(artIdInput, { target: { value: "art-uuid-existing" } });

      expect(handleChange).toHaveBeenLastCalledWith(
        [
          {
            proposalIndex: 0,
            resolution: "existing",
            artifactId: "art-uuid-existing",
            activityRole: "modified",
          },
          {
            proposalIndex: 1,
            resolution: "ignore",
          },
        ],
        true
      );
    });
  });

  // ==========================================
  // 8. /artifacts Page & Gallery
  // ==========================================
  describe("/artifacts Page", () => {
    it("fetches list, handles server search query, and opens InspectorDrawer on selection", async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes(`/api/artifacts/${mockArtifactWithCounts.id}`)) {
          return {
            ok: true,
            status: 200,
            json: async () => mockArtifactDetail,
          };
        }
        if (url.includes("/api/artifacts")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              artifacts: [mockArtifactWithCounts],
              total: 1,
            }),
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      });

      render(<ArtifactsPage />);

      // Initial list loading
      await waitFor(() => {
        expect(screen.getByText("ReactFlow 架构设计规范 RFC")).toBeDefined();
      });

      // Click card to open drawer
      fireEvent.click(screen.getByTestId(`artifact-card-${mockArtifactWithCounts.id}`));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(`/api/artifacts/${mockArtifactWithCounts.id}`);
        expect(screen.getByTestId("inspector-artifact-title").textContent).toContain("ReactFlow 架构设计规范 RFC");
      });
    });

    it("debounces search input to prevent rapid stale requests", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          artifacts: [],
          total: 0,
        }),
      });

      render(<ArtifactsPage />);

      const searchInput = screen.getByTestId("artifacts-search-input");
      fireEvent.change(searchInput, { target: { value: "Neural" } });

      // Immediate call with search=Neural shouldn't happen yet due to 300ms debounce
      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.stringContaining("search=Neural"),
        expect.any(Object)
      );

      await waitFor(
        () => {
          expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining("search=Neural"),
            expect.any(Object)
          );
        },
        { timeout: 1000 }
      );
    });
  });

  // ==========================================
  // 9. Dashboard Assessment Confirm Integration
  // ==========================================
  describe("Dashboard Assessment Confirmation Integration", () => {
    const mockAssessmentWithProposals: Assessment = {
      id: "assess-1",
      activityId: "act-1",
      status: "pending",
      confidence: 0.95,
      modelName: "deepseek-v4-flash",
      promptVersion: "1.0",
      rulesVersion: "1.0",
      createdAt: "2026-08-26T10:00:00Z",
      confirmedAt: null,
      proposal: {
        activity: { type: "learning", completion: 1.0 },
        difficulty: { complexity: 0.5, uncertainty: 0.3, expertise_gap: 0.4, resistance: 0.2 },
        growth: { effort: 0.7, learning: 0.8, performance: 0.6, outcome: 0.7, artifact_value: 0.8, character_evidence: 0.5 },
        evidence: { level: 3, explanation: "Completed survey" },
        affected_skills: [{ name: "Neuroscience", reason: "Direct study" }],
        knowledge_updates: { proposed_nodes: [], proposed_edges: [] },
        mastery_changes: [
          {
            target_type: "skill",
            target_name: "Neuroscience",
            from_level: 2,
            proposed_level: 3,
            confidence: 0.95,
            verification_required: false,
            reason: "Consistent practice",
          },
        ],
        xp_semantics: {
          base_value: 50,
          difficulty: 0.8,
          mastery_gain: 0.5,
          novelty: 0.7,
          goal_alignment: 0.9,
          repetition_risk: "low",
        },
        artifacts: [],
        next_quest: null,
        confidence: 0.95,
        uncertainty_notes: [],
        artifactProposals: [
          {
            title: "LTP Review Article",
            artifactType: "document",
            summary: "Literature survey on synaptic plasticity",
            reusabilityScore: 0.85,
          },
        ],
      },
    };

    const mockDashboardSnapshot: DashboardSnapshot = {
      player: {
        totalXp: 1200,
        playerLevel: 4,
        energy: 80,
        focus: 90,
        momentum: 75,
      },
      levelProgress: {
        xpIntoLevel: 200,
        xpNeededForNext: 500,
        progress: 0.4,
      },
      recentGrowth: [],
      pendingAssessments: [mockAssessmentWithProposals],
      activities: [],
      skills: [],
      pendingMasteryVerifications: [],
    };

    it("renders ArtifactProposalResolutionPicker and passes artifactResolutions on confirm", async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes("/api/dashboard")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ dashboard: mockDashboardSnapshot }),
          };
        }
        if (url.includes("/api/assessments/assess-1/confirm")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ ok: true }),
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText("AI 建议交付的造物提案 (共 1 项)")).toBeDefined();
        expect(screen.getByText("LTP Review Article")).toBeDefined();
        const btn = screen.getByTestId("confirm-assessment-btn-assess-1") as HTMLButtonElement;
        expect(btn.disabled).toBe(false);
      });

      const confirmBtn = screen.getByTestId("confirm-assessment-btn-assess-1");
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/assessments/assess-1/confirm",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({
              artifactResolutions: [
                {
                  proposalIndex: 0,
                  resolution: "create",
                  approvedOverrides: {
                    title: "LTP Review Article",
                    artifactType: "document",
                    reusabilityScore: 0.85,
                  },
                },
              ],
            }),
          })
        );
      });
    });

    it("handles 409 artifact_title_conflict gracefully", async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes("/api/dashboard")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ dashboard: mockDashboardSnapshot }),
          };
        }
        if (url.includes("/api/assessments/assess-1/confirm")) {
          return {
            ok: false,
            status: 409,
            json: async () => ({
              code: "artifact_title_conflict",
              error: "Artifact with this title already exists",
            }),
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByTestId("confirm-assessment-btn-assess-1")).toBeDefined();
      });

      fireEvent.click(screen.getByTestId("confirm-assessment-btn-assess-1"));

      await waitFor(() => {
        expect(screen.getByText(/新建造物标题与已有造物冲突/)).toBeDefined();
      });
    });
  });

  // ==========================================
  // 10. Frozen Backend Delta Guard
  // ==========================================
  describe("Frozen Backend Delta Guard", () => {
    it("ensures zero changes were made to frozen backend or domain paths", () => {
      const forbiddenPathPrefixes = [
        "src/app/api/",
        "supabase/",
        "src/lib/store/",
        "src/lib/ai/",
        "src/lib/growth-engine/",
        "src/lib/supabase/",
        "src/lib/http/",
        "src/lib/auth/",
        "src/proxy.ts",
        "src/types/artifact.ts",
      ];

      function resolveBaseRef(): string {
        const candidates = [
          process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : null,
          "origin/main",
          "main",
        ].filter(Boolean) as string[];

        for (const candidate of candidates) {
          try {
            execSync(`git rev-parse --verify ${candidate}`, { stdio: "ignore" });
            return candidate;
          } catch {}
        }
        return "HEAD";
      }

      const baseRef = resolveBaseRef();
      const gitDiff = execSync(`git diff --name-only ${baseRef}...HEAD`, {
        encoding: "utf-8",
      });
      const changedFiles = gitDiff.split("\n").map((f) => f.trim()).filter(Boolean);

      for (const file of changedFiles) {
        for (const prefix of forbiddenPathPrefixes) {
          expect(
            file.startsWith(prefix),
            `Prohibited modification to frozen backend path: ${file}`
          ).toBe(false);
        }
      }
    });
  });
});

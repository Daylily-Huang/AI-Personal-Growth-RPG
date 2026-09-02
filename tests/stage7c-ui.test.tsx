// @vitest-environment jsdom
// tests/stage7c-ui.test.tsx
// Phase 4 — Stage 7C Artifact UI & Proposal Resolution Comprehensive Test Suite (Round 3 Final Frozen Closure)

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { execSync } from "node:child_process";
import { AppShellBoundary } from "@/components/layout/AppShellBoundary";
import {
  ArtifactInspectorContent,
  ArtifactCreateModal,
  ArtifactEditModal,
  ArtifactLinkManagerModal,
  ArtifactProposalResolutionPicker,
  MarkdownRenderer,
} from "@/components/artifacts";
import ArtifactsPage from "@/app/artifacts/page";
import DashboardPage from "@/app/dashboard/page";
import type {
  ArtifactWithCounts,
  ArtifactDetail,
  ArtifactProposal,
} from "@/types/artifact";
import type { DashboardSnapshot, Assessment } from "@/lib/store/types";

// 1. Next/navigation hoisted mock pattern eliminating TDZ risk
const { mockPush, mockRefresh } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRefresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  usePathname: () => "/artifacts",
}));

// Valid RFC 4122 v4 UUID fixtures
const UUID_ARTIFACT_1 = "11111111-1111-4111-8111-111111111111";
const UUID_ARTIFACT_2 = "22222222-2222-4222-8222-222222222222";
const UUID_SKILL_1 = "33333333-3333-4333-8333-333333333333";
const UUID_SKILL_2 = "44444444-4444-4444-8444-444444444444";
const UUID_KN_1 = "55555555-5555-4555-8555-555555555555";
const UUID_KN_2 = "66666666-6666-4666-8666-666666666666";
const UUID_QUEST_1 = "77777777-7777-4777-8777-777777777777";
const UUID_ACT_1 = "88888888-8888-4888-8888-888888888888";
const UUID_EV_1 = "99999999-9999-4999-8999-999999999999";
const UUID_USER_1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const mockArtifactWithCounts1: ArtifactWithCounts = {
  id: UUID_ARTIFACT_1,
  userId: UUID_USER_1,
  title: "ReactFlow 架构设计规范 RFC",
  normalizedTitle: "reactflow 架构设计规范 rfc",
  artifactType: "design_spec",
  summary: "针对 Stage 6C 知识图谱画布的三列布局与 CAS 模态框技术架构。",
  description: "## 核心规范\n详细记录了节点扩展与交互契约。\n\n```typescript\nconst a = 1;\n```\n[官方链接](https://example.com/spec)",
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
    knowledgeNodes: 2,
    quests: 1,
    activities: 1,
    evidence: 1,
  },
};

const mockArtifactWithCounts2: ArtifactWithCounts = {
  id: UUID_ARTIFACT_2,
  userId: UUID_USER_1,
  title: "海马体突触可塑性元分析",
  normalizedTitle: "海马体突触可塑性元分析",
  artifactType: "data_analysis",
  summary: "LTP 与 LTD 机制在长期记忆巩固中的量化分析与统计模型。",
  description: "统计了 45 篇近期高水平文献的实验数据。",
  lifecycleStatus: "superseded",
  version: "2.0",
  storagePath: null,
  externalUrl: null,
  reusabilityScore: 0.85,
  metadata: { dataset: "synaptic_v2" },
  isArchived: false,
  archivedAt: null,
  createdAt: "2026-08-26T11:00:00Z",
  updatedAt: "2026-08-26T11:00:00Z",
  counts: {
    skills: 1,
    knowledgeNodes: 1,
    quests: 0,
    activities: 1,
    evidence: 1,
  },
};

const mockArtifactDetail1: ArtifactDetail = {
  artifact: mockArtifactWithCounts1,
  links: {
    skills: [
      {
        id: UUID_SKILL_1,
        name: "前端工程化",
        level: 4,
        demonstrationLevel: 5,
      },
      {
        id: UUID_SKILL_2,
        name: "交互设计",
        level: 2,
        demonstrationLevel: 3,
      },
    ],
    knowledgeNodes: [
      {
        id: UUID_KN_1,
        title: "React Flow State Architecture",
        nodeType: "concept",
        verificationStatus: "verified",
        relationType: "synthesizes",
      },
      {
        id: UUID_KN_2,
        title: "D3 Force Simulation",
        nodeType: "concept",
        verificationStatus: "verified",
        relationType: "implements",
      },
    ],
    quests: [
      {
        id: UUID_QUEST_1,
        title: "交付知识图谱画布",
        status: "active",
        isPrimaryDeliverable: true,
      },
    ],
    activities: [
      {
        id: UUID_ACT_1,
        title: "编写 ReactFlow 画布技术方案",
        activityRole: "produced",
        completedAt: "2026-08-26T10:00:00Z",
      },
    ],
    evidence: [
      {
        id: UUID_EV_1,
        evidenceLevel: 4,
        description: "完整的架构设计文档与评审决议",
        verified: true,
      },
    ],
  },
};

const mockArtifactDetail2: ArtifactDetail = {
  artifact: mockArtifactWithCounts2,
  links: {
    skills: [
      {
        id: UUID_SKILL_1,
        name: "神经科学",
        level: 3,
        demonstrationLevel: 4,
      },
    ],
    knowledgeNodes: [
      {
        id: UUID_KN_1,
        title: "Synaptic Plasticity",
        nodeType: "concept",
        verificationStatus: "verified",
        relationType: "evaluates",
      },
    ],
    quests: [],
    activities: [
      {
        id: UUID_ACT_1,
        title: "突触机制量化分析研讨",
        activityRole: "produced",
        completedAt: "2026-08-26T11:00:00Z",
      },
    ],
    evidence: [
      {
        id: UUID_EV_1,
        evidenceLevel: 3,
        description: "Meta-analysis Python notebook and dataset",
        verified: true,
      },
    ],
  },
};

describe("Stage 7C Artifact UI Test Suite (Round 3 Final Frozen Closure)", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // ==========================================
  // 1. AppShell Single-Instance Verification
  // ==========================================
  describe("1. AppShell Single-Instance Verification", () => {
    it("verifies exactly ONE AppShell root, ONE AppSidebar, and ONE AppHeader when rendered under AppShellBoundary", () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ artifacts: [], total: 0 }),
      });

      render(
        <AppShellBoundary>
          <ArtifactsPage />
        </AppShellBoundary>
      );

      const appShellRoots = screen.getAllByTestId("app-shell-root");
      expect(appShellRoots.length).toBe(1);

      const sidebars = screen.getAllByTestId("app-sidebar");
      expect(sidebars.length).toBe(1);

      const headers = screen.getAllByTestId("app-header");
      expect(headers.length).toBe(1);

      const mobileNavs = screen.getAllByTestId("mobile-nav");
      expect(mobileNavs.length).toBe(1);

      // Verify page workspace is directly rendered inside main without nested AppShell
      expect(screen.getByTestId("artifacts-workspace")).toBeDefined();
    });
  });

  // ==========================================
  // 2. 3-Column Workspace Layout & Query Contracts
  // ==========================================
  describe("2. 3-Column Workspace Layout & Query Contracts", () => {
    it("renders 3-column elements: Filter rail on left, Gallery in center, InspectorDrawer on right", async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (url === `/api/artifacts/${UUID_ARTIFACT_1}`) {
          return {
            ok: true,
            status: 200,
            json: async () => mockArtifactDetail1,
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            artifacts: [mockArtifactWithCounts1],
            total: 1,
          }),
        };
      });

      render(<ArtifactsPage />);

      await waitFor(() => {
        expect(screen.getByText("ReactFlow 架构设计规范 RFC")).toBeDefined();
      });

      // Left Column: Filter rail
      expect(screen.getByLabelText("成果分类与生命周期筛选")).toBeDefined();

      // Open inspector
      fireEvent.click(screen.getByText("ReactFlow 架构设计规范 RFC"));

      await waitFor(() => {
        expect(screen.getByTestId("inspector-artifact-title")).toBeDefined();
      });
    });

    it("explicitly passes status=all when '全部状态' is selected", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          artifacts: [mockArtifactWithCounts1],
          total: 1,
        }),
      });

      render(<ArtifactsPage />);

      await waitFor(() => {
        expect(screen.getByText("ReactFlow 架构设计规范 RFC")).toBeDefined();
      });

      // Click "全部状态"
      const allStatusBtn = screen.getByRole("button", { name: "全部状态" });
      fireEvent.click(allStatusBtn);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("status=all"),
          expect.any(Object)
        );
      });
    });

    it("supports linked skill filter query in Left Rail", async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes("/api/skills")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              nodes: [
                { id: UUID_SKILL_1, data: { name: "前端工程化", level: 4 } },
              ],
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            artifacts: [mockArtifactWithCounts1],
            total: 1,
          }),
        };
      });

      render(<ArtifactsPage />);

      await waitFor(() => {
        expect(screen.getByText("前端工程化")).toBeDefined();
      });

      fireEvent.click(screen.getByText("前端工程化"));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`skillId=${UUID_SKILL_1}`),
          expect.any(Object)
        );
      });
    });

    it("supports pagination / load more for >PAGE_SIZE artifacts", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          artifacts: [mockArtifactWithCounts1],
          total: 50,
        }),
      });

      render(<ArtifactsPage />);

      await waitFor(() => {
        expect(screen.getByTestId("artifacts-load-more-btn")).toBeDefined();
        expect(screen.getByText(/已展示 1 \/ 共 50 项/)).toBeDefined();
      });

      // Click load more
      fireEvent.click(screen.getByTestId("artifacts-load-more-btn"));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("offset=24"),
          expect.any(Object)
        );
      });
    });

    it("adjusts gallery grid density when Inspector is opened vs closed", async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (url === `/api/artifacts/${UUID_ARTIFACT_1}`) {
          return {
            ok: true,
            status: 200,
            json: async () => mockArtifactDetail1,
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            artifacts: [mockArtifactWithCounts1],
            total: 1,
          }),
        };
      });

      render(<ArtifactsPage />);

      await waitFor(() => {
        expect(screen.getByTestId("artifacts-grid")).toBeDefined();
      });

      // Inspector closed
      const grid = screen.getByTestId("artifacts-grid");
      expect(grid.getAttribute("data-inspector-open")).toBe("false");
      expect(grid.className).toContain("xl:grid-cols-3");

      // Open inspector
      fireEvent.click(screen.getByText("ReactFlow 架构设计规范 RFC"));

      await waitFor(() => {
        expect(grid.getAttribute("data-inspector-open")).toBe("true");
        expect(grid.className).toContain("grid-cols-1");
        expect(grid.className).not.toContain("2xl:grid-cols-2");
      });
    });

    it("toggles mobile inline collapsible filter panel without modal overlay traps", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          artifacts: [mockArtifactWithCounts1],
          total: 1,
        }),
      });

      render(<ArtifactsPage />);

      await waitFor(() => {
        expect(screen.getByTestId("mobile-filter-toggle-btn")).toBeDefined();
      });

      const toggleBtn = screen.getByTestId("mobile-filter-toggle-btn");
      expect(toggleBtn.getAttribute("aria-expanded")).toBe("false");
      expect(screen.queryByTestId("mobile-filter-panel")).toBeNull();

      // Click to expand inline filter panel
      fireEvent.click(toggleBtn);
      expect(toggleBtn.getAttribute("aria-expanded")).toBe("true");
      expect(screen.getByTestId("mobile-filter-panel")).toBeDefined();

      // Verify no modal overlay or backdrop
      expect(screen.queryByRole("dialog")).toBeNull();

      // Click to collapse
      fireEvent.click(toggleBtn);
      expect(toggleBtn.getAttribute("aria-expanded")).toBe("false");
      expect(screen.queryByTestId("mobile-filter-panel")).toBeNull();
    });
  });

  // ==========================================
  // 3. Artifact Selection & Stale Detail Race Guard
  // ==========================================
  describe("3. Artifact Selection & Detail Race Guard", () => {
    it("discards slow A detail response if B was selected subsequently", async () => {
      let resolveA: (val: unknown) => void = () => {};
      const promiseA = new Promise((resolve) => {
        resolveA = resolve;
      });

      mockFetch.mockImplementation(async (url: string) => {
        if (url === `/api/artifacts/${UUID_ARTIFACT_1}`) {
          return promiseA;
        }
        if (url === `/api/artifacts/${UUID_ARTIFACT_2}`) {
          return {
            ok: true,
            status: 200,
            json: async () => mockArtifactDetail2,
          };
        }
        if (url.includes("/api/artifacts")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              artifacts: [mockArtifactWithCounts1, mockArtifactWithCounts2],
              total: 2,
            }),
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      });

      render(<ArtifactsPage />);

      await waitFor(() => {
        expect(screen.getByTestId(`artifact-card-${UUID_ARTIFACT_1}`)).toBeDefined();
        expect(screen.getByTestId(`artifact-card-${UUID_ARTIFACT_2}`)).toBeDefined();
      });

      // Click Artifact A
      fireEvent.click(screen.getByTestId(`artifact-card-${UUID_ARTIFACT_1}`));
      expect(screen.getByTestId("inspector-loading-state")).toBeDefined();

      // Rapidly click Artifact B before A finishes
      fireEvent.click(screen.getByTestId(`artifact-card-${UUID_ARTIFACT_2}`));

      await waitFor(() => {
        expect(screen.getByTestId("inspector-artifact-title").textContent).toContain("海马体突触可塑性元分析");
      });

      // Now resolve slow A
      resolveA({
        ok: true,
        status: 200,
        json: async () => mockArtifactDetail1,
      });

      // Wait to ensure A never overwrites B
      await new Promise((r) => setTimeout(r, 50));
      expect(screen.getByTestId("inspector-artifact-title").textContent).toContain("海马体突触可塑性元分析");
      expect(screen.getByTestId("inspector-artifact-title").textContent).not.toContain("ReactFlow 架构设计规范 RFC");
    });

    it("clears stale detail and displays error retry state on fetch failure", async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (url === `/api/artifacts/${UUID_ARTIFACT_1}`) {
          return {
            ok: false,
            status: 500,
            json: async () => ({ error: "Internal Server Error" }),
          };
        }
        if (url.includes("/api/artifacts")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              artifacts: [mockArtifactWithCounts1],
              total: 1,
            }),
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      });

      render(<ArtifactsPage />);

      await waitFor(() => {
        expect(screen.getByTestId(`artifact-card-${UUID_ARTIFACT_1}`)).toBeDefined();
      });

      fireEvent.click(screen.getByTestId(`artifact-card-${UUID_ARTIFACT_1}`));

      await waitFor(() => {
        expect(screen.getByTestId("inspector-error-state")).toBeDefined();
        expect(screen.queryByTestId("inspector-artifact-title")).toBeNull();
      });
    });
  });

  // ==========================================
  // 4. ArtifactInspectorContent & Actions
  // ==========================================
  describe("4. ArtifactInspectorContent & Actions", () => {
    it("renders safe Markdown headings, code blocks, timestamps, and metadata", () => {
      render(<ArtifactInspectorContent detail={mockArtifactDetail1} />);

      expect(screen.getByTestId("inspector-artifact-title").textContent).toContain("ReactFlow 架构设计规范 RFC");
      expect(screen.getByTestId("inspector-artifact-version").textContent).toContain("v1.2");
      expect(screen.getByTestId("inspector-artifact-timestamps")).toBeDefined();
      expect(screen.getByTestId("inspector-artifact-metadata")).toBeDefined();

      // Check Markdown rendering inside description
      const desc = screen.getByTestId("inspector-artifact-description");
      expect(desc.querySelector("h3")?.textContent).toContain("核心规范");
      expect(desc.querySelector("code")?.textContent).toContain("const a = 1;");
      expect(desc.querySelector("a")?.getAttribute("href")).toBe("https://example.com/spec");
    });

    it("handles archive with ConfirmDialog and cancel zero mutation", async () => {
      const handleStatusChange = vi.fn().mockResolvedValue(undefined);
      render(
        <ArtifactInspectorContent
          detail={mockArtifactDetail1}
          onStatusChange={handleStatusChange}
        />
      );

      const archiveBtn = screen.getByTestId("inspector-archive-toggle-btn");
      fireEvent.click(archiveBtn);

      // ConfirmDialog should be open
      expect(screen.getByText("确认归档造物")).toBeDefined();

      // Cancel button should close dialog with ZERO mutations
      const cancelBtn = screen.getByRole("button", { name: "取消" });
      fireEvent.click(cancelBtn);
      expect(handleStatusChange).not.toHaveBeenCalled();

      // Re-open and confirm
      fireEvent.click(archiveBtn);
      const confirmBtn = screen.getByRole("button", { name: "确认归档" });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(handleStatusChange).toHaveBeenCalledWith(UUID_ARTIFACT_1, "archived", true);
      });
    });

    it("renders Restore Superseded action for superseded artifact and executes status change", async () => {
      const handleStatusChange = vi.fn().mockResolvedValue(undefined);
      render(
        <ArtifactInspectorContent
          detail={mockArtifactDetail2}
          onStatusChange={handleStatusChange}
        />
      );

      const restoreSupersededBtn = screen.getByTestId("inspector-restore-superseded-btn");
      expect(restoreSupersededBtn).toBeDefined();

      fireEvent.click(restoreSupersededBtn);

      await waitFor(() => {
        expect(handleStatusChange).toHaveBeenCalledWith(UUID_ARTIFACT_2, "active", false);
      });
    });

    it("handles delete with 409 referenced_by_provenance fail-closed error feedback", async () => {
      const handleDelete = vi.fn().mockResolvedValue({
        ok: false,
        code: "referenced_by_provenance",
        error: "Cannot delete artifact referenced by knowledge provenance or evidence records.",
      });

      render(
        <ArtifactInspectorContent
          detail={mockArtifactDetail1}
          onDelete={handleDelete}
        />
      );

      fireEvent.click(screen.getByTestId("inspector-delete-btn"));
      const confirmBtn = screen.getByRole("button", { name: "确认删除" });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(handleDelete).toHaveBeenCalledWith(UUID_ARTIFACT_1);
        expect(screen.getByText("无法物理删除此造物")).toBeDefined();
        expect(screen.getByText(/建议使用/)).toBeDefined();
      });
    });
  });

  // ==========================================
  // 5. ArtifactCreateModal & Initial Relationships
  // ==========================================
  describe("5. ArtifactCreateModal & Initial Lifecycle Status", () => {
    it("submits POST /api/artifacts with active/draft lifecycleStatus and cancels with zero mutation", async () => {
      const handleCreated = vi.fn();
      const handleClose = vi.fn();

      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          artifact: {
            ...mockArtifactWithCounts1,
            id: UUID_ARTIFACT_1,
            title: "全脑图谱白皮书",
            lifecycleStatus: "draft",
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

      // Cancel with zero mutation
      mockFetch.mockClear();
      fireEvent.click(screen.getByTestId("create-artifact-cancel"));
      expect(handleClose).toHaveBeenCalledTimes(1);
      expect(mockFetch).not.toHaveBeenCalled();

      // Fill in title
      const titleInput = screen.getByTestId("create-artifact-title");
      fireEvent.change(titleInput, { target: { value: "全脑图谱白皮书" } });

      // Change status to draft
      const statusSelect = screen.getByTestId("create-artifact-status");
      fireEvent.change(statusSelect, { target: { value: "draft" } });

      const submitBtn = screen.getByTestId("create-artifact-submit");
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/artifacts",
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining('"lifecycleStatus":"draft"'),
          })
        );
        expect(handleCreated).toHaveBeenCalled();
      });
    });

    it("blocks submission when evidence UUID is invalid", async () => {
      render(
        <ArtifactCreateModal
          open={true}
          onClose={vi.fn()}
          onCreated={vi.fn()}
        />
      );

      // Fill title
      fireEvent.change(screen.getByTestId("create-artifact-title"), { target: { value: "测试造物" } });

      // Open initial links
      fireEvent.click(screen.getByTestId("create-initial-links-toggle"));

      // Enter invalid evidence UUID
      const evInput = screen.getByTestId("create-evidence-id-input");
      fireEvent.change(evInput, { target: { value: "invalid-uuid" } });

      expect(evInput.getAttribute("aria-invalid")).toBe("true");
      expect(screen.getByText("请输入有效的 36 位 UUID 格式")).toBeDefined();

      const submitBtn = screen.getByTestId("create-artifact-submit") as HTMLButtonElement;
      expect(submitBtn.disabled).toBe(true);
    });

    it("submits PATCH /api/artifacts/[id] from ArtifactEditModal with updated fields", async () => {
      const handleUpdated = vi.fn();
      const handleClose = vi.fn();

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          artifact: {
            ...mockArtifactWithCounts1,
            title: "Updated Title RFC",
            version: "2.0",
          },
        }),
      });

      render(
        <ArtifactEditModal
          open={true}
          artifact={mockArtifactWithCounts1}
          onClose={handleClose}
          onUpdated={handleUpdated}
        />
      );

      // Cancel with zero mutation
      mockFetch.mockClear();
      fireEvent.click(screen.getByTestId("edit-artifact-cancel"));
      expect(handleClose).toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();

      // Change title
      const titleInput = screen.getByTestId("edit-artifact-title");
      fireEvent.change(titleInput, { target: { value: "Updated Title RFC" } });

      const submitBtn = screen.getByTestId("edit-artifact-submit");
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/artifacts/${UUID_ARTIFACT_1}`,
          expect.objectContaining({
            method: "PATCH",
            body: expect.stringContaining('"title":"Updated Title RFC"'),
          })
        );
        expect(handleUpdated).toHaveBeenCalled();
      });
    });
  });

  // ==========================================
  // 6. ArtifactLinkManagerModal (Batch + Cancel Zero-Mutation)
  // ==========================================
  describe("6. ArtifactLinkManagerModal (Batch + Cancel Zero-Mutation)", () => {
    it("discards staged changes on Cancel with zero network mutations", () => {
      const handleLinksUpdated = vi.fn();
      const handleClose = vi.fn();

      render(
        <ArtifactLinkManagerModal
          open={true}
          detail={mockArtifactDetail1}
          onClose={handleClose}
          onLinksUpdated={handleLinksUpdated}
        />
      );

      // Attach skill to staged
      const skillInput = screen.getByTestId("link-skill-id-input");
      fireEvent.change(skillInput, { target: { value: UUID_SKILL_1 } });
      fireEvent.click(screen.getByTestId("link-skill-submit"));

      // Click Cancel
      mockFetch.mockClear();
      fireEvent.click(screen.getByTestId("link-manager-cancel"));
      expect(handleClose).toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
      expect(handleLinksUpdated).not.toHaveBeenCalled();
    });

    it("submits single batch request across multiple categories on Save", async () => {
      const handleLinksUpdated = vi.fn().mockResolvedValue(undefined);
      const handleClose = vi.fn();

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      });

      render(
        <ArtifactLinkManagerModal
          open={true}
          detail={mockArtifactDetail1}
          onClose={handleClose}
          onLinksUpdated={handleLinksUpdated}
        />
      );

      // Detach existing skill
      fireEvent.click(screen.getByTestId(`detach-skill-${UUID_SKILL_1}`));

      // Switch to Knowledge tab and stage attach
      fireEvent.click(screen.getByTestId("link-tab-knowledge"));
      const knInput = screen.getByTestId("link-knowledge-id-input");
      fireEvent.change(knInput, { target: { value: UUID_KN_1 } });
      fireEvent.click(screen.getByTestId("link-knowledge-submit"));

      // Click Batch Save
      fireEvent.click(screen.getByTestId("link-manager-submit"));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/artifacts/${UUID_ARTIFACT_1}/links`,
          expect.objectContaining({
            method: "POST",
            body: expect.stringContaining(UUID_SKILL_1),
          })
        );
        expect(handleLinksUpdated).toHaveBeenCalled();
        expect(handleClose).toHaveBeenCalled();
      });
    });

    it("blocks invalid UUID from being added to staged links", () => {
      render(
        <ArtifactLinkManagerModal
          open={true}
          detail={mockArtifactDetail1}
          onClose={vi.fn()}
          onLinksUpdated={vi.fn()}
        />
      );

      const skillInput = screen.getByTestId("link-skill-id-input");
      fireEvent.change(skillInput, { target: { value: "invalid-uuid-format" } });
      fireEvent.click(screen.getByTestId("link-skill-submit"));

      expect(screen.getByTestId("link-manager-error").textContent).toContain("请输入有效的 36 位技能 UUID 格式");
    });
  });

  // ==========================================
  // 7. Assessment Proposal Resolution Explicit Contract & Search Race
  // ==========================================
  describe("7. Assessment Proposal Resolution Explicit Contract & Search Race", () => {
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

    it("requires explicit per-item resolution (initial isValid = false)", () => {
      const handleChange = vi.fn();
      render(
        <ArtifactProposalResolutionPicker
          proposals={proposals}
          onChange={handleChange}
        />
      );

      // Initial state: 0 of 2 resolved, isValid must be FALSE
      expect(handleChange).toHaveBeenCalledWith([], false);

      // Resolve proposal 0 as Create
      fireEvent.click(screen.getByTestId("proposal-0-resolution-create"));

      // 1 of 2 resolved -> still FALSE
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
        ],
        false
      );

      // Resolve proposal 1 as Ignore
      fireEvent.click(screen.getByTestId("proposal-1-resolution-ignore"));

      // 2 of 2 resolved -> TRUE!
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
    });

    it("supports search lookup and ignores stale deferred search responses (rea vs react race)", async () => {
      let resolveRea: (val: unknown) => void = () => {};
      const promiseRea = new Promise((resolve) => {
        resolveRea = resolve;
      });

      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes("search=rea%20slow") || url.includes("search=rea")) {
          if (!url.includes("search=react")) {
            return promiseRea;
          }
        }
        if (url.includes("search=react")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              artifacts: [mockArtifactWithCounts1],
              total: 1,
            }),
          };
        }
        return { ok: true, status: 200, json: async () => ({ artifacts: [] }) };
      });

      render(
        <ArtifactProposalResolutionPicker
          proposals={[proposals[0]]}
          onChange={vi.fn()}
        />
      );

      fireEvent.click(screen.getByTestId("proposal-0-resolution-existing"));

      const searchInput = screen.getByTestId("proposal-0-existing-search-input");
      // Search 1: "rea"
      fireEvent.change(searchInput, { target: { value: "rea" } });

      // Quickly search 2: "react"
      fireEvent.change(searchInput, { target: { value: "react" } });

      // Request 2 finishes first
      await waitFor(() => {
        expect(screen.getByTestId(`select-existing-artifact-${UUID_ARTIFACT_1}`)).toBeDefined();
      });

      // Now resolve slow Request 1 with completely different data
      resolveRea({
        ok: true,
        status: 200,
        json: async () => ({
          artifacts: [mockArtifactWithCounts2],
          total: 1,
        }),
      });

      await new Promise((r) => setTimeout(r, 50));

      // UI must strictly show the latest "react" results
      expect(screen.getByTestId(`select-existing-artifact-${UUID_ARTIFACT_1}`)).toBeDefined();
      expect(screen.queryByTestId(`select-existing-artifact-${UUID_ARTIFACT_2}`)).toBeNull();
    });

    it("clearing search input immediately invalidates stale in-flight responses", async () => {
      let resolveSearch: (val: unknown) => void = () => {};
      const promiseSearch = new Promise((resolve) => {
        resolveSearch = resolve;
      });

      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes("search=react")) {
          return promiseSearch;
        }
        return { ok: true, status: 200, json: async () => ({ artifacts: [] }) };
      });

      render(
        <ArtifactProposalResolutionPicker
          proposals={[proposals[0]]}
          onChange={vi.fn()}
        />
      );

      fireEvent.click(screen.getByTestId("proposal-0-resolution-existing"));

      const searchInput = screen.getByTestId("proposal-0-existing-search-input");
      // Search: "react"
      fireEvent.change(searchInput, { target: { value: "react" } });

      // Before request resolves, clear input
      fireEvent.change(searchInput, { target: { value: "" } });

      // Now late resolve the "react" request
      resolveSearch({
        ok: true,
        status: 200,
        json: async () => ({
          artifacts: [mockArtifactWithCounts1],
          total: 1,
        }),
      });

      await new Promise((r) => setTimeout(r, 50));

      // Results must remain completely empty
      expect(screen.queryByTestId(`select-existing-artifact-${UUID_ARTIFACT_1}`)).toBeNull();
    });

    it("selecting an existing artifact cancels pending search and prevents late response from reopening results", async () => {
      let resolveSearch: (val: unknown) => void = () => {};
      const promiseSearch = new Promise((resolve) => {
        resolveSearch = resolve;
      });

      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes("search=spec")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              artifacts: [mockArtifactWithCounts1],
              total: 1,
            }),
          };
        }
        if (url.includes("search=slow")) {
          return promiseSearch;
        }
        return { ok: true, status: 200, json: async () => ({ artifacts: [] }) };
      });

      render(
        <ArtifactProposalResolutionPicker
          proposals={[proposals[0]]}
          onChange={vi.fn()}
        />
      );

      fireEvent.click(screen.getByTestId("proposal-0-resolution-existing"));

      const searchInput = screen.getByTestId("proposal-0-existing-search-input");
      // Search: "spec"
      fireEvent.change(searchInput, { target: { value: "spec" } });

      await waitFor(() => {
        expect(screen.getByTestId(`select-existing-artifact-${UUID_ARTIFACT_1}`)).toBeDefined();
      });

      // Type slow search
      fireEvent.change(searchInput, { target: { value: "slow" } });

      // Click select on artifact 1
      fireEvent.click(screen.getByTestId(`select-existing-artifact-${UUID_ARTIFACT_1}`));

      // Now late resolve the "slow" request with artifact 2
      resolveSearch({
        ok: true,
        status: 200,
        json: async () => ({
          artifacts: [mockArtifactWithCounts2],
          total: 1,
        }),
      });

      await new Promise((r) => setTimeout(r, 50));

      // Results should remain closed and selection preserved
      expect(screen.queryByTestId(`select-existing-artifact-${UUID_ARTIFACT_2}`)).toBeNull();
      const idInput = screen.getByTestId("proposal-0-existing-artifact-id") as HTMLInputElement;
      expect(idInput.value).toBe(UUID_ARTIFACT_1);
    });

    it("blocks invalid manual UUID from being marked as valid", () => {
      const handleChange = vi.fn();
      render(
        <ArtifactProposalResolutionPicker
          proposals={[proposals[0]]}
          onChange={handleChange}
        />
      );

      fireEvent.click(screen.getByTestId("proposal-0-resolution-existing"));

      const idInput = screen.getByTestId("proposal-0-existing-artifact-id");
      fireEvent.change(idInput, { target: { value: "abc" } });

      expect(idInput.getAttribute("aria-invalid")).toBe("true");
      expect(screen.getByTestId("proposal-0-uuid-error")).toBeDefined();
      expect(handleChange).toHaveBeenLastCalledWith(expect.any(Array), false);
    });
  });

  // ==========================================
  // 8. Markdown Security Protocol Allowlist
  // ==========================================
  describe("8. Markdown Security Protocol Allowlist", () => {
    it("renders safe https and http links as clickable anchors", () => {
      const safeMarkdown = "[Safe HTTPS Link](https://example.com) and [Safe HTTP Link](http://example.org)";
      render(<MarkdownRenderer content={safeMarkdown} />);

      const links = screen.getAllByRole("link");
      expect(links.length).toBe(2);
      expect(links[0].getAttribute("href")).toBe("https://example.com");
      expect(links[1].getAttribute("href")).toBe("http://example.org");
    });

    it("downgrades hostile javascript, data, and vbscript schemes to plain text", () => {
      const hostileMarkdown =
        "[Hostile JS](javascript:alert(1)) and [Hostile Data](data:text/html,<script>alert(1)</script>) and [Hostile VB](vbscript:msgbox)";
      render(<MarkdownRenderer content={hostileMarkdown} />);

      // No clickable links should be rendered
      expect(screen.queryByRole("link")).toBeNull();
      expect(screen.getByText(/Hostile JS/)).toBeDefined();
      expect(screen.getByText(/Hostile Data/)).toBeDefined();
      expect(screen.getByText(/Hostile VB/)).toBeDefined();
    });
  });

  // ==========================================
  // 9. Dashboard Assessment Confirm & Error Handling
  // ==========================================
  describe("9. Dashboard Assessment Confirm & Error Handling", () => {
    const mockAssessmentWithProposals: Assessment = {
      id: "assess-1",
      activityId: UUID_ACT_1,
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

    it("disables confirm until proposal is resolved, then submits artifactResolutions", async () => {
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
      });

      const confirmBtn = screen.getByTestId("confirm-assessment-btn-assess-1") as HTMLButtonElement;
      // Confirm should be DISABLED before selection
      expect(confirmBtn.disabled).toBe(true);

      // Select Create
      fireEvent.click(screen.getByTestId("proposal-0-resolution-create"));

      await waitFor(() => {
        expect(confirmBtn.disabled).toBe(false);
      });

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

    it("handles non-disclosing 404 error without disclosing tenant information", async () => {
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
            status: 404,
            json: async () => ({ error: "Not Found" }),
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByTestId("confirm-assessment-btn-assess-1")).toBeDefined();
      });

      fireEvent.click(screen.getByTestId("proposal-0-resolution-create"));
      fireEvent.click(screen.getByTestId("confirm-assessment-btn-assess-1"));

      await waitFor(() => {
        expect(screen.getByText("该造物不存在或当前账户无权访问。")).toBeDefined();
      });
    });
  });

  // ==========================================
  // 10. Fail-Closed Frozen Backend Delta Guard
  // ==========================================
  describe("10. Fail-Closed Frozen Backend Delta Guard", () => {
    it("ensures zero changes were made to frozen backend paths and strictly fails if base ref is missing", () => {
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

      function resolveBaseRefStrict(): string {
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
        throw new Error("FAIL-CLOSED: Unable to resolve valid git base ref for backend delta guard.");
      }

      const baseRef = resolveBaseRefStrict();
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

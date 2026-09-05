// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import React, { type ComponentProps } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type {
  SkillDetailResponse,
  SkillFlowEdge,
  SkillFlowNode,
} from "@/lib/store/types";
import SkillNodeView, {
  type SkillNodeViewData,
} from "@/app/skills/components/SkillNode";
import EvidenceTimeline from "@/app/skills/components/EvidenceTimeline";
import DomainFilterPanel from "@/app/skills/components/DomainFilterPanel";
import SkillDetailPanel from "@/app/skills/components/SkillDetailPanel";
import SkillsPage from "@/app/skills/page";
import { toFlowEdges } from "@/app/skills/components/SkillGraphCanvas";
import { MarkerType } from "@xyflow/react";

const pushMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>();
  return {
    ...actual,
    Handle: () => null,
  };
});

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: query.includes("min-width"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
  class DOMMatrixReadOnlyMock {
    m22 = 1;
    constructor(transform?: string) {
      const scale = transform?.match(/scale\(([0-9.]+)\)/)?.[1];
      if (scale !== undefined) this.m22 = Number(scale);
    }
  }
  (globalThis as Record<string, unknown>).DOMMatrixReadOnly = DOMMatrixReadOnlyMock;
  class ResizeObserverMock {
    private cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb;
    }
    observe(el: Element) {
      this.cb(
        [
          {
            target: el,
            contentRect: { width: 120, height: 80, x: 0, y: 0, top: 0, left: 0, bottom: 80, right: 120 },
            borderBoxSize: [{ inlineSize: 120, blockSize: 80 }],
            contentBoxSize: [{ inlineSize: 120, blockSize: 80 }],
            devicePixelContentBoxSize: [{ inlineSize: 120, blockSize: 80 }],
          } as unknown as ResizeObserverEntry,
        ],
        {} as ResizeObserver,
      );
    }
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
  const svgProto = window.SVGElement.prototype as unknown as {
    getBBox?: () => { x: number; y: number; width: number; height: number };
  };
  svgProto.getBBox =
    svgProto.getBBox || (() => ({ x: 0, y: 0, width: 0, height: 0 }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function baseNodeData(overrides: Partial<SkillNodeViewData> = {}): SkillNodeViewData {
  return {
    name: "Test Skill",
    aliases: [],
    level: 2,
    xp: 45,
    masteryLevel: 3,
    masteryConfidence: 0.67,
    derivedState: "learning",
    lastUsedAt: null,
    prerequisiteCount: 0,
    unfulfilledPrerequisiteCount: 0,
    ...overrides,
  };
}

type SkillNodeProps = ComponentProps<typeof SkillNodeView>;

function nodeProps(data: SkillNodeViewData, selected = false): SkillNodeProps {
  return {
    id: "n1",
    data,
    type: "skillNode",
    selected,
    dragging: false,
    zIndex: 0,
    xPos: 0,
    yPos: 0,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    sourcePosition: undefined,
    targetPosition: undefined,
  } as unknown as SkillNodeProps;
}

describe("P1-2 #1 — SkillNode renders Stage 5B facts", () => {
  test("name / level / mastery / xp / confidence / domain badge / unfulfilled count", () => {
    const data = baseNodeData({
      name: "Deep Work",
      level: 4,
      masteryLevel: 3,
      masteryConfidence: 0.67,
      domainLabel: "认知",
      unfulfilledPrerequisiteCount: 2,
    });
    const { container } = render(<SkillNodeView {...nodeProps(data)} />);

    expect(screen.getByText("Deep Work")).toBeTruthy();
    expect(screen.getByText(/lv\.4/i)).toBeTruthy();
    expect(screen.getByText("M3")).toBeTruthy();
    expect(container.textContent).toContain("45 XP · 置信 67%");
    expect(screen.getByText("认知")).toBeTruthy();
    expect(screen.getByText("×2")).toBeTruthy();
  });

  test("selected state applies the selection ring", () => {
    const { container } = render(
      <SkillNodeView {...nodeProps(baseNodeData(), true)} />,
    );
    expect(container.firstElementChild?.className).toContain("ring-2");
  });
});

describe("P1-2 #2 — all six derived states render semantic presentation", () => {
  const cases: Array<[SkillNodeViewData["derivedState"], string, RegExp]> = [
    ["locked", "已锁定", /opacity-60/],
    ["available", "可开始", /border-\[var\(--state-success-border\)\]/],
    ["learning", "学习中", /border-\[var\(--state-info-border\)\]/],
    ["proficient", "熟练", /border-\[var\(--state-warning-border\)\]/],
    ["advanced", "精通", /ring-\[var\(--entity-artifact-border\)\]/],
    ["archived", "已归档", /repeating-linear-gradient/],
  ];

  for (const [state, label, containerPattern] of cases) {
    test(`"${state}" → aria label "${label}" + dedicated container visual`, () => {
      const { container } = render(
        <SkillNodeView {...nodeProps(baseNodeData({ derivedState: state }))} />,
      );
      const rootEl = container.firstElementChild as HTMLElement;
      expect(rootEl.className).toMatch(containerPattern);
      expect(rootEl.getAttribute("aria-label")).toContain(label);
    });
  }

  test("locked shows the lock glyph; advanced renders mastery badge; available pulses", () => {
    const locked = render(<SkillNodeView {...nodeProps(baseNodeData({ derivedState: "locked" }))} />);
    expect(locked.container.querySelector(".lucide-lock")).toBeTruthy();

    const advanced = render(<SkillNodeView {...nodeProps(baseNodeData({ derivedState: "advanced" }))} />);
    expect(advanced.container.querySelector('[data-testid="mastery-badge"]')).toBeTruthy();

    const available = render(<SkillNodeView {...nodeProps(baseNodeData({ derivedState: "available" }))} />);
    expect(available.container.querySelector(".animate-pulse")).toBeTruthy();
  });
});

describe("P1-2 #5 — EvidenceTimeline populated vs empty", () => {
  test("empty model renders the explicit empty hint (no invented rows)", () => {
    render(<EvidenceTimeline items={[]} />);
    expect(screen.getByText(/暂无证据记录/)).toBeTruthy();
  });

  test("populated model renders level badge, title, verification and time", () => {
    render(
      <EvidenceTimeline
        items={[
          {
            id: "e1",
            activityId: "a1",
            activityTitle: "两小时深度编程",
            evidenceLevel: 4,
            evidenceType: "production",
            description: null,
            verified: true,
            createdAt: "2026-08-20T09:30:00Z",
          },
        ]}
      />,
    );
    expect(screen.getByText("E4")).toBeTruthy();
    expect(screen.getByText("两小时深度编程")).toBeTruthy();
    expect(screen.getByText("已验证")).toBeTruthy();
    expect(screen.getByText("production")).toBeTruthy();
    expect(screen.queryByText(/暂无证据记录/)).toBeNull();
  });

  test("missing activity title falls back to the placeholder, unverified stays visible", () => {
    render(
      <EvidenceTimeline
        items={[
          {
            id: "e2",
            activityId: "a2",
            activityTitle: null,
            evidenceLevel: 0,
            evidenceType: null,
            description: null,
            verified: false,
            createdAt: "2026-08-20T09:30:00Z",
          },
        ]}
      />,
    );
    expect(screen.getByText("（关联活动不可用）")).toBeTruthy();
    expect(screen.getByText("未验证")).toBeTruthy();
    expect(screen.getByText("未标注类型")).toBeTruthy();
  });
});

describe("P1-2 #8 — Domain / state filter interaction", () => {
  const domains = [
    { id: "d1", name: "Engineering", depth: 0, count: 3 },
    { id: "d2", name: "Arts", depth: 1, count: 1 },
  ];

  function filterProps(overrides: Partial<ComponentProps<typeof DomainFilterPanel>> = {}) {
    return {
      domains,
      totalCount: 7,
      activeDomainId: null,
      onSelectDomain: vi.fn(),
      stateFilter: "all" as const,
      onSelectState: vi.fn(),
      ...overrides,
    };
  }

  test("clicking a domain reports its id; clicking 全部领域 reports null", () => {
    const props = filterProps();
    render(<DomainFilterPanel {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /Arts/ }));
    expect(props.onSelectDomain).toHaveBeenCalledWith("d2");

    fireEvent.click(screen.getByRole("button", { name: /全部领域/ }));
    expect(props.onSelectDomain).toHaveBeenCalledWith(null);
  });

  test("clicking a state pill reports that exact filter value", () => {
    const props = filterProps();
    render(<DomainFilterPanel {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "学习中" }));
    expect(props.onSelectState).toHaveBeenCalledWith("learning");

    fireEvent.click(screen.getByRole("button", { name: "已归档" }));
    expect(props.onSelectState).toHaveBeenCalledWith("archived");
  });

  test("active selections are reflected as pressed buttons", () => {
    render(
      <DomainFilterPanel
        {...filterProps({ activeDomainId: "d1", stateFilter: "proficient" })}
      />,
    );
    expect(screen.getByRole("button", { name: /Engineering/, pressed: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: /全部领域/, pressed: false })).toBeTruthy();
    expect(screen.getByRole("button", { name: "熟练", pressed: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: "已归档", pressed: false })).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// P1-2 #4/#6/#7/#9/#10 — SkillDetailPanel states & authority-safe mutations
// ---------------------------------------------------------------------------

const DETAIL: SkillDetailResponse = {
  skill: {
    id: "s1",
    name: "Deep Work",
    aliases: ["专注"],
    description: "长时间不受干扰地工作的能力",
    domainId: null,
    domainName: null,
    level: 3,
    xp: 120,
    nextLevelXp: 200,
    masteryLevel: 3,
    masteryConfidence: 0.62,
    derivedState: "learning",
    lastUsedAt: "2026-08-01T10:00:00.000Z",
    createdAt: "2026-07-01T08:00:00.000Z",
  },
  prerequisites: [
    { id: "p1", name: "Prior Fulfilled", masteryLevel: 2, masteryConfidence: 0.8, isFulfilled: true },
    { id: "p2", name: "Missing Prereq", masteryLevel: 1, masteryConfidence: 0.3, isFulfilled: false },
  ],
  nextUnlocks: [{ id: "u1", name: "Advanced Unlock", derivedState: "locked" }],
  evidenceTimeline: [
    {
      id: "e1",
      activityId: "a1",
      activityTitle: "深度会话",
      evidenceLevel: 3,
      evidenceType: "production",
      description: null,
      verified: true,
      createdAt: "2026-08-02T09:00:00.000Z",
    },
  ],
  masteryHistory: [
    {
      id: "m1",
      eventType: "upgrade",
      fromLevel: 2,
      toLevel: 3,
      confidence: 0.55,
      reason: "突破证据：连续 30 天刻意练习",
      createdAt: "2026-08-03T12:00:00.000Z",
    },
    {
      id: "m2",
      eventType: "request_verification",
      fromLevel: 1,
      toLevel: 2,
      confidence: 0.5,
      reason: null,
      createdAt: "2026-08-01T12:00:00.000Z",
    },
  ],
  recentTransactions: [
    { id: "t1", amount: 40, reason: "活动结算", createdAt: "2026-08-04T10:00:00.000Z" },
  ],
};

const PANEL_BASE = {
  skillId: "s1",
  domains: [] as never[],
  onClose: vi.fn(),
  onFocusSkill: vi.fn(),
  onChanged: vi.fn(),
};

function panelProps(overrides: Partial<typeof PANEL_BASE> = {}) {
  return { ...PANEL_BASE, ...overrides };
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

describe("P1-2 #4 — Skill Detail loading / success / error", () => {
  test("loading state renders skeletons and no content yet", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    render(<SkillDetailPanel {...panelProps()} />);

    expect(screen.getByLabelText("加载中")).toBeTruthy();
    expect(screen.queryByText("Deep Work")).toBeNull();
  });

  test("success state renders the Stage 5B read model", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(DETAIL)));
    render(<SkillDetailPanel {...panelProps()} />);

    expect(await screen.findByText("Deep Work")).toBeTruthy();
    expect(screen.getByText("长时间不受干扰地工作的能力")).toBeTruthy();
    expect(screen.getByText("专注")).toBeTruthy();
    expect(screen.getByText("120 / 200 XP")).toBeTruthy();
    expect(screen.getByText("上次使用：")).toBeTruthy();
  });

  test("error state renders the failure message with a retry action", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: "boom" }, false, 500)),
    );
    render(<SkillDetailPanel {...panelProps()} />);

    expect(await screen.findByText("加载技能详情失败")).toBeTruthy();
    expect(screen.getByRole("button", { name: "重试" })).toBeTruthy();
  });
});

describe("P1-2 P2 — detail read model completion", () => {
  test("description section shows text when present", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(DETAIL)));
    render(<SkillDetailPanel {...panelProps()} />);
    await screen.findByLabelText("技能描述");
    expect(screen.getByText("长时间不受干扰地工作的能力")).toBeTruthy();
  });

  test("null description renders an explicit empty state (no invented copy)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          ...DETAIL,
          skill: { ...DETAIL.skill, description: null },
        }),
      ),
    );
    render(<SkillDetailPanel {...panelProps()} />);
    await screen.findByLabelText("技能描述");
    expect(screen.getByText("暂无描述。")).toBeTruthy();
  });

  test("createdAt is presented alongside lastUsedAt", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(DETAIL)));
    const { container } = render(<SkillDetailPanel {...panelProps()} />);
    await screen.findByText("Deep Work");

    expect(container.textContent).toContain("创建于：");
    expect(
      container.querySelector('time[dateTime="2026-07-01T08:00:00.000Z"]'),
    ).toBeTruthy();
  });

  test("mastery history renders confidence snapshot and reason per event", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(DETAIL)));
    render(<SkillDetailPanel {...panelProps()} />);

    await screen.findByText("M2→M3");
    expect(screen.getByText("置信 55%")).toBeTruthy();
    expect(screen.getByText("突破证据：连续 30 天刻意练习")).toBeTruthy();
    expect(screen.getByText("M1→M2")).toBeTruthy();
    expect(screen.getByText("置信 50%")).toBeTruthy();
    const reasonParagraphs = screen.getAllByText(/刻意练习/);
    expect(reasonParagraphs).toHaveLength(1);
  });
});

describe("P1-2 #6 — prerequisites use prereq.isFulfilled (no recomputation)", () => {
  test("fulfilled → check icon; unfulfilled → cross icon; both keep M/conf facts", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(DETAIL)));
    const { container } = render(<SkillDetailPanel {...panelProps()} />);
    await screen.findByText("Prior Fulfilled");

    const list = container.querySelector('section[aria-label="前置清单"]')!;
    const items = list.querySelectorAll("li");
    expect(items).toHaveLength(2);
    expect(
      items[0].querySelector(".text-\\[var\\(--state-success-text\\)\\]") ||
        items[0].querySelector("svg.lucide-check-circle-2") ||
        items[0].querySelector("svg.lucide-check-circle"),
    ).toBeTruthy();
    expect(
      items[1].querySelector(".text-\\[var\\(--state-danger-text\\)\\]") ||
        items[1].querySelector("svg.lucide-x-circle"),
    ).toBeTruthy();
    expect(list.textContent).toContain("M2 · 80%");
    expect(list.textContent).toContain("M1 · 30%");
  });

  test("clicking a prerequisite row forwards focus to onFocusSkill", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(DETAIL)));
    const onFocusSkill = vi.fn();
    render(<SkillDetailPanel {...panelProps({ onFocusSkill })} />);
    fireEvent.click(await screen.findByText("Missing Prereq"));
    expect(onFocusSkill).toHaveBeenCalledWith("p2");
  });
});

describe("P1-2 #7 — Next Unlock rendering", () => {
  test("unlock rows show name plus its derived-state badge and forward focus", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(DETAIL)));
    const onFocusSkill = vi.fn();
    render(<SkillDetailPanel {...panelProps({ onFocusSkill })} />);

    const unlockBtn = await screen.findByRole("button", { name: /Advanced Unlock/ });
    expect(unlockBtn.textContent).toContain("已锁定");
    fireEvent.click(unlockBtn);
    expect(onFocusSkill).toHaveBeenCalledWith("u1");
  });

  test("empty unlock list keeps the explicit empty hint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ ...DETAIL, nextUnlocks: [] })),
    );
    render(<SkillDetailPanel {...panelProps()} />);
    expect(await screen.findByText("暂无依赖此技能的后续解锁。")).toBeTruthy();
  });
});

describe("P1-2 #9/#10 — PATCH payloads respect the authority whitelist", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/s1")) return jsonResponse(DETAIL);
      throw new Error(`unexpected fetch ${url}`);
    }));
  });

  async function openEditorAndSave() {
    render(<SkillDetailPanel {...panelProps()} />);
    fireEvent.click(await screen.findByTitle("编辑元数据"));
    fireEvent.change(screen.getByLabelText("名称"), {
      target: { value: "Renamed Skill" },
    });
    fireEvent.change(screen.getByLabelText("别名（逗号分隔）"), {
      target: { value: "专注, deep work，深度工作" },
    });
    fireEvent.change(screen.getByLabelText("描述"), {
      target: { value: "新的描述" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => {
      expect(
        fetchMock()?.mock.calls.some(
          ([, init]) => (init as RequestInit)?.method === "PATCH",
        ),
      ).toBe(true);
    });
  }

  function fetchMock() {
    return globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
  }

  test("metadata save sends ONLY whitelisted fields with parsed values", async () => {
    await openEditorAndSave();

    const [, init] = fetchMock().mock.calls.find(
      ([, i]) => (i as RequestInit)?.method === "PATCH",
    )!;
    const body = JSON.parse(init!.body as string);
    expect(Object.keys(body).sort()).toEqual([
      "aliases",
      "description",
      "domainId",
      "name",
    ]);
    expect(body.name).toBe("Renamed Skill");
    expect(body.aliases).toEqual(["专注", "deep work", "深度工作"]);
    expect(body.description).toBe("新的描述");
    expect(body.domainId).toBeNull();
    expect(panelProps().onChanged).toHaveBeenCalled();
  });

  test("archive button PATCHes exactly { status: 'archived' }; unarchive the inverse", async () => {
    render(<SkillDetailPanel {...panelProps()} />);
    fireEvent.click(await screen.findByTitle("归档"));
    await waitFor(() => {
      expect(fetchMock()?.mock.calls.some(([, i]) => (i as RequestInit)?.method === "PATCH")).toBe(true);
    });
    const [, init] = fetchMock().mock.calls.find(([, i]) => (i as RequestInit)?.method === "PATCH")!;
    expect(Object.keys(JSON.parse(init!.body as string))).toEqual(["status"]);
    expect(JSON.parse(init!.body as string)).toEqual({ status: "archived" });
  });

  test("an archived skill offers 取消归档 which PATCHes { status: 'active' }", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          ...DETAIL,
          skill: { ...DETAIL.skill, derivedState: "archived" as const },
        }),
      ),
    );
    render(<SkillDetailPanel {...panelProps()} />);
    const unarchive = await screen.findByLabelText("取消归档");
    fireEvent.click(unarchive);
    await waitFor(() => {
      expect(fetchMock()?.mock.calls.some(([, i]) => (i as RequestInit)?.method === "PATCH")).toBe(true);
    });
    const [, init] = fetchMock().mock.calls.find(([, i]) => (i as RequestInit)?.method === "PATCH")!;
    expect(JSON.parse(init!.body as string)).toEqual({ status: "active" });
  });

  test("empty name is rejected client-side without any network call", async () => {
    render(<SkillDetailPanel {...panelProps()} />);
    fireEvent.click(await screen.findByTitle("编辑元数据"));
    fireEvent.change(screen.getByLabelText("名称"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByRole("alert").catch(() => null) ?? screen.getByText("名称不能为空"));
    expect(
      fetchMock()?.mock.calls.some(([, i]) => (i as RequestInit)?.method === "PATCH"),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// P1-2 edges — relation semantics survive the React Flow mapping
// ---------------------------------------------------------------------------

describe("P1-2 — toFlowEdges preserves frozen edge semantics", () => {
  test("prerequisite: solid sky arrow (static, tokenized)", () => {
    const [edge] = toFlowEdges([
      { id: "e1", source: "a", target: "b", relation: "prerequisite" },
    ]);
    expect(edge.animated).toBe(false);
    expect(edge.style!.stroke).toBe("var(--state-info-text)");
    expect(edge.style!.strokeDasharray).toBeUndefined();
    expect(edge.markerEnd).toMatchObject({
      type: MarkerType.ArrowClosed,
      color: "var(--state-info-text)",
    });
  });

  test("contains: dashed purple line with the custom circle marker url", () => {
    const [edge] = toFlowEdges([
      { id: "e2", source: "a", target: "b", relation: "contains" },
    ]);
    expect(edge.style!.stroke).toBe("var(--entity-artifact-text)");
    expect(edge.style!.strokeDasharray).toBe("6 4");
    expect(edge.markerEnd).toBe("url(#skill-edge-contains-circle)");
    expect(edge.animated).toBe(false);
  });

  test("supports: dotted neutral/muted, no marker", () => {
    const [edge] = toFlowEdges([
      { id: "e3", source: "a", target: "b", relation: "supports" },
    ]);
    expect(edge.style!.stroke).toBe("var(--text-muted)");
    expect(edge.style!.strokeDasharray).toBe("2 4");
    expect(edge.markerEnd).toBeUndefined();
    expect(edge.animated).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// P1-2 #3/#11 — page integration on the real canvas (jsdom)
// ---------------------------------------------------------------------------

const PAGE_GRAPH = {
  domains: [] as never[],
  nodes: [
    {
      id: "root",
      domainId: null,
      position: { x: 0, y: 0 },
      data: baseNodeData({ name: "Root Skill", derivedState: "available" as const }),
    },
    {
      id: "arch",
      domainId: null,
      position: { x: 320, y: 0 },
      data: baseNodeData({ name: "Archived One", derivedState: "archived" as const }),
    },
  ] satisfies SkillFlowNode[],
  edges: [] as SkillFlowEdge[],
};

const ROOT_DETAIL: SkillDetailResponse = {
  skill: {
    id: "root",
    name: "Root Skill",
    aliases: [],
    description: null,
    domainId: null,
    domainName: null,
    level: 1,
    xp: 0,
    nextLevelXp: 100,
    masteryLevel: 1,
    masteryConfidence: 0.4,
    derivedState: "available",
    lastUsedAt: null,
    createdAt: "2026-08-01T00:00:00.000Z",
  },
  prerequisites: [],
  nextUnlocks: [{ id: "arch", name: "Archived One", derivedState: "archived" }],
  evidenceTimeline: [],
  masteryHistory: [],
  recentTransactions: [],
};

function stubPageFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/skills?status=all") return jsonResponse(PAGE_GRAPH);
    if (url === "/api/skills/root") return jsonResponse(ROOT_DETAIL);
    throw new Error(`unexpected fetch ${url}`);
  });
}

async function openRootDetail() {
  vi.stubGlobal("fetch", stubPageFetch());
  render(<SkillsPage />);

  const rootNode = await waitFor(() => {
    const el = document.querySelector('.react-flow__node[data-id="root"]');
    expect(el).not.toBeNull();
    return el as HTMLElement;
  });
  fireEvent.click(rootNode);
  await screen.findByText("Root Skill");
  expect(document.querySelector('marker#skill-edge-contains-circle')).toBeTruthy();
}

describe("P1-2 #3 — node selection triggers the detail flow", () => {
  test("clicking a canvas node opens its detail panel and fetches /api/skills/:id", async () => {
    await openRootDetail();

    expect(screen.getByLabelText("技能详情面板")).toBeTruthy();
    const calls = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map(
      ([u]) => String(u),
    );
    expect(calls).toContain("/api/skills?status=all");
    expect(calls).toContain("/api/skills/root");
  });

  test("closing the panel clears selection", async () => {
    await openRootDetail();
    fireEvent.click(screen.getAllByLabelText("关闭详情面板").at(-1)!);
    await waitFor(() => {
      expect(screen.queryByLabelText("技能详情面板")).toBeNull();
    });
  });
});

describe("P1-2 #11 — archived-focus regression through the real UI", () => {
  test("active target keeps the normal 'all' scope; archived node stays hidden", async () => {
    await openRootDetail();

    expect(
      screen.getByRole("button", { name: "全部", pressed: true }),
    ).toBeTruthy();
    expect(document.querySelector('.react-flow__node[data-id="arch"]')).toBeNull();
    expect(document.querySelector('.react-flow__node[data-id="root"]')).not.toBeNull();
  });

  test("archived target → focus transition selects the archived filter → archived node becomes visible", async () => {
    await openRootDetail();

    fireEvent.click(screen.getByRole("button", { name: /Archived One/ }));

    await waitFor(() => {
      expect(
        document.querySelector('.react-flow__node[data-id="arch"]'),
      ).not.toBeNull();
    });
    expect(
      screen.getByRole("button", { name: "已归档", pressed: true }),
    ).toBeTruthy();
  });
});

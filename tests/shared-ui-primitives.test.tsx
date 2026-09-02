// @vitest-environment jsdom
/**
 * Shared UI Primitives — Verification & Governance Test Suite
 * Authoritative source: docs/DesignSystem/04_SHARED_COMPONENT_SYSTEM.md
 * Phase: Phase 3
 */

import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

import {
  GlassPanel,
  RPGCard,
  SectionCard,
  StatCard,
  LevelBadge,
  MasteryBadge,
  ConfidenceBadge,
  StatusBadge,
  EntityChip,
  XPProgress,
  QuestProgress,
  ReusabilityMeter,
  PrimaryButton,
  SecondaryButton,
  DangerButton,
  SearchInput,
  FilterBar,
  BaseModal,
  ConfirmDialog,
  ToastNotification,
  Tooltip,
} from "@/components/ui";
import { InspectorDrawer } from "@/components/layout/InspectorDrawer";

describe("Shared UI Primitives — Component Library Verification", () => {
  afterEach(() => {
    cleanup();
  });

  // ==========================================================================
  // 1. SURFACES & CARDS
  // ==========================================================================
  it("1. GlassPanel variants map strictly to approved surface tokens", () => {
    const { rerender } = render(<GlassPanel variant="ground">Ground</GlassPanel>);
    let panel = screen.getByTestId("glass-panel");
    expect(panel.className).toContain("bg-[var(--surface-ground)]");

    rerender(<GlassPanel variant="base">Base</GlassPanel>);
    panel = screen.getByTestId("glass-panel");
    expect(panel.className).toContain("bg-[var(--surface-base)]");

    rerender(<GlassPanel variant="raised">Raised</GlassPanel>);
    panel = screen.getByTestId("glass-panel");
    expect(panel.className).toContain("bg-[var(--surface-raised)]");

    rerender(<GlassPanel variant="overlay">Overlay</GlassPanel>);
    panel = screen.getByTestId("glass-panel");
    expect(panel.className).toContain("bg-[var(--surface-overlay)]");
  });

  it("2. GlassPanel neutral default does NOT use Gold by default", () => {
    render(<GlassPanel>Default Neutral Panel</GlassPanel>);
    const panel = screen.getByTestId("glass-panel");
    expect(panel.className).toContain("border-[var(--border-default)]");
    expect(panel.className).not.toContain("gold");
  });

  it("3. RPGCard generic does NOT use Gold and uses neutral hover tokens", () => {
    render(<RPGCard entityType="generic" onClick={vi.fn()}>Generic Card</RPGCard>);
    const card = screen.getByTestId("rpg-card");
    expect(card.className).not.toContain("var(--gold-");
    expect(card.getAttribute("data-entity-type")).toBe("generic");
    expect(card.className).toContain("hover:border-[var(--border-hover-neutral)]");
    expect(card.className).toContain("hover:bg-[var(--surface-hover-neutral)]");
  });

  it("4. RPGCard entity variants use appropriate entity token families", () => {
    const { rerender } = render(
      <RPGCard entityType="activity" onClick={vi.fn()}>Activity Card</RPGCard>
    );
    let card = screen.getByTestId("rpg-card");
    expect(card.className).toContain("hover:border-[var(--entity-activity-border)]");

    rerender(<RPGCard entityType="quest" onClick={vi.fn()}>Quest Card</RPGCard>);
    card = screen.getByTestId("rpg-card");
    expect(card.className).toContain("hover:border-[var(--entity-quest-border)]");

    rerender(<RPGCard entityType="skill" onClick={vi.fn()}>Skill Card</RPGCard>);
    card = screen.getByTestId("rpg-card");
    expect(card.className).toContain("hover:border-[var(--entity-skill-border)]");
    expect(card.className).toContain("hover:shadow-[var(--shadow-card)]");
    expect(card.className).not.toContain("glow-gold");

    rerender(<RPGCard entityType="knowledge" onClick={vi.fn()}>Knowledge Card</RPGCard>);
    card = screen.getByTestId("rpg-card");
    expect(card.className).toContain("hover:border-[var(--entity-knowledge-border)]");

    rerender(<RPGCard entityType="artifact" onClick={vi.fn()}>Artifact Card</RPGCard>);
    card = screen.getByTestId("rpg-card");
    expect(card.className).toContain("hover:border-[var(--entity-artifact-border)]");

    rerender(<RPGCard entityType="evidence" onClick={vi.fn()}>Evidence Card</RPGCard>);
    card = screen.getByTestId("rpg-card");
    expect(card.className).toContain("hover:border-[var(--entity-evidence-border)]");
  });

  it("5. SectionCard renders header, body, and footer slots cleanly", () => {
    render(
      <SectionCard
        title="区域标题"
        subtitle="区域副标题"
        icon={<span data-testid="test-icon">⚡</span>}
        action={<button data-testid="test-action">操作</button>}
        footer={<span data-testid="test-footer">页脚提示</span>}
      >
        <p>主体内容</p>
      </SectionCard>
    );

    expect(screen.getByTestId("section-card-title").textContent).toBe("区域标题");
    expect(screen.getByTestId("section-card-subtitle").textContent).toBe("区域副标题");
    expect(screen.getByTestId("test-icon")).toBeTruthy();
    expect(screen.getByTestId("test-action")).toBeTruthy();
    expect(screen.getByText("主体内容")).toBeTruthy();
    expect(screen.getByTestId("test-footer")).toBeTruthy();
  });

  it("6. StatCard renders numeric/tabular layout with prominent value", () => {
    render(
      <StatCard
        label="总经验值"
        value="12,500"
        subtitle="超越 85% 探索者"
        trend={<span data-testid="trend-val">+250 XP</span>}
      />
    );

    expect(screen.getByTestId("stat-card-label").textContent).toBe("总经验值");
    expect(screen.getByTestId("stat-card-value").textContent).toBe("12,500");
    expect(screen.getByTestId("stat-card-subtitle").textContent).toBe("超越 85% 探索者");
    expect(screen.getByTestId("trend-val")).toBeTruthy();
  });

  it("7. RPGCard selected state has visible non-zero border and stable neutral styling on hover", () => {
    const { rerender } = render(
      <RPGCard entityType="skill" selected={true} onClick={vi.fn()}>
        已选技能卡
      </RPGCard>
    );

    let card = screen.getByTestId("rpg-card");
    expect(card.className).toContain("border");
    expect(card.className).not.toContain("border-0");
    expect(card.className).toContain("border-[var(--selection-neutral-border)]");
    expect(card.className).toContain("bg-[var(--selection-neutral-bg)]");
    expect(card.className).not.toContain("hover:border-[var(--entity-skill-border)]");

    rerender(
      <RPGCard entityType="artifact" selected={true} onClick={vi.fn()}>
        已选造物卡
      </RPGCard>
    );
    card = screen.getByTestId("rpg-card");
    expect(card.className).toContain("border-[var(--selection-neutral-border)]");
    expect(card.className).not.toContain("hover:border-[var(--entity-artifact-border)]");
  });

  // ==========================================================================
  // 2. BADGES & ENTITY PRESENTATION
  // ==========================================================================
  it("8. LevelBadge renders LV integer with octagonal seal silhouette", () => {
    render(<LevelBadge level={14} />);
    const badge = screen.getByTestId("level-badge");
    expect(badge.textContent).toBe("LV.14");
    expect(badge.getAttribute("data-level")).toBe("14");
    expect(badge.getAttribute("data-shape")).toBe("octagonal-seal");
    expect(badge.className).toContain("clip-path:polygon");
    expect(badge.getAttribute("aria-label")).toBe("玩家等级 LV.14");
  });

  it("9. LevelBadge does not expose mastery semantics", () => {
    render(<LevelBadge level={5} />);
    const badge = screen.getByTestId("level-badge");
    expect(badge.textContent).not.toContain("M");
    expect(badge.textContent).toBe("LV.5");
  });

  it("10. MasteryBadge requires visible M label and renders M0 with 5 empty diamonds", () => {
    render(<MasteryBadge level={0} />);
    const badge = screen.getByTestId("mastery-badge");
    expect(screen.getByTestId("mastery-badge-label").textContent).toBe("M0");
    const diamonds = badge.querySelectorAll("svg");
    expect(diamonds.length).toBe(5);
    diamonds.forEach((d) => {
      expect(d.getAttribute("data-state")).toBe("empty");
    });
  });

  it("11. MasteryBadge renders M10 with mandatory visible label and 5 full diamonds", () => {
    render(<MasteryBadge level={10} />);
    const badge = screen.getByTestId("mastery-badge");
    expect(screen.getByTestId("mastery-badge-label").textContent).toBe("M10");
    const diamonds = badge.querySelectorAll("svg");
    expect(diamonds.length).toBe(5);
    diamonds.forEach((d) => {
      expect(d.getAttribute("data-state")).toBe("full");
    });
  });

  it("12. MasteryBadge renders exactly five diamonds representing ten half-steps", () => {
    render(<MasteryBadge level={7} />);
    const badge = screen.getByTestId("mastery-badge");
    expect(screen.getByTestId("mastery-badge-label").textContent).toBe("M7");
    const diamonds = badge.querySelectorAll("svg");
    expect(diamonds.length).toBe(5);
  });

  it("13. Every M0–M10 state is losslessly represented across the 5 diamonds", () => {
    const expectedStates: Array<Array<"empty" | "half" | "full">> = [
      ["empty", "empty", "empty", "empty", "empty"], // M0
      ["half", "empty", "empty", "empty", "empty"],  // M1
      ["full", "empty", "empty", "empty", "empty"],  // M2
      ["full", "half", "empty", "empty", "empty"],   // M3
      ["full", "full", "empty", "empty", "empty"],   // M4
      ["full", "full", "half", "empty", "empty"],    // M5
      ["full", "full", "full", "empty", "empty"],    // M6
      ["full", "full", "full", "half", "empty"],     // M7
      ["full", "full", "full", "full", "empty"],     // M8
      ["full", "full", "full", "full", "half"],      // M9
      ["full", "full", "full", "full", "full"],      // M10
    ];

    for (let level = 0; level <= 10; level++) {
      const { unmount } = render(<MasteryBadge level={level} />);
      const badge = screen.getByTestId("mastery-badge");
      expect(badge.getAttribute("data-mastery-level")).toBe(String(level));
      expect(screen.getByTestId("mastery-badge-label").textContent).toBe(`M${level}`);

      const diamonds = badge.querySelectorAll("svg");
      const actualStates = Array.from(diamonds).map((d) => d.getAttribute("data-state"));
      expect(actualStates).toEqual(expectedStates[level]);
      unmount();
    }
  });

  it("14. Invalid mastery values are safely normalized between 0 and 10", () => {
    const { unmount, rerender } = render(<MasteryBadge level={-5} />);
    let badge = screen.getByTestId("mastery-badge");
    expect(badge.getAttribute("data-mastery-level")).toBe("0");
    expect(screen.getByTestId("mastery-badge-label").textContent).toBe("M0");

    rerender(<MasteryBadge level={25} />);
    badge = screen.getByTestId("mastery-badge");
    expect(badge.getAttribute("data-mastery-level")).toBe("10");
    expect(screen.getByTestId("mastery-badge-label").textContent).toBe("M10");
    unmount();
  });

  it("15. ConfidenceBadge mastery variant renders retention confidence", () => {
    render(<ConfidenceBadge variant="mastery" score={0.92} />);
    const badge = screen.getByTestId("confidence-badge");
    expect(badge.getAttribute("data-variant")).toBe("mastery");
    expect(badge.getAttribute("data-tier")).toBe("high");
    expect(badge.textContent).toContain("92%");
    expect(badge.getAttribute("aria-label")).toContain("掌握保持置信度");
  });

  it("16. ConfidenceBadge assessment variant renders AI proposal confidence", () => {
    render(<ConfidenceBadge variant="assessment" score={0.75} />);
    const badge = screen.getByTestId("confidence-badge");
    expect(badge.getAttribute("data-variant")).toBe("assessment");
    expect(badge.getAttribute("data-tier")).toBe("medium");
    expect(badge.textContent).toContain("75%");
    expect(badge.getAttribute("aria-label")).toContain("AI评估置信度");
  });

  it("17. ConfidenceBadge knowledge variant renders epistemic confidence", () => {
    render(<ConfidenceBadge variant="knowledge" score={0.42} />);
    const badge = screen.getByTestId("confidence-badge");
    expect(badge.getAttribute("data-variant")).toBe("knowledge");
    expect(badge.getAttribute("data-tier")).toBe("low");
    expect(badge.textContent).toContain("42%");
    expect(badge.getAttribute("aria-label")).toContain("知识图谱置信度");
  });

  it("18. Confidence high threshold >= 0.80 uses functional green tokens", () => {
    render(<ConfidenceBadge variant="assessment" score={0.80} />);
    const badge = screen.getByTestId("confidence-badge");
    expect(badge.className).toContain("var(--confidence-high-bg)");
    expect(badge.className).toContain("var(--confidence-high-text)");
  });

  it("19. Confidence medium threshold >= 0.50 and < 0.80 uses dedicated amber neutral", () => {
    render(<ConfidenceBadge variant="assessment" score={0.65} />);
    const badge = screen.getByTestId("confidence-badge");
    expect(badge.className).toContain("var(--confidence-medium-bg)");
    expect(badge.className).toContain("var(--confidence-medium-text)");
  });

  it("20. Confidence low threshold < 0.50 uses functional muted tokens", () => {
    render(<ConfidenceBadge variant="assessment" score={0.35} />);
    const badge = screen.getByTestId("confidence-badge");
    expect(badge.className).toContain("var(--confidence-low-bg)");
    expect(badge.className).toContain("var(--confidence-low-text)");
  });

  it("21. ConfidenceBadge contains NO Gold tokens across all tiers", () => {
    const scores = [0.95, 0.65, 0.35];
    scores.forEach((score) => {
      const { unmount } = render(<ConfidenceBadge variant="knowledge" score={score} />);
      const badge = screen.getByTestId("confidence-badge");
      expect(badge.className).not.toContain("var(--gold-");
      unmount();
    });
  });

  it("22. StatusBadge supports Artifact Lifecycle states", () => {
    render(<StatusBadge type="artifactLifecycle" state="active" />);
    const badge = screen.getByTestId("status-badge");
    expect(badge.getAttribute("data-namespace")).toBe("artifactLifecycle");
    expect(badge.getAttribute("data-state")).toBe("active");
    expect(badge.textContent).toContain("生效中");
  });

  it("23. StatusBadge supports Knowledge Authority states", () => {
    render(<StatusBadge type="knowledgeAuthority" state="verified" />);
    const badge = screen.getByTestId("status-badge");
    expect(badge.getAttribute("data-namespace")).toBe("knowledgeAuthority");
    expect(badge.getAttribute("data-state")).toBe("verified");
    expect(badge.textContent).toContain("已验证");
  });

  it("24. Lifecycle superseded != Authority superseded token family", () => {
    const { unmount, rerender } = render(
      <StatusBadge type="artifactLifecycle" state="superseded" />
    );
    let badge = screen.getByTestId("status-badge");
    expect(badge.className).toContain("var(--status-superseded-bg)");

    rerender(<StatusBadge type="knowledgeAuthority" state="superseded" />);
    badge = screen.getByTestId("status-badge");
    expect(badge.className).toContain("var(--authority-superseded-bg)");
    unmount();
  });

  it("25. StatusBadge pairs explicit icon with visible text label (never color alone)", () => {
    render(<StatusBadge type="knowledgeAuthority" state="rejected" />);
    const badge = screen.getByTestId("status-badge");
    expect(badge.querySelector("svg")).toBeTruthy();
    expect(screen.getByTestId("status-badge-label").textContent).toBe("已驳回");
  });

  it("26. EntityChip has non-nested interactive structure and supports keyboard operation", () => {
    const onRemove = vi.fn();
    const onClick = vi.fn();

    render(
      <EntityChip
        entityType="quest"
        label="主线任务"
        count={3}
        onRemove={onRemove}
        onClick={onClick}
      />
    );

    const chip = screen.getByTestId("entity-chip");
    expect(chip.getAttribute("data-entity-type")).toBe("quest");
    expect(screen.getByTestId("entity-chip-label").textContent).toBe("主线任务");
    expect(screen.getByTestId("entity-chip-count").textContent).toBe("3");

    // Main button action
    const mainBtn = screen.getByTestId("entity-chip-button");
    fireEvent.click(mainBtn);
    expect(onClick).toHaveBeenCalledTimes(1);

    // Remove button action (does NOT fire main onClick)
    const removeBtn = screen.getByTestId("entity-chip-remove");
    fireEvent.click(removeBtn);
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("27. EntityChip does NOT render remove control when onRemove is absent", () => {
    render(<EntityChip label="无删除实体" removable={true} />);
    expect(screen.queryByTestId("entity-chip-remove")).toBeNull();
  });

  // ==========================================================================
  // 3. INTERACTIVE SEMANTICS & TOUCH TARGETS (44x44 Min Dimensions)
  // ==========================================================================
  it("28. RPGCard Enter and Space keys trigger genuine DOM click and prevent scroll on Space", () => {
    const onClick = vi.fn((e) => {
      expect(e.type).toBe("click");
    });
    render(<RPGCard onClick={onClick}>可操作卡片</RPGCard>);
    const card = screen.getByTestId("rpg-card");

    fireEvent.keyDown(card, { key: "Enter" });
    expect(onClick).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(card, { key: " " });
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("29. RPGCard onKeyDown respects defaultPrevented and non-interactive card is not a button", () => {
    const onClick = vi.fn();
    const onKeyDown = vi.fn((e: React.KeyboardEvent) => {
      e.preventDefault();
    });

    render(
      <div>
        <RPGCard onClick={onClick} onKeyDown={onKeyDown}>
          受控卡片
        </RPGCard>
        <RPGCard data-testid="plain-card">普通卡片</RPGCard>
      </div>
    );

    const interactiveCard = screen.getByText("受控卡片");
    fireEvent.keyDown(interactiveCard, { key: "Enter" });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();

    const plainCard = screen.getByTestId("plain-card");
    expect(plainCard.getAttribute("role")).toBeNull();
    expect(plainCard.getAttribute("tabindex")).toBeNull();
  });

  it("30. Buttons across all sizes satisfy Base/mobile min 44x44 touch target", () => {
    const { unmount, rerender } = render(<PrimaryButton size="sm">小按钮</PrimaryButton>);
    let btn = screen.getByTestId("primary-button");
    expect(btn.className).toContain("min-h-[var(--touch-target-min)]");
    expect(btn.className).toContain("min-w-[var(--touch-target-min)]");

    rerender(<SecondaryButton size="md">中按钮</SecondaryButton>);
    btn = screen.getByTestId("secondary-button");
    expect(btn.className).toContain("min-h-[var(--touch-target-min)]");
    expect(btn.className).toContain("min-w-[var(--touch-target-min)]");

    rerender(<DangerButton size="lg">大按钮</DangerButton>);
    btn = screen.getByTestId("danger-button");
    expect(btn.className).toContain("min-h-[var(--touch-target-min)]");
    expect(btn.className).toContain("min-w-[var(--touch-target-min)]");
    unmount();
  });

  it("31. SearchInput and clear control satisfy min 44x44 touch target", () => {
    render(<SearchInput value="关键词" onChange={vi.fn()} onClear={vi.fn()} />);
    const input = screen.getByTestId("search-input");
    expect(input.className).toContain("min-h-[var(--touch-target-min)]");

    const clearBtn = screen.getByTestId("search-input-clear");
    expect(clearBtn.className).toContain("min-h-[var(--touch-target-min)]");
    expect(clearBtn.className).toContain("min-w-[var(--touch-target-min)]");
  });

  it("32. FilterBar options and reset control satisfy min 44x44 touch target", () => {
    const options = [{ id: "opt1", label: "选项一" }];
    render(<FilterBar options={options} activeId="opt1" onChange={vi.fn()} onReset={vi.fn()} />);

    const optBtn = screen.getByTestId("filter-bar-option-opt1");
    expect(optBtn.className).toContain("min-h-[var(--touch-target-min)]");
    expect(optBtn.className).toContain("min-w-[var(--touch-target-min)]");

    const resetBtn = screen.getByTestId("filter-bar-reset");
    expect(resetBtn.className).toContain("min-h-[var(--touch-target-min)]");
    expect(resetBtn.className).toContain("min-w-[var(--touch-target-min)]");
  });

  it("33. EntityChip and Toast dismiss satisfy min 44x44 touch target", () => {
    render(
      <div>
        <EntityChip label="实体" onClick={vi.fn()} onRemove={vi.fn()} />
        <ToastNotification message="通知" onDismiss={vi.fn()} />
      </div>
    );

    const chipBtn = screen.getByTestId("entity-chip-button");
    expect(chipBtn.className).toContain("min-h-[var(--touch-target-min)]");
    expect(chipBtn.className).toContain("min-w-[var(--touch-target-min)]");

    const removeBtn = screen.getByTestId("entity-chip-remove");
    expect(removeBtn.className).toContain("min-h-[var(--touch-target-min)]");
    expect(removeBtn.className).toContain("min-w-[var(--touch-target-min)]");

    const toastDismiss = screen.getByTestId("toast-dismiss");
    expect(toastDismiss.className).toContain("min-h-[var(--touch-target-min)]");
    expect(toastDismiss.className).toContain("min-w-[var(--touch-target-min)]");
  });

  // ==========================================================================
  // 4. METERS & PROGRESS
  // ==========================================================================
  it("34. XPProgress renders valid ARIA progressbar range (0 to 100) and tabular readout", () => {
    render(<XPProgress current={250} max={500} />);
    const meter = screen.getByTestId("xp-progress");
    expect(meter.getAttribute("aria-valuemin")).toBe("0");
    expect(meter.getAttribute("aria-valuemax")).toBe("100");
    expect(meter.getAttribute("aria-valuenow")).toBe("50");
    expect(meter.getAttribute("aria-valuetext")).toBe("250 / 500 XP (50%)");
    expect(screen.getByTestId("xp-progress-current").textContent).toBe("250");
    expect(screen.getByTestId("xp-progress-max").textContent).toBe("500 XP");
  });

  it("35. XPProgress safely handles max=0, current>max, and negative values without NaN", () => {
    const { unmount, rerender } = render(<XPProgress current={100} max={0} />);
    let meter = screen.getByTestId("xp-progress");
    expect(meter.getAttribute("aria-valuenow")).toBe("0");
    expect(screen.getByTestId("xp-progress-bar").getAttribute("style")).toBe("width: 0%;");

    rerender(<XPProgress current={600} max={500} />);
    meter = screen.getByTestId("xp-progress");
    expect(meter.getAttribute("aria-valuenow")).toBe("100");
    expect(screen.getByTestId("xp-progress-bar").getAttribute("style")).toBe("width: 100%;");

    rerender(<XPProgress current={-50} max={200} />);
    meter = screen.getByTestId("xp-progress");
    expect(meter.getAttribute("aria-valuenow")).toBe("0");
    expect(screen.getByTestId("xp-progress-bar").getAttribute("style")).toBe("width: 0%;");
    unmount();
  });

  it("36. XPProgress track uses surface-hover-neutral and fill uses approved Gold progression gradient", () => {
    render(<XPProgress current={400} max={800} />);
    const track = screen.getByTestId("xp-progress-track");
    expect(track.className).toContain("bg-[var(--surface-hover-neutral)]");

    const bar = screen.getByTestId("xp-progress-bar");
    expect(bar.className).toContain("from-[var(--gold-500)]");
    expect(bar.className).toContain("to-[var(--gold-300)]");
    expect(bar.getAttribute("style")).toBe("width: 50%;");
  });

  it("37. XPProgress size variants (sm, md, lg) all strictly consume progress-track-height token", () => {
    const { unmount, rerender } = render(<XPProgress current={100} max={200} size="sm" />);
    let track = screen.getByTestId("xp-progress-track");
    expect(track.className).toContain("h-[var(--progress-track-height)]");

    rerender(<XPProgress current={100} max={200} size="md" />);
    track = screen.getByTestId("xp-progress-track");
    expect(track.className).toContain("h-[var(--progress-track-height)]");

    rerender(<XPProgress current={100} max={200} size="lg" />);
    track = screen.getByTestId("xp-progress-track");
    expect(track.className).toContain("h-[var(--progress-track-height)]");
    unmount();
  });

  it("38. QuestProgress renders semantic 0–100% with Azure Horizon tokens and NO Gold", () => {
    render(<QuestProgress progress={65} milestones={[25, 50, 75]} />);
    const meter = screen.getByTestId("quest-progress");
    expect(meter.getAttribute("aria-valuenow")).toBe("65");
    expect(screen.getByTestId("quest-progress-percentage").textContent).toBe("65%");
    const bar = screen.getByTestId("quest-progress-bar");
    expect(bar.className).toContain("var(--entity-quest-text)");
    expect(bar.className).not.toContain("var(--gold-");
  });

  it("39. ReusabilityMeter renders 0.00 to 1.00 score with Amethyst Scholar styling", () => {
    render(<ReusabilityMeter score={0.88} />);
    const meter = screen.getByTestId("reusability-meter");
    expect(meter.getAttribute("aria-valuenow")).toBe("0.88");
    expect(screen.getByTestId("reusability-meter-value").textContent).toBe("0.88");
    const bar = screen.getByTestId("reusability-meter-bar");
    expect(bar.className).toContain("var(--entity-artifact-text)");
  });

  // ==========================================================================
  // 5. BASEMODAL PORTAL & OVERLAY STACK ARBITRATION
  // ==========================================================================
  it("40. BaseModal renders via createPortal to document.body and escapes local ancestor stacking context", () => {
    render(
      <div data-testid="fake-canvas" className="relative z-[var(--z-canvas)]">
        <BaseModal open={true} onClose={vi.fn()} title="传送门模态框">
          <p>模态内容</p>
        </BaseModal>
      </div>
    );

    const fakeCanvas = screen.getByTestId("fake-canvas");
    const modalRoot = screen.getByTestId("base-modal-root");

    // Modal root is mounted in document.body outside fake-canvas
    expect(fakeCanvas.contains(modalRoot)).toBe(false);
    expect(document.body.contains(modalRoot)).toBe(true);

    const backdrop = screen.getByTestId("base-modal-backdrop");
    expect(backdrop.className).toContain("z-[var(--z-modal-backdrop)]");

    const panel = screen.getByTestId("base-modal-panel");
    expect(panel.className).toContain("z-[var(--z-modal)]");
  });

  it("41. BaseModal panel simultaneously expresses the frozen responsive viewport matrix", () => {
    render(
      <BaseModal open={true} onClose={vi.fn()} title="响应式模态框">
        <p>内容</p>
      </BaseModal>
    );
    const panel = screen.getByTestId("base-modal-panel");
    expect(panel.className).toContain("w-full h-full rounded-none");
    expect(panel.className).toContain("md:h-auto");
    expect(panel.className).toContain("md:max-w-[var(--modal-max-width-sm)]");
    expect(panel.className).toContain("lg:max-w-[var(--modal-max-width-default)]");
    expect(panel.className).toContain("xl:max-w-[var(--modal-max-width-wide)]");
    expect(panel.className).toContain("md:rounded-[var(--radius-xl)]");
    expect(panel.className).not.toContain("workspace-max-width");
  });

  it("42. BaseModal generates unique accessible IDs for multiple instances", () => {
    render(
      <div>
        <BaseModal open={true} onClose={vi.fn()} title="对话框一">
          <p>内容一</p>
        </BaseModal>
        <BaseModal open={true} onClose={vi.fn()} title="对话框二">
          <p>内容二</p>
        </BaseModal>
      </div>
    );

    const titles = screen.getAllByTestId("base-modal-title");
    expect(titles.length).toBe(2);
    expect(titles[0].id).not.toBe(titles[1].id);
  });

  it("43. ConfirmDialog aria-describedby points to visible description and renders via portal", () => {
    render(
      <div data-testid="caller-wrapper">
        <ConfirmDialog
          open={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          title="确认删除"
          description="此操作将永久抹去该记录"
        />
      </div>
    );

    const callerWrapper = screen.getByTestId("caller-wrapper");
    const modalRoot = screen.getByTestId("base-modal-root");
    expect(callerWrapper.contains(modalRoot)).toBe(false);

    const panel = screen.getByTestId("base-modal-panel");
    const descId = panel.getAttribute("aria-describedby");
    expect(descId).toBeTruthy();

    const descElem = screen.getByTestId("confirm-dialog-description");
    expect(descElem.id).toBe(descId);
    expect(descElem.textContent).toBe("此操作将永久抹去该记录");
  });

  it("44. BaseModal automatically transfers initial focus inside modal without manual focus call", () => {
    function TestFocusModal() {
      const [open, setOpen] = React.useState(false);
      return (
        <div>
          <button data-testid="modal-opener" onClick={() => setOpen(true)}>
            打开
          </button>
          <BaseModal open={open} onClose={() => setOpen(false)} title="测试焦点">
            <button data-testid="modal-inner-btn">内部按钮</button>
          </BaseModal>
        </div>
      );
    }

    render(<TestFocusModal />);
    const opener = screen.getByTestId("modal-opener");
    opener.focus();
    expect(document.activeElement).toBe(opener);

    // Click to open modal
    fireEvent.click(opener);

    // Initial focus must automatically be transferred inside the modal
    const modalPanel = screen.getByTestId("base-modal-panel");
    expect(modalPanel.contains(document.activeElement)).toBe(true);
  });

  it("45. BaseModal Tab cycles focus within dialog", () => {
    render(
      <BaseModal open={true} onClose={vi.fn()} title="Tab 测试">
        <button data-testid="btn-1">第一</button>
        <button data-testid="btn-2">第二</button>
      </BaseModal>
    );

    const modalRoot = screen.getByTestId("base-modal-root");
    const btnClose = screen.getByTestId("base-modal-close");
    const btn1 = screen.getByTestId("btn-1");
    const btn2 = screen.getByTestId("btn-2");

    btn2.focus();
    expect(document.activeElement).toBe(btn2);

    fireEvent.keyDown(modalRoot, { key: "Tab" });
    expect(document.activeElement === btnClose || document.activeElement === btn1).toBe(true);
  });

  it("46. BaseModal Shift+Tab cycles focus backwards", () => {
    render(
      <BaseModal open={true} onClose={vi.fn()} title="Shift+Tab 测试">
        <button data-testid="btn-1">第一</button>
        <button data-testid="btn-2">第二</button>
      </BaseModal>
    );

    const modalRoot = screen.getByTestId("base-modal-root");
    const btnClose = screen.getByTestId("base-modal-close");
    const btn2 = screen.getByTestId("btn-2");

    btnClose.focus();
    expect(document.activeElement).toBe(btnClose);

    fireEvent.keyDown(modalRoot, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(btn2);
  });

  it("47. BaseModal closes on Escape key when enabled, remains open when disabled", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <BaseModal open={true} onClose={onClose} closeOnEscape={true} title="Escape 测试">
        <p>内容</p>
      </BaseModal>
    );

    let modalRoot = screen.getByTestId("base-modal-root");
    fireEvent.keyDown(modalRoot, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockClear();
    rerender(
      <BaseModal open={true} onClose={onClose} closeOnEscape={false} title="Escape 测试">
        <p>内容</p>
      </BaseModal>
    );

    modalRoot = screen.getByTestId("base-modal-root");
    fireEvent.keyDown(modalRoot, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("48. BaseModal closes on backdrop click when enabled, remains open when disabled", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <BaseModal open={true} onClose={onClose} closeOnBackdropClick={true} title="Backdrop 测试">
        <p>内容</p>
      </BaseModal>
    );

    let backdrop = screen.getByTestId("base-modal-backdrop");
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockClear();
    rerender(
      <BaseModal open={true} onClose={onClose} closeOnBackdropClick={false} title="Backdrop 测试">
        <p>内容</p>
      </BaseModal>
    );

    backdrop = screen.getByTestId("base-modal-backdrop");
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("49. BaseModal restores focus to opener element upon close and unmount", () => {
    function TestRestore() {
      const [open, setOpen] = React.useState(false);
      return (
        <div>
          <button data-testid="restore-opener" onClick={() => setOpen(true)}>
            打开模态框
          </button>
          <BaseModal open={open} onClose={() => setOpen(false)} title="恢复测试">
            <button onClick={() => setOpen(false)} data-testid="modal-close-trigger">
              完成并关闭
            </button>
          </BaseModal>
        </div>
      );
    }

    render(<TestRestore />);
    const opener = screen.getByTestId("restore-opener");
    opener.focus();
    expect(document.activeElement).toBe(opener);

    fireEvent.click(opener);
    const closeTrigger = screen.getByTestId("modal-close-trigger");
    fireEvent.click(closeTrigger);

    expect(document.activeElement).toBe(opener);
  });

  it("50. Tooltip portals to document.body and escapes overflow-hidden ancestor with z-tooltip authority", () => {
    render(
      <div data-testid="clipped-container" className="overflow-hidden relative z-10 w-32 h-10">
        <Tooltip content="全局提示信息">
          <button data-testid="portal-tip-trigger">提示触发器</button>
        </Tooltip>
      </div>
    );

    const trigger = screen.getByTestId("portal-tip-trigger");
    const container = screen.getByTestId("clipped-container");

    fireEvent.mouseEnter(trigger);
    const tooltip = screen.getByTestId("tooltip-content");

    // Tooltip must be portaled directly to document.body and not trapped in clipped container
    expect(container.contains(tooltip)).toBe(false);
    expect(document.body.contains(tooltip)).toBe(true);
    expect(tooltip.className).toContain("z-[var(--z-tooltip)]");
  });

  it("51. Tooltip preserves and merges existing aria-describedby", () => {
    render(
      <Tooltip content="快捷提示信息">
        <button data-testid="tip-target" aria-describedby="existing-help-id">
          悬停目标
        </button>
      </Tooltip>
    );

    const target = screen.getByTestId("tip-target");
    expect(target.getAttribute("aria-describedby")).toBe("existing-help-id");

    // Hover -> Merged
    fireEvent.mouseEnter(target);
    const tooltip = screen.getByTestId("tooltip-content");
    expect(target.getAttribute("aria-describedby")).toBe(`existing-help-id ${tooltip.id}`);

    // Leave -> Restored
    fireEvent.mouseLeave(target);
    expect(target.getAttribute("aria-describedby")).toBe("existing-help-id");
  });

  it("52. Real Overlay Stack: InspectorDrawer + BaseModal + Tooltip Escape arbitration", () => {
    function FullOverlayStack() {
      const [drawerOpen, setDrawerOpen] = React.useState(true);
      const [modalOpen, setModalOpen] = React.useState(true);

      return (
        <div>
          <InspectorDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="检查器">
            <button onClick={() => setModalOpen(true)}>打开弹窗</button>
          </InspectorDrawer>

          <BaseModal open={modalOpen} onClose={() => setModalOpen(false)} title="弹窗层">
            <Tooltip content="提示详情">
              <button data-testid="stack-tip-trigger">提示触发按钮</button>
            </Tooltip>
          </BaseModal>
        </div>
      );
    }

    render(<FullOverlayStack />);

    // 1. Trigger tooltip focus
    const tipTrigger = screen.getByTestId("stack-tip-trigger");
    fireEvent.focus(tipTrigger);
    expect(screen.getByTestId("tooltip-content")).toBeTruthy();

    // Escape 1: Tooltip dismisses, Modal and Drawer remain open
    fireEvent.keyDown(tipTrigger, { key: "Escape" });
    expect(screen.queryByTestId("tooltip-content")).toBeNull();
    expect(screen.getByTestId("base-modal-root")).toBeTruthy();
    expect(screen.getByTestId("inspector-drawer-root")).toBeTruthy();

    // Escape 2: BaseModal dismisses, Drawer remains open
    const modalRoot = screen.getByTestId("base-modal-root");
    fireEvent.keyDown(modalRoot, { key: "Escape" });
    expect(screen.queryByTestId("base-modal-root")).toBeNull();
    expect(screen.getByTestId("inspector-drawer-root")).toBeTruthy();

    // Escape 3: Window-level Escape dismisses InspectorDrawer
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("inspector-drawer-root")).toBeNull();
  });

  it("53. closeOnEscape=false Modal blocks Escape from reaching underlying InspectorDrawer", () => {
    function BlockedEscapeStack() {
      const [drawerOpen, setDrawerOpen] = React.useState(true);
      const [modalOpen, setModalOpen] = React.useState(true);

      return (
        <div>
          <InspectorDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="检查器">
            <p>抽屉内容</p>
          </InspectorDrawer>

          <BaseModal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            closeOnEscape={false}
            title="不可按Esc关闭模态框"
          >
            <button data-testid="blocked-modal-btn">模态内部按钮</button>
          </BaseModal>
        </div>
      );
    }

    render(<BlockedEscapeStack />);
    const modalRoot = screen.getByTestId("base-modal-root");

    // Press Escape inside non-dismissible modal
    fireEvent.keyDown(modalRoot, { key: "Escape" });

    // Both surfaces remain open because Modal consumed the Escape event
    expect(screen.getByTestId("base-modal-root")).toBeTruthy();
    expect(screen.getByTestId("inspector-drawer-root")).toBeTruthy();
  });

  // ==========================================================================
  // 6. RESTORED BEHAVIOR TESTS (SEARCH, FILTER, CONFIRM, TOAST, BUTTON MOTION)
  // ==========================================================================
  it("54. SearchInput controlled change, clear, disabled, and readOnly behavior", () => {
    const onChange = vi.fn();
    const onClear = vi.fn();

    const { rerender } = render(
      <SearchInput value="" onChange={onChange} onClear={onClear} placeholder="搜索造物..." />
    );

    const input = screen.getByTestId("search-input") as HTMLInputElement;
    expect(input.placeholder).toBe("搜索造物...");
    expect(screen.queryByTestId("search-input-clear")).toBeNull();

    fireEvent.change(input, { target: { value: "系统架构" } });
    expect(onChange).toHaveBeenCalledWith("系统架构");

    rerender(
      <SearchInput value="系统架构" onChange={onChange} onClear={onClear} placeholder="搜索造物..." />
    );

    const clearBtn = screen.getByTestId("search-input-clear");
    expect(clearBtn).toBeTruthy();
    fireEvent.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith("");
    expect(onClear).toHaveBeenCalledTimes(1);

    // Disabled test
    onChange.mockClear();
    rerender(
      <SearchInput value="系统架构" disabled={true} onChange={onChange} onClear={onClear} />
    );
    expect(screen.queryByTestId("search-input-clear")).toBeNull();

    // ReadOnly test
    rerender(
      <SearchInput value="系统架构" readOnly={true} onChange={onChange} onClear={onClear} />
    );
    expect(screen.queryByTestId("search-input-clear")).toBeNull();
  });

  it("55. FilterBar selection and reset behavior", () => {
    const options = [
      { id: "all", label: "全部", count: 12 },
      { id: "active", label: "生效中", count: 8 },
    ];
    const onChange = vi.fn();
    const onReset = vi.fn();

    const { rerender } = render(
      <FilterBar options={options} activeId="active" onChange={onChange} onReset={onReset} />
    );

    const activeBtn = screen.getByTestId("filter-bar-option-active");
    expect(activeBtn.getAttribute("data-selected")).toBe("true");

    const allBtn = screen.getByTestId("filter-bar-option-all");
    fireEvent.click(allBtn);
    expect(onChange).toHaveBeenCalledWith("all");

    const resetBtn = screen.getByTestId("filter-bar-reset");
    fireEvent.click(resetBtn);
    expect(onReset).toHaveBeenCalledTimes(1);

    rerender(<FilterBar options={options} activeId="all" onChange={onChange} onReset={onReset} />);
    expect(screen.queryByTestId("filter-bar-reset")).toBeNull();
  });

  it("56. ConfirmDialog confirm, cancel, and destructive DangerButton semantics", () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    const { rerender } = render(
      <ConfirmDialog
        open={true}
        onClose={onClose}
        onConfirm={onConfirm}
        title="确认操作"
        description="请确认"
      />
    );

    const cancelBtn = screen.getByTestId("confirm-dialog-cancel");
    fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    const confirmBtn = screen.getByTestId("confirm-dialog-confirm");
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(confirmBtn.className).toContain("bg-[var(--gold-400)]");

    rerender(
      <ConfirmDialog
        open={true}
        onClose={onClose}
        onConfirm={onConfirm}
        destructive={true}
        title="破坏性操作"
        description="不可逆"
      />
    );
    const dangerConfirmBtn = screen.getByTestId("confirm-dialog-confirm");
    expect(dangerConfirmBtn.className).toContain("bg-[var(--state-danger-bg)]");
    expect(dangerConfirmBtn.className).not.toContain("var(--gold-");
  });

  it("57. ToastNotification live-region role and dismiss behavior", () => {
    const onDismiss = vi.fn();
    const { rerender } = render(
      <ToastNotification variant="success" message="保存成功" onDismiss={onDismiss} />
    );

    let toast = screen.getByTestId("toast-notification");
    expect(toast.getAttribute("role")).toBe("status");
    expect(toast.getAttribute("aria-live")).toBe("polite");

    const dismissBtn = screen.getByTestId("toast-dismiss");
    fireEvent.click(dismissBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);

    rerender(<ToastNotification variant="danger" message="错误" />);
    toast = screen.getByTestId("toast-notification");
    expect(toast.getAttribute("role")).toBe("alert");
    expect(toast.getAttribute("aria-live")).toBe("assertive");
  });

  it("58. Button active press uses instant duration and ease-in-out-subtle motion tokens", () => {
    render(<PrimaryButton>测试动画</PrimaryButton>);
    const btn = screen.getByTestId("primary-button");
    expect(btn.className).toContain("active:duration-[var(--duration-instant)]");
    expect(btn.className).toContain("active:ease-[var(--ease-in-out-subtle)]");
    expect(btn.className).toContain("active:[transform:var(--active-surface-depression)]");
  });

  it("59. Buttons expose aria-busy and disabled state while loading", () => {
    const { unmount, rerender } = render(<PrimaryButton loading>加载中</PrimaryButton>);
    let btn = screen.getByTestId("primary-button");
    expect(btn.hasAttribute("disabled")).toBe(true);
    expect(btn.getAttribute("aria-busy")).toBe("true");

    rerender(<SecondaryButton loading>次级加载</SecondaryButton>);
    btn = screen.getByTestId("secondary-button");
    expect(btn.hasAttribute("disabled")).toBe(true);
    expect(btn.getAttribute("aria-busy")).toBe("true");

    rerender(<DangerButton loading>危险加载</DangerButton>);
    btn = screen.getByTestId("danger-button");
    expect(btn.hasAttribute("disabled")).toBe(true);
    expect(btn.getAttribute("aria-busy")).toBe("true");
    unmount();
  });

  it("60. Tooltip appears on focus and hover and hides on blur and mouseLeave", () => {
    render(
      <Tooltip content="操作详情提示">
        <button data-testid="tooltip-trigger">悬停按钮</button>
      </Tooltip>
    );

    const trigger = screen.getByTestId("tooltip-trigger");
    expect(screen.queryByTestId("tooltip-content")).toBeNull();

    // Hover
    fireEvent.mouseEnter(trigger);
    expect(screen.getByTestId("tooltip-content").textContent).toBe("操作详情提示");

    fireEvent.mouseLeave(trigger);
    expect(screen.queryByTestId("tooltip-content")).toBeNull();

    // Focus
    fireEvent.focus(trigger);
    expect(screen.getByTestId("tooltip-content").textContent).toBe("操作详情提示");

    fireEvent.blur(trigger);
    expect(screen.queryByTestId("tooltip-content")).toBeNull();
  });

  // ==========================================================================
  // 7. GOVERNANCE & ARCHITECTURAL AUDIT
  // ==========================================================================
  it("61. 100% of consumed CSS variables in src/components/ui/** exist in design-tokens.css", () => {
    const tokensFile = path.resolve(__dirname, "../src/styles/design-tokens.css");
    const tokensContent = fs.readFileSync(tokensFile, "utf-8");

    // Extract all declared --variable-name tokens
    const declaredTokenMatches = tokensContent.match(/--[a-zA-Z0-9_-]+(?=:)/g) || [];
    const declaredTokens = new Set(declaredTokenMatches);

    const uiDir = path.resolve(__dirname, "../src/components/ui");
    const uiFiles = fs.readdirSync(uiDir).filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));

    for (const file of uiFiles) {
      const content = fs.readFileSync(path.join(uiDir, file), "utf-8");
      // Find all var(--token-name) references
      const varMatches = content.match(/var\((--[a-zA-Z0-9_-]+)\)/g) || [];
      for (const varMatch of varMatches) {
        const tokenName = varMatch.replace(/^var\(/, "").replace(/\)$/, "");
        expect(
          declaredTokens.has(tokenName),
          `File ${file} references undeclared CSS variable: ${tokenName}`
        ).toBe(true);
      }
    }
  });

  it("62. zero private arbitrary design literals or ad-hoc white/black palette opacities exist in src/components/ui/**", () => {
    const uiDir = path.resolve(__dirname, "../src/components/ui");
    const files = fs.readdirSync(uiDir).filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));

    const forbiddenPatterns = [
      /\btext-\[10px\]/g,
      /\btext-\[11px\]/g,
      /\bmin-h-\[32px\]/g,
      /\bmin-h-\[36px\]/g,
      /\bmin-h-\[50px\]/g,
      /\btranslate-y-\[-2px\]/g,
      /\bscale-\[0\.985\]/g,
      /\bmax-h-\[90vh\]/g,
      /\b(?:bg|text|border)-white\/\d+/g,
      /\b(?:bg|text|border)-black\/\d+/g,
      /#(?:[0-9a-fA-F]{3,4}){1,2}\b/g,
    ];

    for (const file of files) {
      const content = fs.readFileSync(path.join(uiDir, file), "utf-8");
      const stripped = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");

      for (const pattern of forbiddenPatterns) {
        const match = stripped.match(pattern);
        expect(
          match,
          `File ${file} contains forbidden arbitrary literal or ad-hoc color: ${match?.join(", ")}`
        ).toBeNull();
      }
    }
  });

  it("63. Gold whitelist audit: Gold tokens are restricted to Level, XP, Mastery, Primary affirmative, and Focus ring", () => {
    const uiDir = path.resolve(__dirname, "../src/components/ui");
    const files = fs.readdirSync(uiDir).filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));

    const goldWhitelistedFiles = new Set([
      "LevelBadge.tsx",
      "MasteryBadge.tsx",
      "XPProgress.tsx",
      "PrimaryButton.tsx",
      "GlassPanel.tsx", // opt-in border="gold" variant only
      "index.ts",
    ]);

    for (const file of files) {
      if (!goldWhitelistedFiles.has(file)) {
        const content = fs.readFileSync(path.join(uiDir, file), "utf-8");
        expect(
          content,
          `File ${file} is not on Gold whitelist but contains gold reference`
        ).not.toMatch(/var\(--gold-|var\(--border-gold-|var\(--glow-gold-/);
      }
    }
  });

  it("64. real frozen backend/domain PR-delta guard rejects changes to frozen paths without permissive catch or HEAD~1 fallback", () => {
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
      "src/lib/knowledge/authority-service.ts",
      "src/lib/knowledge/types.ts",
      "src/lib/skills/derived-state.ts",
    ];

    // Authoritative PR base resolution: No HEAD~1 fallback allowed
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
      throw new Error("Unable to resolve a valid git base ref for PR delta verification");
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
          `PR contains prohibited change to frozen path: ${file}`
        ).toBe(false);
      }
    }

    // Verify guard behavior on synthetic forbidden input
    const syntheticForbidden = "src/lib/growth-engine/engine.ts";
    const isForbidden = forbiddenPathPrefixes.some((prefix) =>
      syntheticForbidden.startsWith(prefix)
    );
    expect(isForbidden).toBe(true);
  });

  it("65. InspectorDrawer remains single existing implementation in src/components/layout", () => {
    const layoutInspector = path.resolve(__dirname, "../src/components/layout/InspectorDrawer.tsx");
    expect(fs.existsSync(layoutInspector)).toBe(true);

    const uiInspector = path.resolve(__dirname, "../src/components/ui/InspectorDrawer.tsx");
    expect(fs.existsSync(uiInspector)).toBe(false);
  });

  it("66. ConfirmDialog composes BaseModal and does not create duplicate modal foundation", () => {
    const confirmFile = path.resolve(__dirname, "../src/components/ui/ConfirmDialog.tsx");
    const content = fs.readFileSync(confirmFile, "utf-8");
    expect(content).toContain("import { BaseModal");
    expect(content).toContain("<BaseModal");
  });

  it("67. No Stage7C domain UI exists in this PR", () => {
    const uiDir = path.resolve(__dirname, "../src/components/ui");
    const files = fs.readdirSync(uiDir);

    expect(files).not.toContain("ArtifactInspectorContent.tsx");
    expect(files).not.toContain("ProposalResolutionPicker.tsx");
    expect(files).not.toContain("ArtifactGallery.tsx");
  });

  it("68. Zero raw breakpoint constants exist in src/components/ui/**", () => {
    const uiDir = path.resolve(__dirname, "../src/components/ui");
    const files = fs.readdirSync(uiDir).filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));

    for (const file of files) {
      const content = fs.readFileSync(path.join(uiDir, file), "utf-8");
      expect(content).not.toMatch(/\b1440px\b/);
      expect(content).not.toMatch(/\b90rem\b/);
      expect(content).not.toMatch(/\b1024px\b/);
      expect(content).not.toMatch(/\b64rem\b/);
    }
  });

  it("69. Zero private z-index values exist in src/components/ui/**", () => {
    const uiDir = path.resolve(__dirname, "../src/components/ui");
    const files = fs.readdirSync(uiDir).filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));

    for (const file of files) {
      const content = fs.readFileSync(path.join(uiDir, file), "utf-8");
      const rawZIndexMatch = content.match(/\bz-(?!\[var\(--z-)\d+/g);
      expect(rawZIndexMatch, `File ${file} contains raw z-index: ${rawZIndexMatch?.join(", ")}`).toBeNull();
    }
  });

  it("70. BaseModal accessible name supports ariaLabel mode without visible title", () => {
    render(
      <BaseModal open={true} onClose={vi.fn()} ariaLabel="自定义无标题模态框">
        <p>无标题模态内容</p>
      </BaseModal>
    );

    const panel = screen.getByTestId("base-modal-panel");
    expect(panel.getAttribute("aria-label")).toBe("自定义无标题模态框");
    expect(panel.getAttribute("aria-labelledby")).toBeNull();
  });

  it("71. BaseModal with description without title renders description and sets valid aria-describedby without dangling IDs", () => {
    render(
      <BaseModal open={true} onClose={vi.fn()} ariaLabel="描述测试模态框" description="此为无标题描述信息">
        <p>内容</p>
      </BaseModal>
    );

    const panel = screen.getByTestId("base-modal-panel");
    const descId = panel.getAttribute("aria-describedby");
    expect(descId).toBeTruthy();

    const descElem = screen.getByTestId("base-modal-desc");
    expect(descElem.id).toBe(descId);
    expect(descElem.textContent).toBe("此为无标题描述信息");
  });

  it("72. RPGCard public props interface does not expose unsafe 'as' polymorphism", () => {
    const cardFile = path.resolve(__dirname, "../src/components/ui/RPGCard.tsx");
    const content = fs.readFileSync(cardFile, "utf-8");
    expect(content).not.toMatch(/as\?:/);
  });
});

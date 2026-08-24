# Stage 6 — Knowledge Map UI & Visual Specification

> **Status**: PROPOSED / DESIGN FREEZE (ROUND 1)  
> **Target Milestone**: Stage 6 (Knowledge Map)  
> **Related Rules**: `docs/Design ChatGPT/07_UI_DESIGN_SYSTEM.md`, `docs/Stage6/01_KNOWLEDGE_MAP_DOMAIN_MODEL.md`, `docs/Stage6/02_KNOWLEDGE_AUTHORITY_RULES.md`

---

## 1. Multi-Modal Visual Distinction System

In strict compliance with Accessibility and Product Design rules, **state and authority must NEVER be communicated by color alone**. The Knowledge Map uses a **4-channel visual encoding matrix**:

```text
┌─────────────────────────┬──────────────────┬─────────────────┬──────────────────┬─────────────────┐
│ Authority / Relation    │ Stroke / Border  │ Color Scheme    │ Icon / Badge     │ Text / Label    │
├─────────────────────────┼──────────────────┼─────────────────┼──────────────────┼─────────────────┤
│ Verified Node           │ Solid 1.5px      │ Sky-500 / Slate │ CheckCircle      │ "[VERIFIED]"    │
│ Inferred Node (AI)      │ Dashed 1.5px     │ Amber-500       │ Sparkles (AI)    │ "[AI PROPOSED]" │
│ Archived Node           │ Dotted 1px / 50% │ Zinc-600        │ Archive          │ "[ARCHIVED]"    │
├─────────────────────────┼──────────────────┼─────────────────┼──────────────────┼─────────────────┤
│ Verified Edge           │ Solid 2px line   │ Sky-400         │ Solid Arrow      │ "VERIFIED"      │
│ Inferred Edge (AI)      │ Dashed animated  │ Amber-400       │ Hollow Arrow     │ "AI 85%" Pill   │
│ Contradicts Edge        │ Zigzag / Dotted  │ Rose-500        │ Lightning Marker │ "CONTRADICTS"   │
│ Contains Edge           │ Dotted purple    │ Purple-400      │ Circle Marker    │ "CONTAINS"      │
└─────────────────────────┴──────────────────┴─────────────────┴──────────────────┴─────────────────┘
```

---

## 2. Three-Column Workspace Layout

Matching the proven Stage 5 Skill Tree architecture, the Knowledge Map UI is structured in a high-density 3-column layout:

```text
┌──────────────────────┬─────────────────────────────────────────────────┬──────────────────────┐
│  Left Panel (280px)  │           Center Canvas (Flex-1)                │  Right Drawer (380px)│
├──────────────────────┼─────────────────────────────────────────────────┼──────────────────────┤
│ 🔍 Search Concepts   │ [ReactFlow Interactive Knowledge Graph]         │ [Node Detail Panel]  │
│                      │                                                 │                      │
│ 📁 Domain Hierarchy  │ ┌──────────────┐     ┌──────────────┐          │ • Title & Type Badge │
│   ├─ CS (14)         │ │ Concept Node │- - -►│  Claim Node  │          │ • Domain & Skill Card│
│   └─ Biology (8)     │ │  (Verified)  │      │  (Inferred)  │          │ • Provenance Source  │
│                      │ └──────────────┘      └──────────────┘          │   - Linked Activity  │
│ 🏷️ Node Type Filter  │         ▲                                       │   - Supporting Proof │
│   [x] Concepts       │         │                                       │                      │
│   [x] Claims         │ ┌──────────────┐                                │ • Inbound / Outbound │
│   [x] Topics         │ │  Topic Node  │ (Contains)                     │   - [Verify Edge]    │
│                      │ └──────────────┘                                │   - [Reject Edge]    │
│ 🛡️ Authority Toggle  │                                                 │                      │
│   (o) All Relations  │ [Controls: Zoom, FitView] [MiniMap (Bottom-L)]  │ • Edit Metadata Modal│
│   ( ) Verified Only  │                                                 │ • Archive Node CTA   │
└──────────────────────┴─────────────────────────────────────────────────┴──────────────────────┘
```

---

## 3. Node Presentation Specs

### 3.1 Node Entity Types
1. **`concept` (概念节点)**:
   - **外观**：圆角矩形卡片 (`rounded-xl`)。
   - **标志**：左上角书本/原子图标 (`BookOpen` / `Atom`)。
   - **信息**：显示标题、所属域徽章、关联技能小标签（若有）。
2. **`claim` (命题节点)**:
   - **外观**：六角形或胶囊型圆角 (`rounded-full` 或带引用样式)。
   - **标志**：引号/实验图标 (`Quote` / `FlaskConical`)。
   - **信息**：显示命题陈述文本、支持论据计数。
3. **`topic` (主题节点)**:
   - **外观**：双层边框容器 (`border-double border-2`)。
   - **标志**：文件夹/体系图标 (`FolderTree`)。
   - **信息**：显示主题名称与子概念包含计数。

### 3.2 Inferred vs Verified Visual States
- **Verified Node**:
  - 背景：`bg-slate-900/90`，边框 `border-sky-500/60`。
  - 右上角徽章：绿色实心对勾 (`CheckCircle2 text-emerald-400`)。
- **Inferred Node (AI)**:
  - 背景：`bg-slate-900/70`，边框 `border-dashed border-amber-500/60`。
  - 右上角徽章：紫色 AI 火花 (`Sparkles text-amber-400`) + 置信度百分比（如 `85%`）。
  - 悬停浮层：提示 *"AI 推理生成的概念提案，点击详情进行验证"*。

---

## 4. Edge Presentation Specs & Interactive Actions

```text
Verified Prerequisite Edge:
  Node A ═══════════════════════════════════► Node B (Solid Sky-400, Solid Arrow)

Inferred Supporting Edge:
  Node A - - - - - - [ AI 82% ✓ ✗ ] - - - - - -► Node B (Dashed Amber-400, Quick Action Pill)

Contradicting Edge:
  Node A ─── ─── ─── [ ⚡ CONTRADICTS ] ─── ─── ─── Node B (Zigzag Rose-500, Lightning Marker)
```

### 4.1 Interactive Edge Actions
- 当鼠标悬停在 `inferred` 边上时，边中央弹出快速决策气泡：
  - **✓ Verify 按钮**：一键调用 `POST /api/knowledge/edges/[id]/verify`，边动画立即变为实线，置信度变为 100%。
  - **✗ Reject 按钮**：一键调用 `POST /api/knowledge/edges/[id]/reject`，边渐隐消失。

---

## 5. Right Drawer: Provenance & Audit Panel

When a node is selected, the right drawer answers the 5 core questions:

1. **What is this?**
   - 完整标题、详细描述、实体类型 (`Concept` / `Claim` / `Topic`)。
2. **Where does it belong?**
   - 所属 Domain（带面包屑导航）、关联的实用 Skill（点击可联动切换至技能树）。
3. **Why does the system believe this? (Provenance Box)**
   - 来源活动卡片：`"Paper Review: DNA Barcoding (2026-08-20)"`。
   - 来源产出物卡片：`"Code: barcode_aligner.py"`。
   - 关联的真实证据链（E0~E6 证据徽章）。
4. **What is connected?**
   - 上游认知前置清单、下游延伸知识、支撑论据与对立命题。
5. **How to manage?**
   - 验证全部推论 CTA、编辑元数据 Modal、归档/删除节点。

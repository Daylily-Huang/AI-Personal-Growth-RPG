# AI Personal Growth RPG — Specification Pack v0.1

这是一套可直接放入代码仓库 `docs/` 的产品与开发规范。

## 建议阅读顺序

### 01 SYSTEM_RULES

回答：

> 系统相信什么？什么算成长？什么禁止？

最高优先级。

### 02 PRODUCT_DESIGN

回答：

> 产品是什么形态？每个页面负责什么？用户如何交互？

### 03 TECHNICAL_IMPLEMENTATION

回答：

> 使用什么技术？前后端与 AI 如何落地？

### 04 MVP_ROADMAP_AND_ACCEPTANCE

回答：

> 先做什么、后做什么？每阶段如何验收？

### 05 AI_GAME_MASTER_CONTRACT

回答：

> AI 可以判断什么？必须输出什么？什么绝不能做？

### 06 DATABASE_SCHEMA_AND_DATA_DICTIONARY

回答：

> 数据如何保存？哪些表是 Source of Truth？

### 07 UI_DESIGN_SYSTEM

回答：

> UI 如何统一？哪些组件必须复用？

### 08 TESTING_EVALS_AND_QA

回答：

> 如何证明规则、数据、安全和 AI 没做错？

### 09 PROJECT_GOVERNANCE_AND_CHANGE_CONTROL

回答：

> 后续规则和架构怎么改，避免项目跑偏？

### STARTUP_PROMPT

用于第一次交给 Coding Agent。

---

# 文档优先级

若发生冲突：

```text
01 SYSTEM_RULES
>
02 PRODUCT_DESIGN
>
03 TECHNICAL_IMPLEMENTATION
>
04–09 专项规范
>
当前代码实现
```

Coding Agent 不能通过修改代码事实来“反向覆盖”上层规则。

---

# 推荐仓库结构

```text
docs/
├── 01_SYSTEM_RULES.md
├── 02_PRODUCT_DESIGN.md
├── 03_TECHNICAL_IMPLEMENTATION.md
├── 04_MVP_ROADMAP_AND_ACCEPTANCE.md
├── 05_AI_GAME_MASTER_CONTRACT.md
├── 06_DATABASE_SCHEMA_AND_DATA_DICTIONARY.md
├── 07_UI_DESIGN_SYSTEM.md
├── 08_TESTING_EVALS_AND_QA.md
├── 09_PROJECT_GOVERNANCE_AND_CHANGE_CONTROL.md
├── ADR/
└── CHANGELOG.md

STARTUP_PROMPT.md
README.md
```

---

# MVP 的唯一首要目标

第一版最重要的不是页面数量，而是稳定打通：

```text
现实行为
→ Activity
→ AI Proposal
→ 用户确认
→ Deterministic Growth Engine
→ XP Ledger / Mastery Event
→ Skill / Quest / Dashboard 更新
→ 可追溯历史
```

这个循环没稳定之前，不优先开发高级游戏装饰。


---

## v0.2 新增

### 10_HARNESS_ARCHITECTURE_AND_IMPLEMENTATION.md

详细定义：

- Coding Agent Harness
- deterministic Growth Harness
- LLM Eval Harness
- Playwright E2E Harness
- Golden Cases
- invariant graders
- baseline
- GitHub Actions gate
- model / prompt regression workflow

### AGENTS.md

建议放到正式代码仓库根目录，用于约束 Coding Agent。

### HARNESS_STARTER/

提供 Harness 初始目录与样例 Case / TypeScript Runner。  
这是开发模板，不是假定已经实现完成的业务代码；Coding Agent 应将其接到项目真实 Growth Engine 上。

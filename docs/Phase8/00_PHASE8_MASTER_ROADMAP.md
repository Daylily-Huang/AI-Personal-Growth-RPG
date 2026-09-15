# AI Personal Growth RPG — Phase 8 Outer Growth Loop Master Roadmap

> **文档版本**: 2.0 (Phase 8A Architecture Freeze Edition)  
> **当前状态**: PHASE 8A ARCHITECTURE FREEZE — PURE SPEC / DOCS ONLY  
> **生产代码授权**: NOT AUTHORIZED (生产实现严格禁止，直到 Phase 8A 独立审查签署 GO)  
> **基线主分支 (main)**: `0a85de522503cf3f0a656f74f248c9a65e7b5da5`  
> **前置里程碑状态**: Phase 1–7 全部 **FINAL FROZEN**；CI Governance Guard **REPAIRED**  
> **上位控制规范**: `docs/DesignSystem/PHASE8A_OUTER_GROWTH_LOOP_ARCHITECTURE_FREEZE_CONTROLLING.md`  

---

# 0. 产品愿景与核心定位

## 0.1 从成长内核到个人成长操作系统 (Personal Growth OS)

在 Phase 1 至 Phase 7 的演化中，本项目已经成功构建并冻结了严肃、不可篡改的 **Core Growth System（成长内核）**：
- 现实活动记录 (`Activity`) 与两阶段确认流 (`Two-Phase Confirmation`)；
- 确定性经验与掌握度引擎 (`Growth Engine`：XP 计算、等级、掌握度 M0–M10、衰减与质变惩罚)；
- 不可篡改的成长流水账本 (`xp_transactions` / Ledger)；
- 具有树状主支线层级的任务体系 (`Quests`)；
- 水墨拓扑技能树 (`Skills`)、知识图谱 (`Knowledge`) 与持久交付物档案 (`Artifacts`)；
- 全站新中式水墨浅色优先视觉系统、响应式断点与端到端无障碍语义（Phase 7 全面 FINAL FROZEN）。

然而，仅有底层真实成长记录是不够的。用户的核心诉求演化为更宏观的自我操作系统：
1. **阶段组织**：“我这一个月到底在集中突破什么？” → **Season / Growth Chapter**
2. **反思沉淀**：“这段时间我学到了什么，有哪些得失？” → **Structured Review & Journal**
3. **方法提炼**：“哪些具体的策略和工作法对我真正有效？” → **Strategy / Personal Playbook**
4. **现实激励**：“我的真实成长如何兑现为对自己的人生犒劳，而不是被虚幻数值空耗？” → **Reward Economy & Wishes**
5. **里程碑铭刻**：“我跨越了哪些重大的人生与技术分水岭？” → **Milestones & Achievements**

Phase 8 的目标**不是重做或取代既有成长内核**，而是在不可侵犯的 Growth Core 外围构建一套完整、严谨、反沉迷的 **Outer Growth Loop（外部成长闭环）**。

---

# 1. 历史基线与前序阶段状态归正

在早期草案中，曾有将 Phase 6/7 视作待办或交错阶段的描述。随着项目独立审查与合并治理的推进，当前真实工程基线已全面固化：

| 里程碑 | 交付范围 | 终局状态 | 权威合入基线 / 审查依据 |
| :--- | :--- | :--- | :--- |
| **Phase 1–4** | 设计 Tokens、AppShell、共享基元库、产物档案库 | **FINAL FROZEN** | PR #13 ~ PR #17 |
| **Phase 5** | Dashboard、Quests、Skills 核心业务页面水墨现代化 | **FINAL FROZEN** | PR #18 ~ PR #20 (Squash Commit `6e238a4`) |
| **Phase 6** | Knowledge Graph Canvas 知识图谱画布与单实例抽屉 | **FINAL FROZEN** | PR #21 (Merge Commit `186e5be`) |
| **Phase 7** | 全站无障碍 (A11y)、响应式压力硬化、Reduced Motion、交叉验收 | **FINAL FROZEN** | PR #22, #23, #25, #27, #28 (Merge `653fe01`)；PR #29 Docs Sync (`0abdfa4`) |
| **CI Guard** | 双模 Push-to-Main 治理守卫兼容性修复 | **CLOSED** | Commit `922d99f` / PR #30；Main Push CI `34758696881` 全绿 |

**当前权威主分支基线**：`0a85de522503cf3f0a656f74f248c9a65e7b5da5`。  
所有 Phase 8 的设计工作均建立在该基线之上。现有 Growth Core 的表结构、结算 RPC、确定性引擎与视觉体系处于绝对冻结状态。

---

# 2. 外部闭环与内核边界隔离 (Boundary Invariants)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    OUTER GROWTH LOOP (Phase 8 - 上层组织与激励)                 │
│                                                                                 │
│   Season / Review  ───>  Journal / State  ───>  Strategy Playbook  ───>  Reward  │
│   (阶段目标与复盘)        (主观体验与上下文)      (可复用个人方法论)        (现实心愿)   │
└───────────────────────────────────────┬─────────────────────────────────────────┘
                                        │ 只读引用 / 聚合分析 / 上下文映射
                                        ▼ (严禁回写、篡改、或充当第二引擎)
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    GROWTH CORE (Phase 0–7 - 底层确定性成长真理)                  │
│                                                                                 │
│   Activities  ───>  Two-Phase Confirm  ───>  Growth Engine  ───>  XP Ledger     │
│   Quests            Mastery Engine (M0–M10)   Evidence Truth      Artifacts     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

1. **Growth Core 是唯一的成长真理源**：
   - XP、等级、Mastery 等级（M0–M10）、证据有效性、任务完成事实、知识实体权威均由 Core 独占。
2. **Outer Loop 是只读引用与组织层**：
   - Outer Loop 仅允许**引用 (reference)、聚合 (aggregate)、推导 (derive)、语境化 (contextualize)、组织 (organize)、提议 (propose) 与复盘 (review)**。
   - Outer Loop 绝不允许成为“第二成长引擎”，任何 Phase 8 实体不得直接改写历史成长真理。
3. **XP 永久不可消费 (XP is Non-Spendable)**：
   - `XP != Currency`，`XP != Reward Credit`。XP 永远不能用于购买现实愿望、扣减、兑换或转账。
4. **奖励经济独立账本 (Physical Ledger Isolation)**：
   - 现实奖励积分（Reward Credit）采用物理隔离的独立流水账本 (`reward_transactions`) 与独立结算 RPC，绝不复用 `xp_transactions`。

---

# 3. 依赖驱动的全新 Phase 8 阶段推进顺序

依据独立 Gatekeeper 签署的控制规范，原草案中的阶段推进顺序被正式替换为**严格依赖驱动的科学链路**：

```
Phase 8A: Outer Loop 架构与全套规范冻结 (Architecture Freeze, 纯文档)
   │
   ▼
Phase 8B: Season（成长赛季）+ Structured Review（结构化复盘）
   │        (提供宏观时间容器与阶段复盘骨架)
   ▼
Phase 8C: Journal（主观日记）+ State Context（状态上下文）
   │        (记录主观体验与精力阻力，为方法沉淀提供摩擦力解释)
   ▼
Phase 8D: Strategy（策略假说）+ Personal Playbook（个人方法库）
   │        (基于跨时间真理 + 赛季复盘 + 日记归纳经验，必须有充足输入)
   ▼
Phase 8E: Reward Economy（奖励账本）+ Wishes（心愿兑现）
   │        (稀疏高价值现实正反馈，不阻塞个人认知闭环)
   ▼
Phase 8F: Milestones & Achievements（成就与里程碑）
   │        (基于已稳定的真理与奖励策略进行高维荣誉铭刻)
   ▼
Phase 8G: 可选扩展层 (Focus / Protocols / Past Self)
            (次级行动工具与模板视图，不作为第一版阻断性核心)
```

### 调整逻辑解析：
- **为什么 Season + Review 必须先行 (8B)**：Season 定义了中周期的起止点与目标契约；Review 提供了对阶段客观结果的结构化总结。没有时间容器与复盘，策略与日记将失去锚点。
- **为什么 Journal 紧随其后 (8C)**：日记与身心状态回答的是“主观感受与阻力”，作为定性上下文补全 Review 的定量结果。
- **为什么 Strategy 必须在 Review 与 Journal 之后 (8D)**：策略是“在何种情境下何种方法有效”的因果沉淀。必须先有客观成长真理、周期复盘与主观上下文，才能提取出有据可查的有效策略。严禁无凭据空想策略。
- **为什么 Reward 独立延后 (8E)**：现实奖励是外在激励机制，属于解耦的基础设施，绝不能优先于内在成长逻辑。

---

# 4. Phase 8A 架构包交付矩阵

在 Phase 8A 阶段，必须完整交付以下全套架构设计与规范文档，全部存放于 `docs/Phase8/`：

| 文档编号与路径 | 核心规范内容 | 关键约束与设计原则 |
| :--- | :--- | :--- |
| `00_PHASE8_MASTER_ROADMAP.md` | Phase 8 总体路线图与愿景 | 修正过时基线，建立 Phase 8B~8G 依赖链路与愿景。 |
| `01_OUTER_LOOP_DOMAIN_MODEL.md` | 外部闭环领域模型全景 | 划分持久化领域对象、AI 提议、派生视图与禁止对象。 |
| `02_OUTER_LOOP_AUTHORITY_RULES.md` | 权限矩阵与不可违背铁律 (O1~O12) | 明确用户、确定性 RPC、AI 的权限边界，确立审计法则。 |
| `03_SEASON_AND_REVIEW_SPEC.md` | Season 与 Review 规格说明 | 14~84天周期，单 Active 约束，N:N 任务关联，三级复盘。 |
| `04_JOURNAL_AND_STATE_SPEC.md` | 日记与状态上下文规格说明 | 主观日记分类，7维状态标量，严禁日记隐式升级掌握度。 |
| `05_STRATEGY_PLAYBOOK_SPEC.md` | 策略与个人方法库规格说明 | 5态生命周期，跨时间严苛验证，确定性置信度推导。 |
| `06_REWARD_ECONOMY_AND_WISHES_SPEC.md` | 奖励经济与心愿单规格说明 | 物理隔离账本，6大只增事件，稀疏防刷分配，反沉迷。 |
| `07_MILESTONE_ACHIEVEMENT_SPEC.md` | 里程碑与成就规格说明 | 真实成长映射，客观可核验，禁止刷屏级微任务勋章。 |
| `08_AI_GM_OUTER_LOOP_CONTRACT.md` | AI GM 外环契约与提议信封 | 统一 `OuterLoopProposal` 信封，严禁 LLM 直接写库。 |
| `09_DATABASE_SCHEMA_PLAN.md` | 数据库表结构设计计划 | 严密表定义、约束、索引、RLS 意图与级联规则（不建迁移）。 |
| `10_API_AND_RPC_CONTRACT_PLAN.md` | API 与 RPC 契约设计计划 | 输入校验、幂等键、原子事务、审计日志与错误分类。 |
| `11_TESTING_SECURITY_AND_HARNESS_PLAN.md` | 测试、安全与确定性 Harness 计划 | 覆盖 O001~O022 测试用例，单元/集成/E2E/对抗测试。 |
| `12_INFORMATION_ARCHITECTURE_AND_PHASE_PLAN.md` | 信息架构、路由与逐阶段实施计划 | 页面骨架、导航集成策略与 Phase 8B~8G 实施准入条件。 |
| `ADR/` | 架构决策记录目录 | 记录与上位规范存在真实冲突或权衡的决策（本轮无冲突）。 |

---

# 5. Phase 8A 验收准则与退出门禁 (Gate Criteria)

Phase 8A 的完成标志不是代码提交，而是高质量、零死角、完全自洽的架构规范闭环：
1. **纯文档范围 (Docs-Only Scope)**：`src/**`、`tests/**`、`supabase/**`、`scripts/**` 等生产与测试目录修改量为 **0**。
2. **术语与状态机零冲突**：所有文档中的状态机、生命周期、外键关系与权限边界 100% 互洽。
3. **非农场化与反刷分验证**：奖励系统必须具备严密的原语级防刷设计。
4. **独立 Gatekeeper 终审签署**：提交独立 PR 并等待 Gatekeeper 审查，达成 `P0=0, P1=0, P2=0` 裁决。
5. **严禁越跑**：在 Gatekeeper 明确下发 Phase 8B 控制文件之前，绝不启动任何生产代码实现。

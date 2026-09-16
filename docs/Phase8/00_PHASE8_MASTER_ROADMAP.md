# AI Personal Growth RPG — Phase 8 Outer Growth Loop Master Roadmap

> **文档版本**: 2.4 (Phase 8A Architecture Freeze Edition - R4 Corrective)  
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
- 不可篡改的成长流水账本 (`xp_transactions` / Ledger，具备确定性矫正语义)；
- 具有树状主支线层级的任务体系 (`Quests`，authoritative 字段：`quest_size`, `is_boss`, `is_main_quest`, `status`)；
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

### Phase 7 历史验收证据边界保留声明 (Non-Blocking Carry-Forward)
Phase 7 已于 PR #28 正式终审合入并标记 **FINAL FROZEN**。为维护严谨的证据链条与技术诚实性，此处忠实结转其已知测试局限，绝不隐式扩大证据效力，亦不重开 Phase 7 验收：
```text
Phase 7 remains FINAL FROZEN.

VoiceOver:             NOT VERIFIED
NVDA:                  NOT VERIFIED
JAWS:                  NOT VERIFIED
physical touch device: NOT VERIFIED

emulated != physical device
source scan != runtime proof
```

### v1.0-core Tag 门禁状态与 Phase 8B 基线替代声明
经独立审查核实，`refs/tags/v1.0-core` 标签在 GitHub 远端尚未建立 (`404 / NOT PRESENT`)。
依据 Phase 8A 治理规则：
- 该缺失不阻塞 Phase 8A 架构文档的冻结；
- **Phase 8B 的生产实现绝不能仅凭 Phase 8A PR 的合入而自发启动**；
- 独立审查 AI 在签署 Phase 8B 控制文件时，必须将未来 Phase 8A 架构合入的**确切 Main Merge Commit SHA** 作为不可变更的实现基线，该显式 SHA 声明正式替代缺失的 `v1.0-core` 标签门禁。

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
   - `XP != Currency`，`XP != Reward Credit`。XP 永远不能用于购买现实愿望、扣减、兑换或转账。其历史变更完全受 append-only XP 账本监管（保留既有 CORRECTION 矫正语义，非现实货币意义上的扣减）。
4. **奖励经济单账户只增事件流水账本 (Append-Only Event Ledger Isolation)**：
   - 现实奖励积分（Reward Credit）采用物理隔离的只增事件流水账本 (`reward_transactions`) 与独立结算 RPC，绝不复用 `xp_transactions`。

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
| `00_PHASE8_MASTER_ROADMAP.md` | Phase 8 总体路线图与愿景 | 修正过时基线，建立 Phase 8B~8G 依赖链路，声明 Phase 7 证据边界与 v1.0-core 门禁。 |
| `01_OUTER_LOOP_DOMAIN_MODEL.md` | 外部闭环领域模型全景 | 划分持久化领域对象、AI 提议、派生视图与禁止对象，严密对齐 Core 字段与 Wish/Season 状态机。 |
| `02_OUTER_LOOP_AUTHORITY_RULES.md` | 权限矩阵与不可违背铁律 (O1~O12) | 明确用户、确定性 RPC、AI 的权限边界，确立审计法则与单账户只增账本纪律。 |
| `03_SEASON_AND_REVIEW_SPEC.md` | Season 与 Review 规格说明 | 14~84天周期，单 Active 约束，N:N 任务关联，三级复盘，Proposal 预览与持久化版本化复盘。 |
| `04_JOURNAL_AND_STATE_SPEC.md` | 日记与状态上下文规格说明 | 主观日记分类，7维状态标量，严禁日记隐式升级掌握度，端到端私有化 RLS。 |
| `05_STRATEGY_PLAYBOOK_SPEC.md` | 策略与个人方法库规格说明 | 6状态生命周期，跨时间严苛验证，确定性置信度推导，来源标识去重。 |
| `06_REWARD_ECONOMY_AND_WISHES_SPEC.md` | 奖励经济与心愿单规格说明 | 单账户只增事件账本，确定性 fold 规范，服务端铸币权威与底层防二重包装去重。 |
| `07_MILESTONE_ACHIEVEMENT_SPEC.md` | 里程碑与成就规格说明 | 真实成长映射，客观可核验，自主认证与奖励资格解耦，锚定底层来源防止重复铸币。 |
| `08_AI_GM_OUTER_LOOP_CONTRACT.md` | AI GM 外环契约与提议信封 | 统一 `OuterLoopProposal` 信封，严禁 LLM 直接写库，并发审核 CAS 幂等防重。 |
| `09_DATABASE_SCHEMA_PLAN.md` | 数据库表结构设计计划 | 逐表16项严密表定义、约束、索引、RLS 意图、固定外键行为与迁移时序（不建迁移文件）。 |
| `10_API_AND_RPC_CONTRACT_PLAN.md` | API 与 RPC 契约设计计划 | 逐一明确 23 个写路径的 13 维契约，含并发锁、幂等键、服务权威计算与审计日志。 |
| `11_TESTING_SECURITY_AND_HARNESS_PLAN.md` | 测试、安全与确定性 Harness 计划 | 覆盖 O001~O022 规范断言矩阵，四层防御与对抗性攻击拦截。 |
| `12_INFORMATION_ARCHITECTURE_AND_PHASE_PLAN.md` | 信息架构、路由与逐阶段实施计划 | 页面骨架、导航集成策略、v1.0-core 门禁替换说明与 Phase 8B~8G 实施准入条件。 |
| `ADR/` | 架构决策记录目录 | 记录与上位控制文档零未决偏离声明，确立未来 ADR 提报规程。 |

---

# 5. Phase 8A 验收准则与退出门禁 (Gate Criteria)

Phase 8A 的完成标志不是代码提交，而是高质量、零死角、完全自洽的架构规范闭环：
1. **纯文档范围 (Docs-Only Scope)**：`src/**`、`tests/**`、`supabase/**`、`scripts/**` 等生产与测试目录修改量为 **0**。
2. **术语与状态机零冲突**：所有文档中的状态机、生命周期、外键关系与权限边界 100% 互洽。
3. **确定性账本与防刷分验证**：奖励系统采用严谨的 `foldRewardLedger` 数学折叠模型与服务端权威来源去重。
4. **独立 Gatekeeper 终审签署**：提交独立 PR 并等待 Gatekeeper 审查，达成 `P0=0, P1=0, P2=0` 裁决。
5. **严禁越跑**：在 Gatekeeper 明确下发 Phase 8B 控制文件之前，绝不启动任何生产代码实现。

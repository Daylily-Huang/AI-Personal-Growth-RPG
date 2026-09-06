# 项目进展与独立审查 — 2026-09-05

审查基线：本地 HEAD `11d3b99`（`feat(skills): Stage 5C-UI Skills Modernization`）。本轮未修改业务代码，未推送、部署、重置数据库或修改 AI 桥接。远程分支和 CI 最新结果未核验。

## 审查结论

项目已经具备较完整的成长记录、提议确认、任务、技能、知识和成果管理实现，当前工作重心进入界面现代化收尾。不能仅凭历史 FINAL FROZEN 标记认定当前版本可正式验收：本轮发现 2 项 P1、2 项 P2，真实数据库与 HTTP 集成门禁尚未在本轮重跑。

建议：先关闭两项成长数据正确性问题，再进行真实数据库验收；可继续局部界面迭代，但不建议把当前基线标为全项目最终通过。未发现已证实的 P0，不代表完成全面安全认证。

## 进展核对

| 模块 | 当前证据 | 判断 |
| --- | --- | --- |
| Growth Engine、登录、Supabase、权威结算 | `src/lib/growth-engine`、请求级 Repository、确认路由、SQL RPC；迁移链到 0042 | 已实现；本轮静态检查和非数据库测试通过，数据库运行保证未重新验证 |
| Quest 任务系统 | `/quests`、任务 API、层级/状态测试；Round29 冻结记录 | 已实现，界面路线图标记 FINAL FROZEN |
| Skills 技能系统 | 图谱、筛选、详情、证据、元数据编辑；HEAD 为 Stage 5C-UI | 新版实现已存在，相关 24 项测试本轮通过；路线图仍写 NEXT，尚不能据此认定新界面已最终冻结 |
| Knowledge 知识图谱 | CRUD、推断/验证状态、来源、图谱及 Stage6 冻结摘要 | 基础系统已实现；新版画布改造仍列后续 Phase6 |
| Artifacts 成果库 | 页面、关系管理、提议处理、0041/0042；Stage7 验收清单 | 有完整实现与历史冻结记录；真实 DB/HTTP 断言本轮跳过 |
| 全局视觉系统 | Tokens、AppShell、共享组件；Dashboard/Quests 新版 | 视觉 Phase1–4、Dashboard/Quests 有冻结记录；当前 Skills，后续 Knowledge 和综合可访问性/响应式验收 |
| Review、PWA/外部集成 | 产品路线图 Milestone8/9；当前构建路由不含 Review | 尚无完整交付证据 |

注意区分“业务 Stage5/6/7”和“视觉 Phase5/6/7”，两套编号不是同一条进度线。不能用已完成业务 Stage7 推导视觉收尾已经完成。

## P1-01：掌握度提议可错误授予另一个目标

位置：`src/lib/store/settlement.service.ts:350–354`。

`decideMasteryAction` 按目标名查找失败后，直接使用 `changes[0]`；同时不检查 `target_type`。例如主技能是 Primary Skill，而唯一掌握度提议针对 Unrelated Skill，代码仍把 M2 升级提交给 Primary Skill。即便名称相同，针对 knowledge 的提议也能升级 skill。

本轮通过 `.planning/2026-09-05-project-review/probe.ts` 调用真实 SettlementService、使用内存 Repository 替身复现，两种输入均生成：

```json
{"recipient":"Primary Skill","masteryAction":{"action":"upgrade","proposedLevel":2,"confidence":0.8}}
```

这是服务层行为复现，未向真实数据库写入。正式结算 RPC 接收该服务构造的 masteryAction，因此错误发生在永久写入前的业务判定层。

建议：仅消费匹配技能身份且 `target_type=skill` 的提议；没有匹配时返回 none，不能用其他条目兜底。补充跨技能、同名不同实体、别名身份的回归用例。

## P1-02：AI 失败会把演示评分送入正式账本链路

位置：`src/lib/ai/assess.ts:56–70`；`src/app/api/activities/[id]/assess/route.ts:36–52`。

配置模型调用异常、空输出、JSON/schema 不合法时，函数回退到 mockAssessment。路由照常保存为可确认 assessment，modelName 仍取配置的模型名，随后返回 200。确认服务没有区分演示提议和真实评估，因此用户确认后可以写入正式 XP/证据。

UI 确实展示 uncertainty_notes 中的演示提示，不能称为完全无提示；但弱提示没有隔离正式成长状态，也未修正模型来源字段。

上位规范 `docs/Design ChatGPT/03_TECHNICAL_IMPLEMENTATION.md` §81 明确要求：AI 失败时 Activity 保持 pending_assessment，之后重新评估。

建议：真实数据模式失败后保留 Activity 并返回可重试错误；显式演示模式才可生成 mock，且必须准确保存来源，不将其混入正式评估账本。增加失败、空内容和非法结构三类行为测试。本轮未主动请求真实模型，也未更改供应商配置。

## P2-01：账本不分页，长期使用可能导致确认持续冲突

位置：`src/lib/store/supabase-repository.ts:76–85`；`src/lib/store/settlement.service.ts:196–201,330–334`；`supabase/migrations/0042_artifact_settlement_integration.sql:389–402`。

本地 `supabase/config.toml:18` 明确设置 `max_rows=1000`。listTransactions 只查询一次全部交易，无分页；服务层基于返回列表计算 30 日重复次数，而 RPC 对数据库完整记录执行 count。

触发条件：需要纳入重复计数的交易被挤出返回的最近 1000 条，例如同技能/同类型 30 日内超过 1000 条。服务端传入计数偏小，RPC 返回 repetition_conflict；重试再次读取同一截断列表，三次后仍失败。数据量未达到触发条件时通常不出现。

这是由当前配置与代码路径推导的边界缺陷，本轮未创建 1001 条真实数据库记录进行压力复现。

建议：使用针对技能、类型和时间窗的权威计数查询，或完整分页；不要只提高 max_rows。保留 RPC 并发复核，增加跨页案例。

## P2-02：项目入口和进度文档严重滞后

位置：`README.md:5–22`、根目录 `task_plan.md/findings.md/progress.md`、`AGENTS.md` 文档入口、`docs/DesignSystem/08_PAGE_MIGRATION_PLAN.md`。

README 仍把 Supabase/Auth/RLS/Knowledge 标为下一步；根目录记录主要停在 Stage3；AGENTS 要求读取的 `docs/01...09` 路径不存在，实际位于 `docs/Design ChatGPT/`。视觉路线图写 Skills NEXT，但 HEAD 已包含该实现。

这会让接手者误判当前阶段或重复开发。建议建立一个当前状态入口，区分历史验收、现有实现、已冻结和待验收，并修正引用。本轮未覆盖历史文件。

## 产品闭环缺口（不等同于本次新增回归）

- MasteryVerification 有 pending 展示与创建链路，尚未找到验证完成后正式晋级的产品入口；不能把“已生成待验证记录”当成掌握度验证闭环。
- Assessment 的 knowledge_updates 在现有确认服务/0042 中没有接入知识创建流程。知识图谱自身的 CRUD/验证可用，不代表每次确认 Activity 会自动产生知识节点。
- Review、数据导出、规则/账本重建工具以及长期多维等级约束仍需专项对照上位规范；本轮未把这些列为已完成。
- 本轮没有实际浏览器视觉、375px/768px、键盘和读屏器复验。历史截图与组件测试不能替代最新版本的浏览器验收。

## 本轮验证记录

| 检查 | 本轮结果 |
| --- | --- |
| TypeScript `tsc --noEmit --incremental false` | 通过 |
| ESLint `src tests scripts` | 通过，无输出错误/警告 |
| WSL `pnpm exec vitest run` | 36 文件通过，19 文件跳过；611 项通过，279 项跳过，共 890 项；退出码 0 |
| 确定性 Growth Engine 测试 | 全套测试中 11/11 通过 |
| WSL `pnpm build` | 通过，编译、类型检查、19 个静态页面生成完成，退出码 0 |
| 掌握度错配隔离复现 | 两种输入均复现错误 upgrade |
| 真实 PostgreSQL/RLS/RPC/HTTP 集成 | 未运行：测试进程未配置 XP_RPG_TEST_DB_URL，相关套件跳过 |
| 真实模型质量/回归、远程 CI、生产部署 | 未验证 |

Windows 下 pnpm 首次执行触发依赖重整检查而中止；直接 Vitest 缺少对应平台 native binding。没有重装依赖，改用项目既有 WSL，测试与构建成功。WSL 初次受沙箱访问限制，受控升级后成功运行；这不是代码测试失败。

## 建议执行顺序

1. 修复两项 P1，并用小范围回归证明没有错误 Mastery 或 mock 正式落账。
2. 修复账本分页/计数边界；在独立测试数据库运行完整权限、事务、跨用户、并发和 HTTP 验收，记录零跳过门禁结果。
3. 同步当前状态入口，完成 Skills 新版验收，再推进 Knowledge 画布与综合可访问性收尾。
4. 单独规划 Mastery 验证完成、知识提议落地和 Review，避免把页面齐全当成完整成长闭环。

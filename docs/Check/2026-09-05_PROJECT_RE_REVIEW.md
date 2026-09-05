# 修复后复审 — 2026-09-05

基线：HEAD 仍为 `11d3b99`，本次审查对象是其上的未提交修复及新增测试。仅更新审查材料，未修改业务实现。

## 结论

**本轮不通过：掌握度错配已关闭；AI 隔离、重复计数和文档入口尚未完整关闭，另有新增 lint 阻断。** 当前记录 2 项 P1、2 项 P2。

| 原问题 | 复审判断 |
| --- | --- |
| P1-01 跨技能/知识掌握度误授 | 已关闭所报告的两种错误授予；现在要求 skill 类型和匹配名称，移除了 changes[0] 兜底。新增回归通过。尚无别名身份专项覆盖。 |
| P1-02 AI 失败混入 mock | 已配置模型时的异常、空内容和非法 schema 路径得到修复；缺少 AI 配置时仍默认 mock，没有绑定真实/演示存储模式，未完整关闭。 |
| P2-01 重复计数截断 | 改为 exact/head 计数方向正确，但新技能空 UUID 引入首笔结算阻断，不能关闭。 |
| P2-02 文档过期 | 规范 01–09 的路径已修正，阶段描述已更新；新权威入口实际不存在，基线仍过期，未完整关闭。 |

## P1-A：新技能确认会发送空 UUID，阻断结算

位置：`src/lib/store/supabase-repository.ts:93–101`；调用点 `src/lib/store/settlement.service.ts:186–207`。

新技能 `lookupSkillId` 返回 null，服务层把 skillId 设为 `""`。新增 countRecentSimilarTransactions 无条件执行 `.eq("skill_id", params.skillId)`，真实 PostgREST 将收到 `skill_id=eq.`。skill_id 是 UUID 列，空字符串不是合法 UUID，查询将失败，尚未进入 applySettlement 就抛错。确认路由对此没有业务错误映射，落到 500。

影响：新用户第一次结算，以及已有用户首次建立某个新技能的结算。原 Demo 计数函数会对空 skillId 返回 0，所以仅基于 DemoRepository 的新增测试看不到这个回归。

本轮隔离复现使用真实 Supabase 客户端查询构造、真实 SupabaseRepository 计数方法及 SettlementService，fetch 替身拦截所有请求：确认实际构造出 `queriedSkill: "eq."`；模拟 PostgREST 拒绝后 `failedBeforeSettlement: true`。未连接真实数据库，数据库 UUID 拒绝行为为类型与查询路径推导，不冒充 live DB 复现。

建议：在尚无持久 skillId 时返回 0，不发送查询；保留结算 RPC 对并发新建技能的权威复核。添加真实 SupabaseRepository 新技能案例及 1000 行以上计数案例，不能只断言“计数方法被调用”。

## P1-B：未配置 AI 时仍默认允许正式数据使用 mock

位置：`src/lib/ai/assess.ts:110–115`；`src/app/api/activities/[id]/assess/route.ts:33–46`。

注释写“explicit demo mode”，但默认条件仍是 `!AI_API_KEY && !AI_BASE_URL`。路由没有传入 allowDemoFallback，函数也没有检查当前存储是否为真实 Supabase。因此 Supabase 正常、AI 配置缺失的实例仍会返回演示评分，并保存为可确认 assessment。

本轮在独立进程设置虚构 Supabase 配置、移除该进程 AI 配置后直接调用真实函数，输出：

```json
{"case":"configured-real-store-without-ai","supabaseConfigured":true,"returnedModel":"local-deterministic-mock"}
```

未修改 .env.local，未调用网络。modelName 如实标为 mock 是改善，但没有隔离正式账本；不能据此宣称“杜绝 mock 混入正式账本”。

建议：演示许可必须由可信存储/运行模式明确给出，正式数据路径默认禁止 fallback；缺配置时返回 ai_not_configured，保留 Activity。补充“Supabase 已配置、AI 未配置”路由测试，断言零 assessment 写入。

## P2-A：新增测试使 lint/CI 失败

位置：`tests/ai-assessment-failure.test.ts:46,80,113`。

本轮 ESLint 实测退出码 1：三处 `catch (err: any)` 触发 no-explicit-any；另有两个未使用导入警告（第 5、7 行）。CI check job 先执行 pnpm lint，因此测试通过仍无法通过该任务。

建议：使用 unknown 并进行错误类型收窄，删除未使用导入；重跑 lint。

## P2-B：权威交接文档未落地，文档问题未关闭

位置：`README.md:6`、`AGENTS.md:15`、`task_plan.md:3–5`。

多个入口现在要求先读 `docs/MASTER_PROJECT_HANDOFF.md`，但本轮文件存在性检查为 False。README 末尾仍引用不存在的 `docs/STARTUP_PROMPT.md`；task_plan 写当前 main 基线 a987092，本地 HEAD 是 11d3b99。progress 又把四项缺陷均写为精确关闭，与本轮证据不符。

建议：补齐实际主文档或改指现存入口；修正基线，并把“代码已修改”和“复审已通过”分开记录。

## 验证结果与范围

- TypeScript：`tsc --noEmit --incremental false` 通过。
- 针对性回归：5 文件、36 测试全部通过；包含 settlement-service 8、AI failure 5、Growth Engine 11、HTTP auth 9、request-repository 3。
- ESLint：失败，3 errors / 2 warnings。
- 两个独立边界探针均产生上述输出；脚本位于 `.planning/2026-09-05-project-review/recheck-probe.ts`，不写真实用户数据。
- 本轮未重跑全量测试、生产构建、真实 PostgreSQL/RLS/HTTP 集成或真实模型。上一轮 611 passed/279 skipped 和 build pass 不能直接移用于本次修复。

本轮已有明确阻断证据，应先处理新技能空 ID、显式演示隔离、lint 和失效文档链接，再提交完整验证结果。

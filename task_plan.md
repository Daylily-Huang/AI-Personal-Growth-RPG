# AI Personal Growth RPG — Stage2 工作计划

## 目标
在 Round10 Stage1 Gate 已通过的基础上，先完成并确认 Stage2 最小垂直切片设计，再实现服务端权威结算链路。优先保证 ownership、原子性、幂等性和审计可追溯性，不提前扩展 UI 或无关领域模型。

## 阶段
- [complete] 阶段 1：读取审查记录、当前代码状态和项目规范
- [complete] 阶段 2：整理未完成任务与优先级
- [complete] 阶段 3：完成 Stage1 真实 Supabase 验证
- [complete] 阶段 4：审查 Stage2 接口、schema 与测试缺口
- [complete] 阶段 5：读取 Round11 并冻结 Stage1、确定 Stage2-A/B 边界
- [in_progress] 阶段 6：实现 Stage2-A（Repository/Auth wiring/generated DB types/Activity immutability/basic mapping）
  - [complete] 6.1：诊断并修复本地网站启动阻断
  - [complete] 6.2：实现 SupabaseRepository 与基础 Auth wiring
  - [complete] 6.3：实现 Activity immutability 与基础映射测试
  - [complete] 6.4：运行完整验证并确认 migration 与本地数据库兼容
- [pending] 阶段 7：实现 Stage2-B（settlement RPC/事务/幂等/repetition/mastery/concurrency/双用户测试）
- [in_progress] 阶段 8：生成 Round11 摘要、提交并推送

## 当前设计边界
- 首个切片只覆盖 Activity → Assessment → Confirm → XP Ledger/Player/Skill 的真实 Supabase 路径。
- LLM 仍只产生 proposal；RPC 不接受客户端 user_id，必须由 `auth.uid()` 推导归属。
- `settle_activity` 负责一次数据库事务内的状态检查、重复结算保护、服务端 repetition snapshot、XP ledger、player/skill delta、mastery verification 和 assessment/activity 状态更新。
- `SupabaseRepository` 只做数据映射和 RPC 调用，不在客户端复制永久成长规则。
- 复合 tenant FK、双用户 RLS 测试和并发测试属于同一 Stage2 Gate；若现有 schema 需要新增迁移，采用新增迁移，不改写已执行迁移。
- 暂不处理 Activity 编辑/更正 pipeline、正式 Auth UI、Knowledge Map 全量接线和 UI 重构。

## 约束
- 先读证据，不凭记忆判断。
- 遵循 `AGENTS.md` 的项目不变量与验证要求。
- 用户未确认 Stage2 设计前，不修改业务实现文件。
- 手术式修改，不碰无关重构。
- 修改 confirmation flow、auth、RLS、migration、XP transaction 后必须运行 `pnpm test` 和 `pnpm harness:deterministic`，并保留真实 Postgres smoke 证据。

## 错误记录
- Stage1 期间曾遇到 WSL DrvFs、Docker socket、Supabase auth schema 和 PostgreSQL CHECK 规范化问题，均已采用替代方案关闭；本阶段不重复原失败路径。

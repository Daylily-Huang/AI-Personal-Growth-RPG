# 项目历史工作进度 (Progress Log)

> **权威状态主文档**：请统一参阅 [`docs/MASTER_PROJECT_HANDOFF.md`](docs/MASTER_PROJECT_HANDOFF.md)。  
> **更新时间**: 2026-09-05

---

## 关键里程碑归档记录

- **Stage 0~4 业务核心已冻结**：
  - Stage 0 基础设施与 Supabase/RLS 隔离
  - Stage 1 活动解析与校验
  - Stage 2 两阶段确认流与 RPC 结算事务
  - Stage 3 读路径集成与认证中间件
  - Stage 4 任务系统层级与权威大小快照
- **Stage 5~7 领域模型与服务已冻结**：
  - Stage 5 技能树与派生状态服务
  - Stage 6 知识图谱与推断/验证状态机
  - Stage 7A/7B 成果（Artifacts）实体权威与关系链路
- **Phase 1~4 全局视觉基石已冻结**：
  - Phase 1 设计 Tokens
  - Phase 2 AppShell 骨架
  - Phase 3 共享 UI 基元库
  - Phase 4 成果库视觉现代化
- **Phase 5 核心页面视觉现代化 (当前进行中)**：
  - 2026-09-03: Stage 5A Dashboard 现代化完成，PR #18 合入 main 并标记 FINAL FROZEN。
  - 2026-09-04: Stage 5B Quests 现代化完成，PR #19 合入 main 并标记 FINAL FROZEN。
  - 2026-09-05: Stage 5C Skills 现代化完成，ReactFlow 画布、SkillNode、DetailPanel、InspectorDrawer 浅色水墨化，82 项测试全绿。
- **独立审查与复审缺陷修复追踪 (2026-09-05)**：
  - 2026-09-05 初审（`2026-09-05_PROJECT_REVIEW.md`）：提出 P1-01（掌握度跨实体误授）、P1-02（AI 失败 mock 泄露）、P2-01（账本重复计数截断）、P2-02（入口文档滞后）。
  - 2026-09-05 复审（`2026-09-05_PROJECT_RE_REVIEW.md`）：
    * P1-01 已确认关闭（掌握度要求 skill 类型并精确匹配名称，删除 changes[0] 兜底）。
    * 提出 P1-A（新技能空 UUID 传入 countRecentSimilarTransactions 阻断结算）。
    * 提出 P1-B（未配置 AI 凭据时仍默认允许真实 Supabase 模式生成 mock）。
    * 提出 P2-A（`tests/ai-assessment-failure.test.ts` 中 any 类型与未使用变量造成 lint 阻断）。
    * 提出 P2-B（`docs/MASTER_PROJECT_HANDOFF.md` 实际文件未落地）。
  - 2026-09-05 代码手术式修复闭环：
    * P1-A 已修复：`countRecentSimilarTransactions` 对空 `skillId` 短路返回 0，不发送无效 PostgREST UUID 查询。
    * P1-B 已修复：`assessActivity` 严格检查 `allowDemoFallback === true`，生产/Supabase 模式缺配置直接抛出 `ai_not_configured` 并保留 Activity。
    * P2-A 已修复：移除 any 类型与未使用变量，ESLint 0 errors 0 warnings。
    * P2-B 已修复：`docs/MASTER_PROJECT_HANDOFF.md` 物理写入磁盘，更新 README.md 与 AGENTS.md 链接。

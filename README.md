# AI Personal Growth RPG — Web App

把现实中的学习、工作、技能训练与人生目标，转化为可验证的成长 RPG。

当前实现状态：**Phase 5 核心业务界面现代化收尾（Stage 5A/5B 最终冻结，Stage 5C Skills 现代化待审）**。  
👉 **项目全景架构与治理主文档**：请参阅 [`docs/MASTER_PROJECT_HANDOFF.md`](docs/MASTER_PROJECT_HANDOFF.md)。

## 当前系统里程碑进度

- ✅ **Next.js 16 + React 19 + TypeScript + Tailwind CSS**
- ✅ **确定性 Growth Engine**（XP / Level / Mastery / 防刷分与衰减）
- ✅ **Activity 记录与双阶段确认流**（Activity Log -> AI Proposal -> Confirm）
- ✅ **AI Assessment 提议引擎**（支持 OpenAI-compatible 本地 bridge / 生产模型，严格失败隔离）
- ✅ **不可篡改 XP 账本**（PostgreSQL `xp_transactions`，RPC 权威结算）
- ✅ **Supabase 真实后端生产栈**（PostgreSQL 15+, Row Level Security, RPC 事务, 迁移链 0001~0042）
- ✅ **Quest 任务系统**（/quests，主支线层级，QuestSize 权威快照）
- ✅ **Skills 技能树**（/skills，ReactFlow 水墨画布，单实例 InspectorDrawer 集成）
- ✅ **Knowledge 知识图谱**（/knowledge，知识节点/连边，推断/验证状态机）
- ✅ **Artifact 成果库**（/artifacts，Durable Work Product，关系图谱与链接）
- 🚀 **全局水墨浅色优先视觉现代化**（Phase 1~4 已最终冻结，Phase 5 核心页面收尾中）

## 技术栈

- **Web 框架**: Next.js 16 (Turbopack, App Router) + React 19 + TypeScript (Strict)
- **样式与设计系统**: Modern Eastern Ink-Wash (新中式水墨浅色优先，基于 CSS Design Tokens)
- **数据库与安全**: Supabase (PostgreSQL 15+, RLS, RPC 存储过程, 触发器, Ledger)
- **图谱与可视化**: ReactFlow (`@xyflow/react`) + SVG 拓扑网络
- **AI 本地桥接**: WSL DSH (Minimax-m3 识图 + DeepSeek-v4-flash 文本推理)
- **测试框架**: Vitest 4.1.10 (jsdom) + Growth Engine 确定性测试 Harness

## 启动

```bash
pnpm install
pnpm dev
```

打开 http://localhost:3000（本仓库也可用 `pnpm dev --port 3100`）。

## 环境变量

复制 `.env.example` 为 `.env.local`。

- 不配置任何 key：应用使用本地 mock AI，可完整跑通 Growth Loop。
- 配置本地 bridge：

```env
AI_BASE_URL=http://127.0.0.1:3099/v1
AI_API_KEY=dummy
AI_MODEL=deepseek-v4-flash
```

- 或配置 OpenAI：

```env
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
```

## 核心 API

| Method | Route | 说明 |
| --- | --- | --- |
| POST | `/api/activities` | 创建 Activity（保存 raw_input） |
| POST | `/api/activities/[id]/assess` | 生成 AI Assessment Proposal |
| POST | `/api/assessments/[id]/confirm` | 确认并原子写入 XP Ledger（幂等） |
| GET | `/api/dashboard` | 获取 Dashboard 快照 |
| GET | `/api/skills` | 获取 Skill Tree 的 React Flow nodes/edges |

## 测试

```bash
pnpm test
pnpm harness:deterministic
pnpm lint
pnpm build
```

## 文档与规范

- **全局交接与当前系统架构主文档**：从 [`docs/MASTER_PROJECT_HANDOFF.md`](docs/MASTER_PROJECT_HANDOFF.md) 开始阅读。
- **业务与系统规范文档集**：位于 `docs/Design ChatGPT/`（从 `01_SYSTEM_RULES.md` 开始阅读）。
- **视觉设计系统规范**：位于 `docs/DesignSystem/`（从 `01_GLOBAL_VISUAL_DIRECTION.md` 开始阅读）。

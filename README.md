# AI Personal Growth RPG — Web App

把现实中的学习、工作、技能训练与人生目标，转化为可验证的成长 RPG。

当前实现：**MVP 最小垂直切片（Milestone 0→2）**。

## 当前 Phase

- ✅ Next.js + TypeScript + Tailwind
- ✅ 确定性 Growth Engine（XP / Level / Mastery / 防刷分）
- ✅ Activity Quick Log
- ✅ AI Assessment Proposal（支持 OpenAI-compatible bridge / 本地 mock fallback）
- ✅ Proposal Review + Confirm
- ✅ XP Ledger（幂等确认，重复 confirm 不会重复加分）
- ✅ Dashboard / Activity History
- ⏳ Supabase 真实后端、Auth、RLS、Skill Tree、Knowledge Map（下一步）

## 技术栈

- Next.js 16 + App Router
- TypeScript + Tailwind CSS
- OpenAI-compatible Chat Completions（可配置 bridge）
- Zod Structured Output 校验
- Vitest
- 本地 Demo Store（`.data/demo.json`），后续可替换为 Supabase

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

## 测试

```bash
pnpm test
pnpm harness:deterministic
pnpm lint
pnpm build
```

## 文档

规范文档在 `docs/`，从 `docs/STARTUP_PROMPT.md` 开始阅读。

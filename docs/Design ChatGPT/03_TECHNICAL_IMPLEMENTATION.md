# AI Personal Growth RPG — 技术架构、开发实施与 Coding Agent 操作手册

> **版本：v0.1**
>
> 本文档是 AI Personal Growth RPG 的技术实施规范。
>
> 配套文档：
>
> 1. 《AI Personal Growth RPG — 系统设定与规则规范》
> 2. 《AI Personal Growth RPG — 产品定位、页面设计与交互规范》
> 3. **本文档：技术架构、开发实施与 Coding Agent 操作手册**
>
> 三份文档的优先级：
>
> ```text
> 系统设定与规则规范
> >
> 产品定位与页面设计规范
> >
> 技术实现细节
> ```
>
> 如果技术实现与前两份产品规则冲突，应修改技术实现，而不是反过来修改产品原则。
>
> 本文档的目标不是提供“唯一正确的代码”，而是明确：
>
> - 默认技术栈
> - 架构边界
> - 数据模型
> - AI 调用方式
> - 数据写入规则
> - 安全规则
> - 页面与 API 对应关系
> - 开发顺序
> - 测试与验收标准
> - Coding Agent 可以修改什么、不能擅自修改什么

---

# 1. 技术目标

系统第一阶段不是追求极致复杂架构，而是：

> **用尽可能少的基础设施，实现一个可信、可持续迭代、数据结构正确的 AI Personal Growth RPG MVP。**

技术设计优先级：

```text
数据正确性
>
规则可追溯
>
用户数据安全
>
AI 输出可验证
>
开发速度
>
可维护性
>
扩展能力
>
性能优化
```

---

# 2. 默认产品形态

## 2.1 第一阶段

采用：

> **响应式 Web App**

同时支持：

- Desktop
- Tablet
- Mobile Browser

---

## 2.2 第二阶段

增加：

> **PWA**

支持：

- 安装到桌面
- 安装到手机
- 基础离线壳
- 快速启动

---

## 2.3 暂不开发

第一阶段禁止优先开发：

- 原生 iOS
- 原生 Android
- Electron 桌面客户端
- 微信小程序
- 多端独立代码库

除非 Web MVP 已验证核心闭环有效。

---

# 3. 默认技术栈

## 3.1 前端 / 全栈框架

采用：

```text
Next.js
App Router
TypeScript
React
```

要求：

- 使用官方当前稳定版本
- 不在本文档固定具体 minor / patch 版本
- 初始化后必须提交 lockfile
- 后续升级必须单独记录 migration

---

# 4. 包管理器

推荐：

```text
pnpm
```

原因：

- 安装快
- lockfile 明确
- workspace 扩展方便

整个项目只使用一种包管理器。

禁止同时存在：

```text
package-lock.json
yarn.lock
pnpm-lock.yaml
```

多个锁文件。

本项目默认：

```text
pnpm-lock.yaml
```

为唯一 lockfile。

---

# 5. UI 技术

采用：

```text
Tailwind CSS
+
shadcn/ui
+
Lucide Icons
```

原则：

> shadcn/ui 作为基础组件来源，不把页面做成“默认模板风格”。

必须建立自己的：

- Design Tokens
- Spacing
- Typography
- Status Colors
- RPG State Components

---

# 6. 图谱 / 技能树技术

采用：

```text
@xyflow/react
```

用于：

- Skill Tree
- Knowledge Graph
- Quest Graph（后续可选）

第一版必须支持：

- nodes
- edges
- zoom
- pan
- fitView
- custom node
- 点击节点
- 节点状态样式
- 基础过滤

第一版不要求：

- 复杂自由编辑器
- 任意拖拽后永久保存布局
- 多用户协作图谱

---

# 7. 后端与数据库

采用：

```text
Supabase
```

核心使用：

```text
PostgreSQL
Auth
Storage
Row Level Security
```

MVP 默认不要求：

```text
Realtime
Edge Functions
Vector Search
```

这些功能按真实需要后加。

---

# 8. AI 服务

默认：

```text
OpenAI API
Responses API
Structured Outputs
JavaScript / TypeScript SDK
Zod Schema
```

核心原则：

> **AI 返回“结构化提议”，而不是直接修改用户长期数据。**

禁止新项目基于 Assistants API 设计核心架构。

---

# 9. Embedding / 语义检索

MVP 可以暂时不做向量数据库。

当出现以下需求时再启用：

- 数百 / 数千知识节点语义检索
- Artifact 语义搜索
- 历史成长记录召回
- AI Game Master 长期知识检索

届时采用：

```text
Supabase PostgreSQL
+
pgvector
+
Embedding API
```

禁止第一版为了“AI 感”提前构建复杂 RAG 系统。

---

# 10. 部署

推荐：

```text
Frontend / Server:
Vercel

Database / Auth / Storage:
Supabase
```

代码仓库：

```text
GitHub
```

建议：

```text
main
develop（可选）
feature/*
```

个人 MVP 可以只使用：

```text
main
feature/*
```

---

# 11. 本地开发环境

开发机至少安装：

```text
Git
Node.js LTS
pnpm
```

可选：

```text
Supabase CLI
VS Code / Cursor / Codex
```

---

# 12. 创建项目

Coding Agent 应优先使用当前官方脚手架。

示例：

```bash
pnpm create next-app@latest personal-growth-rpg
cd personal-growth-rpg
```

要求启用：

```text
TypeScript
App Router
ESLint
Tailwind CSS
src/ directory
@/* alias
```

---

# 13. 初始化 shadcn/ui

```bash
pnpm dlx shadcn@latest init
```

随后按需求加入组件，例如：

```bash
pnpm dlx shadcn@latest add button
pnpm dlx shadcn@latest add card
pnpm dlx shadcn@latest add dialog
pnpm dlx shadcn@latest add tabs
pnpm dlx shadcn@latest add input
pnpm dlx shadcn@latest add textarea
pnpm dlx shadcn@latest add progress
pnpm dlx shadcn@latest add badge
pnpm dlx shadcn@latest add dropdown-menu
pnpm dlx shadcn@latest add sheet
pnpm dlx shadcn@latest add tooltip
```

不要一次加入所有组件。

---

# 14. 安装核心依赖

示例：

```bash
pnpm add @supabase/supabase-js
pnpm add @supabase/ssr
pnpm add openai
pnpm add zod
pnpm add @xyflow/react
pnpm add lucide-react
```

可按需求加入：

```bash
pnpm add date-fns
```

测试阶段：

```bash
pnpm add -D vitest
pnpm add -D @playwright/test
```

Coding Agent 应在安装前检查当前官方文档。

---

# 15. 推荐目录结构

```text
personal-growth-rpg/
│
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── onboarding/
│   │   │
│   │   ├── (app)/
│   │   │   ├── dashboard/
│   │   │   ├── quests/
│   │   │   ├── skills/
│   │   │   ├── knowledge/
│   │   │   ├── artifacts/
│   │   │   ├── activity/
│   │   │   ├── reviews/
│   │   │   ├── game-master/
│   │   │   └── settings/
│   │   │
│   │   ├── api/
│   │   │   ├── ai/
│   │   │   │   ├── assess-activity/
│   │   │   │   ├── verify-mastery/
│   │   │   │   ├── next-quest/
│   │   │   │   └── review/
│   │   │   │
│   │   │   └── health/
│   │   │
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── dashboard/
│   │   ├── quest/
│   │   ├── skill-tree/
│   │   ├── knowledge-map/
│   │   ├── artifact/
│   │   ├── activity/
│   │   └── game-master/
│   │
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── client.ts
│   │   │   ├── schemas.ts
│   │   │   ├── prompts.ts
│   │   │   ├── assess.ts
│   │   │   ├── verify.ts
│   │   │   └── review.ts
│   │   │
│   │   ├── growth-engine/
│   │   │   ├── xp.ts
│   │   │   ├── mastery.ts
│   │   │   ├── difficulty.ts
│   │   │   ├── novelty.ts
│   │   │   ├── levels.ts
│   │   │   └── rules.ts
│   │   │
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   └── middleware.ts
│   │   │
│   │   ├── auth/
│   │   ├── validation/
│   │   └── utils/
│   │
│   ├── types/
│   │   ├── database.ts
│   │   ├── growth.ts
│   │   └── ui.ts
│   │
│   └── styles/
│
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── config.toml
│
├── docs/
│   ├── SYSTEM_RULES.md
│   ├── PRODUCT_DESIGN.md
│   ├── TECHNICAL_IMPLEMENTATION.md
│   └── ADR/
│
├── tests/
│
├── .env.example
├── package.json
├── pnpm-lock.yaml
└── README.md
```

---

# 16. 架构总图

```text
┌─────────────────────────────────────┐
│              User                   │
│ Desktop / Mobile Browser            │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│          Next.js Web App            │
│                                     │
│ Dashboard / Quest / Skill / Graph   │
│ AI Game Master                      │
└───────────────┬─────────────────────┘
                │
        ┌───────┴────────┐
        ▼                ▼
┌───────────────┐  ┌─────────────────┐
│ Supabase      │  │ Server AI Layer │
│ PostgreSQL    │  │ OpenAI API      │
│ Auth          │  │ Structured JSON │
│ Storage       │  └─────────────────┘
└───────┬───────┘
        │
        ▼
┌─────────────────────────────────────┐
│ Growth State                        │
│ Activity / XP / Mastery / Quest     │
│ Skill / Knowledge / Artifact        │
└─────────────────────────────────────┘
```

---

# 17. 最重要的架构原则

系统必须严格区分：

```text
事实
vs
AI 判断
vs
用户确认后的正式状态
```

因此数据链必须是：

```text
Raw Activity
↓
AI Assessment Proposal
↓
User Confirmation
↓
Validated Growth Transaction
↓
Permanent State Update
```

禁止：

```text
用户输入
↓
LLM
↓
直接 UPDATE skill_level
```

---

# 18. 为什么要采用 Proposal → Confirm

因为 AI 可能：

- 理解错误
- 高估难度
- 高估 Mastery
- 错误分类 Skill
- 重复计分

因此 AI 只能产生：

> **Assessment Proposal**

用户确认或系统规则验证后，才写入正式成长账本。

---

# 19. 数据库核心思想

数据库不能只保存：

```text
skill.level = 18
```

必须保存：

> **为什么变成 18。**

因此重要状态必须具有历史记录。

核心采用：

```text
Current State
+
Transaction / History
```

---

# 20. 核心数据库实体

MVP 建议至少包含：

```text
profiles
player_states

domains
skills
skill_edges
skill_mastery

knowledge_nodes
knowledge_edges

quests
quest_edges

activities
activity_skill_links

ai_assessments
evidence_records

xp_transactions
mastery_events

artifacts
artifact_links

reviews

rules_versions
```

---

# 21. profiles

用途：

用户基础资料。

建议字段：

```sql
id uuid primary key
display_name text
timezone text
onboarding_completed boolean
created_at timestamptz
updated_at timestamptz
```

`id` 应与 Auth User 对应。

---

# 22. player_states

保存当前临时状态。

例如：

```sql
user_id uuid
player_level integer
total_xp bigint

energy integer
focus integer
momentum integer

updated_at timestamptz
```

注意：

> `total_xp` 可缓存，但 XP 真正来源必须是 `xp_transactions`。

---

# 23. domains

示例：

```text
Knowledge
Skill
Body
Execution
Life
Mind
```

字段：

```sql
id uuid
user_id uuid
name text
slug text
description text
parent_id uuid null
created_at timestamptz
```

---

# 24. skills

字段示例：

```sql
id uuid
user_id uuid

domain_id uuid

name text
description text

level integer
xp bigint

mastery_level integer
mastery_confidence numeric

status text

last_used_at timestamptz
created_at timestamptz
updated_at timestamptz
```

注意：

`level / xp / mastery` 是当前缓存状态。

正式变化必须能够从历史事件追溯。

---

# 25. skill_edges

表示技能关系。

例如：

```text
parent
prerequisite
related
unlocks
```

字段：

```sql
id uuid
user_id uuid

source_skill_id uuid
target_skill_id uuid

relation_type text
confidence numeric

created_by text
created_at timestamptz
```

---

# 26. knowledge_nodes

字段：

```sql
id uuid
user_id uuid

title text
description text

domain_id uuid null

mastery_level integer
confidence numeric

status text

last_reviewed_at timestamptz
last_used_at timestamptz

created_at timestamptz
updated_at timestamptz
```

---

# 27. knowledge_edges

字段：

```sql
id uuid
user_id uuid

source_node_id uuid
target_node_id uuid

relation_type text

confidence numeric

source_type text
source_reference text null

ai_inferred boolean

created_at timestamptz
```

必须保留：

```text
ai_inferred
confidence
```

避免把 AI 猜测当成事实。

---

# 28. quests

建议字段：

```sql
id uuid
user_id uuid

parent_quest_id uuid null

title text
description text

quest_type text
quest_size text

status text

difficulty numeric
goal_alignment numeric

progress numeric

deadline timestamptz null

is_main_quest boolean
is_boss boolean

created_at timestamptz
updated_at timestamptz
completed_at timestamptz null
```

---

# 29. quest_edges

用于更复杂任务关系：

```text
prerequisite
blocks
related
unlocks
```

第一版如果 `parent_quest_id` 足够，可暂缓实现复杂 edge。

---

# 30. activities

这是“现实行为事实表”。

建议字段：

```sql
id uuid
user_id uuid

quest_id uuid null

title text
raw_input text

activity_type text
status text

started_at timestamptz null
ended_at timestamptz null

total_minutes integer null
effective_minutes integer null

completion numeric null

created_at timestamptz
updated_at timestamptz
```

关键原则：

> `raw_input` 必须保留。

这样未来可以重新评估旧记录。

---

# 31. ai_assessments

AI 判断不能直接覆盖 Activity。

字段：

```sql
id uuid
user_id uuid
activity_id uuid

rules_version text
prompt_version text
model_name text

assessment_json jsonb

confidence numeric

status text
-- pending
-- confirmed
-- edited
-- rejected

created_at timestamptz
confirmed_at timestamptz null
```

---

# 32. evidence_records

字段：

```sql
id uuid
user_id uuid
activity_id uuid

skill_id uuid null
knowledge_node_id uuid null

evidence_level integer
evidence_type text

description text

verified boolean

created_at timestamptz
```

---

# 33. xp_transactions

这是整个 XP 系统最重要的账本。

禁止通过：

```sql
UPDATE skills SET xp = xp + 50
```

却不产生 transaction。

每次 XP 改变必须有记录。

字段：

```sql
id uuid
user_id uuid

activity_id uuid null
quest_id uuid null
assessment_id uuid null

domain_id uuid null
skill_id uuid null

xp_type text
amount integer

base_amount numeric
modifier_json jsonb

reason text

rules_version text

created_at timestamptz
```

---

# 34. XP Transaction 原则

XP Ledger 应尽量：

> **append-only**

若历史评分需要修正：

不要删除原记录。

建议新增：

```text
adjustment transaction
```

例如：

```text
Original +40
Correction -12
Final net +28
```

这样所有变化可审计。

---

# 35. mastery_events

字段：

```sql
id uuid
user_id uuid

skill_id uuid null
knowledge_node_id uuid null

activity_id uuid null
evidence_id uuid null

from_level integer
to_level integer

confidence numeric

event_type text
-- upgrade
-- confidence_refresh
-- confidence_decay
-- correction

reason text

created_at timestamptz
```

---

# 36. artifacts

字段：

```sql
id uuid
user_id uuid

title text
artifact_type text

description text

version text

storage_path text null
external_url text null

reusability_score numeric null

created_at timestamptz
updated_at timestamptz
```

---

# 37. artifact_links

Artifact 可以链接：

- Activity
- Quest
- Skill
- Knowledge Node

建议独立关系表。

---

# 38. reviews

存储：

```text
Daily
Weekly
Monthly
Chapter
```

字段：

```sql
id uuid
user_id uuid

review_type text
period_start date
period_end date

summary_json jsonb
narrative text

created_at timestamptz
```

---

# 39. rules_versions

非常重要。

所有 XP / Mastery 规则都应该版本化。

字段：

```sql
id uuid
version text unique

status text
-- draft
-- active
-- archived

config_json jsonb

description text

created_at timestamptz
activated_at timestamptz null
```

例如：

```text
growth-engine-v0.1
growth-engine-v0.2
```

这样以后修改 XP 公式时不会污染历史解释。

---

# 40. 数据库枚举原则

MVP 可以使用：

```text
text + CHECK constraint
```

避免过早创建大量 PostgreSQL ENUM。

例如：

```sql
check (status in ('pending','confirmed','rejected'))
```

---

# 41. RLS 安全原则

所有用户私有表必须启用：

```text
Row Level Security
```

核心策略：

> 用户只能访问 `user_id = auth.uid()` 的行。

禁止：

- 前端使用 service role key
- 关闭 RLS 图省事
- 把用户成长数据公开

---

# 42. API Key 安全

浏览器端允许：

```text
Supabase public / publishable key
```

但绝对禁止暴露：

```text
OPENAI_API_KEY
SUPABASE_SECRET_KEY   （旧命名 SERVICE_ROLE_KEY，已废弃）
```

这些只能存在服务器环境变量。

---

# 43. .env.example

建议：

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...

OPENAI_API_KEY=

SUPABASE_SECRET_KEY=sb_secret_...   # 仅服务端管理员场景，默认不配置
```

> 密钥模型（2026-08-17 采纳，替换旧 ANON_KEY / SERVICE_ROLE_KEY 命名）：

```text
浏览器
  ↓ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY（公开，等同 anon key）
Supabase Auth
  ↓ 用户 JWT
RLS
  ↓
只能操作自己的数据

SUPABASE_SECRET_KEY（旧 SERVICE_ROLE_KEY）
  ↓ 仅少量真正需要后台管理员权限的服务端场景
  绕过 RLS，不能因为"服务端方便"就全员使用
```

默认架构是：

```text
User-scoped Supabase client
+ Auth
+ RLS
```

而不是：

```text
所有 API Route
→ SUPABASE_SECRET_KEY
→ 全权限操作数据库
```

如果 MVP 不需要 service role：

> 不要配置 service role。

能用用户身份 + RLS 完成的操作优先使用用户身份。

---

# 44. AI 不能拥有数据库管理员权限

禁止：

```text
LLM
→ arbitrary SQL
→ Supabase
```

AI 只能返回结构化结果。

真正数据库操作必须由：

```text
Application Code
```

执行。

---

# 45. AI Game Master 架构

AI 层建议拆成四类任务：

```text
Parser
Evaluator
Verifier
Reviewer
```

---

# 46. Parser

职责：

把自然语言转为候选结构。

例如用户输入：

> 今天读了两小时 LC，理解了 LR 与 LC 的区别，但还没有实际跑数据。

Parser 输出：

```json
{
  "activity_type": "learning",
  "total_minutes": 120,
  "topics": [
    "Likelihood Ratio",
    "Likelihood Clustering"
  ],
  "claimed_growth": [
    "understanding"
  ],
  "application_evidence": false
}
```

Parser 不负责最终 XP。

---

# 47. Evaluator

根据：

- Activity
- 当前 Skill 状态
- 当前 Mastery
- Rules Version
- Goal
- 历史重复次数

输出 Assessment Proposal。

---

# 48. AI 结构化输出 Schema

必须通过 Structured Output 返回。

概念示例：

```ts
const AssessmentSchema = z.object({
  activity: z.object({
    type: z.enum([
      "learning",
      "skill",
      "production",
      "physical",
      "maintenance",
      "reflection"
    ]),
    completion: z.number().min(0).max(1)
  }),

  difficulty: z.object({
    complexity: z.number().min(0).max(1),
    uncertainty: z.number().min(0).max(1),
    expertise_gap: z.number().min(0).max(1),
    resistance: z.number().min(0).max(1)
  }),

  growth: z.object({
    effort: z.number().min(0).max(1),
    learning: z.number().min(0).max(1),
    performance: z.number().min(0).max(1),
    outcome: z.number().min(0).max(1)
  }),

  evidence: z.object({
    level: z.number().int().min(0).max(6),
    explanation: z.string()
  }),

  mastery_changes: z.array(
    z.object({
      target_type: z.enum(["skill", "knowledge"]),
      target_name: z.string(),
      from_level: z.number().int().min(0).max(10),
      proposed_level: z.number().int().min(0).max(10),
      confidence: z.number().min(0).max(1),
      verification_required: z.boolean()
    })
  ),

  xp_proposal: z.object({
    min: z.number().int().nonnegative(),
    recommended: z.number().int().nonnegative(),
    max: z.number().int().nonnegative(),
    confidence: z.number().min(0).max(1)
  }),

  artifacts: z.array(
    z.object({
      title: z.string(),
      type: z.string(),
      confirmed_existing: z.boolean()
    })
  ),

  next_quest: z
    .object({
      title: z.string(),
      reason: z.string()
    })
    .nullable(),

  uncertainty_notes: z.array(z.string())
})
```

实际 schema 可调整，但必须保留：

- confidence
- uncertainty
- evidence
- mastery verification
- XP range

---

# 49. XP 最终值不能完全由 AI 决定

推荐架构：

```text
AI
→ 判断语义变量

Growth Engine Code
→ 计算最终 XP
```

AI 负责：

- Difficulty 语义判断
- Learning 增量
- Evidence
- Novelty 判断建议
- Goal Alignment 建议

代码负责：

- modifier 上下限
- XP 公式
- cap
- diminishing returns
- anti-farming
- rounding

---

# 50. XP Engine 必须是纯函数

建议：

```ts
calculateXp(input) => result
```

不得：

- 调数据库
- 调 AI
- 依赖当前时间的隐藏状态

相同输入必须返回相同结果。

这样方便：

- 单元测试
- 规则升级
- Debug
- 历史回放

---

# 51. XP Engine 输入示例

```ts
type XpInput = {
  baseValue: number
  difficulty: number
  masteryGain: number
  evidence: number
  novelty: number
  goalAlignment: number
  repetitionCount: number
  questSize: QuestSize
}
```

---

# 52. XP Engine 输出

```ts
type XpResult = {
  rawXp: number
  finalXp: number

  modifiers: {
    difficulty: number
    masteryGain: number
    evidence: number
    novelty: number
    goalAlignment: number
    repetitionPenalty: number
  }

  rulesVersion: string
}
```

---

# 53. Modifier 必须有边界

禁止 AI 给：

```text
Difficulty = 100
```

导致经验爆炸。

每个 modifier 必须定义：

```text
minimum
maximum
default
```

例如概念上：

```text
Difficulty:
0.75–1.50

Evidence:
0.50–1.25

Novelty:
0.20–1.20
```

具体值由 Growth Engine 规则版本确定。

---

# 54. Mastery 升级不得直接根据 XP

禁止：

```text
XP 达到 1000
→ 自动 M6
```

Mastery 必须基于：

- Evidence
- Independence
- Depth
- Stability
- Verification

---

# 55. Verifier

当出现以下情况时触发：

```text
M4 → M5
M5 → M6
M6+
```

或 AI 判断证据不足时。

Verifier 可以：

- 提问
- 要求解释
- 给应用题
- 要求上传成果
- 让用户实际完成任务

---

# 56. Mastery Verification 结果

结构示例：

```json
{
  "passed": true,
  "evidence_level": 4,
  "recommended_mastery": 5,
  "confidence": 0.86,
  "reason": "..."
}
```

---

# 57. Reviewer

负责：

```text
Daily Review
Weekly Review
Monthly Review
```

Reviewer 不应该重新计算所有 XP。

它主要：

- 聚合数据
- 发现趋势
- 发现偏科
- 发现低价值活动
- 生成建议
- 发现成长突破

---

# 58. Prompt 分层

Prompt 不应全部写在一个巨大字符串。

建议：

```text
constitution.ts
assessment.ts
verification.ts
review.ts
next-quest.ts
```

---

# 59. System Constitution

必须包含最核心不可违反规则：

- XP ≠ time
- XP ≠ Mastery
- AI 不得伪造证据
- AI 不确定时必须说明
- Failure 可产生 Learning
- 临时状态 ≠ 永久能力
- 防止重复刷分
- 真实性优先于鼓励性

---

# 60. Prompt Version

每次重要 Prompt 改动必须更新：

```text
prompt_version
```

例如：

```text
activity-assessment-v0.1
activity-assessment-v0.2
```

并保存到 `ai_assessments`。

---

# 61. 模型选择原则

不要把具体模型名称写死在业务代码的几十个位置。

统一：

```ts
AI_MODELS = {
  assessment: process.env.AI_ASSESSMENT_MODEL,
  review: process.env.AI_REVIEW_MODEL,
  verifier: process.env.AI_VERIFIER_MODEL
}
```

可以先全部使用同一个模型。

后续再按：

- 成本
- 速度
- 复杂度

拆分。

---

# 62. 模型调用必须服务器端执行

推荐：

```text
Client
↓
Next.js Route Handler / Server Action
↓
OpenAI API
↓
Structured Output
↓
Validation
↓
Client
```

禁止浏览器直接调用 OpenAI。

---

# 63. AI Assessment API

推荐：

```text
POST /api/ai/assess-activity
```

Input：

```json
{
  "activityId": "uuid"
}
```

服务器自行读取：

- raw activity
- relevant skills
- recent history
- active rules

不要让客户端直接提交：

```text
“我当前是 Lv.50”
```

作为可信状态。

---

# 64. Assessment 响应

返回：

```json
{
  "assessmentId": "...",
  "status": "pending",
  "proposal": {...}
}
```

此时不得更新永久 XP。

---

# 65. Confirm Assessment

推荐服务器动作：

```text
confirmAssessment(assessmentId)
```

执行顺序：

```text
1. 验证用户身份
2. 验证 assessment 属于用户
3. 验证 status = pending
4. 重新运行确定性的 XP Engine
5. 写 xp_transactions
6. 写 evidence
7. 写 mastery_event（如允许）
8. 更新 quest progress
9. 更新 skill cached state
10. 标记 assessment confirmed
```

必须：

> **原子化执行。**

---

# 66. 原子事务

推荐使用：

```text
PostgreSQL Function / RPC
```

或安全的 server-side transaction 机制。

目标：

避免出现：

```text
XP 已加
但 Quest 没更新
```

这种半完成状态。

---

# 67. Idempotency

Confirm 操作必须支持：

> **重复点击不重复加 XP。**

例如通过：

```text
assessment.status
unique constraint
transaction source id
```

保证幂等。

---

# 68. Dashboard 数据原则

Dashboard 不直接做 20 个独立查询。

应建立聚合查询 / server function。

例如：

```text
getDashboardSnapshot(userId)
```

返回：

```text
player
today
mainQuest
boss
recentGrowth
recentArtifacts
nextAction
```

---

# 69. Skill Tree 数据

API / Server Function：

```text
getSkillTree(domainId?)
```

返回：

```json
{
  "nodes": [],
  "edges": []
}
```

映射为 React Flow：

```text
Skill
→ Node
Skill Relation
→ Edge
```

---

# 70. Knowledge Map 数据

初次加载禁止一次拉取全部知识图谱。

建议：

```text
最近节点
当前 Domain
当前节点邻居
```

按需加载。

未来节点很多时：

```text
progressive graph loading
```

---

# 71. React Flow 状态原则

数据库是 source of truth。

React Flow local state 只负责：

- viewport
- selection
- temporary layout
- expanded / collapsed state

不要让 React Flow 内部状态变成长期业务数据源。

---

# 72. UI State

MVP 优先使用：

```text
React local state
Server Components
URL state
```

只有跨页面复杂 UI 状态确有需要时再引入 Zustand 等状态库。

禁止第一天就加 Redux。

---

# 73. Server / Client Components 原则

默认：

> Server Component

只有以下情况使用 Client Component：

- React Flow
- 输入交互
- Dialog
- 拖拽
- 实时状态
- 浏览器 API
- 局部动画

避免整个 App：

```text
"use client"
```

---

# 74. 页面路由

推荐：

```text
/dashboard
/quests
/quests/[id]

/skills
/skills/[id]

/knowledge
/knowledge/[id]

/artifacts
/artifacts/[id]

/activity
/activity/[id]

/reviews
/reviews/[id]

/game-master

/settings
```

---

# 75. Quick Log

Dashboard 和 Mobile 的核心入口。

用户输入：

```text
今天读了 1.5 小时论文……
```

操作：

```text
Create Activity
↓
Assess
↓
Show Proposal
↓
Confirm
↓
Growth Feedback
```

目标：

> 记录行为本身应在几十秒内完成。

不要要求用户先填写 15 个字段。

---

# 76. AI Proposal UI

必须显示：

```text
AI Parsed

Quest Type
Domain
Skill
Difficulty
Evidence
Mastery Proposal
XP Range
Artifact
Next Quest
Confidence
```

按钮：

```text
Confirm
Edit
Verify Mastery
Reject
```

---

# 77. Edit Assessment

用户修改 AI 判断时：

不要直接修改 AI 原始 assessment。

建议保存：

```text
original_assessment
+
user_adjustment
```

或新的 edit version。

这样未来可以评估：

> AI 判断准确率。

---

# 78. Growth Feedback Animation

Confirm 后才展示：

```text
QUEST COMPLETE
+28 XP
Mastery Updated
New Node
Artifact Created
```

禁止在 AI 尚未确认时提前播放“奖励动画”。

---

# 79. Offline / 网络失败

MVP 至少做到：

用户输入未成功提交时：

> 不要丢失文本。

可以使用：

- local draft
- retry

PWA 离线同步属于后续版本。

---

# 80. Error Handling

所有 AI 接口必须考虑：

```text
timeout
rate limit
invalid structured output
refusal
network error
database failure
```

UI 不得简单显示：

```text
Something went wrong
```

而应区分：

- AI 暂不可用
- 数据保存失败
- 登录失效
- 评分未完成

---

# 81. AI 失败不能阻止基本记录

如果 OpenAI API 暂时失败：

Activity 仍应保存为：

```text
status = pending_assessment
```

之后可以重新评估。

---

# 82. 数据导出

从第一版就应该设计用户可导出：

```text
JSON
CSV
Markdown（部分内容）
```

至少保留未来实现接口。

系统不能让用户的成长数据被锁死。

---

# 83. 数据删除

必须支持：

- 删除单条 Activity
- 修正 Assessment
- 删除账户
- 导出后删除

删除涉及 XP 时不能简单删数据导致状态错乱。

需要：

```text
reconciliation / adjustment
```

机制。

---

# 84. 数据备份

生产环境开启 Supabase 提供的数据库备份能力。

重大 schema migration 前：

> 先备份或确认恢复机制。

---

# 85. Migration

任何数据库结构修改必须通过：

```text
supabase/migrations/
```

禁止生产环境长期依赖：

> 手工在 Dashboard 点出来但没有 migration 文件。

---

# 86. Seed Data

`seed.sql` 可包含：

```text
Core Domains
Default Quest Types
Default Skill Status
Demo User Data（仅本地）
```

禁止 seed：

- API Key
- 真实隐私数据

---

# 87. 数据库类型生成

推荐从 Supabase schema 生成 TypeScript 类型。

不要手工长期维护两套：

```text
DB schema
TypeScript DB type
```

完全不同步。

---

# 88. 测试优先级

必须重点测试“规则”，而不是只测试 Button。

第一优先级：

```text
XP Engine
Mastery Rules
Anti-Farming
Confirmation Idempotency
RLS
```

---

# 89. XP Engine Unit Tests

至少包含：

```text
同输入 → 同 XP

耗时增加但无成长
→ XP 不线性增加

重复任务
→ XP 递减

高 Evidence
→ 在允许范围内增加 XP

失败但产生 Learning
→ 可获得 XP

低效活动
→ 不扣历史 XP

重复 confirm
→ XP 只加一次
```

---

# 90. Mastery Tests

至少包含：

```text
仅自述
→ 不允许 M6

E4 实际应用
→ 可以进入高 Mastery 候选

单次成功
→ 不等于 Stability 高

XP 高
→ 不自动提高 Mastery
```

---

# 91. RLS Tests

至少验证：

```text
User A
不能读取 User B activity

User A
不能修改 User B skill

Anon
不能读取 private growth data
```

---

# 92. E2E 测试核心流程

Playwright 至少覆盖：

```text
注册 / 登录
↓
创建 Activity
↓
AI Assessment
↓
Confirm
↓
XP 变化
↓
Skill 更新
↓
Activity History 可见
```

AI 调用在自动测试中可以 mock。

---

# 93. AI Evals

随着系统成熟，需要创建固定案例集。

例如：

```text
Case 001
用户阅读论文 2 小时但只能复述摘要

Expected:
Evidence <= E1/E2
No high Mastery

Case 002
用户独立完成真实分析

Expected:
Evidence >= E4 candidate

Case 003
重复第 30 次低难操作

Expected:
Strong repetition penalty
```

每次 Prompt / Model 改动运行 eval。

---

# 94. Logging

服务器应记录：

```text
request id
user id（注意隐私）
assessment id
model
latency
token usage
error type
```

不要在日志中无控制地保存完整私人对话。

---

# 95. Cost Tracking

AI 调用需要记录：

```text
input tokens
output tokens
model
call type
```

未来可分析：

```text
Assessment 平均成本
Weekly Review 平均成本
```

---

# 96. AI Cost 优化原则

优先：

- 只提供相关 Skill
- 只提供近期历史
- 不每次传整个知识图谱
- Prompt 模块化
- 重复规则使用缓存能力（若适用）

禁止每次 Quick Log：

> 把用户全部人生数据库塞给模型。

---

# 97. Context Retrieval

MVP：

```text
SQL 精确检索
```

先取：

- active Quest
- related Skill
- 最近同类 Activity
- current Mastery

未来再加入 embedding。

---

# 98. Vector Search 启用条件

满足至少一个：

```text
Knowledge Nodes > 500
Artifact > 200
历史记录难以关键词搜索
AI 经常找不到跨领域关联
```

再评估 pgvector。

不是硬性数值，只是产品信号。

---

# 99. Privacy by Design

成长系统可能包含非常私人数据。

默认：

- Private
- 不公开 Profile
- 不公开 Quest
- 不公开 Knowledge Graph
- 不默认提供社交分享

未来分享必须：

> 用户主动选择具体内容。

---

# 100. External Integrations

未来接入：

```text
Zotero
GitHub
Google Calendar
Garmin / Strava / Health
Notion
Files
Browser Extension
```

接入原则：

```text
External Event
↓
Detected Activity
↓
AI Interpretation
↓
User Confirmation
↓
Growth
```

禁止：

```text
检测到打开论文
→ 自动判定 Mastery +1
```

---

# 101. MVP Phase 0 — 规则验证

在正式写复杂 UI 前，先实现：

```text
Activity
AI Assessment
XP Engine
Confirmation
Skill
```

甚至可以只有简单表单。

验收：

> 输入现实行为后，可以稳定、可解释地完成成长结算。

---

# 102. MVP Phase 1 — 数据底座

开发：

```text
Auth
Profiles
Activities
Skills
Quests
XP Transactions
AI Assessments
RLS
```

验收：

- 用户能注册
- 数据隔离正确
- Activity 可以保存
- XP 交易可追溯

---

# 103. MVP Phase 2 — Growth Loop

开发：

```text
Quick Log
AI Assessment
Confirm
Growth Feedback
Activity History
```

这是第一个真正可玩的版本。

---

# 104. MVP Phase 3 — Dashboard

开发：

```text
Player Level
Today
Main Quest
Boss
Recent Growth
Next Best Action
```

---

# 105. MVP Phase 4 — Skill Tree

实现：

```text
Domain
Skill
Skill Edge
Mastery
XP
React Flow
```

验收：

用户能真实看到：

> “我会什么，以及下一技能是什么。”

---

# 106. MVP Phase 5 — Knowledge Map

实现：

```text
Knowledge Node
Knowledge Edge
Evidence
Confidence
React Flow
```

---

# 107. MVP Phase 6 — Review

实现：

```text
Daily
Weekly
Monthly（可后置）
```

---

# 108. MVP Phase 7 — Artifact

正式加入：

```text
Artifact Library
Version
Relation
```

---

# 109. 开发阶段不要同时做所有页面

Coding Agent 必须遵守：

> **每个 Phase 完成验收后，再进入下一 Phase。**

不要一次生成：

```text
30 个页面
80 张表
20 个 API
```

然后全部半成品。

---

# 110. Git Commit 原则

每个可验证功能一个 commit。

例如：

```text
feat: add activity logging
feat: add AI assessment proposal
feat: add XP transaction ledger
feat: add assessment confirmation
test: add anti-farming XP cases
```

避免：

```text
update stuff
final fix
new
```

---

# 111. Coding Agent 修改规则

Agent 可以自主：

- 拆组件
- 重构类型
- 修复 bug
- 优化查询
- 改进命名
- 增加测试

Agent 不得未经明确允许：

- 修改 Growth Constitution
- 改 XP 哲学
- 删除 Evidence 机制
- 让 AI 直接写正式 XP
- 把 Mastery 改成纯 XP 等级
- 取消 RLS
- 增加赌博式奖励
- 增加排行榜作为核心功能

---

# 112. ADR — Architecture Decision Record

重要技术选择必须记录。

目录：

```text
docs/ADR/
```

例如：

```text
0001-use-nextjs.md
0002-use-supabase.md
0003-ai-proposal-confirmation.md
0004-xp-ledger.md
0005-react-flow-graph.md
```

每个 ADR：

```text
Context
Decision
Alternatives
Consequences
Status
```

---

# 113. README 必须包含

```text
项目是什么
当前 Phase
技术栈
如何启动
环境变量
数据库迁移方法
测试命令
部署方式
文档入口
```

---

# 114. package scripts

建议：

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest",
    "test:e2e": "playwright test"
  }
}
```

以实际脚手架为准。

---

# 115. Definition of Done

任何功能只有满足以下条件才算完成：

```text
功能可用
+
TypeScript 无关键错误
+
Lint 通过
+
关键测试通过
+
Loading / Empty / Error 状态存在
+
移动端基本可用
+
数据权限正确
+
不会破坏 Growth Rules
+
文档已更新
```

---

# 116. 页面验收通用规则

每个页面必须至少具有：

```text
Loading State
Empty State
Error State
Success State
```

禁止只实现“有数据时”的漂亮截图。

---

# 117. Accessibility

至少满足：

- 键盘基本可操作
- Button 使用真实 button
- Link 使用真实 link
- 文本对比度合理
- icon-only button 有 aria-label
- 不仅靠颜色表达状态

---

# 118. Performance

MVP 优先保证：

- 首屏快速
- 图谱不卡顿
- AI 调用有明确 loading
- 页面切换稳定

不要为了理论性能提前做复杂微服务。

---

# 119. 禁止微服务化

MVP 默认：

> **Monolith First**

即：

```text
Next.js
+
Supabase
+
OpenAI
```

足够。

禁止一开始引入：

- Kafka
- Kubernetes
- Redis Cluster
- 独立 Python AI Server
- 多个微服务
- GraphQL Gateway

除非出现真实需求。

---

# 120. 推荐的 Source of Truth

```text
User Identity:
Supabase Auth

Permanent Growth History:
PostgreSQL transactions / events

Current Cached State:
PostgreSQL current state tables

AI Interpretation:
ai_assessments

UI Temporary State:
React

Rules:
versioned Growth Engine code/config
```

---

# 121. 关键不可逆决定最小化

MVP 期间尽量选择容易更换的实现。

例如：

AI Provider：

> 封装在 `lib/ai`

XP Formula：

> 封装在 `growth-engine`

Graph：

> 数据结构不要依赖 React Flow 专有格式

这样未来可替换。

---

# 122. Skill / Knowledge 数据与 UI 解耦

数据库：

```text
skill_id
relation
mastery
```

不要直接保存：

```text
reactFlowNode = {...}
```

UI 层再进行：

```text
Domain Data
→ React Flow Node
```

转换。

---

# 123. Growth Rules 与 Prompt 解耦

核心数学规则不能只存在 Prompt 中。

错误：

```text
Prompt:
请给合理 XP
```

正确：

```text
AI:
输出语义判断

Code:
根据 rules-v0.1 计算 XP
```

---

# 124. AI Prompt 与 UI 文案解耦

不要把 UI 文字直接作为系统 Prompt。

例如：

```text
QUEST COMPLETE
```

属于 UI。

AI 只返回：

```json
{
  "quest_completed": true
}
```

---

# 125. Timezone

所有数据库时间：

```text
timestamptz
UTC storage
```

显示时转换到用户：

```text
profile.timezone
```

不要把本地字符串时间作为唯一时间数据。

---

# 126. Soft Delete

对会影响历史成长链的核心实体：

- Activity
- Quest
- Artifact

优先考虑：

```text
archived_at
deleted_at
```

而不是立即物理删除。

用户请求彻底删除时再进行真实删除流程。

---

# 127. Reconciliation

必须预留：

```text
recalculate cached state
```

功能。

因为如果未来：

- 修正 XP
- 修正历史 Assessment
- 改 Skill 分类

系统必须能够根据 ledger 重建当前状态。

---

# 128. Growth Engine Recalculation

不要默认使用新规则重算全部历史 XP。

历史记录应保留：

```text
rules_version
```

如果用户主动选择：

> 使用新规则重算历史

必须作为单独 migration / simulation。

---

# 129. Rules Sandbox

后续建议增加开发工具：

```text
Growth Engine Sandbox
```

输入：

```text
Activity 示例
```

查看：

```text
AI variables
XP calculation
Mastery proposal
Anti-farming result
```

用于调规则。

---

# 130. Admin / Developer Tools

个人 MVP 不需要复杂后台。

但开发环境建议有：

```text
/debug/activity/[id]
```

查看：

- raw input
- AI assessment
- final XP
- modifiers
- mastery event
- DB links

生产环境默认关闭。

---

# 131. 推荐实施顺序

Coding Agent 必须按以下优先级：

```text
Step 1
初始化项目与文档

Step 2
Supabase + Auth + RLS

Step 3
数据库 migrations

Step 4
Activity Log

Step 5
AI Structured Assessment

Step 6
Growth Engine

Step 7
Confirm Transaction

Step 8
Dashboard

Step 9
Quest

Step 10
Skill Tree

Step 11
Knowledge Map

Step 12
Review

Step 13
Artifact

Step 14
PWA / Integrations
```

---

# 132. 第一个完整垂直切片

在开发任何高级功能前，必须打通：

```text
登录
↓
输入：
“今天阅读一篇论文并理解一个新方法”
↓
Activity 保存
↓
AI 返回结构化 Assessment
↓
用户确认
↓
XP Transaction 写入
↓
Skill 状态变化
↓
Dashboard 显示变化
↓
Activity History 可追溯
```

如果这个流程没有稳定：

> 不要先做 Knowledge Graph 动画。

---

# 133. 第一次可交付 MVP

至少满足：

```text
用户可登录

用户可创建 Main Quest

用户可快速记录 Activity

AI 能分类现实行为

AI 能提出 Evidence / Difficulty / Growth

XP Engine 能稳定计算

用户确认后才正式计分

Skill 能获得 XP

Mastery 与 XP 分离

Activity 可追溯

Dashboard 可显示成长

数据受 RLS 保护
```

---

# 134. 第一版明确不需要

```text
复杂 Economy
商城
装备
角色战斗
PVP
排行榜
好友
公会
自动社交分享
多 Agent swarm
复杂向量 RAG
原生 App
```

---

# 135. Coding Agent 开工前必须阅读

Agent 开始编码前，必须先阅读：

```text
docs/SYSTEM_RULES.md
docs/PRODUCT_DESIGN.md
docs/TECHNICAL_IMPLEMENTATION.md
```

然后输出：

```text
1. 当前理解
2. 准备实现的 Phase
3. 涉及的数据表
4. 涉及的页面
5. 验收标准
```

之后再编码。

---

# 136. Coding Agent 不得自行扩大 Scope

如果当前任务是：

> 实现 Activity Quick Log

Agent 不得顺便：

- 重写整套视觉
- 新增商城
- 新增社交
- 修改 XP Formula
- 重构所有数据库表

保持：

> **Small, testable increments**

---

# 137. Coding Agent 遇到不确定点

如果是不影响系统原则的小技术选择：

> Agent 可以自行选择合理方案并记录。

如果涉及：

- XP 规则
- Mastery
- 核心属性
- 数据删除
- AI 权限
- 用户隐私
- Main Quest 逻辑
- 游戏奖励哲学

必须：

> 提出选项，不得擅自决定。

---

# 138. 推荐 Coding Agent 开发提示词

可直接将下面内容作为首次开发指令的框架：

```text
你现在负责实现 AI Personal Growth RPG。

在写任何代码前，请完整阅读：
1. SYSTEM_RULES.md
2. PRODUCT_DESIGN.md
3. TECHNICAL_IMPLEMENTATION.md

优先级：
SYSTEM_RULES > PRODUCT_DESIGN > TECHNICAL_IMPLEMENTATION。

不要一次性实现完整产品。
采用垂直切片、小步开发。

当前目标：
完成 MVP Phase 0–1 的基础设施。

请先：
1. 检查当前仓库状态；
2. 输出你对系统架构的理解；
3. 列出本次将创建/修改的文件；
4. 列出数据库 migration；
5. 列出测试与验收标准；
6. 确认没有修改 Growth Constitution；
7. 然后开始实现。

任何 AI 评分都只能产生 Proposal。
正式 XP / Mastery 必须经过确认与服务器规则校验。
不得让 LLM 直接拥有数据库写权限。
所有私有数据必须启用 RLS。
XP 与 Mastery 必须分离。
```

---

# 139. 当前推荐架构总结

```text
Frontend / Full Stack
Next.js + TypeScript

UI
Tailwind CSS + shadcn/ui + Lucide

Graph
@xyflow/react

Backend
Supabase

Database
PostgreSQL

Authentication
Supabase Auth

Security
RLS

Files
Supabase Storage

AI
OpenAI Responses API

AI Output
Structured Outputs + Zod

Growth Logic
Deterministic TypeScript Engine

Deployment
Vercel + Supabase

Repository
GitHub

Testing
Vitest + Playwright
```

---

# 140. 最重要的技术原则总结

## 1

> **数据库保存事实，AI 提供解释。**

## 2

> **AI 产生 Proposal，用户确认后才进入永久成长状态。**

## 3

> **XP 由确定性 Growth Engine 最终计算，而不是让 LLM 随意给分。**

## 4

> **Mastery 由证据和验证决定，不由 XP 自动决定。**

## 5

> **所有 XP 都必须有可追溯 Ledger。**

## 6

> **所有评分都必须记录 Rules Version。**

## 7

> **用户数据默认私有并受 RLS 保护。**

## 8

> **MVP 采用 Monolith First，不做无意义技术复杂化。**

## 9

> **先打通现实行动 → AI 判定 → 用户确认 → 成长更新，再做高级游戏效果。**

## 10

> **真实性高于游戏刺激，数据正确性高于视觉效果。**

---

# 141. 开发最终目标

技术系统最终应该让以下流程变得可靠：

```text
现实中的我完成了一件事
↓
系统准确记录事实
↓
AI 理解这件事意味着什么
↓
规则引擎判断我真正成长了多少
↓
我确认
↓
数据库留下可追溯证据
↓
技能树 / 知识世界 / Quest 世界发生真实变化
↓
我明确知道：
“我具体变强了什么”
↓
系统给出合理的下一步
↓
我重新回到现实行动
```

所有技术都只是为了支持这个循环。

如果某项技术不能提高：

- 真实性
- 可验证性
- 反馈质量
- 使用效率
- 长期可维护性

则没有必要加入。

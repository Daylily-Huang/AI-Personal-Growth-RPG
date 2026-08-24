# Stage 6 — Acceptance Gates & Quality Assurance

> **Status**: PROPOSED / DESIGN FREEZE (ROUND 1)  
> **Target Milestone**: Stage 6 (Knowledge Map)  
> **Related Rules**: `docs/Design ChatGPT/08_TESTING_EVALS_AND_QA.md`, `docs/Design ChatGPT/09_PROJECT_GOVERNANCE_AND_CHANGE_CONTROL.md`

---

## 1. Acceptance Gates Matrix

| Gate | Stage | Mandatory Acceptance Criteria | Blocker Policy |
|:---|:---|:---|:---|
| **Gate 6A** | Schema & Authority | 1. `knowledge_nodes` + `knowledge_edges` 迁移在空库及现有库完全回放通过。<br>2. 复合租户外键 `(user_id, id)` 强制启用，杜绝跨租户连边。<br>3. `prerequisite` 与 `contains` 关系通过数据库触发器拦截循环依赖 (PG 23514)。<br>4. 所有私有表 RLS 覆盖 SELECT / INSERT / UPDATE / DELETE。 | **HARD BLOCKER**：任何跨租户漏洞或循环依赖穿透立即阻断 6A。 |
| **Gate 6B** | API & Read Model | 1. 所有 `/api/knowledge*` 路由必须先执行 `auth.uid()` 鉴权。<br>2. 401 / 400 / 404 / 409 / 200 / 204 状态码语义精确对齐。<br>3. `POST /api/knowledge/edges/[id]/verify` 原子化将 `inferred` 提升为 `verified` (置信度设为 1.0)。<br>4. AI 推理绝对不能静默将关系直接存为 `verified`。 | **HARD BLOCKER**：任何静默自动转正或未鉴权数据泄漏立即阻断 6B。 |
| **Gate 6C** | UI & Visual System | 1. 严格支持 4 通道视觉编码（线型、箭头、徽章、文本标签），**禁止仅凭颜色区分** Verified vs Inferred。<br>2. 三栏布局（280px 域树、中间 React Flow 画布、380px 详情抽屉）响应式正常。<br>3. 详情面板完整展示来源追溯（Activity / Artifact 链接 + Evidence 卡片）。<br>4. 前端组件测试与回归测试全绿，Skills/Quests/Dashboard 零回归。 | **HARD BLOCKER**：视觉通道缺失、来源不可追溯或其它页面样式污染阻断 6C。 |
| **Gate 6D** | Final Security Freeze | 1. 双租户 RLS 隔离矩阵（User A / User B 双向互攻测试 100% 拒绝）。<br>2. 真实 Live Next.js HTTP 集成测试全部通过。<br>3. GitHub Actions CI 执行 `check` + `supabase-integration` 全绿。<br>4. 凭据日志脱敏验证：CI 日志中绝对无 `sb_secret_`、`JWT`、数据库密码或明文环境变量泄漏。 | **HARD BLOCKER**：任何测试失败或凭据泄漏禁止合入 main。 |

---

## 2. HUMAN_REQUIRED Decision Checklist

The following architectural and semantic decisions require explicit Human Owner confirmation before implementation:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              HUMAN_REQUIRED DECISIONS                                  │
├────┬──────────────────────────────────────┬────────────────────────────────────────────┤
│ #  │ Decision Area                        │ Description & Architectural Impact         │
├────┼──────────────────────────────────────┼────────────────────────────────────────────┤
│ 1  │ Migration Strategy for 0012          │ 是否通过新迁移 0039 彻底重构 0012_knowledge_graph  │
│    │                                      │ （旧 0012 仅为原型占位表，未被任何生产代码使用）  │
├────┼──────────────────────────────────────┼────────────────────────────────────────────┤
│ 2  │ Node Type Enumeration                │ 确认 Knowledge Node 类型限定为:            │
│    │                                      │ ['concept', 'claim', 'topic'] 三类          │
├────┼──────────────────────────────────────┼────────────────────────────────────────────┤
│ 3  │ Edge Relation Ontology               │ 确认 Edge 关系类型限定为:                  │
│    │                                      │ ['prerequisite', 'contains', 'supports',   │
│    │                                      │  'contradicts', 'relates_to'] 五类         │
├────┼──────────────────────────────────────┼────────────────────────────────────────────┤
│ 4  │ Settlement Inferred Edge Creation    │ 确认 Activity 结算生成知识提案时，默认以    │
│    │                                      │ status='inferred' 写入，需用户在前端 Verify │
└────┴──────────────────────────────────────┴────────────────────────────────────────────┘
```

---

## 3. Zero-Regression Assurance on Stages 0–5

Stage 6 开发过程中，以下已冻结的系统模块必须保持 100% 不变：

- [x] **Growth Engine**: 确定性 XP 与熟练度算法纯函数 (`src/lib/growth-engine/**`)
- [x] **Settlement RPC**: 数据库原子化结算事务 (`settle_activity` / `0037`)
- [x] **Quest System**: 任务层级树、Boss HP 扣减与快照锁定 (`0032–0035`)
- [x] **Skill Tree**: 技能树 Authority、Derived State Engine、三栏 React Flow UI (`0036–0038`, Stage 5)
- [x] **CI Credential Masking**: GitHub Actions runner `::add-mask::` 与日志脱敏器 (`scripts/**`)

# Round7 跟进摘要（Milestone 3 — Supabase Foundation · Stage 1）

对应 `docs/Check/Round7.txt`：**PASS 9.0/10，GO**。按 Gate 指示只做
**Schema Bootstrap + Auth + RLS + Supabase client architecture**，
**不删除 DemoRepository、不修改 Growth Constitution、不扩 UI**。
此 commit 独立提交，等数据库/RLS Gate Review 后再动 SupabaseRepository + settlement RPC。

## IN SCOPE

1. 完整 MVP migration 链 `0001_profiles … 0017_rls`（空库可建，按 docs/06 §20 顺序）
2. Auth：`auth.users` 关联 + `handle_new_user` 触发器（注册自动补 profiles + player_states）
3. RLS：全部私有表 `enable RLS` + `auth.uid()` 四类策略（select/insert with check/update/delete）
4. Supabase client 架构：env / browser / server(用户会话) / admin(secret) 工厂
5. Round7 列出的 M3 P1/P2 顺手收掉：
   - P2 409 提前（调用 AI 之前直接 409，不再白花 token）
   - Assessment.rulesVersion 继承 Activity 冻结版本
   - DemoRepository 与 Domain Error 解耦（errors.ts，为 SupabaseRepository 铺路）
6. DB 不变量以 SQL 形式落进 migration（Mastery 单调交给 Stage2 RPC/事务）

## OUT OF SCOPE（Stage2，等这次 Gate）

- SupabaseRepository 实现 / 业务接线（应用到 Supabase 仍走 DemoRepository）
- PostgreSQL settlement RPC / 事务 / mastery monotonic `greatest()` 校验
- Auth 页面 / middleware / 会话刷新接线
- 真实在线集成测试（两用户互查、并发幂等）——需要 cloud secrets 的 CI/集成套件
- skill ontology / engine registry（第一次 rules_version bump 前才做）

---

## 落库文件（migrations）

```text
0001_profiles               profiles(1:1 auth.users)
0002_player_states          total_xp 缓存 + Provisional XP Level
0003_domains                层级域（parent_id, unique(user_id,slug)）
0004_skills                 uuid 主键 + aliases + mastery 0..10 CHECK
0005_quests                 quest_size 对齐 Growth Engine（micro..main）
0006_activities             raw_input 保留 + rules_version 冻结 + status CHECK
0007_ai_assessments         含 superseded + 每 Activity 至多一份 confirmed（部分唯一）
0008_evidence_records       evidence_level 0..4
0009_xp_transactions        已有：xp_type CHECK + assessment UNIQUE + 一笔 activity 结算
0010_mastery_verifications  已有：skill_id NOT NULL + one pending 部分唯一
0011_mastery_events         upgrade/confidence_refresh/decay/correction
0012_knowledge_graph        knowledge_nodes + knowledge_edges
0013_artifacts              artifacts + artifact_links（多态，应用层校验）
0014_reviews
0015_rules_versions         全局（engine registry 容器）
0016_indexes                docs/06 §21 查询索引
0017_rls                    RLS + auth.uid() 策略 + handle_new_user 触发器
```

## 代码

```text
src/lib/store/errors.ts             STORE_ERROR_CODES + ActivityAlreadySettledError（domain 解耦）
src/lib/store/demo-repository.ts    改用领域错误；assessment 继承 activity.rules_version
src/app/api/activities/[id]/assess/route.ts  早退 409（调 AI 之前）+ 领域错误 import
src/lib/supabase/env.ts|browser.ts|server.ts|admin.ts|index.ts  client 架构
```

## 测试

```text
pnpm test    → 8 files / 64 tests passed（新增 supabase-schema 12、supabase-client 5、repo 版本继承 1）
pnpm lint    → 0 errors / 0 warnings
pnpm harness:deterministic → 11 passed
pnpm build   → 成功
```

- `tests/supabase-schema.test.ts`（离线静态）：迁移链完整有序、每个私有表挂 RLS、
  硬不变量字面存在、`.env.example` 新键模型。
- `tests/supabase-client.test.ts`（离线）：env 解析、secret 缺失拒绝构建 admin 客户端。

> 静态测试 ≠ 在线隔离。两用户互查（A 看不到 B）+ 并发幂等必须等 Stage2 集成套件 + cloud secrets。

## 数据库变更（对既有 0009/0010 之外的新增）

新增 0001–0008、0011–0017；均 `create table if not exists`，未对真实库执行
（无 DB 连接串/口令，只有 URL + 密钥）。执行需 `supabase db reset`（CLI + 项目链接）或等效。

## Known issues

- `supabase/config.toml` 未提供；空库迁移执行脚本（db reset 命令）属 Stage2/CI 配置。
- Database 生成型 TS 类型（`supabase gen types`）接入 SupabaseRepository 时生成。
- Mastery monotonic 不变量目前只在 ADR-0001 明确，尚未落入 RPC 校验（Stage2）。

## 下一步（等 Database/RLS Gate Review）

拿到 Gate 后：SupabaseRepository（实现同一 `Repository` async port）+ PostgreSQL
settlement transaction/RPC（含 mastery monotonic、并发幂等、repetition snapshot 事务内取）+ 空库 migration 测试 + 真实集成隔离测试。

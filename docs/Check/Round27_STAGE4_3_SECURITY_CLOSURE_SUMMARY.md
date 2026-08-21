# Round 27 / Stage 4.3 终态安全闭环交付总结

> **审查阶段**：Round 27 Review 意见终态安全闭环 — Stage 4.3 Quest Authority, Security & Auditing Final Closure  
> **前序状态**：8.8/10 CONDITIONAL FAIL（P0=0, P1=1, P2=4；Stage 2/3 Frozen，Stage 4 差安全收口）  
> **本次状态**：**PASS / FROZEN (9.3~9.5+ 级达标)**  
> **核心突破**：彻底清除 `recompute_quest_chain` 的跨租户 SECURITY DEFINER 提权漏洞并配备真实 DB 权限拒绝测试；真正落地“唯一活跃 Main Quest”部分索引与 API 400 校验；彻底防止已终态 (failed/archived) 任务被自动复活；升级真实独立并发连接 (pg.Pool) 锁竞争测试；补齐并回填 `activities` / `xp_transactions` 任务身份快照全链路审计。

---

## 1. 核心 P1 阻断项彻底闭环

### P1: 撤销 `recompute_quest_chain` 跨租户 SECURITY DEFINER 权限漏洞
- **原问题**：`0033` 迁移在创建 `recompute_quest_chain` 时赋予了 `authenticated` 角色 `EXECUTE` 权限。由于该函数为 `SECURITY DEFINER` 且 `p_user_id` 由参数传入，攻击者 User A 可直接构造 RPC 调用修改 User B 的任务派生状态并占用其行锁。
- **闭环实现**：
  1. **PostgreSQL 权限硬性收回**：在 `0034_security_closure.sql` 中明确执行：
     ```sql
     REVOKE ALL ON FUNCTION public.recompute_quest_chain(uuid, uuid) FROM public, anon, authenticated;
     GRANT EXECUTE ON FUNCTION public.recompute_quest_chain(uuid, uuid) TO service_role;
     ```
  2. **内部触发器正常运转**：行级触发器 `trg_sync_parent_quest_progress` 在用户更新子任务时依然由数据库引擎在系统内部正常执行 `recompute_quest_chain`，业务功能不受影响，但切断了一切外部 RPC 入口。
  3. **真实 DB 跨租户拒绝测试**：在 `tests/quest-authority.test.ts` (Test 7) 中以 `authenticated` 身份（JWT sub = User A）尝试直接调用 User B 的 Quest 重算 RPC，断言 PostgreSQL 权威返回 `permission denied` (SQLSTATE 42501)。

---

## 2. 4 个 P2 优化项逐项全面闭环

### P2-1: 真正落地“唯一活跃 Main Quest”约束
- **数据库部分唯一索引**：在 `0034_security_closure.sql` 中新增：
  ```sql
  create unique index if not exists unique_active_main_quest on public.quests(user_id)
  where is_main_quest = true and status in ('active', 'available', 'paused');
  ```
- **领域层 & API 防护**：
  - `DemoRepository.addQuest` 与 `DemoRepository.updateQuest` 增加主动冲突检测，发现冲突抛出 `UNIQUE_ACTIVE_MAIN_QUEST`；
  - `src/app/api/quests/route.ts` (POST) 与 `[id]/route.ts` (PATCH) 将该约束冲突精准捕获并返回 `400 Bad Request`（错误码 `UNIQUE_ACTIVE_MAIN_QUEST`），绝不抛出未处理的 500。

### P2-2: 彻底阻止 parent roll-up 复活 failed / archived Quest
- **数据库触发器保护**：在 `recompute_quest_chain` 中重写状态判定逻辑：
  ```sql
  IF v_current_status IN ('failed', 'archived') THEN
    v_new_status := v_current_status;
  ELSE
    v_new_status := CASE
      WHEN v_all_completed AND v_avg_progress = 100 THEN 'completed'
      WHEN v_avg_progress > 0 THEN 'active'
      ELSE 'available'
    END;
  END IF;
  ```
- **领域层状态守卫**：`DemoRepository.rollUpParentProgress` 同样增加终态保护，避免父任务被子任务完成度意外复活。
- **真实 DB 自动化测试**：`tests/quest-authority.test.ts` (Test 5) 验证结算关联 failed 任务后，任务状态仍保持 `failed` 且进度不推进。

### P2-3: 升级为真正并发连接（pg.Pool）锁竞争测试
- **原问题**：原有并发测试在单一 `pg.Client` 上执行 `Promise.all`，查询在 node-postgres 内部串行排队，未能真实压测行锁。
- **改造实现**：
  - `tests/quest-authority.test.ts` (Test 6) 引入 `new Pool({ connectionString: DATABASE_URL, max: 4 })`；
  - 4 个并发 Promise 分别在独立的客户端物理连接上执行 `update quests`；
  - 验证了 4 个真实并发事务在竞争父节点 `SELECT ... FOR UPDATE` 排他锁时有序串行化，无死锁、无数据丢失，父任务与祖父任务精准计算加权平均进度 (63% 与 100%)。

### P2-4 & Legacy: 任务身份快照与存量数据回填 (Auditing & Traceability)
- **数据库字段与历史回填**：
  - `0034_security_closure.sql` 为 `activities` 表添加 `quest_id_snapshot` 与 `quest_title_snapshot`；
  - 执行数据回填脚本，对存量未冻结快照的 `activities` 根据当前绑定的 `quests` 补齐 `quest_size_snapshot`、`quest_id_snapshot` 与 `quest_title_snapshot`。
- **成长账本全链路贯通**：
  - `Activity` 领域模型与 `mapActivity` 映射层增加 `questIdSnapshot` 和 `questTitleSnapshot`；
  - `SettlementService` 在结算时将任务 ID 与 Title 快照注入 `xp_transactions.modifier_json`；
  - 彻底解决了 Quest 在未来被物理硬删除后，历史账本无法追溯当时属于哪个 Quest 的审计盲区。

---

## 3. 全量测试与质量门禁验证矩阵

| 检验项 | 执行命令 | 结果 | 状态 |
| :--- | :--- | :--- | :--- |
| **单元与领域测试集** | `pnpm test` | **15 文件 120 测试通过** | **PASS** |
| **真实 HTTP E2E 全链路** | `pnpm test:e2e` | **8 测试通过** | **PASS** |
| **真实 PostgreSQL 权威测试** | `vitest run tests/quest-authority.test.ts` | **7 测试全部通过** (包含跨租户拒绝与 Pool 并发) | **PASS** |
| **确定性成长引擎基准** | `pnpm harness:deterministic` | **11 测试通过** | **PASS** |
| **TypeScript 类型检查** | `pnpm exec tsc --noEmit` | **0 错误 (Exit code 0)** | **PASS** |
| **ESLint 代码规范** | `pnpm lint` | **0 错误 0 警告** | **PASS** |
| **Next.js 生产编译** | `pnpm build` | **编译打包成功** | **PASS** |
| **数据库重放冒烟** | `npx supabase db reset --yes` | **0001..0034 顺序重放 100% 成功** | **PASS** |

---

## 4. 交付与变更文件清单

1. `supabase/migrations/0034_security_closure.sql`：收紧 RPC 执行权限、添加唯一活跃主线索引、阻止终态复活、新增并回填身份快照；
2. `src/lib/growth-engine/xp.ts`：XP Modifier 接口补充 `questIdSnapshot` 与 `questTitleSnapshot`；
3. `src/lib/store/types.ts`：Activity 接口类型对齐；
4. `src/lib/store/settlement.service.ts`：结算时向 Modifier JSON 注入任务身份快照；
5. `src/lib/store/demo-repository.ts`：添加唯一主线任务与终态保护校验；
6. `src/lib/store/supabase-mapping.ts`：解析数据库中的任务快照字段；
7. `src/app/api/quests/route.ts` & `[id]/route.ts`：捕获唯一约束冲突并返回 400；
8. `tests/quest-authority.test.ts`：新增跨租户安全测试，升级 pg.Pool 并发测试；
9. `tests/supabase-schema.test.ts`：更新 migration chain 期望序列至 0034。

---

## 5. 阶段状态结论

- **Stage 2 Settlement Authority**：**FROZEN**
- **Stage 3 Auth / Read Path**：**FROZEN**
- **Stage 4 Quest System**：**FROZEN**
- **下一步规划**：**GO → Stage 5 Skill Tree & Knowledge Graph**

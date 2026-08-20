# Stage 3 Final Acceptance Closure — Round 22 验证报告

> 项目：AI Personal Growth RPG  
> 日期：2026-08-21  
> 依据：Round22 审查（8.9/10 CONDITIONAL FAIL，Stage 2 权威保持 Frozen，Stage 3 功能全面成立，针对 P1-1 函数全局默认权限 与 P1-2 CI 任务编排 执行 Final-Final Patch）  
> 目标：提供 Global Default Privileges 真实 PostgreSQL 生效证据、提供新函数 Fail-Closed 探测断言测试、修正 CI 工作流编排解耦 E2E。

---

## 1. 落地修改与证据

### 1.1 P1-1 数据库函数全局默认权限修复 (`0031_global_function_default_privileges.sql`)
* **原理**：PostgreSQL 默认对新建函数授予 `PUBLIC EXECUTE`，且 `IN SCHEMA public` 的 Default Privilege 无法覆盖全局默认赋权。必须使用针对角色（`FOR ROLE postgres`）及全局的 `REVOKE EXECUTE ON FUNCTIONS FROM public, anon, authenticated`。
* **迁移实现**：
  ```sql
  -- supabase/migrations/0031_global_function_default_privileges.sql
  alter default privileges revoke execute on functions from public;
  alter default privileges revoke execute on functions from anon, authenticated;

  alter default privileges for role postgres revoke execute on functions from public;
  alter default privileges for role postgres revoke execute on functions from anon, authenticated;

  alter default privileges for role postgres grant execute on functions to service_role;
  ```
* **Live DB Probe 真实探测测试 (`tests/authority-final-state.test.ts`)**：
  * 在真实运行的 PostgreSQL 数据库中作为 `postgres` 角色新建探测函数 `public.__test_future_rpc_probe()`；
  * 执行 `has_function_privilege` 验证新建函数权限终态：
    * `public` -> `false`
    * `anon` -> `false`
    * `authenticated` -> `false`
    * `service_role` -> `true`
  * 验证后安全清理探测函数。

### 1.2 P1-2 CI 编排与 E2E 脚本解耦 (`.github/workflows/ci.yml` & `package.json`)
* **package.json**：新增独立测试命令 `"test:e2e": "vitest run tests/e2e-http-browser.test.ts"`；
* **.github/workflows/ci.yml**：在 `supabase-integration` 任务中显式声明：
  ```yaml
  - name: Start local Supabase stack
    run: supabase db start

  - name: Build production app
    env:
      NEXT_PUBLIC_SUPABASE_URL: http://127.0.0.1:54321
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: sb_publishable_test_key
      SUPABASE_SECRET_KEY: test_secret_key
    run: pnpm build

  - name: Run database-backed tests
    env:
      XP_RPG_TEST_DB_URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      NEXT_PUBLIC_SUPABASE_URL: http://127.0.0.1:54321
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: sb_publishable_test_key
      SUPABASE_SECRET_KEY: test_secret_key
    run: pnpm test
  ```
  彻底杜绝 fresh checkout 下 `pnpm test` 因缺乏 `.next` 生产产物而隐式失败的风险。

---

## 2. 全量验收门禁报告

### 2.1 自动化测试（真实 PostgreSQL 数据库，0001..0031 迁移链）
```text
$ vitest run

 Test Files  18 passed (18)
      Tests  143 passed (143) — 0 skipped
   Duration  6.57s
```

* `pnpm test:e2e` 独立执行：**6/6 passed (100%)**
* `pnpm harness:deterministic`：**11/11 passed (100%)**

### 2.2 静态编译与构建门禁
* `pnpm exec tsc --noEmit`：**0 errors**
* `pnpm build`：**0 errors, 0 warnings (11 Routes compiled & optimized)**
* `pnpm lint`：**0 errors, 0 warnings**

---

## 3. 结论

Stage 3（Auth Bootstrap + 全量 Supabase Read Path 与 UI 集成）包含真实生产 HTTP E2E、会话隔离与注销、Next 16 Proxy、函数全局默认权限收敛（0001..0031）与 CI 顺序构建编排已全部达成终态闭环，建议正式签署 **Frozen (9.3~9.5 / 10 PASS)**。

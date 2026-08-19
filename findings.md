# 调查发现

## 当前状态
- Round11 已确认 Round10 Stage1 Gate 正式冻结：Stage1 评分 9.2/10，P0=0，GO → Stage2。
- 当前代码仍由 `DemoRepository` 提供运行时数据；`src/lib/supabase/index.ts` 已预留 Stage2 wiring point。
- Stage2 应拆成两个可审查 commit：Stage2-A 先做 Repository/Auth wiring/generated DB types/Activity immutability/basic mapping；Stage2-B 再做 settlement RPC/事务/幂等/repetition/mastery/concurrency/双用户测试。
- 本轮已开始执行 Stage2-A 和网站诊断。
- 网站诊断证据：`src/app/page.tsx` 仅重定向到 `/dashboard`，API 路由本身使用 DemoRepository；Next 开发服务器显示 Ready，但访问 3000 无响应。
- 启动链路存在两个独立问题：直接执行项目 `next` 时因缺少 Windows SWC 包而尝试调用 `pnpm config get registry`，但当前 Bash PATH 没有 pnpm；使用受控 pnpm 时又因检测到现有 Linux/WSL `node_modules`，在无 TTY 环境中触发 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`。
- 页面使用 `next/font/google`，在当前受限网络环境会触发字体下载；已先移除该运行时网络依赖，改用本地系统字体，避免页面编译阻塞。但旧 dev 进程仍需重启后验证。
- `.env.local` 含真实 Supabase publishable/secret key，未改动、未输出、未纳入本次修复；secret 已存在泄露风险，后续应轮换。

## 证据
- `docs/Check/Round10.txt` 的原始结论为 `8.8/10 CONDITIONAL NO-GO`；后续 `docs/Check/Round10_VERIFICATION_SUMMARY.md` 记录 Gate 已通过，状态可推进 Stage2。
- Stage2 目标明确为：`SupabaseRepository`、`settle_activity` `SECURITY DEFINER` RPC、从 `auth.uid()` 推导 ownership、原子结算、幂等、Activity confirmed/frozen 不可篡改、双用户 RLS 隔离与并发测试。
- `Repository.applySettlement` 已定义 delta 语义、重复结算返回冲突、服务端重算 repetition snapshot、至少一个 pending MasteryVerification 等契约；Supabase 实现必须把这些保证放进 RPC/数据库事务，而不是复制到浏览器。
- `activities`、`ai_assessments`、`xp_transactions`、`skills`、`player_states` 均已有 `user_id`；但 `xp_transactions` 的 activity/assessment/skill 外键在 `0019` 才补齐，tenant 复合外键和结算 RPC仍未实现。
- `src/lib/supabase/index.ts` 明确当前仍运行 `DemoRepository`，只预留 Stage2 统一 wiring point。
- Git 工作区有未跟踪 `docs/Check/Round10.txt`，不应擅自纳入本轮提交。
- 当前不改 UI；先以最小后端垂直切片完成权威结算和运行时隔离，再接线前端。
- 网站无法进入根因已关闭：项目此前携带 WSL/Linux `node_modules`，Windows Next 缺少 `@next/swc-win32-x64-msvc`，造成 Ready 后请求挂起。现已备份旧依赖、安装 Windows 依赖、移除 `next/font/google` 网络字体；`/` 307、`/dashboard` 200、`/api/dashboard` 200，且受控 Node 22.22.2 + pnpm 11.7.0 下 production build 通过。
- Stage2-A 已新增最小 `Database` 类型、纯 snake_case↔domain mapping、RLS 用户域 `SupabaseRepository` 与 `getAuthenticatedRepository()`。默认 API 仍使用 DemoRepository，避免无登录 UI 时把现有网站变为 401；真实 Confirm 结算明确留给 Stage2-B 的 `settle_activity` RPC。
- 新增 `0020_activity_immutability.sql`：confirmed Activity 禁止任何 UPDATE；任何状态下 `raw_input` 与 `rules_version` 都不可修改。函数显式固定 `search_path=public`。

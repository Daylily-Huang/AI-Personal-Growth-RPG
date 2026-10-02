# 项目历史工作进度 (Progress Log)

## 2026-09-29 — Phase 8D 独立审查落盘（PR #38 归档闭环）

- PR #38（`docs(phase8d): final freeze archive and status sync`）已由用户合入 `main`：merge commit `a1da765e492b8d93e6350ac32865d8e0018faa91`（parents `b93273cd` + `597e3f8`）。PR head `597e3f8` 的 CI Run `36596794622` 双 job success。
- 第三个全新独立 Gatekeeper（agent `696420ae`，未复用前两个）对 `597e3f8` 给 `P0=0 / P1=0 / P2=0 + GO`：逐个 API 核对 9 个 Phase-8D CI run 的 `head_sha` 绑定、核对 merge 血缘与 main head、确认 diff 仅 4 个文档且 `src/supabase/tests` 零改动，并在本机真实 PG 上复跑 exit set（`10 passed / 1 skipped`）与六文件集（`69 passed / 2 skipped`），多次反例构造均被契约挡回。
- 该 Gatekeeper 指出 Phase 8D 缺少 8B `docs/Phase8/14_...` 式的独立审查落盘文档，判决只存在于进度记录中。已补齐 `docs/Phase8/20_PHASE8D_INDEPENDENT_REVIEW_RECORD.md`：记录三个审查实例（`e4d3ab4b` / `7bae83b5` / `696420ae`）、Round 5 的 4 项 P1 与 6 项 P2 开启与关闭证据、可外部复现的 CI/test 证据表，并明确声明三个判决均为 session attestation（同供应商同模型族、由执行方 spawn），第三方可复核 CI 绑定与重跑测试，但无法复算判决本身；同时披露"复审复用原判 agent、未为每个 corrective head 换新审查员"这一流程偏差。
- 其全量测试在本机 dev DB 留下的残留已清除（7 用户 / 2 策略 / 27 活动等；复核：10 用户、0 策略、0 proposal、0 禁用触发器）。
- PR #38 的 post-merge main push CI 已补录：Run `36599144119`（event=push，head `a1da765`）双 job success；独立审查记录 `docs/Phase8/20_...` 已同步该 run ID。

## 2026-09-29 — Phase 8D 最终冻结归档

- PR #37 已由用户手动合入 `main`：merge commit `b93273cd87d39e04a66ed0ebfd76fa95ebd2e643`（parents `98dbe37e` + `f5dd59d`）。
- Post-merge main CI Run `36593720889`（event=push，head_sha=b93273cd）双 job success：`check`（Lint/Test/Build）与 `supabase-integration`（Supabase startup、production build、database-backed tests、deterministic harness、E2E）全部 success。
- 最终 reviewed implementation exact head 为 `8b33cca8e994ba45862194d5588642e9e76626ba`（CI Run `36590521018` 双绿、independent Gatekeeper `P0=0 / P1=0 / P2=0 + GO`）；`3c09f8a` 的 Run `36587173704` 与 Gatekeeper `P2=3 + NO-GO`、Round 5 首轮对抗复审 `P1=4 / P2=6 + NO-GO` 均作为历史保留，未被改写。
- 新增最终归档 `docs/Phase8/19_PHASE8D_GATEKEEPER_REREVIEW_AND_FINAL_FREEZE.md`；`docs/MASTER_PROJECT_HANDOFF.md`、`task_plan.md` 同步至 main 基线 `b93273cd` 与 **Phase 8D = FINAL FROZEN**。DoD 1–11 全部满足。
- 冻结边界：`0046`/`0047`、四个 Strategy RPC、Strategy server boundary 与 `/journey/playbook` 随 Phase 1–8C 一并冻结；Phase 8 剩余的 reward/milestone 规格未获授权，下一阶段须先有独立 controlling document 与 Gatekeeper admission。
- 可选 backlog（需迁移，非门禁项）：已合格 `CONTEXTUAL` 上 `rpc_evaluate_strategy_status(confirm=true)` 的错误码命名不够精确。

## 2026-09-29 — Phase 8D Round 5 exit verification (accepted)

- Round 4 已接受后启动 Round 5（exit verification）。新增 `tests/phase8d-exit-verification.test.ts`，把控制文档 §10/§11.6 绑定的四个 canonical exit test 显式命名：`O008_AI_CANNOT_COMMIT_STRATEGY`、`O009_STRATEGY_REQUIRES_CROSS_TIME_SUPPORT`、`O017_STRATEGY_CONFIDENCE_IS_DETERMINISTIC_DERIVED`、`O021_AI_PROPOSAL_REQUIRES_CONFIRM_BEFORE_COMMIT`；未修改任何 production 代码、迁移或已接受测试。
- O009 补齐 §10 要求的边界反例：Case A 同日两次观测 + 0 completed Season 严格 LOW 且 `rpc_evaluate_strategy_status(true)` / `rpc_transition_strategy_status('SUPPORTED')` 均以 `22023` 拒绝；Case B 3 个不同 UTC 日期 + 1 个 COMPLETED Season FINAL review + 3 个 Core link + 100% ratio 严格 MODERATE 且拒绝晋升；第 4 个日期后才 HIGH 并在显式确认下转 `SUPPORTED`。
- §10 反例与安全项逐条对照现有测试：直接写/伪造字段、DELETE 拒绝、版本与支持不可变、反重放（evaluator/note/timestamp/Journal 别名）、随机 MANUAL UUID、跨租户、并发版本与并发 transition、UTC 边界、0/0→LOW、FINAL+COMPLETED 资格、Core link 资格、<60% 弱化、提案 reject/accept/edit 与同键重放、counter-evidence alert 只确认不改真值，均有具名测试覆盖。
- 首轮独立对抗复审为 `P0=0 / P1=4 / P2=6 + NO-GO`，指出四类未被证伪的缺口：后台 `confirm=false` 对已合格策略的非晋升未断言；CONTEXTUAL 生命周期完全未覆盖；RETIRED 后历史可查询未覆盖；策略提案并发 CAS 未覆盖（既有 CAS 测试走 `phase8b_review_outer_loop_proposal` 分支）。已全部修复：O009 在 4 日期合格后先断言 `confirm=false` 仍为 TESTING 再显式确认；新增 CONTEXTUAL（空 note `22023`、SUPPORTED↔CONTEXTUAL、<60% 弱化）与退休（空 reason `22023`、RETIRED 不可再建版本 `23514`、历史仍可查询）用例；新增 CI-only 双会话 `STRATEGY_HYPOTHESIS` 并发评审用例（一个胜出、另一个 `23514`、恰好一个 Strategy）。
- 同时收敛 P2：伪造字段/越权 UPDATE 断言精确 `42501`；补充 VERY_HIGH（8 日期 / 2 Season / 8 Core link）、ratio 恰为 0.75 的包含性门槛、`CORE_EVIDENCE_REFERENCE` 贡献 0 Core link；O008 注明 Phase 8D 无 AI 生成 HTTP 端点、AI 生产者面即 `outer_loop_proposals` 权威。
- 最终独立 Gatekeeper 对 `3c09f8a` 给出 `P0=0 / P1=0 / P2=3 + NO-GO`（实质结论全部确认，NO-GO 仅由三项非阻塞覆盖缺口驱动）：service_role/AI 角色未测；§9.1 `supporting_activity_ids` 与 §5.1 canonical timestamp 前提未在 DB 层断言；ratio 0.65/0.85 精确边界与 CONTEXTUAL confirm 语义未测。已在纯测试 corrective head `8b33cca` 全部关闭：新增 anon/service_role 对 strategies/versions/supports 的 INSERT/UPDATE/DELETE 一律 `42501`、service_role 仅能建 proposal 不能提交 Strategy；新增含两条 owned `supporting_activity_ids` 的提案审核后 0 `strategy_supports` 且保持 HYPOTHESIS/LOW/v1，并断言 authenticated 直写 activities/journal_entries 被拒；新增 13/7=0.65→MODERATE 与 17/3=0.85→VERY_HIGH 精确包含性门槛，并把「已合格 CONTEXTUAL + `confirm=true` 仍 `22023` 且生命周期不变、只能经 transition RPC 晋升」pin 为 §7 的既定契约。仅剩错误码命名（`INSUFFICIENT_SUPPORT_FOR_PROMOTION` 用词不够精确）作为可选 backlog，需迁移才能改，不作为门禁项。
- 本机真实数据库证据（此前 Round 1–4 只能依赖 CI）：先把 0043–0047 增量应用到本机 Supabase dev DB（应用前已 `pg_dump` 备份到 `.data/phase8d-pre-0043.dump`），并另建隔离 scratch DB 复跑全量。修正后 exit set：无 CI 时 `10 passed / 1 skipped`（skip 为 CI-only 并发用例），`CI=true` 时 `11 passed / 0 skipped`；定向 Phase 8D 6 文件 `69 passed / 2 skipped`；全量在 `CI=true` 且设置 Supabase key 变量时为 `1151 passed / 1 failed / 0 skipped`。同一全量仅设 `XP_RPG_TEST_DB_URL` 时为 `1121 passed / 1 failed / 30 skipped`、3 个文件失败——多出的 2 个文件失败是 `stage7d-artifact-e2e` / `stage7d-artifact-security` 在 `beforeAll` 因缺 Supabase key 抛错，属环境缺失而非 Phase 8D 回归；`30 skipped` 中的 28 个来自这两个文件。
- 唯一全量失败为 `tests/stage5b-db-repository.test.ts` 用例 1：其硬编码 domain UUID `d1111111-...-0001` 在本机 dev DB 已被既有 `demo_player@growth-rpg.dev`（2026-09-02 创建）占用，`on conflict (id) do nothing` 使该用户只剩 1 条 domain。该失败与本轮改动无关，CI 全新数据库不触发；本机为环境性数据冲突，未修改该既有数据。
- 本机门禁：ESLint 全量 `exit=0`、`tsc --noEmit` 0 error、`next build` 成功（含 `/journey/playbook` 与 6 个 `/api/strategies` 路由）、deterministic harness `11/11`、`git diff --check` 通过。
- 已清理本轮全量运行在本机 dev DB 留下的测试残留（e2e/stage5d/stage7b 时间戳用户、strategy 行、audit 行；临时关闭用户触发器后删除并恢复，验证 0 残留、0 disabled trigger），并 drop scratch DB。dev DB 现保留 0043–0047 迁移。
- exact-head CI：`3c09f8a` Run `36587173704` 与 corrective `8b33cca` Run `36590521018` 均 completed/success，`check`（Lint/Test/Build）与 `supabase-integration`（真实 database-backed tests、deterministic harness、E2E）全部 success；两次 run 均以 `head_sha` 精确绑定到对应 SHA。fresh independent Gatekeeper 对 `8b33cca` 重审为 `P0=0 / P1=0 / P2=0 + GO`。Round 5 exit verification 接受，DoD 7/8/9 满足。PR #37 仍 open/unmerged；按 §11 下一步是用户手动 merge gate 与 post-merge main CI，通过后才可宣告 Phase 8D FINAL FROZEN。

## 2026-09-29 — Phase 8D Round 4 kickoff

- 用户明确要求搭建 Playbook UI。当前分支 `codex/phase8d-strategy-playbook`，Round 3 final exact head `789569372af37e9f9e43fe4492ad914408a10125` 已通过 CI/Gatekeeper；PR #37 仍未合并。
- 已阅读本地 Next App Router 页面及 Server/Client 组件指南、控制文档 §9/§11、Strategy HTTP 类型与既有 Journey 组件。Round 4 保持 HTTP-only，不增加浏览器 DB/RPC 权威。
- 发现现有提案只有按 ID 的 review HTTP 接口、没有列表接口；本轮采用提案 ID 审核入口，不擅自扩展已接受的 Round 3 server boundary。时间戳必须保留数据库原始精度。
- 已实现 `/journey/playbook`、导航、策略全生命周期 UI、当前版本证据视图、日志来源选择器与提案 ID 审核表单；所有写入经既有 HTTP routes，无 browser Supabase 调用。
- 定向 Journey/治理回归 44/44，TypeScript、ESLint、production build 通过；全量 48 files passed / 24 skipped、783 passed / 340 skipped。`git diff --check` 通过。确定性 harness 11/11 通过。
- 首次 harness 命令错误地猜测了不存在的 `src/lib/growth-engine/harness.ts`，报 `ERR_MODULE_NOT_FOUND`；读取 `package.json` 后改跑真实脚本目标 `tests/growth-engine.test.ts`，11/11 通过，不再重复错误路径。
- 已发起独立只读对抗审查，特别核查提案审阅原文、来源时间戳、版本与确认边界。CI/exact-head 尚未进行。
- 独立初审未提交工作区结果为 `P0=0 / P1=2 / P2=1 + NO-GO`：提案 UI 无原文/检索，非日志来源无可核对定位；新版本/编辑后审核测试不足。初审环境用 `pnpm exec vitest` 未找到命令；执行侧使用实际存在的 `node_modules/.bin/vitest.cmd` 已验证全量 783 passed，不把初审工具缺失误报为代码失败。
- 当前 Round 4 不提交/推送、不声称 exact-head CI 或 Gatekeeper GO；要闭合提案与所有来源定位需补充已认证只读 HTTP/domain surface，与 §11 的“只消费已接受接口”存在授权边界，待用户确认扩展范围。
- 用户明确允许本轮补充只读接口。现已新增 authenticated `GET /api/strategies/proposals` 与 `GET /api/strategies/sources`，服务器只用用户 session 和显式 `user_id` 过滤，七类来源按 0047 canonical table/timestamp 投影；UI 显示待审提案原文、来源与过期时间，并使用来源选择/精确查询，不新增 mutation authority。
- 新增只读 adapter 单测涵盖匿名、七类来源表与 tenant filter、QUEST_OUTCOME timestamp、非法参数；真实 HTTP E2E 增加匿名/跨用户提案与日志来源读取反例。此真实数据库测试只能在 CI 临时最新迁移库执行，本机旧 0042 实例未改动。
- 纠正独立初审 P2：补充编辑后提案 CAS、历史版本证据仅作历史展示等 UI 测试。最新定向 57/57、全量 49 files passed / 24 skipped、796 passed / 340 skipped；ESLint、TypeScript、production build 和 `git diff --check` 全绿。exact-head CI 与独立重审仍待执行。
- 首轮 Round 4 exact head `ad915fc992ab7c6c28297d34987acec978a7cb83` 已推送同一分支；CI Run `36557413857` 的 `check` 与 `supabase-integration` 均 success，真实 database-backed tests、deterministic harness、E2E 均已执行。PR #37 head 已核实为该 SHA 且未合并。
- 独立 exact-head Gatekeeper 对 `ad915fc` 返回 `P0=0 / P1=1 / P2=0 + NO-GO`：提案原文虽显示 JSON，但其 canonical Activity 来源（包括超过近期 50 条的旧记录）无法从提案审核卡按 ID 核对。CI green 不覆盖此 P1，Round 5 继续 gated。
- Corrective UI 正按 0047 RPC 真实 payload 字段 `counter_evidence_activity_id` / `supporting_activity_ids` 加提案内按 ID 精确查询与接受前逐条核对；编辑后改动来源 ID 也重新门禁。定向 19/19、lint、typecheck 已通过，新 SHA 尚未提交。
- 进一步收敛 P1：按 ID 的 Activity projection 返回 `raw_input` 全文供提案内核对，近期列表只返回轻量标题/时间；提案接受/编辑后接受须先核对每个 Activity ID，警报还需核对关联 Strategy。新增 CI 真实 HTTP E2E 使用合法 Activity + 警报 fixture，验证全文、原始时间戳与跨租户不可见。最新定向 20/20、lint/typecheck 通过，待新 exact-head CI。
- Corrective 本地全量门禁：49 files passed / 24 skipped，800 passed / 340 skipped；production build、TypeScript、ESLint、`git diff --check` 均通过。跳过的真 DB/E2E 留给新 exact-head CI，不能据本机结果声称通过。
- `fc086041ccd342bfd62b2e92b41b8402a79ed212` 的 CI Run `36558552775` 双 job success，真实 database-backed tests、deterministic harness 与 E2E 全部执行成功。但独立 exact-head Gatekeeper 返回 `P0=0 / P1=0 / P2=1 + NO-GO`：缺少含两条 `supporting_activity_ids` 的策略假设逐条审核回归。已增加该测试，验证只核对一条时不发 review POST，两条均核对后才发；定向 9/9、typecheck、lint 通过。仍需新 SHA 的 CI/Gatekeeper。
- Round 4 最终 implementation exact head `6fea360adffc4f7d9cde7a159797d246ca55f592`：CI Run `36559214448` 的 `check` 与 `supabase-integration` 均 success，真实数据库、deterministic harness、E2E 已通过；独立 exact-head Gatekeeper `P0=0 / P1=0 / P2=0 + GO`。PR #37 head 已核实匹配该 SHA 且未合并。Round 4 accepted；Round 5 未开始、Phase 8D 未 FINAL FROZEN。


> **权威状态主文档**：请统一参阅 [`docs/MASTER_PROJECT_HANDOFF.md`](docs/MASTER_PROJECT_HANDOFF.md)。  
> **更新时间**: 2026-09-19

---

## 2026-09-17 — Phase 8B Season & Review 实施

- 已有实现：0043 五表 foundation、0044 九个权威 RPC、Phase 8B DB/RPC 测试、outer-loop repository/service scaffold；Draft PR #33。
- 首轮真实 CI Run `35118406738`：`check` 与 `supabase-integration` 均未通过。
- 已确认并修复第一层阻断：Phase 8B DB tests 不再把多条参数化 SQL 作为单个 prepared statement 执行，fixture cleanup 改为逐条查询。
- 已保留本地 CI 守卫修复：迁移白名单纳入 0043/0044；visual migration activation 不再仅由验证测试文件触发。
- Run `35119470754` 已证明真实 Supabase DB/RPC 权威层、deterministic harness 与 E2E 全绿。
- Round 3 已实现 `/api/seasons`、Season lifecycle action routes、Season-Quest link、Review finalize/amend、全局 Review read 与 outer-loop proposal review HTTP 适配器，并新增统一 Phase 8B HTTP 错误映射。
- 新增 Round 3 API 契约测试 10 项；本机全量结果 711 passed / 295 skipped，lint/build 全绿。
- 顺带修复 Windows 下 governance delta helper 对 `HEAD^1` 的 shell 转义兼容性，定向治理回归 26/26 通过。
- Round 3 已提交为 exact head `6e5ccdfc902dee3d9478742876aaefc0560f7e02`；GitHub Actions Run `35121618237` 的 `check` 与 `supabase-integration` 全绿，Round 4 进入门禁已满足。
- Round 4 已实现 Journey UI：`/journey/seasons` 与 `/journey/reviews`，覆盖 Season lifecycle、Quest 关联、周期 Review、FINAL amendment 与只读版本历史；Journey 局部 AppShell 保持单实例且未触碰历史全局导航治理。
- 修复 Next.js 16.3.1 production build 对 `/journey/reviews` 的 `useSearchParams()` Suspense 阻断：server page 解析 async `searchParams`，交互逻辑迁移到 `ReviewsClient`。
- Round 4 本地门禁：Round 3+4 定向 18/18；全量 44 files passed / 21 skipped，719 passed / 295 skipped；全量 ESLint 与 production build 全绿。
- Round 4 exact head `6f94f3a06ea30cfb77faa870053aedcbf03f6b8b` 已由 CI Run `35124441177` 复验，`check` 与 `supabase-integration` 均全绿。
- Round 5 新增 canonical exit / 并发覆盖：O006 ABANDONED Growth Core snapshot（含真实 XP ledger row）、O015 Quest 状态不随 Season conclusion 改写、并发 WEEKLY Review version allocation、并发 FINAL amendment version allocation，以及 Proposal CAS 的 EDITED / REJECTED / concurrent winner-loser 数据库运行时覆盖。
- Round 5 首个测试提交 `631451edc6c585f6c327e3fd38a8accb7ae6696d` 的 CI Run `35127960690` 在 `Run database-backed tests` 失败；根因是新增 O006 基线 XP transaction 使用 `ASSESSMENT_A`，但 fixture 未先插入对应 `public.ai_assessments` 父记录，触发 `fk_xp_transactions_assessment`，并非 Phase 8B RPC/CAS 逻辑失败。
- 已手术式修复 fixture：在 XP row 前 seed `ai_assessments`，cleanup 顺序改为先删 `xp_transactions`、再删 `ai_assessments`、后删 activity；commit `80abfa3878a76e1f74279c86d0c5413786fad9e9`。
- 修复后本机门禁：44 files passed / 21 skipped，725 tests passed / 301 skipped；ESLint、Next.js production build、deterministic harness 11/11 全绿。数据库相关 14 tests 本地因未配置 `XP_RPG_TEST_DB_URL` 正常 skip，不作为 DB 运行时证据。
- Exact-head CI Run `35128996512` 已全绿：`check` success；`supabase-integration` success，其中 production build、database-backed tests、deterministic Growth Engine harness、E2E 均 success。
- 下一步：对 exact implementation head 做独立只读 Gatekeeper 终审；若 `P0=0 / P1=0 / P2=0` 且明确 `GO`，则 Phase 8B implementation 满足 DoD 1–8，DoD 9 仍要求在 Phase 8C 前合入。


## 2026-09-18 — Phase 8B 项目收尾与终局冻结

- Gatekeeper 历史 NO-GO 头 `c4b4f2c...` 的四项 finding 已由 corrective head `ae35a63ab15abab6c6e7fafd06fd51281ab6e634` 手术式关闭，并补齐同 commit-key 并发 replay、CANCELLED 删除、HTTP 422 taxonomy、proposal EXPIRED 生命周期/审计回归。
- Independent exact-head re-review 已记录为 `P0=0 / P1=0 / P2=0 + GO`。
- GitHub Actions Run `35310121814` 对 corrective exact head 全绿：`check` 与 `supabase-integration` 均 success，后者包含真实 database-backed tests、deterministic Growth Engine harness 与 E2E。
- PR #33 已于 2026-09-18 合入 `main`，merge commit `0e4bec5f26411669f7031af4523b6d4fca747f96`。
- Post-merge main push CI Run `35315613393` 全绿，证明当前 main 的 push-to-main governance path 已恢复正常。
- Phase 8B DoD 独立审查与最终 merge gate 均满足，状态更新为 **FINAL FROZEN**；Phase 8C 尚未启动。
- 新增归档：`docs/Phase8/15_PHASE8B_GATEKEEPER_REREVIEW_AND_FINAL_FREEZE.md`。

## 2026-09-18 — Phase 8C controlling document 审查与草拟

- 已从 `main` 基线 `7df500b1c764efd247938dcf3da4e83b6e2e8e45` 创建文档分支 `codex/phase8c-controlling-review`。
- 已完成 AGENTS.md 要求的 Design ChatGPT 01–09 前置规则阅读（本轮补完 04–09），并复核 Phase 8 冻结架构的 Journal/State、DB、API/RPC、测试、安全与 phase ordering 边界。
- 已确认关键 O011 编号冲突：Phase 8C 控制文档将采用 supplemental `C011_JOURNAL_STATE_NOT_CAPABILITY`，不篡改 frozen canonical O011。
- 当前只进入 controlling-document planning/drafting；Phase 8C production implementation 仍为 BLOCKED，等待后续独立 Gatekeeper GO。
- 已新增 `docs/Phase8/16_PHASE8C_JOURNAL_STATE_IMPLEMENTATION_CONTROLLING.md` 草案；状态明确为 `DRAFT — PENDING INDEPENDENT GATEKEEPER; PRODUCTION IMPLEMENTATION BLOCKED`。
- 草案已封口三处架构歧义：O011 编号冲突、hard-delete 未闭合契约、WEEKLY_REFLECTION 描述中的 Review link 与冻结 schema 不一致。
- 首轮文档校验发现并修复尾随空格：`git diff --check` 命中 `task_plan.md` 1 处；同时清理新 controlling draft 头部用于 Markdown 强制换行的尾随空格，避免提交门禁噪声。
- 最终文档门禁通过：`git diff --cached --check` 无错误；四个修改文件均为有效 UTF-8 且无 NUL；无 `src/`、`supabase/`、`tests/` 或冻结 Phase 8 00–12 变更；现有用户未跟踪文件保持未触碰。
- controlling draft 首次提交：`0925b3a27043021d5c73e0a5c241c712d34c78ee`，分支 `codex/phase8c-controlling-review` 已推送。
- 已创建 Draft PR #35：`docs: draft Phase 8C Journal + State controlling document`；下一治理步骤是由独立 Gatekeeper 对 PR exact head 做只读审查，当前不授权生产实现。
- 独立只读 Gatekeeper 使用单独 Codex 会话审查 exact head `d83c324b4666816359f8b86df87bafca4bf4aa22`，结果 `P0=0 / P1=2 / P2=0 — NO-GO`；tracked worktree/index 未被 reviewer 修改。
- 已按两项 finding 做最小 controlling-document 修正：authoring-time context 与 FK `ON DELETE SET NULL` 解耦并增加 parent-deletion regression；`JOURNAL_INSIGHT` 全面延期出 Phase 8C production scope。
- corrective head `e40cd4cf248c82f77a980ff841d6f20c6b6834e2` 的独立复审结果为 `P0=0 / P1=1 / P2=0 — NO-GO`：P1-02 已关闭；P1-01R 发现 parent deletion 后 context FK 合法变 NULL 的历史 Journal 会被“每次 deliberate edit 重检 context”规则阻断普通编辑。
- 第二轮最小修正已收窄 UPDATE 校验：仅显式变更 `entry_type` 或 relevant contextual FK 时重检；父删除后的普通 content/state edit 与 archive/unarchive 保持允许，并新增对应 acceptance coverage。
- 第二轮 corrective commit `a702985041c3fb616ea3b64b5998ffd6de0d087b` 已推送，远端分支与本地 exact head 一致；独立复审结果为 `P0=0 / P1=0 / P2=0 + GO`。P1-01R、P1-02 均关闭，Phase 8C production implementation 准入解除。
- 已进入 Phase 8C Round 1：范围限定为 `journal_entries` migration、数据库约束、RLS/tenant trigger 与真实 database-backed tests；冻结 Phase 8 00–12 保持不改。
- Round 1 实现前检查确认现有迁移编号止于 0044；Phase 8C schema 契约仅授权一张 `journal_entries` 表，下一 migration 采用 0045，不提前创建 API/UI/AI 代码。
- Round 1 已落地 `0045_phase8c_journal_state_foundation.sql`：单表 `journal_entries`、9 值 taxonomy CHECK、7 个 state scalar CHECK、Season/Quest/Activity `ON DELETE SET NULL`、required indexes、RLS owner policies、`trg_enforce_journal_entry_tenant_isolation`、immutable-field/update timestamp guard 与最小列权限。
- 新增 `tests/phase8c-db-foundation.test.ts`，覆盖 taxonomy、scalar 边界、tenant SELECT、跨租户 context、immutable/system timestamps、archive/unarchive、client UUID、parent deletion SET NULL 与 Growth Core 无副作用；`tests/supabase-schema.test.ts` 已纳入 0045 chain 和离线 authority guards。
- 本机 targeted tests：`35 passed / 8 skipped`；8 个 DB tests 因 `XP_RPG_TEST_DB_URL` 未配置而 skip，不作为 DB runtime 证据。两测试文件 ESLint 全绿，`git diff --check` 无错误。Round 2 必须等待 CI 的真实 Supabase DB tests 成功后再进入。
- Round 1 implementation 已提交为 `c9d0d2765a043a4dc874a6c0a1f16da9f29807f8` 并推送至 PR #35；GitHub Actions Run `35339072556` 已全绿，真实 database-backed tests、deterministic harness、E2E 均 success，Round 2 阻塞解除。
- Round 2 已新增 `src/lib/journal/{types,repository,request,http}.ts` 与 `/api/journal`、`/api/journal/[id]` Route Handlers；范围仅 authenticated create/read/list/update/archive，没有 hard-delete route、Journal RPC 或 `JOURNAL_INSIGHT` production authority。
- Round 2 domain validation 已落实：三类 authoring context 必填；显式 `entryType`/Quest/Season context PATCH 才触发 resulting-entry 重检；父删除造成的历史 `SET NULL` 行仍允许普通正文、state 与 archive/unarchive PATCH。
- 新增 `tests/phase8c-api-domain.test.ts`，并增强 `tests/phase8c-db-foundation.test.ts` 的 O007/O018/C011 命名与 `FAILURE_POSTMORTEM` parent-deletion compatibility；随后修正 resulting-entry relevant-context PATCH 校验，并补充历史行无关 contextual FK 更新与非法 timestamp→HTTP 400 回归。最终定向门禁 `49 passed / 8 skipped`；全量 `45 files passed / 22 skipped`、`747 passed / 313 skipped`；ESLint 与 production build 全绿。首次全量测试的一次 Windows `EPERM` 经 `quest-system.test.ts` 隔离 13/13 与全量复跑全绿确认未复现。8 个 skipped 仅因本机未配置 `XP_RPG_TEST_DB_URL`。
- Round 2 Gatekeeper 在 exact head `c74a58322e063b9461fbae5bf2c2e5f641a05f66` 返回 `P0=0 / P1=3 / P2=0 — NO-GO`。三项 corrective 已落到 `tests/phase8c-db-foundation.test.ts`：跨租户 DELETE 返回 0 行且目标仍存在；parent SET NULL 后完成 archive→unarchive，并比较 Journal 7 标量与 Growth Core 前后快照；C011 使用 STATE_LOG 上下边界值，并比较非空 `player_states`、`skills`、稳定 `quests.status` 及 XP/Evidence/Mastery event counts。当前定向本地门禁 `14 passed / 8 skipped`，8 个 skipped 仍仅因本机缺 `XP_RPG_TEST_DB_URL`。
- 首个 corrective exact head `10b925cf8994fa2f938c2dac13b2e4ff13871266` 的 CI Run `35363322596`：`check` success，但 `supabase-integration` 在真实 DB tests 的 fixture setup 失败，错误为 `23505 player_states_pkey`。根因是 auth-user bootstrap 已存在 `player_states`，测试又普通 INSERT 同一 `user_id`；已将该基线 seed 改为 `ON CONFLICT (user_id) DO UPDATE`，保持非空 Growth Core 基线而避免重复主键。
- 第二个 corrective exact head `886761353a0b053e89f1836e26e287a612b0f2fa` 的 CI Run `35363920987` 已全绿：`check` 与 `supabase-integration` 均 success，后者包含真实 Supabase startup、production build、database-backed tests、deterministic harness 与 E2E。
- 对 `8867613...` 的独立 Round 2 复审返回 `P0=0 / P1=1 / P2=0 — NO-GO`。先前三项 P1 均被确认关闭；新增 P1 指向 DB authority：authenticated 角色可直接 INSERT/UPDATE，现有 RLS + field-authority trigger 未强制 required authoring context，可绕过 repository validation。
- 已完成该 P1 的手术式 corrective：migration trigger 对 authenticated CREATE 强制三类 required context；authenticated UPDATE 仅在 `entry_type` 或 resulting type 的 relevant contextual FK 显式变化时重检，因此父实体删除造成的自动 `SET NULL` 不会阻断历史行普通编辑/归档。DB tests 已覆盖无 context direct INSERT、主动移除 context 与无 context entry-type 转换。
- 当前本地门禁：targeted `14 passed / 9 skipped`，全量 `45 files passed / 22 skipped`、`747 passed / 314 skipped`，lint、production build、deterministic harness 11/11、`git diff --check` 全绿；冻结 Phase8 00–12 仍零改动。本机 Docker daemon 不可用，因此 DB runtime 证据仍待新 exact-head CI。
- Round 2 最终 exact head `8c156032c95caae7b1832ad7dc0d2603d5bb8981` 的 GitHub Actions Run `35367209443` 已确认 `check` 与 `supabase-integration` 双绿；两次独立复审均为 `P0=0 / P1=0 / P2=0 + GO`，Round 2 正式接受。
- Round 3 Journey Journal UI 已实现：新增 `/journey/journal` 与 Journey “日志”导航，覆盖反思 create/edit、类型/归档筛选、Quest/Season context、archive/unarchive、7 个主观状态控件、当前筛选集描述性均值，以及 loading/empty/error、Ctrl/⌘+Enter、响应式与长文本处理；UI 仅调用既有 HTTP API。
- Round 3 本地门禁：定向 `27/27`；全量 `46 files passed / 22 skipped`、`752 passed / 314 skipped`；lint、production build、deterministic harness `11/11`、`git diff --check` 全绿；冻结 Phase 8 00–12 与 Round 2 authority 区域相对 `8c156032...` 均零新增差异。下一步为提交推送 Round 3，绑定新 exact head 跑 CI 并做独立复审。

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
  - 2026-09-06 终审与合流（`2026-09-06_E860DAD_REVIEW.md`）：
    * R1 已关闭：门禁测试套件统一引入 `AUTHORIZED_CORE_BUGFIX_ALLOWLIST` 精确手术式白名单，零破坏零删除，所有 PR Delta 测试全绿。
    * R2 已关闭：实现轻量级进程内确定性 OpenAI 测试服务（`tests/helpers/mock-ai-server.ts`），真实 Next.js / Supabase 集成测试自动挂载，生产环境严格保持 fail-closed。
    * R3 已关闭：`docs/MASTER_PROJECT_HANDOFF.md` 修正 Mastery 等级为 M0~M10，验证门槛为目标 >= M5 或单次跨级 >= 2。
    * GitHub Actions CI 双绿通过（`check` ✅, `supabase-integration` ✅）。
    * **PR #20 已通过 Squash and merge 合入 main（Commit `6e238a4`），Stage 5C-UI Skills Modernization 正式宣告 FINAL FROZEN！**

## 2026-09-19 — Phase 8C Round 3 corrective head preparation

- Reproduced CI Run `35374173512` locally and confirmed the failure is confined to the historical visual migration governance guard.
- Added exact Phase 8C controlling-document binding in `tests/visual-foundation.test.ts` for the two Journal API routes and migration `0045`; added three fail-closed regression tests.
- Verification complete: `111/111` governance tests; `138/138` Round 3 targeted tests; full `758 passed / 314 skipped`; `pnpm lint`, `pnpm build`, `pnpm harness:deterministic` (`11/11`), and `git diff --check` pass.
- Scope verification complete: frozen `docs/Phase8/00–12` has zero diff; `supabase`, `src/lib/journal`, and `src/app/api/journal` have zero new diff from accepted Round 2 head `8c156032c95caae7b1832ad7dc0d2603d5bb8981`.
- Pending: commit/push new exact head, confirm both GitHub CI jobs success, then fresh independent Round 3 review.

## 2026-09-19 — Phase 8C Round 3 independent-review P1 corrective

- Exact head `d217366d4e2e401566446b2bfda0ea5faf46a18d` passed GitHub CI Run `35375469477` with both `check` and `supabase-integration` successful.
- Fresh independent review returned `P0=0 / P1=1 / P2=0 + NO-GO`: historical Journal rows whose required Quest/Season parent was deleted could not be edited because the Round 3 form re-applied context-required UI rules on every edit.
- Patched only `src/app/journey/journal/page.tsx` and `tests/phase8c-journey-ui.test.tsx` for the product correction. CREATE and deliberate type/context changes remain fail-closed; ordinary edits to historical `NULL` context rows no longer require replacement context, and unchanged NULL FKs are omitted from PATCH.
- Verification: targeted `28/28`; full `759 passed / 314 skipped`; lint, production build, deterministic `11/11`, and `git diff --check` all pass. Frozen Phase8 00–12 and Round 2 production-authority paths still have zero new diff.
- Pending: commit/push the new corrective exact head, wait for both exact-head CI jobs, then run a fresh independent Round 3 re-review. Round 4 remains blocked.

## 2026-09-19 — Phase 8C Round 4 context-filter corrective

- Final Gatekeeper for adc4042fc3846d133d23cbe03fd5e24342c3c067 returned P0=0 / P1=0 / P2=1 + NO-GO; only remaining finding was missing Journal context-filter UI.
- Updated only src/app/journey/journal/page.tsx and 	ests/phase8c-journey-ui.test.tsx: added Season/Quest filters that reuse the existing /api/journal?seasonId=...&questId=... contract and added runtime query assertions.
- Local verification complete: targeted 28/28; full suite 759 passed / 314 skipped; lint/build/deterministic 11/11; diff-check pass. Frozen Phase8 docs and Round 2 authority areas have zero new diff.
- Pending: commit/push new exact head, confirm both GitHub CI jobs at that SHA, then fresh independent final Round 4 Gatekeeper. Phase 8D remains blocked.

## 2026-09-19 — Phase 8C 最终冻结归档

- Final corrective exact head `f2f4d2b2d0a857348b6282dfdbfb3cfd08f4a06d` 已完成独立最终 Gatekeeper，结论 `P0=0 / P1=0 / P2=0 + GO`。
- Exact-head CI Run `35381923343` 全绿：`check` 的 lint/test/build success；`supabase-integration` 的 Supabase startup、production build、database-backed tests、deterministic Growth Engine harness、E2E 均 success。
- PR #35 已合入 `main`，merge commit `9aa76e7ce36b20b9f99e28d6cbd08eeb7bc55b85`。
- Post-merge main CI Run `35432361509` 全绿，`check` 与 `supabase-integration` 均 success。
- 新增最终归档 `docs/Phase8/17_PHASE8C_GATEKEEPER_REREVIEW_AND_FINAL_FREEZE.md`；Phase 8C 状态更新为 **FINAL FROZEN**。
- Phase 8D 保持 **BLOCKED / 未启动**；本轮没有进入任何 Phase 8D production code/schema/API/UI 工作。


## 2026-09-19 — Phase 8D 启动与准入

- Phase 8C 归档 PR #36 已由用户手动合并；权威 `main` 基线为 `98dbe37e0a6fe334b6638ca568bc3ba06b4c3aac`。
- Post-merge main CI Run `35436440893`：`check=success`、`supabase-integration=success`，Phase 8C 归档闭环。
- 已切换到 `codex/phase8d-strategy-playbook`，当前 HEAD 与上述 main 基线一致。
- `docs/Phase8/18_PHASE8D_STRATEGY_PLAYBOOK_IMPLEMENTATION_CONTROLLING.md` 已完成 admission-candidate 收敛：补齐 deterministic confidence rubric、lifecycle/transition authority、四个 RPC 的输入与失败语义、source provenance / anti-replay / tenant validation、`STRATEGY_HYPOTHESIS` 通过既有 proposal-review CAS 落地、Playbook UI 范围、runtime/database counterexamples、Round 1–5 与最终 merge/post-merge-CI DoD。
- 当前下一步是提交/推送该 controlling-document exact head，并由独立只读 Gatekeeper 对冻结文档 05/08/09/10/11/12 做 exact-head 准入审查。
- Phase 8D production schema/RPC/API/UI 仍为 **BLOCKED**；只有 Gatekeeper 返回 `P0=0 / P1=0 / P2=0 + GO` 才进入 Round 1。
# 2026-09-22 — Phase 8D Round 1 resume

- Verified branch: `codex/phase8d-strategy-playbook`.
- Verified HEAD: `b4c26079e5532cc1c02238f70de95f3e4694e554`; reviewed Gatekeeper head is the current exact HEAD and ancestor check passes.
- No tracked working-tree modifications at resume; existing Round 1 draft migration/test plus unrelated paths are untracked and preserved.
- Admission status refreshed to `P0=0 / P1=0 / P2=0 + GO`; Round 1 DB foundation is now active. Round 2 remains gated on Round 1 implementation, runtime tests, and independent exact-head review.
- One broad multi-file read was blocked before execution by Codex safety review; switched to narrow single-file reads with zero repository effect.
- Read Phase 8C `0045` field-authority/RLS pattern and Phase 8B `0044` SECURITY DEFINER authority conventions. Round 1 design chosen: authenticated Strategy create + title/description update only; internal atomic version-1 bootstrap; versions/supports authenticated read-only; immutable and tenant guards at storage layer.

## 2026-09-22 — Phase 8D Round 1 resumed

- Re-verified exact HEAD `b4c26079e5532cc1c02238f70de95f3e4694e554` and restored planning context.
- Confirmed `0046` and its test are obsolete Round 1 drafts; no production implementation commit exists yet.
- Two whole-file reads of `0046` were blocked by command safety review; repository remained unchanged by those failed reads. Switched to narrow read-only queries.

## 2026-09-23 15:12 +08:00 — Resume Phase 8D Round 1
- 已恢复 planning files、git 状态与 Phase 8D admission 状态。
- 已读取 MASTER_PROJECT_HANDOFF 与 01_SYSTEM_RULES；继续按 AGENTS.md 要求依次读取 02–09 后再编辑 Round 1 production files。
- 本轮尚未修改 migration/tests。

- 已完成 Round 1 权威边界复核：补齐 04–09，定位 controlling contract §6/§10/§11 与 frozen Strategy spec schema；下一步只读对照旧 0046、0045 authority pattern 与现有 database-backed test pattern，再重写 Round 1 foundation。

## 2026-09-28 — Phase 8D Round 1 resumed

- 确认当前 HEAD `b4c26079e5532cc1c02238f70de95f3e4694e554` 已是 controlling-document independent Gatekeeper GO 的 exact head；当前只推进 Round 1 DB foundation，Round 2 继续 gated。
- 补齐 `tests/supabase-schema.test.ts`：迁移链登记 0046，并增加三表/版本锚、taxonomy/version-1 bootstrap、private RLS/无 version-support 直写、Strategy 列权限与 immutable tenant guards 的静态断言。
- 定向测试最终通过：`39 passed / 12 skipped`；12 skipped 全部来自未配置 `XP_RPG_TEST_DB_URL` 的真实 Strategy DB suite。两个相关测试文件 ESLint 通过，`git diff --check` 通过。
- 本机 Docker daemon 未运行，真实 migration/RLS/trigger 负向测试尚未执行；在获得真实 DB 证据前不提交 Round 1 Gatekeeper，也不进入 Round 2。
- 独立对抗初审发现来源/版本锚反例不足与静态守卫脆弱；已补五类 source 的 owned/foreign/class-mismatch、同租户错误 version anchor，并强化 policy/trigger body 静态断言。最新定向结果 `40 passed / 13 skipped`，skipped 仍全部为真实 DB suite。
- 权威 `docs/MASTER_PROJECT_HANDOFF.md` 已从旧的“Phase 8D 未启动/BLOCKED”手术式同步为 admission exact head 已 GO、Round 1 IN PROGRESS、Round 2 gated；当前 main 基线同步为 Phase 8C archive merge `98dbe37...`。
- 独立只读对抗第四次复审：`P0=0 / P1=1 / P2=0 + NO-GO`。来源/版本锚覆盖与静态 policy/trigger/source mapping findings 均关闭；唯一剩余 P1 是本机无真实 Supabase runtime，下一步提交并推送 Round 1 candidate，以 exact-head CI 的 `supabase-integration` 获取数据库证据。

## 2026-09-28 — Phase 8D Round 1 accepted; Round 2 started

- Round 1 commit `400cf1536e86412e6183e45289d87cb21bd56ba1` 已推送。CI Run `36338180207` 的 `check` 与 `supabase-integration` 均 success；integration 的 Supabase startup、production build、database-backed tests、deterministic harness、E2E steps 均 success。
- Fresh independent Gatekeeper 对上述 exact SHA 返回 `P0=0 / P1=0 / P2=0 + GO`，Round 1 接受。PR #37 仍未合并。
- 本轮恢复后 `git status` 仅有原有未跟踪目录/文件；HEAD 与远端 Round 1 SHA 一致。开始 Round 2 RPC authority，下一门禁为 Round 2 exact-head CI 与独立 Gatekeeper。

## 2026-09-28 — Phase 8D Round 2 local candidate

- 新增 `0047_phase8d_strategy_rpc_authority.sql`：四个 Strategy RPC、当前版本确定性评估、审计与持久幂等键、提案审核的 Strategy 扩展；`0044` 保留为内部委托，冻结文件未修改。
- 独立只读初审指出 Quest 完成后时间戳变化破坏重放、晋升确认重放报错、编辑后 alert 内容未留痕（P1=1/P2=2）；已针对三项修复并加入相应回归用例，fresh 复审待结论。
- 本地全量 Vitest：46 files passed / 24 skipped，764 passed / 332 skipped；确定性 harness 11/11；TypeScript、定向 ESLint、`git diff --check` 通过。新增 5 个真实 DB 用例因 `XP_RPG_TEST_DB_URL` 缺失而跳过；迁移执行、RLS 与数据库负向测试仍未验证，不能宣称 Round 2 GO。
- Next.js 生产构建通过；Docker daemon 探测仍报 `open //./pipe/docker_engine: The system cannot find the file specified`，不能作为数据库测试替代。
- Fresh 只读复审确认前轮三项实现路径已修复，指出两项 P2 测试覆盖缺口：晋升确认重放、匿名/外租户来源/直写拒绝。已补这些真实 DB 用例；定向静态 40/40、TypeScript 与 ESLint 通过，Round 2 DB suite 现为 7 skipped。覆盖缺口的复审与数据库运行证据仍待完成。
- 后续只读复审指出两项 P2：直写负向测试被随机 version FK 遮蔽；`EDITED` 提案同键不同 payload 未拒绝。现改用有效 version/own source 并断言权限 SQLSTATE `42501`，且对已审定编辑载荷做同键冲突比较；回归测试已加。定向静态 40/40、TypeScript/ESLint 复跑通过；fresh 静态复审与真实 DB 仍待完成。
- 最新限定范围独立静态复审为 `P0=0 / P1=0 / P2=0`，确认两项 P2 的代码与测试闭环；这只代表静态 GO。真实数据库用例仍未运行，因此 Round 2 环境验收继续 NO-GO。下一步形成候选提交，并需另行获准推送该新 SHA 才能触发 exact-head CI。
- 当前未提交、未推送、未触发新 SHA 的 CI；Round 3 保持 gated。

## 2026-09-28 — Phase 8D Round 2 CI corrective

- `dfdb32182a69e3f6357512f05ba7219837d5270e` 已按授权推送；exact-head CI Run `36413584990` 的 `check` success，`supabase-integration` 在 database-backed tests 阶段 failure：Round 2 新增 7 个 DB 用例中 3 failed，其余 4 passed。失败被测试助手事务错误后的 `RESET ROLE` 覆盖为 `25P02`，首个 SQL 错误未从该日志确认。
- 诊断修复 `43bb67baac4ec1076db43daf4da580e8c3cec7c4` 仅让测试助手保留原始 DB 错误；已推送到同一分支，exact-head CI Run `36435042869` 运行中。此前本地定向静态 40 passed / 7 DB skipped，TypeScript、ESLint、diff check 通过；Round 2 仍 NO-GO。
- 更正本机数据库状态：Ubuntu WSL Docker 中运行着本项目 Supabase PostgreSQL，映射端口 `54322`，最高迁移版本 `0042`。先前仅检查 Windows Docker daemon/端口而误称本机没有可用 DB；未向该现有数据库应用 `0043–0047` 或写入测试数据。
- `43bb67b` 的 CI Run `36435042869`：`check` success，Supabase startup/build success；数据库测试仍 3 failed，三者原始错误均为首次 support 插入的 `SOURCE_TIMESTAMP_MISMATCH` / `22023`。已将相关测试查询改为 `created_at::text`，以保留 PostgreSQL 微秒精度并维持 production RPC 的 exact timestamp 断言；等待新 exact-head CI 验证。
- 独立只读复核发现测试仍缺 1 微秒错误断言的首次插入/重放拒绝案例（P1），且整秒 Activity 样本不能证明微秒传输（P2）。现补同一 Journal 来源的 `+ interval '1 microsecond'` 两处 `22023` 负向断言与插入前 count=0，四个 Activity 时间戳改为确定非零微秒并断言 `.123456`；本地定向 40 passed / 7 DB skipped、TypeScript/ESLint/diff-check 通过。待真实 DB 与 fresh 复审。
- 针对微秒 corrective 的第二次独立只读复核未发现新 P0/P1/P2，确认上述负向与确定非零微秒正向覆盖；仅为未提交工作树静态结论，不是 exact-head/运行时 GO。下一步提交并推送后以隔离数据库 CI 验证。

## 2026-09-29 — Phase 8D Round 3 server boundary kickoff

- Round 2 exact head `1910af870fc82ffde35bf76da93d4bac50a5effb` 已通过 CI Run `36438563584` 双 job；数据库日志 Strategy suite 12 tests、整套 70 files / 1103 tests passed。独立 Gatekeeper 修订终判 `P0=0 / P1=0 / P2=0 + GO`，Round 3 可开始；PR #37 保持未合并。
- 本轮只做 Round 3 repository/service/request/http 与认证 API，不实现 `/journey/playbook` UI。工作区原有未跟踪 `.pnpm-store/`、两个 docs 文件、`launcher/` 均保留不动。
- 已读取 `planning-with-files-zh`、现有三份进度文件和 Next 本地 route-handler guide；`session-catchup.py` 无未同步报告。一次 `Get-Content` 路由读取因同时传入位置参数和 `-LiteralPath` 失败，改为只用 `-LiteralPath`。
- 新增 `src/lib/strategy/{types,repository,request,service,http}.ts` 与六个 `src/app/api/strategies` 路由；仅 Strategy 用户草稿/元数据直接使用受限表权限，support/evaluate/transition/version 委托 0047 四 RPC。Proposal review 继续使用既有 `/api/outer-loop/proposals/[id]/review`。
- 新增 `tests/phase8d-api-adapters.test.ts`。定向初版 12/12、全量本地 47 files passed / 24 skipped（776 passed / 339 skipped）、Next 生产 build、TypeScript/ESLint 均通过；真实 DB tests 因本机未配置 0047 测试库而 skipped。
- 独立只读初审 `P0=0 / P1=1 / P2=1`：RPC 返回值缺字段可被空字符串/NaN 掩盖；元数据 PATCH 仅改标题会清空描述。已用 Zod 严格解析四类返回结构、PATCH 只提交实际提供的字段，并加两个负向回归。新定向 14/14、TypeScript/ESLint 通过；复审待结果。Round 3 尚未 exact-head CI/Gatekeeper GO。
- 同一独立审查员复审修复后的未提交工作树为 `P0=0 / P1=0 / P2=0`（仅静态）。修复后本地全量 `47 files passed / 24 skipped`、`778 passed / 339 skipped`；Next 生产 build、TypeScript、ESLint 和 diff-check 通过。尚需候选 exact-head CI、真实 DB suite 与新 exact-head Gatekeeper。
- Round 3 candidate `94a120859dfe211c84cc8620ec2fc65beffa8de2` 已推送；CI Run `36450221396` 的 `check` success，数据库作业尚在执行。独立 exact-head Gatekeeper 给 `P0=0 / P1=1 / P2=0 + NO-GO`：新路由缺真实 HTTP→认证→数据库贯通反例。此 finding 与 CI 是否双绿分开处理。
- 已在现有 `tests/e2e-http-browser.test.ts` 追加 Strategy 双用户真实请求路径：匿名 401、外租户读/写 404、受权测试状态切换、来源时间错拒、Journal alias replay 不增数、外租户来源拒、晋升不足 422、version replay 与旧证据隔离。本机该测试因未配置 0047 数据库跳过；TypeScript/ESLint 通过，需新 exact-head CI 真实执行。
- Corrective exact head `fca284249dcdaf141cfe0dfd1515013a41f6f480` 的 CI Run `36450973097` 双 job success；integration 日志明确显示 test 11 执行并通过，71 files / 1118 tests passed。独立审查撤回真实 HTTP P1，但给两个 P2：test 11 依赖早期用例建用户；外租户来源 404 后未核验 B support 零写入。现改为 test 内独立注册 A/B、并在拒绝后 GET B supports 断言 count=0；本地类型/ESLint 通过，真实执行待新 CI。
- Final Round 3 implementation exact head `2b0796e66fc900344a1571f39ebd771fe64abe47` 的 CI Run `36452011311` 双 job success；integration 原始日志确认 Strategy RPC 12 tests 与真实 HTTP Strategy test 11 执行通过、71 files / 1118 tests passed，deterministic harness 和单独 E2E 步骤 success。独立 Gatekeeper 最终 `P0=0 / P1=0 / P2=0 + GO`；PR #37 head 同 SHA，仍 open/unmerged。Round 4 可作为下一阶段开始，但本次尚未写 UI。
- 文档-only 状态同步提交 `1949e1f` 的独立复审发现 `task_plan.md` 顶部“当前”摘要仍停在 Round 2，与新增 Round 3 GO 记录冲突（P2）。已只更新当前摘要与阶段总览，保留历史过程行；需对此新文档 SHA 重新做 CI/复审。

## 2026-09-30 — Phase 8E pre-admission draft

- 从 `origin/main` baseline `a1da765e492b8d93e6350ac32865d8e0018faa91` 切出 `codex/phase8e-reward-wishes-admission`；原有未跟踪 `.pnpm-store/`、两份 docs 与 `launcher/` 保留不动。
- 新增 `docs/Phase8/21_PHASE8E_REWARD_WISHES_IMPLEMENTATION_CONTROLLING.md`，状态为 PRE-ADMISSION DRAFT；没有创建 migration、RPC、API 或 UI。
- 已明确 `REAL_WORLD_VERIFIED` 依赖 Phase 8F、O005 在 8E 只验 correction primitive、单一 selected Wish 覆盖 PRIMARY+RESERVED、循环 FK migration 顺序、cooldown 实际 enforcement 与 `credit_cost` 字段统一。
- 两项承重政策保持 blocker：D1 奖励策略载体/精确数值，D2 Artifact 确定性资格。未获用户决策与 fresh exact-head Gatekeeper GO 前生产实现不授权。
- 本地治理定向验证通过：`visual-foundation`、`supabase-schema`、`governance-delta-guard` 共 3 files / 92 tests passed；WSL 因现有 Windows node_modules 缺 Linux rolldown native binding 未执行，结果来自 Windows Vitest。
- Fresh 独立只读对抗审查：`P0=0 / P1=0 / P2=0`，三条承重命题均通过；因 D1–D3 尚未解除，阶段总判保持非缺陷性 `NO-GO`。

## 2026-09-30 — Phase 8E D1/D2 user decisions

- 用户明确批准 D1：采用 immutable versioned PostgreSQL function `reward-v1`；额度冻结为 Season 150，Quest Major/Epic/Main-or-Boss 为 100/150/200，Mastery M6/M8/M10 为 100/150/250。
- 用户明确批准 D2：Phase 8E 延后 Artifact EARN，等待独立、确定性的验证标准；当前必须 fail closed 且零 ledger mutation。
- 控制文档已从 PRE-ADMISSION DRAFT 更新为 ADMISSION CANDIDATE；生产实现仍需 fresh exact-head Gatekeeper 接受 D3 并返回 `P0=0 / P1=0 / P2=0 + GO`。
- Admission exact head `080accd5b49088ba8e62686bb2a54dcdc189c515` 已获 fresh independent Gatekeeper `P0=0 / P1=0 / P2=0 + GO`；D3 明确接受，Phase 8E 仅获准进入 Round 1。
- Round 1 范围锁定：`0048` 四表 foundation、RLS/tenant/field-authority/immutability guards、纯 `foldRewardLedger` 与测试；`0049` RPC、API、UI 继续 gated。
- Round 1 写入前发现 admission contract 的新 P1：`IDEA -> ACTIVE` 生命周期没有合法 authority path；直接客户端状态更新被禁止，原九 RPC 也无 activate。生产写入继续暂停，先补 `rpc_activate_wish` 控制契约并重新送 Gatekeeper。
- Exact head `4bbe3d1...` 的 fresh Gatekeeper 返回 `P0=0 / P1=2 / P2=0 + NO-GO`：通用 RPC 规则误要求 activation 写 ledger/account；activation 幂等 key 未绑定 RPC/target/payload。现拆分通用与六个财务 RPC 规则，并定义 audit-backed SHA-256 fingerprint、stored result snapshot 与 `IDEMPOTENCY_KEY_REUSED` 冲突。
- Corrective head `f4adc14...` 已关闭前两项 P1，但 fresh Gatekeeper 新发现 1 个 P1：总不变量“Every mutation RPC-only”与 Wish 草稿 INSERT / IDEA-ACTIVE metadata field grants 冲突。现收窄为 financial mutation + lifecycle transition RPC-only，草稿内容编辑仍受字段级 grant/RLS/trigger 限制。
- Exact head `b23696d...` 的 Gatekeeper 返回 `P0=0 / P1=2 / P2=0 + NO-GO`：验收条款仍无条件拒绝 authenticated direct writes；全部 10 RPC 缺同 key 跨 target 并发串行化。现改为精确正/负 direct-write matrix，并冻结 `(user,key)` transaction advisory lock -> audit replay check -> domain locks 的顺序及失败零残留。
- Exact head `bf0229e...` 的 fresh Gatekeeper 返回 `P0=0 / P1=2 / P2=0 + NO-GO`：ownership 校验仍排在 key replay 前；D2 rejection audit 与“任何失败零审计残留”冲突。现冻结 auth -> normalized tuple -> `(user,key)` lock -> existing replay -> first-seen ownership 的优先级，并区分可提交的确定性业务拒绝与必须全回滚的事务失败。
- Corrective exact head `cd24254...` 已获 fresh Gatekeeper `P0=0 / P1=0 / P2=0 + GO`，只授权 Phase 8E Round 1 DB foundation；Round 2 RPC/API/UI 仍未授权。
- Phase 8E Round 1 已实现 `0048` 四表/RLS/field authority/immutable guards、纯 `foldRewardLedger` 与静态/可选真实 DB 测试。定向测试 82 passed、全量测试 818 passed、TypeScript/ESLint、Next production build 均通过。真实 DB 测试未验证：Supabase CLI 2.114.0 可用，但 Docker Desktop Linux engine 未建立 `dockerDesktopLinuxEngine` 管道。
- Round 1 exact head `ac7c27a...` 的独立 Gatekeeper 返回 `P0=0 / P1=2 / P2=1 + NO-GO`：WISH ledger tenant、exact correction/refund guards 不完整；`src/lib/reward/` 未纳入 visual backend freeze。现补齐永久账本关联守卫、反例测试与精确 `fold.ts` allowlist；真实 DB 未运行继续作为未验证 P2，不进入 Round 2。
- Corrective head `b898bc9...` 的 fresh Gatekeeper 返回 `P0=0 / P1=1 / P2=1 + NO-GO`：生产 SQL 两项 P1 已关闭，但 direct-write 测试使用不完整载荷，可能因 NOT NULL 而错误通过。现改为完整可落库载荷、精确 SQLSTATE `42501` 与四表前后行数不变断言；真实 DB P2 仍未验证。
- Corrective head `d7d7a75...` 的 fresh Gatekeeper 返回 `P0=0 / P1=1 / P2=1 + NO-GO`：完整载荷已关闭前项，但 `SET ROLE` 自身的 42501 仍可能冒充 INSERT 拒绝。现将角色/JWT/current_user/auth.uid 核验移到捕获范围外，仅捕获目标 INSERT，并保留 SQLSTATE 与零副作用断言。
- Exact head `6f8dfdd640f41b24fc8ae3d58443c94f477e4753` 的 fresh Gatekeeper 返回 `P0=0 / P1=0 / P2=1 + Round 1 GO`。Round 1 代码/静态门禁通过；Round 2 继续 BLOCKED，必须先在该 HEAD 或仅补验证证据的后继 HEAD 上跑通真实 PostgreSQL 套件。
- 本机真实 DB 阻塞已独立诊断：Supabase CLI 2.114.0 可用；WSL2/Ubuntu 正常；Docker Desktop backend 因 `C:\Users\Administrator\AppData\Local\Docker\run\sailor-ingest.sock` 返回 Error 1920 而崩溃，停止服务后 Move/Remove/fsutil 仍无法访问；Ubuntu 侧未发现 `psql/postgres/initdb/pg_ctl`。未删除 socket、镜像、容器或 volume，Docker 服务恢复为原先的 stopped 状态。

## 2026-09-30 — Phase 8E Round 1 真实 PostgreSQL 验证（纠正阻塞误判 + 修复真实缺陷）

- 上一轮的“Docker 损坏导致真实 DB 无法运行”结论被证伪：本机 Supabase 跑在 **WSL 原生 Docker daemon**（`docker context default`，`unix:///var/run/docker.sock`；`supabase_*_AI_Personal_Growth_RPG` 全部 healthy，`54321` 返回 200、`54322` 开放），只有 **Windows** 的 `supabase` CLI 2.114.0 因绑定 `desktop-linux` 管道而不可用。DB 套件的唯一开关是 `XP_RPG_TEST_DB_URL`：此前是「未设置被 skip」，不是「被阻塞」。未删除任何 socket/镜像/容器/volume，未改动 Windows Docker 服务状态。
- 应用 `0048` 到本机 dev DB 前先做备份 `.data/phase8e-pre-0048.dump`（`docker exec supabase_db_... pg_dump -Fc`），再以单事务 `psql -v ON_ERROR_STOP=1 -1 -f -` 应用 migration 并写入 `supabase_migrations.schema_migrations('0048','phase8e_reward_wishes_foundation')`。
- `XP_RPG_TEST_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres` 下首跑 `tests/phase8e-db-foundation.test.ts`：**5 passed / 1 failed**。失败用例「authenticated metadata edits are narrow and stop after ACTIVE」暴露真实缺陷：`wishes_owner_update` 的 `USING (auth.uid() = user_id AND status IN ('IDEA','ACTIVE'))` 会把越权 UPDATE 过滤成 **0 行**而非报错，导致 `trg_enforce_wish_field_authority` 对 `PRIMARY` 等状态完全不可达，客户端拿到静默成功。已改为 ownership-only `USING`（拒绝由触发器 `42501` 负责，`WITH CHECK` 作为纵深防御），并补契约要求的第二条正向路径（`ACTIVE` 期间仍可改 title/description/credit_cost）、拒绝后行内容不变断言、cooldown 与 DELETE 的 `42501` 断言。
- 全量真实 DB 套件（`.data/run-tests.cjs`，只注入 `.env.local` 的 Supabase 凭据 + `XP_RPG_TEST_DB_URL`，`CI=true`）：修复前 `1173 passed / 2 failed / 0 skipped (1175)`，修复后 `1174 passed / 1 failed / 0 skipped (1175)`；唯一剩余失败是本机历史数据导致的 `tests/stage5b-db-repository.test.ts` case 1（`d1111111-1111-4000-a000-000000000001` 已被 `demo_player@growth-rpg.dev` 占用 + `on conflict (id) do nothing`），与 8E 无关、CI 干净库不复现。
- 曾把 `.env.local` 整份注入测试进程，导致 `AI_BASE_URL` 指向已下线的 `127.0.0.1:3099` 桥接、mock AI 未启动，产生 3 个 e2e + 1 个 stage5d 假失败（超时/502）；改为白名单注入后全部通过。`tsc --noEmit`、`eslint`、`next build` 均 exit 0。
- 空库可复现性由本轮自查的独立 scratch DB 证明（**不是** `empty-db-migration.smoke`）：Gatekeeper 指出该 smoke 在 `public.activities` 已存在时会跳过整个 migration 循环（`tests/empty-db-migration.smoke.test.ts:52-59`），本机即为此情形，故原引用无效。实际做法：`create database gk8e_owner_verify` + 最小 `auth` shim（`auth.users`、`auth.uid()`），以 `psql -v ON_ERROR_STOP=1 -1 -f -` 应用 corrective head `5e0d449003a88da98c3659cd7adbae64ef951046` 的 `0048` blob → 0 error（4 张表、5 个触发器、6 条 policy），随后 `drop database`。指纹命令如下（dev DB 与 scratch DB 各执行一次，输出完全相同）：

`select md5(string_agg(polname || '|' || pg_get_expr(polqual, polrelid) || '|' || coalesce(pg_get_expr(polwithcheck, polrelid), '-'), E'\n' order by polname)) from pg_policy where polrelid in ('public.wishes'::regclass, 'public.reward_accounts'::regclass, 'public.reward_transactions'::regclass, 'public.reward_redemptions'::regclass);`

两边结果均为 `7881dbec1a794d84ecf5e631e72d0364`。（此前只写了摘要值未附命令，第三位 Gatekeeper 因此无法复算；该值本身可复现。）
- 测试残留已清理：删除 27 个时间戳/`phase8d-*` 测试账号（事务内先禁用 public 触发器、按 `auth.users` 外键循环删子表、再启用触发器），本机 dev DB 回到基线 `users=10`、`activities=2`、禁用触发器 0、孤儿行 0；`wishes/reward_accounts/reward_transactions/reward_redemptions` 全为 0。
- 本轮为 corrective exact head，Round 1 已重新送 fresh 独立 Gatekeeper（见下一节）。

## 2026-09-30 — Phase 8E Round 1：两个 fresh 独立 Gatekeeper 复核与 P2 关闭

- 对 exact head `62035a4db2199c57bdb48f3b225f984a0f76f21e` 跑了**两个互不相同的 fresh 只读对抗 Gatekeeper**（一个后台、一个阻塞式，均未继承本会话上下文），两者独立复现了：修复前后两个方向、~75 条越权语句无新漏洞（含 MERGE/upsert/COPY/DDL、`service_role` 无 grant 故 BYPASSRLS 无用、`authenticated` 无角色继承）、空库指纹一致、Docker 环境结论、`6/6` 与 `1174/1175` 计数、`stage5b` 为历史数据碰撞（非 8E 回归）。两者终判一致：**P0=0 / P1=0，Round 1 GO**；按 controlling §12 仍以 `P2≠0` 为由**不解除 Round 2**。
- P2 关闭（本次证据型后继提交）：
  1. 纠正 `progress.md` 中 `empty-db-migration.smoke` 的空库证据引用（该 smoke 在本机为空转），改为上一条的 scratch DB 指纹证据。
  2. 补 §11 要求的**四表**跨租户隔离断言：`tests/phase8e-db-foundation.test.ts` 现对 `reward_accounts`/`reward_transactions`/`wishes`/`reward_redemptions` 各做「属主可见 1 行 + USER_B 可见 0 行」双向断言（含正向控制，避免空转通过）。
  3. 补系统时间戳直接写拒绝断言：`authenticated` 改 `created_at`/`updated_at` 均 `42501`，且在可编辑的 `ACTIVE` 状态下断言，排除「因生命周期被拒」的错误归因。
  4. 记录（非认可）Round 2 前置条件：契约允许 `IDEA/ACTIVE` 期间改 `credit_cost` 且该列可为 NULL，属主当前可把 `ACTIVE` Wish 的 `credit_cost` 清空（测试已固化该行为），因此 `rpc_reserve_wish_credits` / `rpc_set_primary_wish` 必须对 NULL cost fail closed，不能假设「ACTIVE ⇒ 有正数 cost」。
- 残留清理：两位 Gatekeeper 的全量跑又留下 18 个时间戳/`phase8d-*` 账号（其中一位因 `trg_prevent_strategy_version_mutation` 拒绝直接删除而保留），已按既定「事务内禁用 public 触发器 + 按 `auth.users` 外键循环删子表」流程清空；dev DB 回到 `users=10`、残留 0、禁用触发器 0。
- 第三位 fresh Gatekeeper 复核 P2 关闭提交 `5e0d449003a88da98c3659cd7adbae64ef951046`：`P0=0 / P1=0 / P2=1 + GO`。唯一 P2 是 `progress.md` 只记录指纹摘要值、未附复算命令（已在上一节补全命令）；另指出送出任务书时的 head 全 SHA 写错（真实值如上，已核对 `git cat-file`）。它同时做了**变异测试**证明新断言可失败：把四张表的 owner_select policy 依次改成 `USING (true)` 会让对应那张表的断言分别失败；把 `wishes_owner_select` 改成 `auth.uid() <> user_id` 会让 6/6 全败；把 `credit_cost` 改成 `NOT NULL` 会让 metadata 用例失败——均随后回滚/恢复为 6/6。
- 待办：`5e0d449` 已推送 origin；等用户创建 PR → exact-head CI 双绿（DB/concurrency 套件不得 skip）→ 再跑一次 fresh Gatekeeper 取得 `P2=0 + GO`，方可解锁 Round 2 (`0049`)。

## 2026-09-30 — Phase 8E Round 1：一次性实例 CI 等价复现 + 合并 main 解冲突

- 为补齐三位 Gatekeeper 唯一共同标注的「无法验证」项（一次性 disposable 实例上 DB/并发套件不得 skip），在 WSL 内下载 **Linux supabase CLI 2.114.0**（`.data/ci/supabase`，gitignored），用独立工作目录 `.data/ci/stack`（`project_id = ai_growth_rpg_ci_scratch`、端口整体 +1000：API 55321 / DB 55322、独立卷与网络）起了一个全新栈，**未触碰用户现有 dev 栈**。
- 严格按 `.github/workflows/ci.yml` 的 `supabase-integration` 顺序复刻：`supabase start`（48 个 migration 全量应用、`users=0`）→ `supabase status -o env` 导出与 CI 完全相同的四个变量（`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`、`SUPABASE_SECRET_KEY`、`XP_RPG_TEST_DB_URL`）→ `next build` → `vitest run` → `harness:deterministic` → `test:e2e`。
- 结果：`Test Files 76 passed (76)`、**`Tests 1175 passed (1175)`、0 skipped、0 failed**；`harness:deterministic` 11/11；`test:e2e` 10/10；`tsc --noEmit`、`eslint`、`next build` 均 exit 0。这同时证明 dev 栈上 `stage5b` 的那 1 个失败纯属本机历史数据（干净栈上通过）。
- CI `check` job 等价复现（不设 `XP_RPG_TEST_DB_URL`）：`Test Files 50 passed | 26 skipped (76)`、`818 passed | 357 skipped (1175)`——这正是上一轮报告里「818 passed / 357 skipped」的真实来源，即 DB 套件当时被整批 skip。
- 过程中修掉两个**本机复现环境**的坑（非被测代码缺陷）：① `.env.local` 白名单在覆盖文件之后执行，把 `NEXT_PUBLIC_SUPABASE_URL` 写回 dev 的 54321，导致「pg 写一次性栈 / PostgREST 读 dev 栈」混用，出现 4 个假失败；② 本机 `.next` 是早先用 dev 凭据构建的，而 CI 是在导出一次性栈凭据**之后**才 build（`NEXT_PUBLIC_*` 会内联进产物），导致进程内起 Next 的 HTTP/E2E 套件全部 401，按 CI 顺序重建后全绿。
- 环境已完整还原：一次性栈 `supabase stop --no-backup` 后残留容器 0、dev 栈 11 个容器与 `54321`/`54322` 正常；dev DB 清回基线 `users=10 / activities=2 / 8E 四表全 0 / 禁用触发器 0`（混用期间被写脏的 13 个测试账号已按「禁用 public 触发器 + 按外键循环删子表」流程清除）；`.next` 已用 dev 凭据重建；仓库 tracked 文件未被环境操作改动。
- PR **#40** 已由用户创建（base `main` @ `be949deb`，head `59a45f5`），创建时状态为 conflict（`dirty`）且未触发任何 CI run。已把 `origin/main` 合并进分支并解决 `docs/MASTER_PROJECT_HANDOFF.md`、`task_plan.md` 的冲突（保留 main 的 8D FINAL FROZEN + 文档 20 叙述，并追加 Phase 8E Round 1 状态），`progress.md` 自动合并成功。

## 2026-09-30 — Phase 8E Round 1：PR #40 exact-head CI 与 corrective gate

- PR #40 当前 exact head `958829c215626df165640a3f33279d28d4b05c9b`，base `be949deb67f62269d58a0e21865580d0e67204e0`，GitHub 显示 `mergeable=true / mergeable_state=clean`。Actions Run `36713825255` 的 `check` 与 `supabase-integration` 均 success。
- 公开 Jobs API 可复核 `supabase-integration` 的 `Export local Supabase credentials` 与 `Run database-backed tests` 两个步骤均 success；`scripts/export-supabase-ci-env.cjs` 在 `DB_URL` 缺失时 exit 1，并把非空值写入 `XP_RPG_TEST_DB_URL`；`tests/phase8e-db-foundation.test.ts` 唯一 skip 条件正是该变量缺失。因此该 exact-head 的 Phase 8E DB suite 不可能以缺少 DB URL 的 skip 路径得到成功。为让后续审查无需下载受限 job log，在 integration workflow 中新增独立的 `Verify database test gate is active` 步骤，缺少变量即失败。
- Fresh 独立 Gatekeeper 对 `958829c` 返回 `P0=0 / P1=2 / P2=0 + NO-GO`：P1-01 为公开 job log 下载受限导致 0-skip 证据不可直接复核；P1-02 为 `task_plan.md` 将 Round 2 错写成含 API/UI，且 Master handoff 保留了“尚未创建 0048”的过时 admission 待办。本次仅修复 CI 证据可见性与上述文档矛盾；不创建 `0049`，Round 2 继续 BLOCKED，等待 corrective exact-head CI 与新的 fresh Gatekeeper。

## 2026-10-02 — Phase 8E Round 2：0049 RPC authority 本地闭环

- Round 1 corrective exact head `11fbb7aad0c8d5fb4d0a501b77199c186a828533` 的 CI Run `36730784334` 中 `check` 与 `supabase-integration` 均 success，fresh Gatekeeper `P0=0 / P1=0 / P2=0 + GO`，仅授权 Round 2 `0049`，不授权 API/UI。
- Docker Desktop 已从 4.87.0 升级至 4.93.0；绕过损坏的 `docker-secrets-engine/engine.sock` 后，本地 Supabase API 恢复 HTTP 200。清理已使用更新缓存 857,245,819 bytes，并删除 5 个无人引用的历史验证 volume（约 210 MiB）；当前 12 个 Supabase 容器、全部在用镜像及 3 个当前 volume 保留，build cache 为 0。
- 新增 `0049_phase8e_reward_wishes_rpc_authority.sql`：冻结 D1 `reward-v1` 数值，D2 Artifact/REAL_WORLD_VERIFIED fail closed；实现十个 authenticated-only RPC、append-only ledger/correction、account fold/cache parity、Wish 生命周期/预留/兑换/退款、统一 caller+key replay authority，以及 `WISH_COST_SUGGESTION` proposal wrapper。
- 真实 PostgreSQL 首轮本地验证全绿后，独立 Gatekeeper 报 4 个 P1：缺 PRIMARY→ARCHIVED、set-primary 未按 account-first 锁序、六金融 RPC 顺序非 ledger→audit→cache、十 RPC 并发矩阵不足。已全部修复，并加入 projected account snapshot + audit-before-cache apply 及十 RPC same-key replay/conflict 双连接矩阵。
- 修复后证据：聚焦 `3 files / 89 tests` 全过；完整真实 DB 套件 `77 files passed`、`1191 passed / 2 skipped (1193)`；deterministic `11/11`、TypeScript、ESLint、production build、`git diff --check` 全绿。fresh corrective Gatekeeper：`P0=0 / P1=0 / P2=0 + GO`，只接受 Round 2，不授权 Round 3。
- 当前待办：只提交本轮 0049/测试/治理与状态文件并推送 PR #40，取得新 exact-head CI 双绿后冻结 Round 2；并行出现的 login/auth/端口同步修改不属于本轮，不纳入提交。

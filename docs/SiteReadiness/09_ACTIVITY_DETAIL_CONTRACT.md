# 09 — Activity 原文详情：纠正准入合同

日期：2026-10-10。状态：ADMISSION 待独立 Risk2；本文件不声称实现、完整 MVP 或整站完成。

## 1. 原始缺口与接受基线

04_MVP_ROADMAP_AND_ACCEPTANCE §13 第 11 步要求从 Activity 页面回溯原文。现有 ActivityLog/RecentGrowth 只有截断显示，没有可打开的详情；上一轮真实 AI 的 API 原文检查不能替代页面验收。保留这一 P2 和历史 NO-GO，不降低原验收标准。

接受基线 main/HEAD `c06ab0b692045557d550a3e8eb2b9dd8aed61645`，tree `8f14dbca16341324678cb0c51f6c19f08cf3c25d`。实现副本 `.data/site-activity-detail`，分支 `codex/site-activity-detail-20261010`；root 旧分支、7 个用户 dirty 文件、正式数据库、备份和当前 3015 预览均保留。准入阶段只新增本合同；生产及旧治理测试须 ADMISSION GO 后才可编辑。

## 2. 精确 22 路径，不授予目录权限

```text
docs/Design ChatGPT/02_PRODUCT_DESIGN.md
docs/MASTER_PROJECT_HANDOFF.md
docs/SiteReadiness/09_ACTIVITY_DETAIL_CONTRACT.md
docs/SiteReadiness/10_ACTIVITY_DETAIL_VERIFICATION.md
findings.md
progress.md
src/app/activities/[id]/page.tsx
src/app/api/activities/[id]/route.ts
src/components/dashboard/ActivityHistoryList.tsx
src/components/dashboard/RecentGrowthFeed.tsx
task_plan.md
tests/activity-detail-api.test.ts
tests/activity-detail-governance.test.ts
tests/activity-detail-http.test.ts
tests/activity-detail-ui.test.tsx
tests/graph-canvas-governance.test.ts
tests/graph-mobile-governance.test.ts
tests/helpers/governance-delta.ts
tests/onboarding-governance.test.ts
tests/phase5-dashboard-ui.test.tsx
tests/phase8f-ui-governance.test.ts
tests/visual-foundation.test.ts
```

七个旧 guard 的必要性：helper 注册新 scope；visual/Phase8F/Canvas/mobile/Guide 累计范围识别；Phase5Dashboard 原政策禁止与 dashboard 同 delta 的一切 API，必须仅对已完整准入的这一个 GET 给予窄适配。不得修改旧 policy、旧 helper 函数体、历史 synthetic 断言、已有保护 blob 或把禁止目录变成许可目录。

10 个必须同时出现的 marker：本 09、02、四个 production、四个新 test。缺任一 marker 不能激活新例外。全候选必须恰为上述 22 路径；治理 selector 可接受这些路径的子集以检测反例，但任何额外路径必须拒绝。

新 exclusive additions 恰为 11：09、10、四 production、四新 test，以及 `tests/phase5-dashboard-ui.test.tsx`。02 及其他旧 guard 已在旧 Guide 范围内，不能错误地从历史范围删除。当前严格 c06 范围先通过，再只从旧累计 delta 过滤这 11 个新 additions；原 Guide 21/11/12、graph/mobile 旧 marker/allowlist 和 Phase8F 禁止谓词仍独立执行。Phase5Dashboard 仅在新严格 scope 通过且 all10 时，从实际 policy 输入移除精确 `src/app/api/activities/[id]/route.ts`；旧 synthetic forbidden 输入完全不变。

Git fail-closed：working 为 c06..HEAD/working tracked + untracked；PR 为 c06..HEAD 全候选，不以 first-parent 隐藏跨提交改动。current-main 只在实际 origin/main == HEAD 且 c06 是祖先时取 first-parent（merge 的 main parent）；所有 Git 异常、非 40 位 HEAD、非祖先、空 delta 必须失败。现有 07/旧 helper 的原文 prefix 不变，仅追加新函数；不得借 09 授权旧 Core/SQL/auth/bootstrap/AI/依赖/workflow 任何变更。

## 3. 私有只读接口

新增 `GET /api/activities/[id]`。只复用现有 `isSupabaseConfigured`、`getAuthenticatedRepository`、`AuthRequiredError`、`isValidUuid` 与 `Repository.getActivity`，不走可回退 Demo 的 `getRequestRepository`。

- 缺 public Supabase 配置：503 固定安全 JSON；配置有效而无 session：401。
- 认证先于 UUID 验证：已认证非法 UUID 为 400；匿名不能靠参数探测记录。
- 真实 request-scoped repository + owner/RLS；不存在及 foreign 同为 404。query/header 中的 user/owner 不得替换 session。
- 成功 200 `{activity}`，保留 rawInput 原样及当前领域字段；异常统一 500，不输出 SDK/SQL/error.message/密钥。
- 所有本接口显式 JSON 分支为 `Cache-Control: private, no-store`；无任何可缓存 private receipt，不通过 service-role 读记录。
- 仅 GET；不新增 POST/PATCH/DELETE/RPC/AI/确认/状态写入。读取旧记录按 UUID，不受 dashboard 近期 10 条限制。

## 4. 真正可见的详情与入口

新 `/activities/[id]` 不在既有 AppShell product-prefix 中：自带单 main、h1、固定 Dashboard 返回，不改 AppShell/全局导航。遵循现有浅色、44px touch target、原生键盘与手机布局；不新增图形相机/动画参数。

同源 GET、same-origin credentials、no-store、AbortController。缺编译 public 配置必须明确报错且零读取；401 转固定 login；404/invalid/config/error 均不可伪造原文。receipt 验证为 plain own fields：UUID 与 route 匹配（UUID case-insensitive），title/rawInput/createdAt/rulesVersion 字符串，status 精确三态 pending_assessment/assessed/confirmed；畸形 receipt fail closed，不默认 confirmed。切换 id/重试/unmount 必须隔离旧或延迟响应。

原文以 React text + pre-wrap/anywhere 完整显示，保留换行、Unicode、空白和 HTML 字面量，不用 dangerouslySetInnerHTML、不链接化、不 trim、不 truncate/line-clamp。可显示实际 title/status/time/rulesVersion/id；不捏造评估、XP 或奖励。明确本页只读，不自动评估或确认。

ActivityHistoryList 给 actual activity.id 添加详情入口，保留旧排序、近期 10 条和空状态。RecentGrowthFeed 仅 actual valid activityId 可跳详情；null/空/非法 legacy activityId 留普通文本，绝不使用 transaction.id/assessment.id 冒充。保持原六条、XP、reason、skill、repetition 信息和旧 empty 行为。

## 5. 不变项、来源与测试承重

冻结 01 不变项，02§71 primary-only，04§13 全 13 步，07_UI_DESIGN_SYSTEM 可访问性与响应式。不得因先手动建的技能是 secondary 就要求它必须获 XP。API 复用现有 UUID 语法，不新增版本限制。Activity 三态来源 `src/lib/store/types.ts`。44px 来源现有 globals.css touch token；md=48rem、250ms/0 reduced-motion 与两图相机原参数均不改。0049 唯一不可变 reward-v1 的八值仍为 Season150、Quest Major100/Epic150/Main或Boss200、Mastery M6/M8/M10=100/150/250；0050 精确 grammar、0053 manual zero-XP 不变。Artifact 认定/奖励继续延期，现实成就只记录零积分。

新增 tests：API auth/config/uuid/private-no-store/owner/error/rawReceipt；UI 原文精确渲染、链接 source、缺配置零 GET、三态、畸形 receipt、id/retry race、unmount、401、安全/键盘；治理 exact22/all10/missing10/extras/oldscope mixed/working/PR/main/Git异常与全部旧函数/断言保护；真实 HTTP 至少同源 session、跨用户/不存在一致404、读取超过10条的旧记录、完整长原文/HTML字面量、GET前后 Core/财务深快照不变及无权限写方法。fixture 创建与业务只读阶段分开，不冒称建 fixture 也零写。

所有新真实 HTTP 必须完成 build 后，独占合成 `phase8f_test_...` 栈、精确四容器 project/workdir/ports/IDs/Created、实际 BUILD_ID 和编译 public tuple 与 runtime 一致、源码 hash 未变。missing/different public tuple 必须在测试 dispatch 前失败。不能复用正式库或用户私有文本。当前项目专用 DeepSeek 仅 server process memory，测试真实 AI 只传本轮合成输入；模型/原 prompt/schema 不变，密钥文件不回显、不复制/上传。

## 6. 顺序、独审和清理

ADMISSION GO → 实现 → direct-Node（不使用会重建共享依赖的 pnpm exec）target/lint/type/build → 独占合成全 PG suite/既有 harness/E2E → 真实 Chrome 严格04§13全部13步（第11步必须点击入口到新详情，完整原文实际可见）及手机/长文本/原生 Tab/错误态 → fresh Risk2 candidate。独审须自己构造反例/实际模块验证，不以主报告代跑；明示 DB_ACCESS_GRANTED 才取独占测试 DB/HTTP，结束永久 DB_ACCESS_COMPLETE 后主精确 disposal。

最终 note 区分独立与 main-only、文件数与 internal suite、历史失败与最终 terminal；22 路径冻结 manifest，任何字节变化作废绑定。candidate GO → selected22 commit → exact-head own CI → 不同 fresh committed FINAL → 用户委托 ordinary merge → post-main CI → accepted 本机预览。无 admin/force/public deployment。单项 GO 不等于整站完成。

每阶段只清理可证明属于本轮的合成四容器/一卷、clients、临时构建/副本与可再生缓存；清理前验证实际依赖链接不再指向待删除副本，保留正式11容器/备份、root4保护、用户其它文件、密钥和可用网站。禁止 global prune/删活跃 node_modules/系统缓存/未知进程。

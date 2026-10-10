# 15 — Assessment Context：旧回归兼容范围补充准入

日期：2026-10-11。状态：待 fresh Risk2 ADMISSION；只定义兼容补充，不是候选验收、FINAL、合并或整站完成。

## 1. 原合同保持与实际失败

本轮 base/HEAD 仍为 `15f6287cd53d9049a2d6e60958cab40f75911405`、tree `d8e80817d390ac9e203cf83637bb37dca7444134`，分支 `codex/site-assessment-context-20261010`。13全文保持，raw/canonical SHA256 均为 `EB4EDD946D269D3050C93D56F97C29C0C7DEA5D8847D5FB2AA1E80B5C5063E48`。本补充只替代13的实际交付路径数量/marker数量及对应严格门禁，不扩展产品能力或历史内容白名单。

主 full-v2 实际126文件、3005 assertions通过、11失败、child.status=1、signal/error=null、verificationError=null；raw JSON `4F97DDAEB7022BF903A8C5FCD6FFB157EB7BCAF7392631EE95F46DACBC8DA5EC`。九项是主Git包装器漏放行只读hash-object；一项是旧HTTP认证测试要求原固定安全提示；一项是原AI失败测试明确mock DemoRepository但未显式清除全套注入的public Supabase配置。不得删断言、skip或降低真实认证要求求绿。

此前full-v1主包装器误将OS临时Git夹具指向候选，产生本地误提交e7f6c94、common config变更；已保留恢复ref、恢复原分支/index及可工作的项目配置，全部30文件/源/Root四保护文件和refs核对。无完整raw或子进程终态，不算通过。此历史及所有旧失败必须保留；不能声称配置原字节恢复或reviewer零文件写等未经证明的事。

## 2. EXACT32 / 17 markers

仅新增本15与 `tests/ai-assessment-failure.test.ts` 两项；其余仍原13的30项，完整允许集为：

```text
docs/Design ChatGPT/02_PRODUCT_DESIGN.md
docs/MASTER_PROJECT_HANDOFF.md
docs/SiteReadiness/13_ASSESSMENT_CONTEXT_CONTRACT.md
docs/SiteReadiness/14_ASSESSMENT_CONTEXT_VERIFICATION.md
docs/SiteReadiness/15_ASSESSMENT_CONTEXT_COMPATIBILITY_CONTRACT.md
findings.md
progress.md
src/app/api/activities/[id]/assess/route.ts
src/lib/ai/assessment-context.ts
src/lib/ai/assess.ts
src/lib/ai/prompts.ts
src/lib/store/assessment-context.repository.ts
src/lib/store/repository.ts
src/lib/store/supabase-repository.ts
task_plan.md
tests/activity-detail-governance.test.ts
tests/ai-assessment-failure.test.ts
tests/assessment-context-api.test.ts
tests/assessment-context-authority.test.ts
tests/assessment-context-golden.test.ts
tests/assessment-context-governance.test.ts
tests/assessment-context-http.test.ts
tests/assessment-context-repository.test.ts
tests/assessment-context.test.ts
tests/graph-canvas-governance.test.ts
tests/graph-mobile-governance.test.ts
tests/helpers/governance-delta.ts
tests/onboarding-governance.test.ts
tests/phase5-dashboard-ui.test.tsx
tests/phase8f-ui-governance.test.ts
tests/proposal-rejection-governance.test.ts
tests/visual-foundation.test.ts
```

分类：7 production、7 new tests、10 existing tests/guards、8 docs/plans。17 markers为13原16逐字集合加本15；旧AI test是允许集的必需第32项，不是marker，不新增目录通配权。

在ADMISSION GO前只新增15；其它候选字节不改。GO后，helper新context尾段允许增加独立compatibility常量/纯selector/hash validator；原accepted15f helper全文prefix、原13 scope纯函数的30路径synthetic/default语义不改。当files包含本15或旧AI test时，必须检查all17且无extra，旧AI test缺失或缺marker也不能当32成功。实际working、完整PR/base...HEAD、current-main HEAD^1..HEAD必须严格EXACT32、同时核验13与本15的canonical全文hash；本15hash在ADMISSION GO后计算绑定。不能靠旧all16先命中而绕过32；selector在visual/8F分支早退前生效。原30纯测试仍保持原预期，不能将本15自动吸收为任意旧scope的合法extra。

旧八guard wrapper复用新的actual32 gate后，仍执行原历史断言；仅context尾段允许适配，不改旧helper prefix/旧assertions/旧合成案例。历史路径仅原13规定的两个固定终点和六anchors；内容投影仍只有onboarding七项、Activity三项、Reject prompts一项，禁止把旧AI test或其它文件加为历史内容例外。七protected blobs继续current原样。新增测试必须攻击缺17 markers、缺旧AI test、extra/重复/旧scope混入、13/15篡改及Git错误、实际working/committed/remote-main三拓扑；不能仅用模拟“成功报告”。

## 3. 两个兼容修复的精确实现边界

1. 已允许的assess route：`AuthRequiredError`分支返回与原类构造函数相同的固定安全字符串 `An authenticated Supabase session is required`。只处理这个类型，不传播任意SDK/private error.message；401/private,no-store/Vary Cookie继续，原 `tests/http-auth-flow.test.ts`全文不改。新增API回归须保留固定文字与private header断言，并证明其它异常仍固定安全500/502。
2. 新增允许的 `tests/ai-assessment-failure.test.ts`：accepted raw SHA256 `10B8710092BAFAF07EAAD2FE13D505CB64173F6A3676B82558BEC663FF0465E8`。只在第6条已明确使用DemoRepository的测试内，显式删除 `NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`，由现有afterEach originalEnv还原。其余代码、六条用例名称、每条原断言/故障注入/未settled/pending/no-assessment证明原样；逆向删除这两行与说明注释须完整还原accepted文件。不能修改生产isSupabaseConfigured/auth工厂或以repo类推断Demo；有public配置而缺context端口仍500且零AI dispatch。原1–5实际adapter失败和无credentials策略不改。
3. 主ignored Git shim：候选cwd只允许只读Git，hash-object允许计算并拒绝-w/--literally；OS `/tmp/governance-delta-fixture-*` 路径使用真正cwd原生Git，其它路径拒绝。显式main旧fixture26独立运行、before/after候选HEAD/tree/allrefs/common-config/source保护不变。临时Git fixture会写OS tmp，不得包装成严格只读独审证据。

这不是用户规则选择：不改Edit、不改UI/确认/拒绝/DB/migrations/RLS/RPC/XP/Mastery/Artifact/reality/provider/model/temperature/credentials/依赖/workflow。原13的隐私预算、来源、schema、无fallback、旧完整prompt与版本边界、全部冻结常量和验收义务继续。

## 4. 运行证据与后续门禁

原build-v2/HTTP-v2/浏览器flow-v2/source23只作历史证据，兼容source/test变化后全部失效为最终绑定。新的completed-build receipt必须覆盖EXACT32中的24 source/test文件及同20 unique production；旧Reject completed-build view仍仅原exact18、同BUILD_ID/HEAD/tree/public tuple、绑定新完整receipt，不能降低旧HTTP断言。

先新目标验证旧AI6、旧auth、新API、纯治理；再实际全套/type/lint/build/Growth deterministic/既有E2E。全套计数读取actual testResults/assertions及child终态，不预测通过数，不混同internal suite数。fresh browser用新合成owner，绑定当前Git/BUILD_ID/24 source/20 production；原文、Evidence/Confidence、Confirm单一XP、Reject不增长、SDK故障不生假assessment、四宽与原生键盘必须实测。原真实provider smoke仅是合成单次实际请求历史，不以它代替改后源或模型质量验收。

fresh Risk2 corrective candidate独立审查EXACT32与全部13承重义务，显式exclusive DB grant后指定目标＋bounded READ ONLY/ROLLBACK，永久释放后主精确owned disposal；最终14/note与32 manifest冻结。selected32 commit后own exact-head CI、不同fresh committed FINAL、新栈/新disposal、受托ordinary merge及post-main/新预览仍分别通过。禁止提前commit/push、admin/force或公开部署。

现有3017、formal54321/54322、备份、Root四保护文件、原密钥、共享physical node_modules保持。最终仅清本轮无引用可重建cache与确切owned合成栈，报告实际大小；不global prune，不删证据或假称整站完成。

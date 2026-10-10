# 11 — Proposal Review Round1：拒绝提案准入合同

日期：2026-10-10。状态：ADMISSION 待 fresh 独立 Risk2；本合同不是实现验收或整站完成声明。

## 1. 基线、目标及后续缺口

接受 main/HEAD `78d2036af19e55ea59f40cdc8a3358c3bab3cae4`，tree `9a85fff25d2ee36396cda29c7723408d482887eb`。实现分支 `codex/site-proposal-rejection-20261010`、副本 `.data/site-proposal-rejection`；当前可用3016、root用户改动、正式Supabase54321/54322、备份与共享依赖保持。

02§33、03§76、04 M2-03要求Confirm/Edit/Verify/Reject；现有页面只有Confirm。本轮按04垂直切片原则仅完成Reject：拒绝自己未确认的AI提案，保留原始Activity和评估历史，不产生、删除或抵消任何成长。Edit、事实纠正/补证、验证申请及最小AI上下文分别后续受控实现；不得把本轮标成完整Proposal Review或整站完成。高阶Mastery没有独立验证标准时不自动授予；Artifact认定和奖励继续延期，现实成就只记录零积分。

准入阶段仅新增本11。独立ADMISSION GO前不改生产、旧guard或测试；实现后任何候选字节变化均使此前候选绑定失效。

## 2. 精确25路径与12个marker

```text
docs/Design ChatGPT/02_PRODUCT_DESIGN.md
docs/MASTER_PROJECT_HANDOFF.md
docs/SiteReadiness/11_PROPOSAL_REJECTION_CONTRACT.md
docs/SiteReadiness/12_PROPOSAL_REJECTION_VERIFICATION.md
findings.md
progress.md
src/app/api/assessments/[id]/reject/route.ts
src/components/dashboard/PendingProposals.tsx
src/lib/assessments/rejection-client.ts
src/lib/store/assessment-rejection.service.ts
task_plan.md
tests/activity-detail-governance.test.ts
tests/graph-canvas-governance.test.ts
tests/graph-mobile-governance.test.ts
tests/helpers/governance-delta.ts
tests/onboarding-governance.test.ts
tests/phase5-dashboard-ui.test.tsx
tests/phase8f-ui-governance.test.ts
tests/proposal-rejection-api.test.ts
tests/proposal-rejection-authority.test.ts
tests/proposal-rejection-governance.test.ts
tests/proposal-rejection-http.test.ts
tests/proposal-rejection-service.test.ts
tests/proposal-rejection-ui.test.tsx
tests/visual-foundation.test.ts
```

分类：4 production、6 new tests、8 existing guards（含helper）、7 docs/plans。必须同时存在的12 markers：本11、02、四production、六new tests。selector仅在all12时许可上述精确路径的子集；duplicate、任何extra、缺marker都拒绝。真实working+untracked、完整PR和current-main候选必须EXACT25，不能用selector通过冒充完整范围。

旧helper在接受78d的全文canonical prefix逐字保留，仅追加新函数/常量。旧policy、历史synthetic用例/断言、先前控制01–10、7个8F受保护blob、Growth/确认/RLS/SQL/AI/prompts/schema/依赖/workflow/全局UI保持。只允许八guard在真实working/committed入口识别本轮严格scope；不得给任何目录通配权，也不得仅因docs/tests路径就放行。

## 3. 当前与历史治理必须分别绑定，避免共享路径误投旧scope

新Git解析器接受base78d；working为base78d到当前tracked+untracked完整差集；PR用78d...HEAD全范围，绝不HEAD~1。只有实际origin/main==HEAD、base为祖先、合法40hex HEAD/父提交、非空时current-main才取HEAD^1..HEAD。Git异常/空范围/错祖先/伪mode或files/range一律fail closed。

真实当前入口必须先独立解析并核验EXACT25/all12/11内容绑定，之后才处理旧历史。新主分支必须使用真实当前25，不能回到PR55的22或PR56的7，也不能根据测试运行时随意假定是PR或main。新增回归须覆盖working、累计PR、future main以及当前远端main前移情形。

Dashboard page不是旧Guide marker：真实旧Guide11个markers和固定历史差集都不包含它，而onboarding旧测试将它作为受保护blob。本轮不修改Dashboard page，四production改为新API、服务、纯客户端请求/回执模块及既有PendingProposals；Dashboard和其它非本轮目标的protected blob断言继续检查当前真实文件。允许在严格当前scope通过后，为旧历史路径断言读取真实固定accepted78d的历史差集：`git diff --no-renames --name-only -z <旧接受base> 78d`；所有Git失败/非法base/空历史差集拒绝。历史投影必须显式命名、绑定固定78d和所用旧base，不伪称为当前working/PR/main delta，不改origin/ref或伪造Git输出。旧Activity22、PR56 corrective7和Guide/graph累计的范围与历史真实路径分别检查；当前25的全部路径仍由新独立门禁承担，不能用历史投影遮蔽新增extra。

onboarding原“every nonselected original22 file...”把PR56未选的15文件与b9cef旧字节比较，其中恰七个在本轮25内：`docs/Design ChatGPT/02_PRODUCT_DESIGN.md`、`tests/activity-detail-governance.test.ts`、`tests/phase5-dashboard-ui.test.tsx`、`tests/visual-foundation.test.ts`、`tests/graph-canvas-governance.test.ts`、`tests/graph-mobile-governance.test.ts`、`tests/phase8f-ui-governance.test.ts`。仅对该处这七个文件，允许在真实EXACT25/all12/11完整hash/实际Git范围均通过后，把该历史内容断言的左输入显式改为真实`git show 78d:<精确file>`，右输入仍是原b9cef blob，断言不能跳过。其它八个15列表成员继续读当前文件；原Dashboard等保护、8F七blob、旧helper全部prefix、旧synthetic/default断言不变。不得把任意docs/tests投影到旧版本；七个当前新版本必须由新25范围、02原文prefix、六guard旧断言/分支逆向恢复与本轮新反例独立验收。未通过当前严格门禁、非法file/锚点或git show失败均fail closed，不能以历史读取替代当前字节验收。

原历史helper/classifier函数体和synthetic默认行为不变。可对实际工作区入口新增本轮strict dispatcher：只有本11存在且all12、EXACT25/内容/真实Git范围全部通过才走本轮当前检查及显式历史投影；其余执行原入口，缺marker不能安静回退成功。原旧断言保留为历史路径验证，不删除、不改弱、不把主分支校验改成总通过。visual selector在最前识别本11并严格返回违规，禁止“非visual”早退绕过；8F原violations不改，仅all12后对四精确production例外，额外Core/SQL/旧授权混入仍失败。Phase5仅完整新scope下对精确新reject API与service窄适配，其它后端仍禁止。

11 canonical UTF-8/LF完整文件hash由独立ADMISSION原文绑定；实现helper固定该hash。12过程说明与MASTER/计划仅追加当前事实，旧历史不重写。新治理用例须实际攻击12个missing marker、extra/mixed、旧helper/policy/synthetic断言保留、旧scope overlap、真实当前/累计/未来main/Git故障、控制hash/重复章或路径/伪range，不能只测自写替身。

## 4. 服务端权限与唯一状态写入

新增POST `/api/assessments/[id]/reject`，不新增SQL/RPC/数据库列或客户端UPDATE权限。复用现有server Supabase client的`auth.getUser()`验证session；缺public配置503，无session401，身份先于UUID验证；配置/认证基础设施失败不能回退Demo。不可从body/query/header接受user_id/owner/assessment/proposal或状态作为权限。认证后的非法UUID400。

只接受JSON空对象`{}`；非JSON/畸形/数组/null/unknown字段400，body实际读取上限1024 UTF-8 bytes，超限413，不信任Content-Length。跨origin或Sec-Fetch-Site=cross-site拒绝403，不能靠浏览器简单表单触发写入；无Origin的同源非浏览器JSON客户端可用。仅POST，其它写方法不提供入口。

新服务只供已验证的当前session上下文调用：先用request-scoped RLS client读取精确assessment id+user_id。missing/foreign均404，不用service-role查不存在/foreign。只对pending允许进入写入，已经rejected返回同一个最小成功回执、零写；confirmed/edited/superseded返回409，不能退回pending。

服务端受控CAS才可调用现有admin client：**唯一写语句**对`ai_assessments`执行`UPDATE {status:'rejected'} WHERE id=<verified id> AND user_id=<auth.getUser id> AND activity_id=<RLS原row activity> AND status='pending'`，且返回实际row。继承既有AssessmentPersistence受信服务边界，不授权其它admin用途；不修改admin工厂/通用Repository/认证路由。不可读取或输出secret，客户端不得import本服务或admin模块。没有新的authenticated/anon写策略或宽泛admin能力。

CAS未匹配时只用同一个RLS作用域重读：rejected为重放200，其余终态409，消失404；异常固定安全500。不得依赖先读pending作为已写成功的证明。成功receipt只回`{assessment:{id,activityId,status:'rejected'}}`，必须为实际合法own fields，UUID绑定原请求/row且raw status精确rejected，不能在map中默认状态。所有显式JSON分支private,no-store并Vary:Cookie，错误不含SDK/SQL/error.message/秘密，不console记录完整private row。

拒绝只改该row.status；assessment_json/model/prompt/rules/confidence/created_at/confirmed_at/updated_at、Activity原始raw/status/rules、所有其它assessment，以及所有Core/成长/财务表不变。原row本身即持久状态历史，不删除提案，不调用AI，不写XP/证据/Mastery/Quest/Artifacts或纠正流水。

## 5. 原子性、并发及UI

单行CAS的数据库行锁序与现有0042 confirm先assessment后Activity相容：新拒绝不持有第二实体锁，不新增逆序Activity锁。这个设计推论必须由真实PG验证，不能仅凭绿色mock证明。same-key双拒绝只一次状态转移；reject先胜则随后Confirm无任何XP/成长，Confirm先胜则reject409且原结算保持；同Activity sibling同时确认时，不得把已superseded提案恢复rejected/pending或制造重复XP。用户另一个独立活动合法确认不受影响。

PendingProposals保留既有指标、ArtifactResolutionPicker和Confirm语义。新增纯客户端模块只负责同源POST/AbortSignal/严格最小回执及固定安全错误，不import服务端/密钥。新增“拒绝提案”是明确二次确认的inline区，文案说明只拒绝本评估、不删除活动、不发或扣XP，可取消。当前item确认和拒绝互斥；提交中拒绝/确认按钮禁用、防连续点击；只有实际rejected回执才在组件内部移除该pending项并显示成功，若有现有AppShell context则复用refreshDashboard；无context的独立渲染也按已提交回执更新自身列表，整页刷新后须由真实DB保持。成功提示在列表变空后仍可见；不改Dashboard page、load、全局context或其它组件。不虚构结算/奖励。失败保留提案可重试，401固定login，409说明已变更并尝试刷新；网络或刷新失败不冒充写入成功，已实际提交但刷新失败应明确区分。空列表/旧Confirm/longtext/中文/mobile/键盘不回归。无Demo配置必须明确503而非写demo.json。

客户端必须严格核对返回id/activityId/status，只实际rejected receipt才显示成功。切换item/unmount/延迟响应不能作用到新提案；禁用只限正在处理的item、不得阻断其它提案的合法操作。44px原touch token、原生Tab/Enter、可见focus、aria-live错误/成功；不新增相机/全局动画/导航或额外外部依赖。

## 6. 承重证据、门禁与清理

新六tests：API配置/auth/owner/UUID/JSON实读上限/origin/安全错误/所有终态与receipt；service实际SDK查询绑定及CAS/replay/失败/畸形raw receipt；UI二次确认/取消/互斥/单击重放/错误/刷新/401/延迟与卸载/旧Confirm；真实authority行锁两种顺序、双拒绝/sibling、三owner完整表与原row字段快照；completed-build HTTP真session/foreign/405/cache/cross-site/真Confirm冲突/持久重读；完整治理承重。

独占合成栈以实际project/workdir/四IDs+Created/API54331/DB54332/BUILD_ID/编译public tuple绑定，不连接正式库，不使用真实用户内容。HTTP不得在build中运行；错误/缺失public tuple在测试dispatch前拒绝，测试进程finally关闭Next/HTTP/pg。测试和真实Chrome使用合成账户；本轮不需真实AI请求，新提案fixture明确主建不是AI生成，历史真实AI闭环不当成本轮证据。真实浏览器要实际拒绝、刷新后消失/原活动可读、其它提案Confirm保持、手机320/375/768/1280、原生Tab与错误态；没有跑的不能写已通过。

全部外部常量/规则冻结：01时间非XP、XP非Mastery、证据/确定性账本；02 primary-only；Assessment五状态来源types/0007；0042锁序；0020raw/rules不可变；0018撤销旧assessment写策略并仅建立SELECT策略、0028_schema_grants.sql表权限共同维持客户端无assessment写权（不是0021建立这一策略）；0021仅作为服务端record_ai_assessment与Activity权限参考；44px、md48rem、250ms/0 reduced-motion与两图相机原参数；唯一0049 immutable reward-v1八金额[150,100,150,200,200,100,150,250]及0050 grammar、0053手工零XP不变。独审须独立核对这些来源而非只读主摘要。

ADMISSION GO → 实现 → direct-Node目标/lint/type/build → 实际全PG套件+Growth harness/既有E2E → 主真实浏览器 → fresh Risk2 candidate（自己独立反例/指定测试，显式独占DB_ACCESS_GRANTED后才DB/HTTP）→永久DB_ACCESS_COMPLETE →主精确自有清理→25文件冻结manifest/note最终绑定。candidate GO后selected25 commit/own exact-head CI/不同fresh committed FINAL/普通merge/post-main CI/accepted本机预览另行验证。不admin/force/公开部署，不用CI代独审，不把ADMISSION/candidate/FINAL与整站完成混淆。

每阶段清理仅确属本轮且无进程/依赖引用的合成容器/卷、临时客户端和可再生构建；不global prune，不删正式数据/备份/用户文件/密钥、共享node_modules、Playwright/系统缓存或当前3016；来源不明不删除。最终报告实际目标及逻辑释放空间、保留项和未验证项。

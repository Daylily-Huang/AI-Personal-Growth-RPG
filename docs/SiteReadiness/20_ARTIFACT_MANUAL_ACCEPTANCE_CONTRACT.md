# 20 — Artifact 用户手动验收与首次100愿望积分

状态：待 fresh Risk2 ADMISSION。本文件仅锁定后续实现准入；不是实现验收、候选GO、committed FINAL、合并、正式0056升级或整站完成授权。

## 1. 已确认决定及窄政策修订

用户明确选择「手动验收＋每件首次100积分」。积分是现有愿望积分，不是XP、现金、Mastery或Evidence等级。由本人明确声明作品符合自己的交付要求，再由服务端确定性结算100；AI不判合格、不决定数额、不直接写入账本或永久成长。

这窄修订02/03/06中Artifact认定与奖励延期的现行约束：新增独立 `USER_CONFIRMED_ARTIFACT` /「用户验收」权威路径，绝不冒称 `CORE_VERIFIED`、第三方验证、已验证Evidence或高阶Mastery资格。现实成就仍只记录、零积分；既有Quest/Season/Mastery的reward-v1及旧来源谓词不变。01 > 02 > 03 > 04–10 > 实现。

本地使用，公网部署、PWA、附件上传、远程URL抓取、自动运行作品、AI质量评分、相似度去重、高级Verifier与外部集成不在本次范围。「每件」以现有稳定Artifact UUID为身份：改名、改版本、改链接、归档/恢复、换request key或策略版本均不再奖励。创建不同UUID的实质重复内容不能声称已自动识别；保留旧建档去重，不新增AI或内容比对权威。

## 2. 基线、EXACT46与MARKERS25

accepted base `5168bc4805444ecd1d62490d99f55d3c9e17a58b`，tree `1043f1180b7e1a0b0d21c48784d1ae40069ec373`，PR60已合并。隔离checkout `.data/site-artifact-manual`，branch `codex/site-artifact-manual-20261012`。正式数据库/API、现站与已构建0055预览、PR60冻结53、SQL0001..0055、root用户修改、密钥、完整备份和共享依赖均不动。

最终 working tracked+untracked、完整PR、明确识别的current-main first-parent差集必须且只能是下列46个唯一文件。旧文件限本合同规定的窄接入或追加，不借allowlist重构。

```text
docs/Design ChatGPT/02_PRODUCT_DESIGN.md
docs/Design ChatGPT/03_TECHNICAL_IMPLEMENTATION.md
docs/Design ChatGPT/06_DATABASE_SCHEMA_AND_DATA_DICTIONARY.md
docs/MASTER_PROJECT_HANDOFF.md
docs/SiteReadiness/20_ARTIFACT_MANUAL_ACCEPTANCE_CONTRACT.md
docs/SiteReadiness/21_ARTIFACT_MANUAL_ACCEPTANCE_VERIFICATION.md
findings.md
progress.md
task_plan.md
src/lib/artifact-acceptance/types.ts
src/lib/artifact-acceptance/validation.ts
src/lib/artifact-acceptance/repository.ts
src/lib/artifact-acceptance/request.ts
src/lib/artifact-acceptance/http.ts
src/lib/artifact-acceptance/client.ts
src/components/artifacts/ArtifactAcceptancePanel.tsx
src/app/api/artifacts/[id]/acceptance/route.ts
src/app/api/artifacts/[id]/acceptance/revoke/route.ts
src/app/artifacts/page.tsx
src/components/artifacts/ArtifactInspectorContent.tsx
src/components/milestones/MilestonesClient.tsx
supabase/migrations/0056_artifact_manual_acceptance.sql
tests/artifact-acceptance-validation.test.ts
tests/artifact-acceptance-repository.test.ts
tests/artifact-acceptance-api.test.ts
tests/artifact-acceptance-authority.test.ts
tests/artifact-acceptance-concurrency.test.ts
tests/artifact-acceptance-http.test.ts
tests/artifact-acceptance-ui.test.tsx
tests/artifact-acceptance-governance.test.ts
tests/activity-detail-governance.test.ts
tests/assessment-context-governance.test.ts
tests/evidence-submission-governance.test.ts
tests/graph-canvas-governance.test.ts
tests/graph-mobile-governance.test.ts
tests/helpers/governance-delta.ts
tests/onboarding-governance.test.ts
tests/phase8f-ui-governance.test.ts
tests/proposal-rejection-governance.test.ts
tests/proposal-edit-governance.test.ts
tests/supabase-schema.test.ts
tests/visual-foundation.test.ts
tests/phase8f-milestones-ui.test.tsx
tests/phase5-dashboard-ui.test.tsx
tests/stage7c-ui.test.tsx
tests/assessment-context-api.test.ts
```

其中production13 = 新模块6、新面板1、新路由2、现页/Inspector/Milestones3、唯一SQL0056；新测试8；文档/计划9；旧治理14；旧UI测试的一行文案断言1、旧API仅一处fixture UUID1。MARKERS25 = 本合同、02/03/06、production13、新测试8。全25齐备、EXACT46全等、合同canonical SHA256（UTF8，仅CRLF→LF）一致后，才可作任何旧范围/历史内容投影。合同出现但标记缺失不得回落到18/16/13/11/09等旧选择器。

原V1 EXACT42、V2 EXACT43、V3 EXACT44及其准入、候选GO/提交e0a9ff8c与所有运行历史均保留；当前e0a9ff8c ownCI38167679925被旧Stage7C第29治理入口拒绝，不能合并。V4第45文件tests/stage7c-ui.test.tsx的最前alias/wrapper已获03A26独立ADMISSION；当前V5再仅新增第46文件tests/assessment-context-api.test.ts的一处fixture UUID，先独立同Risk2 ADMISSION GO后才可实施V5。生产13、新测试8、文档9、MARKERS25不变，旧治理14、唯一旧UI文案断言1、旧API一处fixture1；old53不含Stage7C但含该API，重叠21、累计53+46−21=78。合同重新准入后冻结；范围/规则变更仍须同档重新准入，21只记录证据不暗改政策，执行者不自签独立GO。

## 3. 资格、验收快照与审计权威

首领只允许本人存在、`lifecycle_status='active' AND is_archived=false` 的作品。草稿/更替/归档不能首次验收，用户可通过原有编辑/恢复流程明确切为active后再验收；验收本身不自动变更生命周期、标题、版本、拓扑或任何作品字段。

新增且只新增一张私有表 `artifact_acceptances`：独立ID、user_id、artifact_id、认定类型固定USER_CONFIRMED_ARTIFACT、状态ACTIVE/REVOKED、不可变的验收时标题/nullable版本/原始updated_at、验收说明、accepted_at、唯一原EARN ID及固定策略；撤销仅一次追加 revoked_at、原因、原CORRECTION ID。验收记录是手动认定与历史快照，不是另一套Artifact可编辑真值。

`UNIQUE(user_id,artifact_id)`覆盖全部状态。REVOKED是终态，不删除、不重新认定、不再次领奖；源后续更名/版本更新不改旧快照。界面同时标明验收版本和当前版本，不能把旧版本验收冒称新版已验收。

以复合owner FK或等效不可绕过的owner回查约束Artifact、账户、EARN、CORRECTION；NULL必需字段、错误owner/account/kind/source/金额/策略都fail-closed。允许作品原有归档/恢复；已认定作品单独物理删除必须被新引用约束阻止，以免删后复用ID刷奖。允许UI沿用原删除失败/建议归档反馈，不在本范围修改旧仓储删除协议。不为auth父级删库新增超出现行账本限制的承诺。

表启用RLS，authenticated仅本人SELECT；anon不可读，authenticated/anon/service_role均无原始INSERT/UPDATE/DELETE或helper执行权限。即使临时放宽表级/列级grant、伪造JWT role、session authority标志或trigger depth，外层不可信SQL角色也不能直接写入。受控RPC的实际outer SQL role/auth.uid与SECURITY DEFINER内部current_user须分别核验；不得仅凭definer变成postgres就把外部调用认作受信。所有新helper固定search_path并撤销PUBLIC及三角色EXECUTE。

首次验收、100 EARN、账户缓存与一次外环审计在一个事务提交；任何失败全回滚，无孤立EARN或半成认定。GET/浏览/创建/编辑/AI建议/刷新/历史迁移均不发奖，也不提前创建或修复账户。

## 4. 独立策略、终生防重和撤销

新策略固定 `artifact-manual-v1`、canonical_source_type=`ARTIFACT`、canonical_source_id=规范小写作品UUID；新增独立IMMUTABLE的100金额函数，不能编辑/替换0049的calculate_reward_grant_v1或0050的canonicalizer/grant。旧公共grant继续拒绝ARTIFACT；任何旧Milestone API/class/settle谓词不扩容。

新增独立跨policy的Artifact EARN唯一索引，至少覆盖 `(user_id,canonical_source_type,canonical_source_id)` 且仅ARTIFACT/EARN，防止换策略发第二笔。0056对未知既存Artifact EARN或不一致历史须迁移失败，不自动认领、删除或补发。新ledger INSERT guard只追加ARTIFACT权威检查，禁止不可信角色raw insert绕过验收，即使放宽grant；不能更改旧账本integrity/immutable函数或其他来源的既有结果。EARN必须100、本人账户/作品、新权威链接一致；新guard不能使旧合法correction流程失效。

所有请求共享现有outer_loop_audit_events的 `(user_id,request_idempotency_key)` 权威。使用与0049/0052相同的key锁 `hashtextextended(user_id::text || E'\x1f' || key,0)`，先取key锁、判既有完整tuple/fingerprint，再读取可变作品/认定/账户；新增private begin/audit helper使用独立策略标记，不修改旧helper。accept与revoke、全部旧RPC同key异tuple必须冲突且零delta；本人完全相同tuple必须重放原不可变receipt，即使源后来改名/归档、认定已撤销。客户端超时/丢响应不能换key盲发。

首次accept在key锁后使用既有账户互斥锁和稳定顺序的源/认定行锁；相同作品不同key/并发最多一笔认定和EARN，后到新key报已认定409，不造第二个成功审计。相同key回放返回原成功snapshot，不用当前状态改写历史结果。并发accept/revoke、原generic correction、兑换/预留与新100结算必须遵守既有账户锁顺序与fold，不产生死锁式错误重试、丢更新或超支。

revoke只认本人现有ACTIVE认定，理由必需；校验原EARN同user/account、EARN、100、ARTIFACT、同规范UUID、artifact-manual-v1。没有CORRECTION时新增精确-100，追加审计并更新认定状态/既有账户fold。已有合法原CORRECTION时严格校验其owner/account/kind/correction_for_id/-100/source/id/policy后复用，不能双冲回，不能再次改变账户缓存；无效既有纠正fail-closed。generic旧纠正可能先发生，因此GET在ACTIVE认定上也必须能如实显示reward_state=CORRECTED，不能继续宣称积分仍有效。revoke完成后REVOKED/原纠正链接永久保留。

旧fold继续处理消费后不足：撤销造成correction_deficit，不扣XP、不改Wish或兑换receipt。既有债务150时新合法100只能使债务50、available0，不制造可花余额。原账本append-only；不改原EARN/CORRECTION/receipt。

## 5. API、严格输入与安全回执

新增request-scoped、真实auth.getUser的私有路由：GET/POST `/api/artifacts/[id]/acceptance`，POST `/api/artifacts/[id]/acceptance/revoke`。不引入service-role runtime客户端、Demo fallback或用户传userId；不改原Artifact CRUD/routes/store/types协议。

认证先于params/query/body/业务查询。未登录401；foreign/missing作品或认定统一404，不泄露存在；可预期冲突409、输入400、未知内部故障安全500。所有自定义成功和失败均private/no-store JSON；Map或own-key错误映射防constructor/toString/__proto__继承状态码，不返回SQL细节、堆栈、原始异常、密钥或其他用户字段。动态params按当前已安装Next指南await。

GET不接受query；只读源和本人认定/原奖励及纠正，未认定明确NONE，不偷偷expire/repair/create。返回可用于下一次显式验收的源UUID、当前title/version/lifecycle/isArchived和原始updated_at字符串，及认定、EARN/CORRECTION provenance。日期精度保留数据库原始文本，不经JS Date往返后作并发比较。

accept POST JSON恰为 `{requestKey,expectedUpdatedAt,acceptanceNote}`；revoke恰为 `{requestKey,reason}`。不可有额外/继承键、getter、非plain对象、owner/amount/policy/status/class字段。requestKey按既有25空白trim后1..200 Unicode codepoints；UI用crypto UUID，但API允许此界内文本并对prototype样式key安全处理。说明/理由trim后1..2000 codepoints，拒绝NUL和不成对surrogate。expectedUpdatedAt为非空≤128 ASCII字符的合法带时区时间戳，原文本参与tuple并由SQL timestamptz与源updated_at精确比较，不只比较毫秒/字符串排序；过期409，要求重新读后由用户显式重新提交。这些上限是本切片资源限制，不是外部质量标准。

POST拒绝query，认证后检查application/json（允许UTF8 charset）、沿用已冻结16精确Host/Origin/Sec-Fetch-Site边界，流式最多16384 bytes并fatal UTF8解码，不先无界request.json/text。SQL侧也严格检查字段类型、长度、NULL与资格，不能只信TS校验。服务端amount/policy固定，body注入或数据库RPC自填数额均不可改变100。

raw DB/RPC回执必须严格验证必需字段、exact ACTIVE/REVOKED、认定类、owner/source UUID关系、100与策略、原奖励和纠正provenance；缺失/null/非法status绝不能默认ACTIVE。NONE只能由明确无认定构造；未知故障不能伪装NONE。replay receipt校验其历史字段自洽，但不能拿今天已变的源状态否认真实历史成功。GET当前状态与POST历史成功回放在UI分开显示。

## 6. UI与旧功能兼容

作品Inspector添加独立验收面板入口。原Inspector通过可选slot/props接入，默认无新增请求或副作用；页面父级持有按作品分离的请求key/原payload/结果，关闭再开面板、列表刷新或组件重挂载不能盲造新key。新GET仅在明确打开验收面板时读取，避免改变原CRUD mock请求顺序；不得为通过测试删旧断言或修改未准入旧fixture。

未认定明确「用户验收并领取100积分」及自验/非XP说明，展示当前标题/版本并要求验收说明；提交中禁重复，过期明确提示刷新重读，非active/archived不可首次提交。已认定展示当时版本、说明、时间、来源EARN与当前奖励/纠正状态；撤销需明确原因与确认。REVOKED无再次领奖按钮。未知结果保留原key/输入，仅核对GET或原请求重放；GET的NONE不能作为未知提交已失败的证明，重放先于新尝试。切换作品/关闭/登录身份变化时防迟到结果串位；完整刷新后通过只读GET恢复持久状态，不承诺把内存key持久到浏览器磁盘。

成功回执独立于列表/面板后续刷新，刷新失败不得抹掉成功并引导新key重发。旧创建/编辑/搜索/分页/链接/归档/删除错误反馈、键盘/Inspector focus与手机布局保留。MilestonesClient仅把「Artifact认定和奖励均暂缓」窄改为用户验收/100积分说明及作品库入口，不改旧Core/现实分类、按钮、RPC或状态权威。全部新按钮使用现有44px touch tokens，沿用md=48rem及现有动画/减弱动画规则，不改CSS/token/导航。

## 7. 治理闭包与历史保持

仅向tests/helpers/governance-delta.ts追加Artifact精确选择器/解析/校验，旧完整prefix、函数体、常量及旧失败行为不改。新策略先校验合同hash+all25+EXACT46，才允许历史投影；Git命令失败、异常revision/merge-base/parent、未预期working/PR路径、缺marker或混入旧生产入口均fail-closed，不把错误转空范围。

旧14治理文件只追加最前的新严格入口及必要新schema一表库存行/测试；原测试body/断言保留。旧自身scope单元测试仍按其原输入运行，新工作树分支先validate46，再调用旧accepted历史的原断言，不能过滤当前未知路径来“过旧门禁”。旧控制文档与七protected blobs、Phase8旧服务端/RPC/Milestone/账本/rules文件均原样。唯一新SQL为0056，旧0001..0055原bytes/prosrc冻结。

唯一旧业务测试例外为tests/phase8f-milestones-ui.test.tsx中恰一次 `expect(screen.getByText(/Artifact（作品与产物）的成就认定和奖励均暂缓/)).toBeTruthy();` 替换为 `expect(screen.getByText(/Artifact（作品与产物）支持用户手动验收，每件首次100愿望积分/)).toBeTruthy();`；不删除断言、不改测试名/fixture/mock/其它断言或行为。新governance必须独立检查旧行0次/新行1次，并逆替换后全文canonical精确还原accepted5168该文件；重复行、缺行或任何额外修改fail-closed。该例外只纠正用户新决定对应的UI政策断言，不能作为其它旧功能测试的免检通道。

PR60历史固定accepted229c→5168，原53范围及18合同/19兼容amendment/唯一旧fixture改动须重新通过旧validator，不能因本次范围与旧scope共享路径而从累计列表简单删掉46后冒称旧53完整。更早阶段同样按已接受固定range验证；cumulative范围为已验证历史集合与本次46的精确并集，不可见extra；内容变化仅能来自各阶段明确准入差异。current-main first-parent必须明确匹配5168；PR比较accepted5168...HEAD；工作树包含untracked。origin/main存在、合法revision与祖先关系不靠任意本地值猜测。

新governance tests独立覆盖：46/25唯一性与合同hash、每个missing marker、任意extra/旧scope混入、合同存在的missing-marker不fallback、working/fullPR/committed-main/cumulative、Git失败、旧选择器/旧assertions/protected blobs/固定历史与新版本内容精确边界及唯一UI断言逆向全文。治理测试不是业务或DB证据。

## 8. 验收、常量与执行边界

必须完成新8测试及所有受影响旧测试、真实PostgreSQL套件、完整pnpm test、pnpm harness:deterministic、typecheck/lint/build；不用skip掩盖缺DB。新HTTP测试基于完成构建并真实Next/Auth/DB；隔离合成栈使用明确project/workdir/ID/Created/ports和一次性数据，禁止对正式库造fixture。独占DB交接只在所有主客户端关闭后显式grant；独审永久释放后主方才可精确清理。

承重验收包括：

- 无验收零积分；本人active首次严格100，其他状态/foreign/anon/NULL/原始或列grant/伪旗标均拒绝；amount/policy/class注入无效，旧公共grant仍拒ARTIFACT。
- 同key replay与异tuple/跨旧RPC冲突、同作品不同key/并发只一EARN、过期updated_at（含微秒）、rename/version/archive/restore不能二领；REVOKED终态；accepted source硬删被挡。
- 一事务任一步失败全回滚；已有合法纠正复用/不再改cache；纠正provenance每字段错均fail-closed；消费后撤销的deficit及新100还债；所有原ledger/receipts只追加不篡改。
- populated本人/另一owner至少覆盖profiles/player_states/domains/skills/quests/activities/ai_assessments/evidence_records/mastery_verifications/xp_transactions/knowledge_nodes/knowledge_edges/artifacts及全部artifact links；accept/revoke除新认定、允许的奖励cache/ledger/外环audit之外零delta。原作品字段/版本/拓扑也零delta；固定XP500/level4不变。
- 严格DB回执missing/null/伪状态/错误source/prototype字段；未知网络、提交成功但刷新失败、切换/关闭/重挂载、foreign、过期页面、撤销后与已纠正状态的UI闭环；全部旧Artifact CRUD断言不弱化。
- 原8冻结金额按Season/Major/Epic/Main/Boss/M6/M8/M10顺序仍为150/100/150/200/200/100/150/250；0049唯一IMMUTABLE/STRICT reward-v1、0050规范语法和旧来源资格、0051/52认定类与谓词、0053手动技能零XP、0054 Evidence E0/false、0055事实修正审计与Confirm协议均原定义/结果不变。

独立Risk2负责全部承重及反例，不限“测试绿”；必须自行复现关键DB/HTTP、额外反例及最终exact hash绑定。候选GO后只提交46，再自身exact-head CI和不同fresh committed FINAL，满足用户代建/合并授权条件后才普通merge；未完成独审或发生新finding立即NO-GO并保留历史。

当前仅授权0055，绝不延伸为0056正式升级。0056仅在合成栈开发；新PR独审/合并后，另向用户申请0056，获准且新完整备份/恢复演练和独立迁移门禁通过后才可执行一次正式DDL。不能因为本合同引用编号就预先升级。正式升级/本机新预览/真实验收尚未完成时不得称Artifact可用或整站完成。

清理只限本轮精确owned合成栈、确认无运行依赖的临时缓存/中转文件；清理前声明目标并检查绝对路径/标签/ID，无global prune、未知进程kill、共享依赖或完整恢复备份删除。保留最小验收收据及必要恢复点，告知删除逻辑大小与可重建性，不虚称Windows磁盘/VHD已压缩。

## 9. 旧Dashboard治理入口纠正准入（V3历史，当前计数与实施以第11节V5为准）

主完整回归发现旧tests/phase5-dashboard-ui.test.tsx:673直接进入旧53 validator，当前Artifact范围被拒。仅新增此文件的最前import别名和新wrapper常量，将既有isProposalFactEditCheckout/assertProposalFactEditActualScope/proposalFactEditHistoricalFiles三个真实调用在Artifact工作树严格验证44/all25/hash后投影到固定accepted历史；原27测试名称、fixture、body、全部expect和超时值逐字canonical保持。旧自身模拟输入/原失败语义保持；不得重赋值旧helper函数或加入通用skip/ignore，禁止绕过旧53/原成长保护。新增governance须逆向移除仅新import/const并还原accepted5168旧全文，真实执行原27测试和完整回归；EXACT44、MARKERS25、旧governance入口13取代旧43/12。cumulative仍77：新增的Dashboard路径已经属于原53，重叠20，集合并集53+44-20=77，禁止简单把77加1。不新增业务权限或生产文件。先独立同Risk2 ADMISSION GO后才实施此增补，不把本草案作为候选GO、提交/正式0056授权。

## 10. Stage7C旧治理入口的committed拓扑纠正（V5沿用V4精确过渡）

PR61 ownCI38167679925的check job114553535206真实失败在tests/stage7c-ui.test.tsx:1365；原resolveGovernanceChangedFiles取得完整已提交44差集，STAGE7C_ARTIFACT_POLICY将两个新API及0056判为forbidden。主此前uncommitted全套4346虽过，旧resolver没有覆盖新untracked路径，因此该历史绿不能代committed FINAL；失败与旧44冻结manifest必须保留。

唯一新增文件准入为tests/stage7c-ui.test.tsx：只在最前追加新wrapper/import并将旧resolveGovernanceChangedFiles import别名；全部原29名称、fixture、body、expect、timeout、原evaluateScopedPolicy/STAGE7C_ARTIFACT_POLICY及syntheticMixedDelta拒绝断言全文canonical保持，逆向移除仅新wrapper/import并恢复alias后必须整份精确还原accepted5168。不得修改旧resolver/旧policy/helper完整accepted5168前缀，不重赋值旧函数，不删断言，不增加skip/CI bypass。

新增append-only artifactManualStage7CHistoricalDelta只在当前Artifact真实checkout由wrapper使用：先strict EXACT46/all25/本V5合同hash、实际working+untracked/cumulative/Git失败/远端祖先全部通过；提交范围按下面唯一过渡分支或通常完整46分支如实校验，再通过既有原validator验证真实固定accepted229c→5168完整53。返回明确标记mode/range/mergeBase为该固定已提交历史的GovernanceDelta及其53files，不能把53配上当前46的range或捏造空delta。当前46的生产权威由本合同strict门禁独立承担；旧29中的policy和synthetic断言继续对各自真实输入原样执行。带execute的原synthetic options或非Artifact checkout必须走原函数，不借新wrapper豁免。

仅为本次提交前纠正新增精确过渡：HEAD必须逐字为e0a9ff8c56fd9c80976b96c630d55a47dd331ead、HEAD tree必须6abcfdecb6834237a172c8ed3fb04ca234205e86、origin/main必须accepted5168；真实BASE...HEAD差集必须是原冻结44（当前46恰去tests/stage7c-ui.test.tsx与tests/assessment-context-api.test.ts），无缺/多/重复，已提交20必须canonical E68FB02441A0A288E17B63917709765516ACBBC663BA7D527B4DBBC372ECA923。精确SHA/tree已绑定全部44 Git blobs；此分支仍先验证当前working46/all25/新V5 hash及累计78，明确将已提交差集标记44，不伪称46，不把此NO-GO历史head变成合并许可。任何head/tree/remote/路径/旧合同异常均fail-closed；一旦HEAD有新的纠正提交，完整PR及明确main first-parent范围必须全部46，禁止HEAD~1或44退回。exported assertArtifactManualChangedScope仍要求通常完整46；过渡仅在assertArtifactManualActualScope的精确e0a条件内部单独验证，不能作为通用宽松bind。原accepted5168尚无Artifact提交时的旧未提交语义仅保持strict working46＋远端祖先，不把它当44过渡或committed证据。

新governance须验证原Stage7C整份逆向恢复、29测试数量/全部旧assertions、当前46严格先于历史投影、truthful固定53range+mergeBase、历史仍经原validator、missing25/extra/旧scope混入/非法Git拒绝；并覆盖真实当前e0a9ff8c上working46＋冻结committed44的精确过渡和每个错误head/tree/remote/44路径/旧20内容，未来多commit PR5168...HEAD及合并后明确first-parent5168的main拓扑必须完整46。old53与current46实测重叠21，集合并集78；新增Stage7C不在old53，但旧API已在old53，不能误计79或沿用V3的77。

全PR仍accepted5168为base，本轮corrective parent为受拒e0a9ff8c；原44与旧NO-GO/主4346/Chrome31/buildRze证据不覆盖新治理字节。生产13不改则原completed build及UI业务证据可经逐项同源绑定保留，不编造新build/browser执行；治理/原Stage7C29/完整回归及own exact-new-head CI必须实际重跑，通过同Risk2纠正候选、不同fresh committed FINAL/新栈清理后才普通merge。正式0056仍另批、重新完整备份恢复独审，不扩大用户业务范围。

## 11. 旧API随机fixture纠正（V5现行）

V4主corrective-full-v1真实151files4347passed/2failed/0skip/0unhandled，child1，raw CFC331672B0A6CDF5509E308B1C0AE1CC0648D3A6F77E432CCA53049874FEEA8。Stage7C29、新110与全部新业务DB/HTTP均过；第一旧失败assessment-context-api:36合法随机activityUUID bc2977b7-76fe-40da-8f6f-a4943ab99969使原not.toMatch(/Foreign|forged|999/)误判；另一旧context-governance:126是原显式30000ms超时。完整失败不得冒绿，V4原03A26准入/独立166与261反例保留历史，不是当前V5候选GO。

唯一旧API改动是fixture()返回值中的恰一处 activityId:randomUUID() 替为 activityId:"11111111-1111-4111-8111-111111111111"。这是合法UUID v4/variant8的测试标识，不是业务ID或外部常量；其中不可能含999。所有原test名称/body/expect、负例随机不同ID、mock、原PR60 hasProposalFactEdit模拟接口以及其他字符均canonical逐字不变；不改变或删去/Foreign|forged|999/原断言，不过滤输出、不mock crypto、不重跑随机ID到合格、不修改生产校验。新增current门必须在历史投影前验证这一唯一fixture逆替换整份等于accepted5168；缺失、重复、改其他fixture/mock/断言任何额外字节均fail-closed。新governance独立覆盖其整份inverse与篡改负例，并实际运行旧API全部测试。

V5现行EXACT46/MARKERS25，production13/newtests8/docs9/oldgovernance14/oldUI一行1/oldAPI一处fixture1；旧53重叠21，累计并集仍78。前文V4的第45文件与旧44是历史计数；现行working/通常fullPR/main/binder以46为准。精确e0a rejected44过渡不扩大：当前46恰去Stage7C与该API才得到原冻结44，必须仍绑定原HEAD/tree/origin5168/E68；新HEAD绝不容44/45fallback。原accepted5168未提交语义只strict working46+remote ancestry。

旧context-governance原30秒和全部原断言/body不改；可在ignored调度层使用真实installed Windows Git直接读取同一actual candidate Windows路径，替代WSL Linux Git穿过9P的实际读，必须保持只读子命令及参数组合白名单，拒绝diff/show/log的--output及未知/可写参数；真实HEAD/tree/remote/文件内容/全部Git错误fail-closed，先独立逐字节对照代表命令，并记录新wrapper哈希。不是调度层Git输出缓存/模拟、镜像refs、timeout放宽、skip或CI绕过。main只可更新candidate index的stat时间缓存且前后所有index blobs、全部candidate raw、HEAD及staged-empty精确相同，reviewers不得更新index。若真实性能不足不得冒称通过或擅改旧timeout，须另查因。

新append-only Artifact实际scope校验允许一次调用内复用已经验证的本次HEAD/remote及准入输入，减少重复同一校验；不改accepted5168旧helper前缀，不跨调用缓存，不缓存/模拟Git命令输出。每次assertActual必须真实读取当前合同/UI/API fixture并验证原整份inverse，真实HEAD/base ancestry、working+untracked exact46、remote ancestry、e0a exact tree+committed44+E68或新HEAD full46完整拓扑，所有必要Git查询异常拒绝；结束必须再次真实核对HEAD/remote与开头相同、当前合同/UI/API原文与开头逐字一致，否则fail-closed。public working/changed/binder仍自行验证准入及真实Git，不可接受调用者伪造proof。可将新函数内部重复解析拆为private接受本调用验证值的函数，仅在同一同步调用内复用；绝不让caller通过options逃过验证。新governance须覆盖中途HEAD/remote/合同/UI/API漂移及各Git失败、普通binder拒44/45，独审复核这些同级反例；这不是旧validator跳过或持久缓存。原Stage7C历史函数仍先current strict46+cumulative78再原53 validator，不因性能删承重。

先同Risk2 V5 ADMISSION GO后才改candidate20/helper/newgov/唯一APIfixture；原V4候选数据和失败历史保留。然后定向原API+oldguard+Stage7C/Dashboard/新governance、类型lint/原Growth11/真实完整套件、同Risk2候选冻结、新exactheadCI与不同freshFINAL/新owned栈清理；未通过不交付。357生产源/SQL/build/主Chrome业务同源证据可透明重绑定，不伪称新build/browser或第二独审DB；正式0056仍另批。

## 12. 旧事实修正历史模型与当前唯一UUID的分离（V6纠正准入草案）

本节在得到同Risk2独立ADMISSION GO前仅是外部草案，不授权修改candidate。准入后本合同以V6全文hash为当前唯一控制hash，V5第11节及其准入451AA770...C27E与main/own346保留历史。EXACT46/MARKERS25、old53交21/cumulative78、production13与357源及0056正式另批边界全部不变；不增加路径，不删改旧18/19、不改accepted5168 helper完整前缀、旧55SQL或业务逻辑。

### 12.1 失败与证据边界

主corrective-full-v2/session99191已观察tests/proposal-edit-governance.test.ts的116中3失败：amendment fixture全文、synthetic PR/main、history group。完整套件仍须取得真实终态并保留原raw/terminal，不把本草案或前346当全绿。Poincare只读核对当前旧API仅逆向V5固定UUID后等于5168，再经原PR60 validator移除两处mock增补后等于229c；只移mock不等，故原synthetic默认读current会在fixture检查处提前失败。部分Git/control/path负例因此虽绿却未到真正注入点，不能当该项防护已证明。本节必须补调用轨迹证明，保留该P2历史。

### 12.2 最小旧测试改动与全文保护

只允许在已列46内tests/proposal-edit-governance.test.ts顶部新增专用helper import/const适配，恰一处将原function model定义名改为artifactManualPrevious_model，原函数body逐字不改；原verifyProposalFactEditFixture导入alias恰一处由verifyFixture改成artifactManualPrevious_verifyFixture，然后由专用适配定义原局部名verifyFixture。所有116个原测试名称/body/expect/negative、原model内部execute/calls/readControl、extras及原全局git函数均canonical逐字不变。逆向删除新增顶部块并逆转这两个唯一标识改名，整份文件必须精确等于accepted5168加原已准入Artifact入口适配的逆向保护基线；进一步逆转既有Artifact入口后整份等于真实accepted5168。缺失、重复或任何额外变化拒绝。不能改测试body来过滤错误、让断言忽略固定UUID或删原fixture保护。

### 12.3 明确的历史synthetic fixture，不是当前scope proof

只在新append-only helper追加专用model wrapper。每次调用先执行原model得到原对象，其execute必须真实存在为function，否则拒绝把该模型包装成真实入口。保持原execute函数、calls数组、readControl及其他属性原identity；只有原模型未显式提供readFixture时补默认provider。默认provider每次用独立真实Git读取固定accepted5168的该API文件，并调用原verifyProposalFactEditFixture针对独立真实229c blob验证PR60两mock的整份唯一逆向，然后返回该真实5168 fixture。不得使用synthetic execute代替这两次真实Git、截获Git输出、从当前文件删片段伪造历史blob、缓存内容或refs、吞掉读取/validator错误。

这是旧53历史模型的数据，不是当前46 proof；不能拿这份数据给当前checkout、未来commit、真实请求或0056授权。原model被调用后由调用者后置显式覆盖的readFixture必须优先，错误/异常必须原样到达原validator；wrapper不能再次覆盖它。若原model已经显式含readFixture，保留该属性而非用历史默认替代（包括无效provider按原严格行为拒绝）。原synthetic execute/readControl/readAmendment/路径/HEAD/remote/first-parent/delta/Git负例继续由原函数真实运行。

通用artifactManualLegacyProjection的execute/synthetic分流全文保持，不改为“synthetic也走current projection”。actual(model(...))、working/changed/bind(model(...))以及六个现有旧入口只证明各自明确旧53模型。无execute的actual()与每个真实历史projection入口仍自行先strict真实当前46/all25/V6 hash/working+untracked/ancestry/唯一e0a44或新HEAD46/结束漂移检查，再经原固定53 validator，不得借别的测试曾通过或model构造替代真实入口自己的门禁。

### 12.4 直接fixture validator专用适配

新append-only专用适配保留原previous validator及current/accepted参数。非Artifact checkout原样调用previous；在当前Artifact checkout，只有current包含V5唯一合法固定activityUUID表达式时，才独立真实Git读取5168 fixture，先用V5严格整份inverse验证current除该唯一表达式外等于5168，再逆转这一表达式并调用previous(normalizedCurrent, originalAccepted)。原accepted参数绝不替换；不得容许调用者伪造accepted、改mock/assert、增加空行或重复固定表达式。其他输入不做宽松归一化，继续由原previous validator严格处理。这个纯fixture数据适配不返回范围proof，也不取得当前scope授权；真实scope入口另有12.3逐次严格门禁，不跨调用缓存current proof。

### 12.5 新增承重与重新验收

新governance必须实际验证：两个唯一rename及旧文件全文逆向、116原测试全部body/expect不变、旧helper完整prefix与55SQL保持；两阶段fixture inverse、固定UUID/改mock/assert/重复/空行/错误accepted/非Artifact和显式readFixture覆盖/读取异常/原provider identity反例。使用原synthetic execute/calls与受控readControl/readAmendment/readFixture注入，先证明正例到达目标Git/拓扑/group检查，再证明每个注入点确实执行且失败，禁止以早先fixture错误充当目标拒绝证据；原PR/current-main/forged delta/history group/path/全部Git失败仍严格。

另对每个真实入口验证缺46/marker/hash/伪造caller proof/中途漂移拒绝，历史model不能买当前豁免。保持原30秒及全部旧timeout，不跨调用缓存、不skip、不mock当前Git、不中断正式数据边界。先同Risk2 V6 ADMISSION GO，再仅20/helper/newgov/该已列旧gov顶部与唯一rename实施；定向至少覆盖原116、新gov、原API21/oldcontextgov157/Stage7C29/Dashboard27，随后type/lint/Growth11/真实完整151套件及同级候选复审。生产357完全同源则buildRze/主Chrome31/旧独立171只作透明同源历史，不伪称新执行。全套终态、精确owned清理、46冻结、新commit/own exactheadCI/不同freshFINAL/ordinary merge/postCI后，正式0056仍必须另获用户批准并重新完整备份恢复独审。

# 20 — Artifact 用户手动验收与首次100愿望积分

状态：待 fresh Risk2 ADMISSION。本文件仅锁定后续实现准入；不是实现验收、候选GO、committed FINAL、合并、正式0056升级或整站完成授权。

## 1. 已确认决定及窄政策修订

用户明确选择「手动验收＋每件首次100积分」。积分是现有愿望积分，不是XP、现金、Mastery或Evidence等级。由本人明确声明作品符合自己的交付要求，再由服务端确定性结算100；AI不判合格、不决定数额、不直接写入账本或永久成长。

这窄修订02/03/06中Artifact认定与奖励延期的现行约束：新增独立 `USER_CONFIRMED_ARTIFACT` /「用户验收」权威路径，绝不冒称 `CORE_VERIFIED`、第三方验证、已验证Evidence或高阶Mastery资格。现实成就仍只记录、零积分；既有Quest/Season/Mastery的reward-v1及旧来源谓词不变。01 > 02 > 03 > 04–10 > 实现。

本地使用，公网部署、PWA、附件上传、远程URL抓取、自动运行作品、AI质量评分、相似度去重、高级Verifier与外部集成不在本次范围。「每件」以现有稳定Artifact UUID为身份：改名、改版本、改链接、归档/恢复、换request key或策略版本均不再奖励。创建不同UUID的实质重复内容不能声称已自动识别；保留旧建档去重，不新增AI或内容比对权威。

## 2. 基线、EXACT44与MARKERS25

accepted base `5168bc4805444ecd1d62490d99f55d3c9e17a58b`，tree `1043f1180b7e1a0b0d21c48784d1ae40069ec373`，PR60已合并。隔离checkout `.data/site-artifact-manual`，branch `codex/site-artifact-manual-20261012`。正式数据库/API、现站与已构建0055预览、PR60冻结53、SQL0001..0055、root用户修改、密钥、完整备份和共享依赖均不动。

最终 working tracked+untracked、完整PR、明确识别的current-main first-parent差集必须且只能是下列44个唯一文件。旧文件限本合同规定的窄接入或追加，不借allowlist重构。

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
```

其中production13 = 新模块6、新面板1、新路由2、现页/Inspector/Milestones3、唯一SQL0056；新测试8；文档/计划9；旧治理13；旧UI测试的一行文案断言1。MARKERS25 = 本合同、02/03/06、production13、新测试8。全25齐备、EXACT44全等、合同canonical SHA256（UTF8，仅CRLF→LF）一致后，才可作任何旧范围/历史内容投影。合同出现但标记缺失不得回落到18/16/13/11/09等旧选择器。

原V2 EXACT43已准入并实施，其字节与独审/主执行历史保留；本轮先独立审查V3增补草案，fresh Risk2 ADMISSION GO后才可将20升级为本EXACT44版本并新增第44文件的窄接入。原EXACT42因漏掉旧UI文案断言获独立P2/NO-GO，旧快照与裁决保留。合同重新准入后冻结；范围或规则变更须同档重新准入，不用21证据文档暗改合同。21只记录真实结果与历史失败，执行者不自签独立GO。

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

仅向tests/helpers/governance-delta.ts追加Artifact精确选择器/解析/校验，旧完整prefix、函数体、常量及旧失败行为不改。新策略先校验合同hash+all25+EXACT44，才允许历史投影；Git命令失败、异常revision/merge-base/parent、未预期working/PR路径、缺marker或混入旧生产入口均fail-closed，不把错误转空范围。

旧13治理文件只追加最前的新严格入口及必要新schema一表库存行/测试；原测试body/断言保留。旧自身scope单元测试仍按其原输入运行，新工作树分支先validate44，再调用旧accepted历史的原断言，不能过滤当前未知路径来“过旧门禁”。旧控制文档与七protected blobs、Phase8旧服务端/RPC/Milestone/账本/rules文件均原样。唯一新SQL为0056，旧0001..0055原bytes/prosrc冻结。

唯一旧业务测试例外为tests/phase8f-milestones-ui.test.tsx中恰一次 `expect(screen.getByText(/Artifact（作品与产物）的成就认定和奖励均暂缓/)).toBeTruthy();` 替换为 `expect(screen.getByText(/Artifact（作品与产物）支持用户手动验收，每件首次100愿望积分/)).toBeTruthy();`；不删除断言、不改测试名/fixture/mock/其它断言或行为。新governance必须独立检查旧行0次/新行1次，并逆替换后全文canonical精确还原accepted5168该文件；重复行、缺行或任何额外修改fail-closed。该例外只纠正用户新决定对应的UI政策断言，不能作为其它旧功能测试的免检通道。

PR60历史固定accepted229c→5168，原53范围及18合同/19兼容amendment/唯一旧fixture改动须重新通过旧validator，不能因本次范围与旧scope共享路径而从累计列表简单删掉44后冒称旧53完整。更早阶段同样按已接受固定range验证；cumulative范围为已验证历史集合与本次44的精确并集，不可见extra；内容变化仅能来自各阶段明确准入差异。current-main first-parent必须明确匹配5168；PR比较accepted5168...HEAD；工作树包含untracked。origin/main存在、合法revision与祖先关系不靠任意本地值猜测。

新governance tests独立覆盖：44/25唯一性与合同hash、每个missing marker、任意extra/旧scope混入、合同存在的missing-marker不fallback、working/fullPR/committed-main/cumulative、Git失败、旧选择器/旧assertions/protected blobs/固定历史与新版本内容精确边界及唯一UI断言逆向全文。治理测试不是业务或DB证据。

## 8. 验收、常量与执行边界

必须完成新8测试及所有受影响旧测试、真实PostgreSQL套件、完整pnpm test、pnpm harness:deterministic、typecheck/lint/build；不用skip掩盖缺DB。新HTTP测试基于完成构建并真实Next/Auth/DB；隔离合成栈使用明确project/workdir/ID/Created/ports和一次性数据，禁止对正式库造fixture。独占DB交接只在所有主客户端关闭后显式grant；独审永久释放后主方才可精确清理。

承重验收包括：

- 无验收零积分；本人active首次严格100，其他状态/foreign/anon/NULL/原始或列grant/伪旗标均拒绝；amount/policy/class注入无效，旧公共grant仍拒ARTIFACT。
- 同key replay与异tuple/跨旧RPC冲突、同作品不同key/并发只一EARN、过期updated_at（含微秒）、rename/version/archive/restore不能二领；REVOKED终态；accepted source硬删被挡。
- 一事务任一步失败全回滚；已有合法纠正复用/不再改cache；纠正provenance每字段错均fail-closed；消费后撤销的deficit及新100还债；所有原ledger/receipts只追加不篡改。
- populated本人/另一owner至少覆盖profiles/player_states/domains/skills/quests/activities/ai_assessments/evidence_records/mastery_verifications/xp_transactions/knowledge_nodes/knowledge_edges/artifacts及全部artifact links；accept/revoke除新认定、允许的奖励cache/ledger/外环audit之外零delta。原作品字段/版本/拓扑也零delta；固定XP500/level4不变。
- 严格DB回执missing/null/伪状态/错误source/prototype字段；未知网络、提交成功但刷新失败、切换/关闭/重挂载、foreign、过期页面、撤销后与已纠正状态的UI闭环；全部旧Artifact CRUD断言不弱化。
- 原8冻结金额按Season/Major/Epic/Main/Boss/M6/M8/M10顺序仍为150/100/150/200/200/100/150/250；0049唯一IMMUTABLE/STRICT reward-v1、0050规范语法和旧来源资格、0051/52认定类与谓词、0053手动技能零XP、0054 Evidence E0/false、0055事实修正审计与Confirm协议均原定义/结果不变。

独立Risk2负责全部承重及反例，不限“测试绿”；必须自行复现关键DB/HTTP、额外反例及最终exact hash绑定。候选GO后只提交44，再自身exact-head CI和不同fresh committed FINAL，满足用户代建/合并授权条件后才普通merge；未完成独审或发生新finding立即NO-GO并保留历史。

当前仅授权0055，绝不延伸为0056正式升级。0056仅在合成栈开发；新PR独审/合并后，另向用户申请0056，获准且新完整备份/恢复演练和独立迁移门禁通过后才可执行一次正式DDL。不能因为本合同引用编号就预先升级。正式升级/本机新预览/真实验收尚未完成时不得称Artifact可用或整站完成。

清理只限本轮精确owned合成栈、确认无运行依赖的临时缓存/中转文件；清理前声明目标并检查绝对路径/标签/ID，无global prune、未知进程kill、共享依赖或完整恢复备份删除。保留最小验收收据及必要恢复点，告知删除逻辑大小与可重建性，不虚称Windows磁盘/VHD已压缩。

## 9. 旧Dashboard治理入口纠正准入（V3规则，是否已准入以独立回执为准）

主完整回归发现旧tests/phase5-dashboard-ui.test.tsx:673直接进入旧53 validator，当前Artifact范围被拒。仅新增此文件的最前import别名和新wrapper常量，将既有isProposalFactEditCheckout/assertProposalFactEditActualScope/proposalFactEditHistoricalFiles三个真实调用在Artifact工作树严格验证44/all25/hash后投影到固定accepted历史；原27测试名称、fixture、body、全部expect和超时值逐字canonical保持。旧自身模拟输入/原失败语义保持；不得重赋值旧helper函数或加入通用skip/ignore，禁止绕过旧53/原成长保护。新增governance须逆向移除仅新import/const并还原accepted5168旧全文，真实执行原27测试和完整回归；EXACT44、MARKERS25、旧governance入口13取代旧43/12。cumulative仍77：新增的Dashboard路径已经属于原53，重叠20，集合并集53+44-20=77，禁止简单把77加1。不新增业务权限或生产文件。先独立同Risk2 ADMISSION GO后才实施此增补，不把本草案作为候选GO、提交/正式0056授权。

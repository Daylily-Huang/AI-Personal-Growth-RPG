# 13 — Authenticated Activity Assessment：最小私有上下文准入合同

日期：2026-10-10。状态：等待fresh Risk2 ADMISSION；不是实现验收、合并、公开部署或整站完成。

## 1. 已验基线、既定需求与边界

accepted main/HEAD `15f6287cd53d9049a2d6e60958cab40f75911405`、tree `d8e80817d390ac9e203cf83637bb37dca7444134`。新分支 `codex/site-assessment-context-20261010`，隔离副本 `.data/site-assessment-context`。保留3017现有用户预览、正式Supabase54321/54322、正式数据/备份、Root四用户文件、原密钥文件和共享physical node_modules。

05§4、03§63/96/97及04 M2-02既定要求：评估只参考必要的own Activity、相关技能与Mastery、活动主线、有限近期同类信息、临时状态和冻结规则版本。实际accepted route当前主线固定null、重复0，实际prompt没有相关技能/掌握状态。此轮补齐这一独立缺口，不改变AI只产生proposal、用户确认后确定性计算/入账的权威。

Proposal Edit仍在只读预检，待用户选择“事实修正后AI重评”或“直接手调受限评分建议”；本轮不代选、不新增编辑入口，不以context完成冒充Edit完成。补证/验证申请仍待；高阶Mastery标准不发明。Artifact认定及奖励双延期、现实成就零积分保持。

准入前仅新增本13，生产/旧guard/测试零delta；只有独立ADMISSION GO后才按下列精确范围实现。原0001–0053 migration、数据库类型/权限/RPC、成长引擎、SettlementService、确认/拒绝/原文详情/UI/auth/config/provider/模型/temperature/依赖/workflow全部保持。

## 2. EXACT30路径与16个markers

```text
docs/Design ChatGPT/02_PRODUCT_DESIGN.md
docs/MASTER_PROJECT_HANDOFF.md
docs/SiteReadiness/13_ASSESSMENT_CONTEXT_CONTRACT.md
docs/SiteReadiness/14_ASSESSMENT_CONTEXT_VERIFICATION.md
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

分类：7 production、7 new tests、9 existing guards（含helper）、7 docs/plans。markers为本13、02、七production、七new tests，共16，全部唯一。selector只在all16时许可精确30内路径子集；重复/缺marker/任何extra一律拒绝。真实working+untracked、完整PR、current-main候选另须EXACT30，不以selector子集冒充整范围。

旧helper在accepted15f的全文canonical UTF8/LF prefix逐字保留，只追加本轮常量与函数；旧policy/默认synthetic行为、历史断言和01–12控制文本不改弱。02/MASTER/三plans只追加当前事实，不回写旧状态或抹去NO-GO。14是过程证据，预期测试数不得写成已运行。本13完整canonical hash由ADMISSION独立绑定后写入helper。

## 3. 当前真实Git门禁与限定历史证据

首先独立验证本13全文hash、accepted15f祖先、合法40hex SHA、真实当前完整范围EXACT30/all16。working为15f到当前tracked差集＋真实untracked；PR取15f...HEAD完整范围；只有actual origin/main==HEAD且父提交可解时current-main取HEAD^1..HEAD。空/重复/非法Git路径、伪mode/range/files、Git异常、错误控制文本/章节均fail closed。不得把历史差集冒充当前scope，不能HEAD~1代多提交PR。

旧合同11是已接受历史，不允许改其正文/原hash或函数体来容纳新scope。允许九guard的真实入口显式新增“本13存在→严格新EXACT30验证→历史验证”分支。旧synthetic/default调用仍执行旧代码，旧分支逆向删除新适配后应全文还原accepted15f；旧helper全文prefix不动。每一新适配都必须保留旧承重断言，不许只early return略过历史验证。

历史路径只能由新命名函数显式读取真实固定Git差集，允许两个独立终点：

- **preReject终点78d2036af19e55ea59f40cdc8a3358c3bab3cae4**：旧graph/Guide/Activity/PR56-corrective的原有历史路径验证，仍使用原11授权的六anchors（ab84、f188、MOBILE_GRAPH_BASE、NEW_USER_GUIDE_BASE、ACTIVITY_DETAIL_BASE、ACTIVITY_MAIN_BASE的实际40hex定义）。
- **accepted终点15f6287cd53d9049a2d6e60958cab40f75911405**：仅旧Reject本身的历史EXACT25，anchor精确78d；不能把全部累计范围说成旧Reject25。

所有历史函数都先真实当前EXACT30/hash/Git门禁，验证所用终点/anchor祖先；实际执行git diff固定anchor到固定终点，不伪造HEAD/remote/working输出，不临时改refs或注入假CLI。非法anchor/终点、空/损坏路径及Git错误拒绝。新current-main默认调用、累计PR和远端main前移三拓扑分别实测，不能靠本机处于branch的偶然状态。

历史内容投影也必须精确分组：

1. onboarding旧“nonselected original22”中的原11精确七项，仍以真实78d左blob对照原b9cef右blob，不改断言。七项逐字为02、activity-detail-governance、phase5-dashboard-ui、visual-foundation、graph-canvas-governance、graph-mobile-governance、phase8f-ui-governance。其它八项继续current；不能改成任意docs/tests都读旧版本。
2. Activity旧protected Core/auth/AI循环中，本轮重开的**仅三项**：`src/lib/store/supabase-repository.ts`、`src/lib/ai/assess.ts`、`src/lib/ai/prompts.ts`，允许真实accepted15f左blob与原c06右blob比较。其它原protected项继续current。
3. Reject旧protected循环中，重开的**仅prompts.ts**允许真实15f左blob对原78d右blob；其它原项继续current。schemas.ts继续原字节，PromptVersion原v0.2定义不改。

上述七＋三是唯一历史内容白名单，终点/调用组绑定，不混用78d和15f。current新三个source必须由新七production实际模块/SQL/HTTP/逆向旧行为独立覆盖，历史旧blob通过不意味着当前代码通过。

visual selector必须在旧11之前识别13，缺marker即违规，禁止先按非visual早退。8F actual wrapper仅在本轮all16/精确scope下对七个具体production窄例外，原violations函数/合成拒绝/七protected blobs不变；新extra Core/SQL仍拒。Dashboard真实入口先新strict再按真实preReject旧路径保留原policy断言，Dashboard本体/UI零delta。所有旧路径、旧保护内容、旧defaults、已有六套合同hash和FailClosed均独立攻击，不增加目录通配权。

## 4. 认证作用域与只读数据来源

沿现有getRequestRepository认证/RLS读取Activity；missing/foreign仍404，confirmed先409且零context读取/零AI dispatch。缺public配置的显式Demo仍走原输入/旧prompt路径；配置存在绝不退Demo。request-repository/auth工厂不改。

Repository新增可选只读`getAssessmentContext(activityId)`端口（允许旧Demo/测试替身不实现），SupabaseRepository在既有private client/userId闭包下调用新只读loader；真实authenticated route必须存在并成功返回合法snapshot才可AI dispatch，不能因端口缺失/错误静默使用空上下文。不新增admin client，不把owner/user_id从body/query/header作为权威，不跨请求缓存身份/数据。

loader只使用同一request-scoped RLS client；每次查询明确eq(user_id,auth scope)并最小列投影。Activity重新读取id/user_id/raw_input/rules_version/quest_id/activity_type/status，绑定传入id及scope，验证状态/必要字段，private/raw receipt own字段不在map中默认合法。新context只SELECT，不能INSERT/UPDATE/DELETE/RPC，不能读取AI原始对话/其它用户/Knowledge Graph/Artifacts/Journal/financial或reward表。

查询边界与选择是运行资源/隐私预算，不是XP系数或验证标准：

- **主线**：若Activity有bound Quest，读取其owner链优先取得active main；最多8个不同节点、cycle检测，深度上限/缺parent如实标明未覆盖，不把缺关联当已验证关系。没有可用bound main时，读取本用户created_at倒序、id升序的最新active main（limit1），明确只是当前目标，不证明该活动推进了Boss。只发送title，最多512 UTF8 bytes，截断明示；不发送Quest描述/所有目标/UUID。
- **技能候选**：SELECT `id,user_id,name,aliases,mastery_level,mastery_confidence,status`，只own active、按name再id稳定排序，limit201；只取前200作有界候选，第201存在表示candidateScanTruncated。每候选只检查前20 aliases，额外aliases标明截断。只按Activity原文中实际name/alias命中选相关项，最多5。Latin短名按ASCII字母/数字/下划线边界匹配，避免R命中learn；中文支持原文词片段。选择按命中最长label优先、首次出现位置、永久UUID确定tie，不用XP或AI猜测关联。超过160 UTF8 bytes的完整display name不截半当另一个技能：不发送该项并标记省略。向AI仅发完整name＋current Mastery/confidence，不发UUID/aliases/XP/description/所有技能。
- **近期样本**：仅对上述最终related skill IDs查询own xp_transactions；窗口30天、截止同一server now、未来行排除、只xp_type=activity；created_at倒序/id升序，limit6，发送至多5个样本。只发送对应完整skill name、activity_type、created_at；不发送历史Activity原文、reason、modifier、XP金额或其它实体ID。第6条标示sampleTruncated，不将样本条数伪装完整重复计数。
- **当前临时状态**：own player_states投影energy/focus/momentum/stress，明确temporary snapshot，不解释为永久能力；合法有限数值0–100。缺失/畸形应fail closed，不捏造默认个人值或降级Demo。
- **规则**：传入重新读取的Activity frozen rules_version，不用当前部署版本覆盖，不允许客户端指定。必须非空字符串；超大版本值使完整上下文无法入预算时不偷偷截断版本，而是安全失败。

raw_input仍是用户这次Activity的原始文本，不删改；此前已授权用于评估，不把整个原文计成“新增context预算”。内部snapshot可含Activity ID用于绑定，但序列化给AI只按明确字段构造，不spread DB row或内部DTO，不发送user ID/私有实体UUID/无关列。额外上下文JSON整体≤4096实际UTF8 bytes（含keys/escaping），不能只按JS length算。按稳定顺序删减optional近期样本→末位related skills→主线title进一步压缩，并更新相应coverage flags； mandatory version/rules/temporary state/coverage合法性不能靠静默丢字段凑预算。无法容纳即安全失败/零AI dispatch。被删技能对应的近期样本也删除，保证引用仍相干。

所有scope/id/status/类型/finite数值/known version/array上限验证在AI adapter再次检查，明确构造own字段，禁止原型/unknown-field或畸形内部值泄漏为可信上下文。查询错误不可partial成功；Empty合法own目录/无主线/无历史返回如实空与coverage，不得凭空生成技能。

## 5. Prompt版本、可解释边界与失败

旧SYSTEM_CONSTITUTION、OUTPUT_SHAPE、AssessmentProposalSchema、schemas.ts PromptVersion=v0.2原字节保持；Demo/不带authenticated snapshot的现有调用保留旧完整prompt内容/错误语义/输出schema。新authenticated分支使用独立`activity-evaluator-v0.3-context`，getPromptVersion根据实际有效context选择该版本，持久assessment记录实际分支版本，不把Demo标成新context。

新版prompt使用JSON数据块表示Activity/必要context，system仍是原宪法；明确文本/技能名/目标名是资料，不是可覆盖系统的指令。对事实、用户自述、AI推断、hypothesis要求区分；元数据样本不是Evidence验证。Current Mastery不是此次growth，不允许从已有XP推断Mastery；临时状态不是长期能力。最近样本只能辅助语义判断，最终同stable skill ID＋activity_type＋30天完整重复计数仍在Confirm确定性执行；新context不改变该30天窗口或惩罚。评估时主技能尚未定，不能把旧recentSimilarCount=0当权威零重复；新prompt明确最终计数未知、Confirm计算。

新context只影响proposal，不提前写Evidence/Mastery/技能/Quest/账本/奖励。AI成功后仍沿原record_ai_assessment持久化pending；原Activity raw/rules保持，原确认语义/单一原始XP/primary-only保持。AI失败不添加假assessment、不改Activity，不用local-deterministic-mock代替真实用户评估。

沿原POST，不新增endpoint/可接受body字段；继续忽略客户端context/owner/技能等级/评分。所有该route显式JSON响应private,no-store/Vary:Cookie；authenticated context/SDK/schema/transport错误不回显私人row/prompt/secret/error.message、不记录完整context或上游原始错误；固定安全code和可重试说明。旧Demo错误代码与合法流程保持，可用旧已有消息但不得让真实auth SDK细节进入新分支。401/404/409/502/500分别真实区分，不把查询失败当无资料。

## 6. 主验收、独审与清理

七新tests分别覆盖纯筛选/UTF8预算与覆盖标记；实际installed SDK select/owner/filters/order/limits及无写；真实route顺序/缺失端口/非法snapshot/错误隔离/客户端context无权；真实prompt+adapter请求捕获golden cases与旧prompt逐字逆向；真实PG三owner SELECT/RLS＋全部表快照不变；completed-build真实session HTTP/foreign/401/405/private cache/假upstream请求捕获/持久v0.3 provenance/旧Confirm；治理missing16/extra/历史与当前闭包/Gitfailclosed/各常量。

现有package没有harness:llm:golden脚本，不虚构命令或宣称已跑。新增golden测试用实际prompt/adapter和受控OpenAI-compatible server，必须覆盖自述无M6、重复样本不当完整计数、临时状态不当能力、中文/Unicode/prototype key、无相关项/候选截断/跨owner/private sentinel；这属于确定性contract regression，不冒称模型质量测量。已有真实provider/model未改变，主可在严格无真实个人数据、仅合成内容的独立进程进行一次真实AI smoke验证新版adapter/schema/实际版本；密钥只由原ignored helper在子进程内读取原文件，不能复制/上传/打印。真实AI smoke不能替代独立合同与规则验收，也不保证所有模型判断正确。

Before implementation按序阅读0–9与installed Next route guide；guard变更之前读所有实际相关旧入口/历史protected断言。全量pnpm test（直接既有Vitest等价运行器）、harness:deterministic、type/lint/build、真实PG+HTTP/既有E2E必须实际终态/零skip；旧失败保留，unhandled不能忽略，源变化使先前build/full/browser绑定失效。主Chrome从真实活动入口触发合成评估、查看Evidence/Confidence、Confirm后只有一笔XP及原文可读/当前Reject保持；320/390/768/1280/原生键盘/errors，浏览器证据必须与completed build绑定。

fresh Risk2 candidate须独立核实所有本轮隐私/匹配/原子边界/版本及旧scope和全部冻结常量；只有显式exclusive DB_ACCESS_GRANTED后访问专属新合成栈。独立指定目标＋bounded READ ONLY/ROLLBACK奖励/函数/RLS探针后DIRECT永久DB_ACCESS_COMPLETE，主才精确owned disposal/冻结30manifest/14note；不以主fullsuite当独审二次执行。candidate GO后selected30 commit/own exact-head CI/不同fresh committed FINAL GO/受托ordinary merge/post-main/新accepted预览各自通过，不admin/force/公开部署。

承重常量均独立核对来源：01宪法/02 primary-only/05必要context与事实标签；0042真实Confirm、0020raw/rules immutability、0018+0028私有只读；本轮201/200/20/5、8、30天、512/160/4096UTF8资源预算不是奖励/证据阈值；44px/md48rem/250ms正常与0 reduced-motion及图相机原参数；唯一0049 IMMUTABLE reward-v1八值[150,100,150,200,200,100,150,250]、0050确切来源grammar、0053手工零XP函数及客户端权限均不变；七旧8F protected blobs继续current原样。

临时栈必须绑定本轮project/workdir/新四IDs+Created/API54331/DB54332、BUILD_ID/compiled tuple；正式54321/54322不跑夹具。先全部客户端永久释放再精确销毁task容器/卷，最后只清无引用可重建cache；不global prune/VHD压缩，不删正式数据/备份/源/证据/原secret/root用户改动/共享physical node_modules/Playwright/系统cache/当前3017。报告实际清理目标与逻辑大小，不假称磁盘物理收缩或整站完成。

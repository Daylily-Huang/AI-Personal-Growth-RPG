# 18 — 待确认建议的事实修正与 AI 重新评估契约

状态：待 fresh Risk2 ADMISSION。本文不是实现验收、候选 GO、committed FINAL、合并、正式迁移或整站完成授权。

## 1. 用户决定与上位约束

用户于 2026-10-11 明确选择「修正事实后由 AI 重新评估」。本切片落实 02 §33 / 04 M2-03 的 Edit，不开放手调 XP、Evidence 等级、Mastery、confidence、奖励或规则版本。01 > 02 > 03 > 04–10 > 实现；03 原始记录保留、06 多评估但每 Activity 一笔原始结算仍有效。原 Activity / 旧 assessment JSON / 旧 model 与 prompt provenance 永久保留，不对已确认成长做回改。

本机交付；对外部署暂缓。Artifact 认定及奖励均延期，现实成就仅记录、零积分。补充材料 E0/false 入口已经完成，不把本次事实说明当独立验证，不据此完成 Verifier、文件附件或当前整站 13 步验收。正式 0054 已完成，不重派发；正式 0055 应用另需当前批准及备份/恢复/迁移独审。

## 2. 基线、精确路径及准入边界

accepted base `229c09f122d3f0cb31fd02ff3ade53b27d06566d`，tree `ae8316f16cab5e9ad13005bef135ee552197531a`，PR59 已合并。新 checkout `.data/site-proposal-edit`，branch `codex/site-proposal-edit-20261011`。运行中的 `.data/site-evidence-live` / 127.0.0.1:3019、正式 API54321/DB54322、root 用户修改、密钥、备份和共享依赖均不动。

EXACT52：最终 working（tracked+untracked）、完整 PR、正向识别的 current-main first-parent 差集必须且只能是下列 52 个唯一文件。允许修改不等于必须重构；旧文件限本契约所列接入、追加和严格治理适配。

```text
docs/Design ChatGPT/02_PRODUCT_DESIGN.md
docs/Design ChatGPT/03_TECHNICAL_IMPLEMENTATION.md
docs/Design ChatGPT/06_DATABASE_SCHEMA_AND_DATA_DICTIONARY.md
docs/MASTER_PROJECT_HANDOFF.md
docs/SiteReadiness/18_PROPOSAL_FACT_EDIT_CONTRACT.md
docs/SiteReadiness/19_PROPOSAL_FACT_EDIT_VERIFICATION.md
findings.md
progress.md
task_plan.md
src/app/activities/[id]/page.tsx
src/app/api/activities/[id]/assess/route.ts
src/app/api/activities/[id]/fact-revisions/route.ts
src/app/api/assessments/[id]/edit/route.ts
src/components/activities/ProposalFactHistory.tsx
src/components/assessments/ProposalFactsEditor.tsx
src/components/dashboard/PendingProposals.tsx
src/lib/proposal-edit/ai.ts
src/lib/proposal-edit/client.ts
src/lib/proposal-edit/context.ts
src/lib/proposal-edit/http.ts
src/lib/proposal-edit/repository.ts
src/lib/proposal-edit/request.ts
src/lib/proposal-edit/service.ts
src/lib/proposal-edit/types.ts
src/lib/proposal-edit/validation.ts
src/lib/store/repository.ts
src/lib/store/settlement.service.ts
src/lib/store/supabase-repository.ts
src/lib/store/types.ts
supabase/migrations/0055_proposal_fact_edit_authority.sql
tests/proposal-edit-api.test.ts
tests/proposal-edit-authority.test.ts
tests/proposal-edit-concurrency.test.ts
tests/proposal-edit-context.test.ts
tests/proposal-edit-golden.test.ts
tests/proposal-edit-governance.test.ts
tests/proposal-edit-http.test.ts
tests/proposal-edit-repository.test.ts
tests/proposal-edit-ui.test.tsx
tests/proposal-edit-validation.test.ts
tests/activity-detail-governance.test.ts
tests/assessment-context-governance.test.ts
tests/evidence-submission-governance.test.ts
tests/graph-canvas-governance.test.ts
tests/graph-mobile-governance.test.ts
tests/helpers/governance-delta.ts
tests/onboarding-governance.test.ts
tests/phase5-dashboard-ui.test.tsx
tests/phase8f-ui-governance.test.ts
tests/proposal-rejection-governance.test.ts
tests/supabase-schema.test.ts
tests/visual-foundation.test.ts
```

MARKERS35 = 本合同、02/03/06、上述全部 21 个 production（含唯一 SQL0055）、10 个新 proposal-edit tests。35 个唯一标记全齐、52 路径全等及合同 canonical SHA256（UTF8，仅 CRLF→LF）绑定后，才允许任何历史范围/内容投影。合同存在但标记缺失时也不得落回旧16/13/11/09分支。准入阶段仅新增本合同；ADMISSION GO 后才可实现另51项。合同正文一旦获准即冻结，任何修改需同档重新准入。19仅记录真实证据，不自签 GO。

## 3. 用户可修正的事实和唯一数据来源

POST JSON 恰为 `{requestId,facts}`，facts 恰为 `{description,totalMinutes,effectiveMinutes,relatedSkillIds}`；外层两键、内层四键均必需，无额外/继承键、getter、prototype 污染、用户 owner/status/model/proposal/rules/评分字段。路由 id 是要替代的 pending assessment ID，服务器核对其 Activity 和 owner；不另建 Activity，不引入可重复结算的 Activity family。

description 是本次完整修正描述，不是要求模型服从的指令。沿用已冻结 phase8f_trim_text/JS trim 25 空白，首尾 trim 后非空，UTF8≤8192 bytes；拒绝 NUL、不成对 UTF16 surrogate。totalMinutes/effectiveMinutes 均为 null 或 0..1440 的整数；有效分钟不能大于已知总分钟。null明确表示未知，不暗用0；1440 是本表单单次活动的输入资源/真实性边界，不改变时间因子或任何旧 Activity 输入规则。

relatedSkillIds 是有顺序的 0..5 个唯一 UUID（标准带连字符、小写规范化）；仅查本人的 active Skill。它们是「相关技能线索（AI会重新判断）」而非直接指定永久成长目标。表单明示此义；模型仍输出既有 affected_skills/mastery_changes schema，普通 Confirm 再按既有稳定 ID resolution 和确定性规则结算。不得把客户端名称当 ID，不能将用户线索伪称已核实技能归属。选择器真实分页，一页50+lookahead1；name最多200 codepoints并明示截断，不改技能真值。不后台遍历全目录。

只新增两张私有表：

- `proposal_fact_edit_requests`：主键 `(user_id,request_id)`；immutable tuple为 Activity ID、base assessment ID、上述 canonical facts、创建时间和期限；只允许受控状态转换，保存 `in_progress/completed/failed/expired/conflict` 及固定安全错误码、完成 revision ID。每 Activity 最多一个 in_progress。facts 的唯一持久正文/时长/线索来源是这里，不能在 receipt/Activity/新 assessment JSON 再造可分叉副本。
- `proposal_fact_revisions`：不可改写的成功版本链，引用同 owner request、Activity、base/result assessment、previous revision（首版 null）、规则版本、prompt版本、创建时间；每 result assessment 至多一条。原始事实仍唯一来自原 Activity，原 assessment JSON/provenance仍唯一来自旧 ai_assessments；revision join request取得修正事实，join结果assessment取得新AI建议。历史链不能跨 tenant/Activity、重复/成环或断代。父 auth/Activity 正常删除可合法成组级联，单删 request/revision/被引用 assessment 不得丢审计或幂等；所需新 FK 应为精确 composite owner约束和合适的 deferred NO ACTION，不改旧 FK。

原 Activity 的 raw_input、title、类型、全部时长、时间戳、rules_version、Quest绑定与创建时 snapshots 在 Edit 开始/失败/完成时均不更新。原 assessment正文/model/prompt/confidence/rules不改；成功仅改原 pending状态并创建新 pending。原时间也不被悄悄覆盖：修正时间只在对应成功 revision 的普通 Confirm 中被选用。Activity详情分列「原始事实」和「修正与重新评估历史」，不得让旧 GET / 原文区域冒称修正后值。

## 4. 请求状态、AI 消费与失败闭环

认证先于 route/query/body/model/业务查询；真实 Supabase request scoped auth.getUser，不降级 Demo、不接 userId。缺配置/未知内部故障安全500，未登录401，foreign/missing assessment统一404。新key/首次begin遇已确认/拒绝/被替代状态409且零模型请求；本人已存在key必须先判tuple/replay，completed即使后来Confirm/Reject也可200读回，不能被上述新请求guard截断。只有本人 pending assessment +未确认 Activity可首次 begin；有成功revision时下一次Edit必须以该result pending为base，不允许旧 sibling重开。

新 `/api/assessments/[id]/edit` GET/POST，id始终为assessment ID。POST不接受query，application/json（可UTF8 charset）与来源边界复用16精确Host/Origin/Sec-Fetch-Site语义，认证后流式最多16384bytes/fatalUTF8解码；不先无界json/text再检查。GET允许互斥有界view：默认 `facts` 初始化，`skills` 可选 after UUID，`request` 必须 requestId UUID；重复/未知query拒绝。另新增GET-only `/api/activities/[id]/fact-revisions`，id始终为Activity ID，仅可选 after revision UUID，供只知道ActivityID的详情面板读取历史；不借dashboard全量数据推测assessment、不把ActivityUUID塞进assessment路由。两种GET都auth-before-parse、owner/foreign404、只读且无expire/repair/create。

begin必须先按 owner/request固定namespace取事务锁，查已有 tuple；同key不同base/Activity/facts即409，全表不变。相同key重放先返回持久状态，不因当前base已superseded/技能已归档或删除而丢失completed receipt。任何已有key绝不再派发AI，无论失败/过期/进程崩溃；用户看到结果后明确发起新尝试才换key（可能再次产生模型费用）。SDK禁自动重试 `maxRetries=0`，单次model timeout60s；DB请求期限180s。两者只是任务超时预算，不是成长常量。

首次begin经§5同一Activity互斥门核对owner/pending/unconfirmed/线索active，清理该Activity真正已超期限的旧in_progress为expired（只在POST事务）；创建in_progress/固定expires_at并返回严格 `dispatch=true`。相同key dispatch=false；不同key在有效in_progress期间409，不调用AI。成功begin的返回结果不明时保持同key查状态，不盲重派。模型调用在任何数据库锁和事务之外进行，不跨网络持锁。

完成：service-only finalize 核对request实际in_progress且未过期、exact owner/base/Activity/previous链、base仍pending/Activity未确认、rules不变、严格AI schema与本次model/prompt；atomic创建唯一新pending，supersede此Activity所有旧pending（只改status/updated_at），插入revision，request→completed。期限后或Confirm/Reject赢了则终态expired/conflict，绝不写新assessment/revision。失败：固定安全code的service-only fail仅将本次in_progress→failed；不覆盖已completed、其他request或并发已确认的Activity。模型超时/非法JSON/schema/DB提交失败不改旧proposal；除用户自己的并发Confirm/Reject以外，原pending完整可继续处理。终态不可逆，不复活request。

已completed返回严格持久receipt，200+replayed=true；首次完成201+false。仍in_progress返回202+Retry-After:3，仅状态与requestId，不暴露dispatch/token。failed/expired/conflict返回固定可恢复状态/提示；不能伪报新assessment成功。未确认的网络结果用同key GET核实；轮询最多20次/60s且可取消，之后显示手动核实，不后台无限请求。即使客户端abort，服务器可能已调用AI/完成；取消仅关闭等待，不许宣称回滚。残留in_progress只能在明确新POST按实际期限关闭；不可自动租约接管同key重发模型，不能声称跨进程/提供商 exactly-once。

## 5. SQL0055、旧入口竞争及结算一致性

0001..0054历史文件逐字不变。新 sequential0055只新增§3两表、必要index/constraint/guard、受控 RPC/helper；只允许替换以下两个installed函数：`record_ai_assessment(uuid,uuid,jsonb,text,text,numeric)` 和 `settle_activity(uuid,jsonb)`。不替换其他旧函数/trigger/RLS/grants、奖励策略或成长系数，不改旧代码 migration来伪造安装效果。

两个旧函数必须在原锁行前加入统一 per-Activity advisory transaction gate，key固定namespace+owner UUID+Activity UUID；新begin/finalize/fail也先取同gate，再锁assessment→Activity→request/revision。request-key锁总在gate前；record/settle不取request-key锁，不能构成反向循环。settle先保留0042原参数解析/负值检查顺序，再根据assessment的真实owner/Activity取gate（查不到则走原失败分支），原功能主体保持。新表只在持gate事务内写；拒绝服务仍是旧单assessment CAS UPDATE、不反取Activity锁，不能为本切片擅改它。

必须覆盖旧Confirm选A/选B、Edit选A、旧reassess、Reject选A/选B同时竞争，证明既无锁序死锁也无两笔XP/两条当前revision。只在Edit中加Activity锁而不治理旧settle的先assessment锁与末尾supersede sibling是禁止方案；只靠前端busy或新入口advisory锁同样不足。

record_ai_assessment取得gate后，对有效in_progress或已有成功revision的Activity拒绝普通旧评估入库；旧assess route在model前新增同义只读guard，提示用事实修正入口。route先查后变更的竞态由DB再拦，不把前置检查当原子授权。无修正/无有效in_progress的旧Activity行为和Demo路径不变；原函数主体逆向去除准确新guard/gate必须还原0021的canonical prosrc。

SettlementService对本人assessment仅新增严格revision读取（Supabase repo的optional读取端口，Demo不提供），无revision时原行为逐字可逆；有revision时读取唯一request facts及其精确ID/链/owner/rules，**只用effectiveMinutes修正值**代入原calculateXp与calculateQuestProgressDelta，不替换base/difficulty/重复次数/规则/Quest snapshot。unknown=null沿用原engine unknown语义。添加factRevisionId与effectiveMinutes一致性标量至settlement和ledger modifier审计；ledger reason仍原始rawInput，通过revision可追溯修正。无revision时禁止冒充这些新authority字段。

settle_activity持gate、锁assessment/Activity后核对该assessment的actual revision及request completed关系。要求调用方revisionId/分钟和request facts逐值相等，不接受漏字段、NULL偷换、错误revision、跨tenant/Activity、过期base或客户端自供时长；不能UPDATE原Activity时长，也无需重写本地v_activity来冒充原事实。旧0042实际是优先采用传入questProgressDelta，否则round(coalesce(原有效分钟,40)/2)回退，最后least(100,原progress+delta)；它**没有**以时长校验传入delta的cap，不能据此声称双端已验证修正时长。

新revision绑定Quest时，新增guard要求显式数值questProgressDelta，与实际新assessment的completion及request有效分钟按冻结TS规则逐值相等：completion>0时clamp(round(completion×100),5,100)，否则有效分钟>0时clamp(round(minutes/2),5,100)，否则20。无Quest的新revision不接该字段；无revision的旧调用全部保持原回退语义。正值边界round与JS Math.round须独立核验。应用仍原calculateXp计算XP；SQL只新增本次revision/分钟/显式delta一致性校验，之后执行原0042主体，不重算/改写旧Growth算法。实测覆盖completion为0/正数、minutes为null/0/正数/饱和及故意错传delta，不把成功fallback冒充验证。逆向去除准确新gate/revision-receipt guard后还原0042完整canonical prosrc及旧功能实测。

新表RLS开启，authenticated仅本人SELECT，无API role直接INSERT/UPDATE/DELETE；guards采用实际安全函数执行身份/owner及状态转换，不信任客户端GUC、pg_trigger_depth或service_role自报字段。额外broaden-grants+forged-flags仍拒绝直接DML/跨owner；auth/Activity已实际删除时只允许精确合法cascade。新API RPC fixed search_path(public,pg_temp)，对象schema-qualified/owner postgres。begin仅authenticated+真实uid；read查询同request RLS，不用admin读历史。finalize/fail仅service_role execute（PUBLIC/anon/authenticated撤销），在服务器认证/读取owner后使用现有server admin，禁止客户端import；私有guard/helper revoke所有API execute。所有NULL/类型/键/范围/Unicode独立在SQL再验，不以STRICT静默NULL充成功。

## 6. 新 AI 契约、隐私和固定常量

单独 `src/lib/proposal-edit/{ai,context}.ts` 实现 `activity-evaluator-v0.4-facts`，temperature0，原SYSTEM_CONSTITUTION/既有AssessmentProposalSchema可import但旧src/lib/ai/**全文不改，不接任意model/url/temperature。主/次技能100%/0XP规则、时间因子1.00..1.15、重复30天稳定skill ID、Mastery>=5或跳>=2需verification完全冻结，不把事实修正当通过验证。

模型资料明确分块：原始Activity（原文最长投影8192UTF8bytes+截断标记，原数据不改）、本次完整facts、已有v1本人最小context和server加载的0..5技能线索(name/mastery/confidence与ID provenance)。旧context4096bytes预算、200候选+201query、技能5、recent5+6query、alias20、questDepth8、recentDays30、title512bytes/name160bytes约束保持。v1相关技能/近期样本来自原文选择，明确original-context范围，不能冒称是修正关联的完整历史。线索投影name≤200codepoints并注明截断；关联不存在/foreign/archived在AI前拒绝；begin之后失效则finalize冲突，不偷换为别的ID。

新prompt完整编码UTF8≤131072bytes；JSON.stringify后实测转义最坏界限，不将原字符数当编码bytes。原文与facts都是user_claim，不是system指令；技能既有Mastery非新增成长，recent仅样本非独立Evidence；无关私人记录/secret/cookie/env/完整历史不发送。下游仅schema合法Proposal，可低confidence/uncertainty，不自动Confirm、验证、改奖励。鉴权或context不合法时zero SDK dispatch；真实AI错误不退Demo、不打印输入/原始服务错误。

旧AssessmentProposalSchema对字符串/数组没有长度上限，不能单靠schema声称有界。新adapter另在解析前检查model content UTF8≤65536bytes，解析/验证后JSON.stringify(proposal) UTF8≤65536bytes；只允许纯JSON有限数值，不接受函数/getter/循环/不成对surrogate。SQL finalize独立要求jsonb::text UTF8≤65536bytes及实际proposal shape；SQL含排版空格的表示与JS compact表示不同，SQL预算是最终入库边界，不伪称逐字等同；触界拒绝是安全失败，旧pending保留。新model_name、prompt、rules标签各UTF8≤256bytes。拒绝过大的模型结果后绝不先持久化再让回执不可读；原schema/旧评估不因此重写或裁切。

引用常量须独立验证：01/02/06的primary-only、Evidence/Mastery阈值；0049唯一IMMUTABLE STRICT reward-v1八case按Season/Major/Epic/Main/Boss/M6/M8/M10为150/100/150/200/200/100/150/250，0050来源grammar与既有权限；phase8f_trim_text 25空白；md48rem、44px、正常motion250ms/reduced0、两图原camera参数。全部不改。表单/AI/HTTP数值是本切片明确资源预算，不能伪称外部标准。

## 7. 读取、严格回执和 UI

新repository/HTTP固定字段、own-property/Map错误映射、JSON私有no-store/VaryCookie；不回传DB/detail/stack/token或输入日志，不用Boolean/default mapper吞NULL/status。原始owner在公开投影前核验并剔除；每UUID/base/result/request/revision/Activity/时间/actualboolean/status/链/规则/model/prompt/事实类型严格校验。状态缺失/null/prototype错误名必须fail-closed。输出日期有时区且UTF8≤40bytes；历史一页25+lookahead1/revision UUID升序keyset，完整facts正文、状态和provenance可读。

Activity GET history仅成功revision + request事实，不返回全部原始AIJSON（通过原有assessment相关展示查看建议），逐项公开固定UUID/时间/状态/规则/model/prompt（标签每项UTF8≤256bytes，超限failclosed）、最多5个Skill UUID、完整description/分钟。单项除description的JSON编码预算8192bytes，envelope1024；25×(6×8192+8192)+1024=1434624≤1572864 (1536KiB)。skills单独≤81920bytes；facts/request单独≤131072bytes。facts初始化仅含原文8192UTF8bytes有标记投影、原分钟/current事实/线索，不含旧/新assessment JSON；request完成回执可含唯一新proposal对象及facts，但不重复包含原文或转义成JSON字符串，65536+49152+8192=122880≤131072。固定字段总预算8192包含至多三种256byte标签/UUID/时间/语法，不准无限metadata旁路。最坏ASCII controls/Unicode/quotes/非法超大provenance必须实测完整分页，而不以无限metadata破坏预算；所有GET无业务mutation/模型调用。

PendingProposals仅新增“修正事实”按钮和独立editor组件接入；原Confirm/Reject、Artifact picker、busy/race/error语义保留。编辑中与本项Confirm/Reject互斥，但不禁其他项。原生label/textarea/分钟input/关联选择/确认重评/取消/结果核实均44px；不渲染评分input。只在显式打开时读取初始化/技能，路由/id切换、关闭、卸载abort全部owned reads；用真实native fetch/socket证明失败一路不泄漏另一路。保存成功但dashboard刷新失败单列、保留receipt，不为刷新再次POST/AI。401登录、404/409状态变更、502模型失败、网络unknown/reconcile均可读中文，不泄露底层。

表单/key仅内存，不local/sessionStorage、不cookie、不自动提交。unknown期间不把同key换facts；用户明确改内容/新尝试才新key。完成后旧项不可再确认，刷新显示新pending；用户可查看原文、旧/新suggestion与修正史后自行Confirm。活动详情只新增独立只读ProposalFactHistory面板；默认关闭时旧GET数量不增加、原文/原时长/错误路由逻辑逆向还原accepted229c。已有EvidenceSubmissionPanel保持原义和独立生命周期。

浏览器320/390/768/1440四宽、native Tab/focus返回、44px/inClip/无横溢/error0，真实修正时长+线索→AI建议→旧项失效→新Confirm→History一笔XP闭环；另测model失败/unknown/refresh失败/并发确认、取消/卸载。需要受控合成AI响应测试真实HTTP/UI，不把mock模型称真实AI验收；真实API独立限量验证另记，禁止上传secret。

## 8. 历史治理闭包与测试保持

accepted229c的governance-delta.ts完整canonical前缀不改；只末尾追加新18 selector/range/history/content。全部旧synthetic callers/old policies/violations/markers/assertions保留。12个旧测试文件只加显式18真实分支和有界adapter；先完整actual52+35+合同hash/祖先/真实Git范围绑定，再投影固定历史。新actual selector先于16/13/11，不能因旧合同常驻绕过；working和committed均完整，不按目录豁免或吞Git错误。

历史端点：Evidence35固定52ba1378d355ccab26f12e7fdd3eedb8464deafe..229c09f122d3f0cb31fd02ff3ade53b27d06566d；Context32仍15f6287cd53d9049a2d6e60958cab40f75911405..52ba；Reject25仍78d2036af19e55ea59f40cdc8a3358c3bab3cae4..15f；旧图/guide/detail/maincorrective沿原approved anchors→78d精确范围。必须对每个固定range本身运行旧完整scope断言，同时实测新52/0055，不能历史投影后就不审新production。

历史内容仅保留16原四组精确路径/端点（onboarding七条固定78d、activity三条固定15f、rejection prompts固定15f、page固定52ba），另允许Evidence自己page逆向保护以accepted229c page为基线，以及旧Context own immutable source断言重叠的repository.ts/supabase-repository.ts以accepted229c为基线；都先strict18且新测试逆向复原、实测当前差异。禁任意source/doc投影、不能把整个旧test固定到旧blob假跑。0055唯一新增SQL，schema inventory只加两表并按原inventory组织，不删旧权限/assertions。旧0001..0054、奖励source/helpers、9个8Fauthority/protected blobs、原v0.2/v0.3prompt/context、Demo fixture均实际原样检查。

新增governance tests独立攻击35missing、52extra/duplicate/path traversal/旧scope混入、坏hash/read/ancestry/Git失败、空范围、remoteahead/full多commit PR/currentmain firstparent错配、content组错配；全部旧helper前缀/历史assertions/受保护blob以及production原逻辑逆向证明。currentmain仅remoteHEAD==HEAD且firstparent==accepted229c进入；不能以merge-base==HEAD或HEAD~1代替完整PR。

## 9. 真实验证、独审、合并和精确清理

ADMISSION仅设计可实施性、范围及常量，不启动DB/模型或改production。实现前读installed Next对应guide；无需安装/升级依赖，不改package/lock/config/workflow、共享styles/graphs、provider或系统代理。依次纯validator/actualSDK/route/UI、schema/golden新prompt、真实隔离PG/auth/完成buildHTTP并发与populated基线、主完整回归/Growth11/E2E11/type/lint/build/Chrome；无harness:llm:golden脚本时不得编造运行，以新golden回归+现有context golden标明差异。

PG至少三owner+populated所有旧表（技能/玩家XP500 Level4、旧Evidence、mastery、Quest、outer/reward/Wishes余额与债务），逐表深比较：begin只新增本人request；失败/replay/读取/异tuple不改Core；finalize仅两新表及ai_assessments状态/一新行；Confirm才原有一次growth结算。包括各种NULL/缺键/false串/Unicode25/UTF8边界、直接SQL绕API、三APIroles broaden-grants/forgedflags/helper拒绝、foreign same-shape、rollback故障、同key同/异tuple/跨keyinprogress/过期/迟到model/unknowncommit、旧双pending的Confirm/Edit/Reject/reassess锁竞争（接住所有rejections，deadlock0）、新old分钟分歧/冻结TSdelta与新增SQLguard/原fallback不改、1000+历史/skills分页、删除/级联、已确认不能重评、旧一笔ledger唯一。

临时栈独立project/workdir+原始四ID/Created+54331/54332；绝不对正式54321写夹具/迁移。reviewer真实DB需主显式独占grant，main期间零DB/HTTP；reviewer direct永久release、所有client/runner终态+census后main才能精确owned清理；删除仅本次合成栈/卷、已不用的task cache，可恢复源/证据/备份/共享deps/active3019保留，不全局prune、不kill未知旧服务、不绕过删除拒绝。

fresh Risk2候选独审须独立复现actualmodule/React/SQL并发，不只是读主报告；source修改使旧build/full/browser/candidate绑定失效，修后同Risk2重验。失败保留。冻结52字节/base/tree/build/manifest/19后候选GO→selected52commit/push→own exact-head CI→不同fresh committed FINAL→普通保护允许merge→post-main CI→另需正式0055批准/新备份恢复/迁移独审→新本机预览验收/精确清理。无force/admin/deletebranch；任何GO均不自动等于整站完成。

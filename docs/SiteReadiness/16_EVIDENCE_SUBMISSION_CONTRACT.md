# 16 — 活动补充材料的受控提交契约

状态：待 fresh Risk2 ADMISSION；本文不预签实现、候选、committed FINAL、合并、发布或整站完成。

## 1. 上位依据与本次目标

01 §2 Rule2/4/10、§10 的 E0 Self-report，02 §33 允许补证，§34 的独立 Mastery Verification，03/06 的 Evidence 与租户数据架构，04 §13、05/07/08/09 仍优先。本次只完成可操作的第一段：用户对自己的既有 Activity 提交文字材料（可以包含以纯文本保存的链接），保存为待核实的 E0；不是自动判定材料质量或 Mastery 的 Verifier。

可行性预检 AA13D1BCDDE3CF26B76A20E0EAA085610D8FEB53F414443008AE2ED1EEB88648 及 Hubble 的 GO 只证明方案可准备，不授权本次 Core 写入。旧 09/13/15 合同、历史测试、原规则及原证据不修改。新入口由本合同单独准入。

不新增手调评分权限；Edit 仍待用户明确选择。文件上传、正式验证申请/裁定、既有 pending verification 的处理仍是后续缺口，不能把文字补交或已有 verified 布尔字段当完整验证闭环。Artifact 认定和奖励继续延期；现实成就仍只记录、零积分。

## 2. 基线、精确范围与十九个标记

accepted base/当前起点 `52ba1378d355ccab26f12e7fdd3eedb8464deafe`，tree `f0c2d8545af169c2e569e5323d3608065ec8f371`；独立 checkout `.data/site-evidence-submission`，branch `codex/site-evidence-submission-20261011`。现有 3018、正式 Supabase 54321、root 用户 dirty、密钥、共享依赖及备份均保护。

EXACT35：最终 working（tracked+untracked）、完整 PR 差集和正向识别的 current-main first-parent 差集只能且必须为以下三十五个唯一文件；不按目录放行，不用 HEAD~1 代替累计 PR，不吞 Git 错误。

```text
docs/Design ChatGPT/02_PRODUCT_DESIGN.md
docs/MASTER_PROJECT_HANDOFF.md
docs/SiteReadiness/16_EVIDENCE_SUBMISSION_CONTRACT.md
docs/SiteReadiness/17_EVIDENCE_SUBMISSION_VERIFICATION.md
findings.md
progress.md
task_plan.md
src/app/activities/[id]/page.tsx
src/app/api/activities/[id]/evidence/route.ts
src/components/activities/EvidenceSubmissionPanel.tsx
src/lib/evidence-submission/client.ts
src/lib/evidence-submission/http.ts
src/lib/evidence-submission/repository.ts
src/lib/evidence-submission/request.ts
src/lib/evidence-submission/types.ts
src/lib/evidence-submission/validation.ts
supabase/migrations/0054_evidence_submission_authority.sql
tests/evidence-submission-api.test.ts
tests/evidence-submission-authority.test.ts
tests/evidence-submission-governance.test.ts
tests/evidence-submission-http.test.ts
tests/evidence-submission-repository.test.ts
tests/evidence-submission-ui.test.tsx
tests/evidence-submission-validation.test.ts
tests/activity-detail-governance.test.ts
tests/assessment-context-governance.test.ts
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

MARKERS19 为本合同、02、上述九个 production TypeScript 文件、唯一 0054 SQL 和七个新 evidence-submission 测试。十九标记必须唯一且齐全；任一缺失、重复、旧 scope 混入或额外路径必须在历史过滤/内容投影/非视觉提前返回前 fail-closed。十九标记不是缩减后的最终十九文件范围，最终仍 EXACT35。准入阶段只允许新增本合同；ADMISSION GO 后才可实现其余三十四项。

02/MASTER/三个计划只追加本次内容并保留历史；本合同准入后全文 canonical SHA256 固定（UTF8、仅 CRLF→LF），任何正文变化需同档重新准入。17 为最终证据记录，不可用其状态代替独立裁决。

## 3. 唯一 Evidence 真相与提交内容

新建 `public.evidence_submissions` 仅是最小幂等/来源映射 receipt：`user_id, request_id, activity_id, evidence_id, requested_skill_id, created_at`。主键 `(user_id,request_id)`；同一 Core Evidence 只能被一个 receipt 引用。不复制正文、证据等级、verified、XP 或评分进 receipt，避免平行真相。

正文唯一存于现有 `public.evidence_records.description`。新记录仅由本次 RPC 插入，固定 `evidence_level=0, verified=false, evidence_type='user_submission', knowledge_node_id=NULL`，Activity/可选 Skill 都属于请求本人。不得依赖 0008 的 level=1 默认值，不重解释/覆盖 0042 的既有 verified 语义，不改原 Activity/raw_input/rules_version/assessment/旧 Evidence。

E0 只表示尚未独立核实的用户提交来源；不能断言材料实际价值只有 E0。提交不增加或减少 XP、Level、Mastery、confidence、last_used、主线/Boss/Season/里程碑/奖励/Wishes/余额或债务，不写任何其他 Core/outer/reward 表。

POST JSON 恰为 `{requestId, skillId, description}`；三键均必需，无额外/继承字段。requestId 为标准带连字符 UUID（大小写归一到小写）；skillId 同格式或显式 null。description 为字符串，使用已冻结 `phase8f_trim_text` 对齐 JS trim 的二十五空白字符，只规范化首尾空白，剩余正文逐字保存；trim 后非空、UTF8 最多 8192 bytes；拒绝 NUL 和不成对 UTF16 surrogate。不得 HTML/Markdown 执行、URL 抓取、图片解析或发送到 AI。链接只是正文中的用户声明，纯文本显示而非自动外链。

API 流式读取 body，最多 16384 bytes；不得先无界 request.json/text/arrayBuffer 再检查大小。POST 只接 application/json（可带 UTF8 charset），不支持的 media type 为 415。来源沿用现有 login-http.ts 的实际 Host 边界：target=`request.url.protocol + '//' + (Host ?? request.url.host)`，有 Origin 时须精确匹配 target；无论有无 Origin，Sec-Fetch-Site=cross-site 都403。无 Origin 的非浏览器调用仍须真实认证；忽略全部 forwarded host/proto，不把内部 bind address 当浏览器地址。上述检查都在认证后，不改旧认证模块、不增 CORS 放行。UTF8 fatal decode、JSON/object/类型/字段失败为 400；超限为 413。SQL 独立重验 exact input `{skillId,description}`、NULL/type/trim/UTF8 上限，不信任前端。外层 byte 上限是资源预算，不是成长规则。

## 4. 认证、HTTP 与读取预算

仅新增 `/api/activities/[id]/evidence` 的 GET/POST。请求级服务端 Supabase client + `auth.getUser()` 确定身份；认证必须先于路由/query/body 解析与业务查询。缺配置不降级 Demo；不用 admin/service-role client、不接受 userId/actor/authority GUC/body flags。未登录 401；无配置/未知故障 500；无权/不存在的 Activity 统一 404。自己当前三种状态 pending_assessment/assessed/confirmed 都可提交（原 confirmed Activity 不更新）。新 Skill 关联仅允许本人 active Skill；缺失、归档、外人 Skill 统一 404；null 是活动通用材料，不暗建技能。

GET 只有可选 `view` 和 `after` 两个唯一 query key，重复/未知 query 拒绝；view 为 `submissions`（默认）或 `skills`；after 为标准 UUID 或省略。POST 不接 query。两 RPC 都由 SQL 再认证/核租户；GET 不调用创建 RPC，不加锁写状态，不产生 receipt。

submissions 使用 request_id 升序 keyset，每页 25、最多读 26 条作 lookahead，只列当前 owner+Activity receipt 与其 Core Evidence 的 join，不伪称时间倒序或返回所有旧结算 Evidence。返回完整正文，nextCursor 由最后返回的 requestId 给出；无更多为 null。外部响应上限 **1280 KiB（1310720 bytes）**，超过 fail-closed。必须覆盖合法 SQL 直接调用的最坏 JSON 转义，而非假定8192原文bytes等于JSONbytes：每正文最多6×8192=49152编码bytes；固定字段/UUID/日期/语法每项保守1024、整个envelope另1024，25×(49152+1024)+1024=1255424≤1310720。公开字段严格固定，无任意 metadata/extra 可破坏该证明。列表不能据数量推算 Mastery/奖励。

skills 只作表单关联选择，当前 owner+active，id 升序 keyset，返回 50、最多读 51；SQL 投影 name 前 200 codepoints，附严格布尔 nameTruncated，ID 保持完整。标签截断明确，不修改 Skill 真值，不读取 domain/graph/XP/主线/历史。每次下一页由用户明确触发，不后台遍历全目录；公开字段仅 id/name/status/nameTruncated，输出最多 **80 KiB（81920 bytes）**。JSON每codepoint最多6bytes，固定字段每项保守256、envelope1024，50×(200×6+256)+1024=73824≤81920；不得把原标签UTF8长度等同转义后的JSON长度。

响应是固定安全 JSON，均 `Cache-Control: private, no-store`，不得返回原始 DB/detail/stack/URL/secret/cookie/body 日志。错误映射用 exact own-property/Map，`constructor/toString/__proto__` 等 prototype 名不进入 HTTP status。已登录输入/外键错误 400/404；同 key 异 tuple 409；其他故障 500；客户端统一可读中文而非吐底层异常。405 保留框架行为，不伪称每种不支持 method 由业务函数认证。

## 5. 新 SQL 权限、幂等、并发与删除

只新增 sequential `0054_evidence_submission_authority.sql`；0001..0053 字节/原函数/trigger/RLS/grants 不变，不替换 settle_activity/record_ai_assessment/奖励函数，不新增 service-role 使用或规则重算。允许本 SQL 创建且仅创建 receipt、必要 index/constraints/receipt guards 与两个 RPC：

- `rpc_submit_activity_evidence(p_activity_id uuid,p_request_id uuid,p_input jsonb)`：原子写一条 E0/false Core Evidence 和一条 receipt。
- `rpc_list_activity_evidence_submissions(p_activity_id uuid,p_view text,p_after uuid)`：只读上述两种有界投影，不写入/锁行更新任何业务状态。

RPC 为 postgres 所有、SECURITY DEFINER、固定 search_path（public,pg_temp），全部对象 schema-qualified；拒绝非 authenticated 当前 role 或空 auth.uid；不能仅凭可伪造 GUC/client flags 授权。默认/PUBLIC/anon/service_role execute 撤回，只授 authenticated；底层 receipt guard helpers 不向 API 角色开放 EXECUTE。receipt RLS 开启，只给 authenticated 本人 SELECT；撤回三 API role 的全部继承 DML，再明确只授 SELECT。即使在事务测试里临时 broaden 表 DML/grants、伪造 GUC，anon/authenticated/service_role 仍不能直接插入/更新/单独删除合法 receipt 或冒充 owner；不可弱化旧 Core 权限。

创建时先 auth→输入基本校验→按 `(uid,requestId)` 的固定 namespace advisory transaction lock→查本人已有 receipt。存在时先比较原 tuple（activityId、requested_skill_id、Core 当前完整 description）；完全相同返回同一真实 Evidence，replayed=true、HTTP200，**不**先用当前可变 Skill active 状态卡住重放；任何 tuple 差异 409 且全表不变。首次创建才按固定顺序核查并锁 Activity、可选 active Skill 防 delete/ownership/status race，再插入固定 Core 行及 receipt、返回 replayed=false/HTTP201；任一失败整个事务回滚。相同 key 并发只产生一对、异 tuple 并发最多一对，所有 promise/rejection 都需当场接住。不同 key 可独立形成不同提交；不以说明相同偷偷吞掉用户明确的另一提交。

NULL activity/request/input/type 不得由 STRICT 静默返回成功，函数须显式拒绝。caller不能自供 Evidence ID/level/verified/type/createdAt/XP。新 receipt INSERT guard 必须用不可被表 DML/自设 GUC 冒充的实际函数执行身份 + owner 校验作独立 backstop；UPDATE 无条件拒绝。DELETE 只允许 Activity/auth owner 实际删除后的 referential cascade（用真实父行已不存在作边界），不许单独删除/改写一个仍有父 Activity 的 receipt；不把 pg_trigger_depth 或 custom setting 当唯一授权。

receipt `(user_id,activity_id)` 指向 0041 已有 composite Activity 唯一键、ON DELETE CASCADE；`(user_id,evidence_id)` 指向已有 composite Evidence 唯一键，NO ACTION DEFERRABLE INITIALLY DEFERRED，避免单独删除 Evidence 丢失幂等映射，同时不阻塞原本合法的 Activity→Evidence/receipt 成组级联。user_id 仍 auth.users CASCADE。这些仅是新 receipt 的约束，不重写旧表 FK。

requested_skill_id 是请求原 tuple 的历史标量，不作为可变 Skill 当前状态真相，也不阻止既有 Skill 删除：没有新 Skill FK；旧 0036 已让 Core Evidence.skill_id 随 Skill 删除 SET NULL。重放/读取必须 join 当前 Core Evidence，若原 Skill 已删除，返回 skillId=null、保留 receipt.requestedSkillId 原值；归档则保持原 skillId。Activity 已删除导致 receipt/Evidence 成组消失，此后同请求 404、不复活。auth 删除保持完整级联。必须在真实 PG 独立证明这些语义，而非只数 FK。

RPC 回执严格验证对象/own 字段/UUID/归属/Activity/请求 tuple/日期/实际 boolean replayed 与 verified===false/level===0/type 固定，不能用默认 mapper 或 Boolean('false') 吞缺失、NULL 或字符串。当前 skillId 仅允许 requestedSkillId 或合法删除后的 null；SQL 必须核对 Core/receipt 的 owner、Activity、固定 E0/false/type 以及 requestedSkillId 仍存在时不得无故丢失 skill 关联，不能仅相信传回的 null。createdAt/description 来自 Core，不拿 receipt 副本遮盖污染；错误回执 fail-closed，不伪报成功、不触发第二次写入。最少公开 `{submission:{requestId,activityId,requestedSkillId,evidence:{id,activityId,skillId,evidenceLevel,evidenceType,description,verified,createdAt}},replayed}`；数据库 owner 在仓库原始回执校验，不向外暴露他人标识。

所有日期回执仅接受有明确时区、可解析且UTF8≤40 bytes的ISO timestamp；不接受无限长度 Date.parse 宽松字符串。固定UUID/常量/布尔/键名及该日期界限共同支撑上述JSON上限；私有owner字段在公开投影前剔除。验收须实际 JSON.stringify 最坏ASCII controls/引号/反斜线/Unicode、HTTP16KiB合法输入及可直接调用SQL的8192byte正文，验证完整25项/50项可读且续页不丢，不只比较未经转义的字符数。

## 6. 用户界面与旧详情保留

仅 ready Activity 详情插入独立 EvidenceSubmissionPanel；原 GET/parser/raw/status/router/race/error 逻辑与原文区域逐字保留。原“这里只读取”说明须明确归属原文区，另列补证为用户操作，不使整页虚称永不写入；不内联 POST/RPC 到原 page。不开面板时保持旧详情恰一 GET。显式展开后才读本 Activity 材料/有界技能选择；关闭/路由切换/卸载 abort，旧响应不能覆盖新 Activity。

默认不关联 Skill；可选本人 active 技能，分页明确、标签有截断提示。输入为纯文字，显示 8192 UTF8 byte 上限与“待核实，不改变 XP/Mastery/奖励”。提交前用户能确认/取消。提交中的同项防连点，不禁其它页面；每次明确新提交生成 crypto.randomUUID，在未知网络结局/重试中保留同 key/同正文；编辑或另一次明确提交使用新 key，不能把旧 key 配新 tuple。

严格成功回执才显示“材料已保存，待核实”，完整正文可查看；保存后刷新失败与保存本身失败分开，保持成功 receipt 和重试读取选项、不为刷新再写。401 提示重新登录，404/409/400/413/500/网络故障有可恢复提示且不暴露底层信息。只在内存保留表单/key，禁 local/sessionStorage、cookie/secret 暴露、dangerouslySetInnerHTML、自动评估/确认/验证/跳转外链。

复用已有 tokens/组件语义，不改 globals/design-tokens/package/lock/config/workflow。控件真实原生 Tab 可达、44px target、无水平溢出、320/390/768/1440 宽度正常；md=48rem、正常 motion250ms/reduced0ms 和两图 camera 参数全部保持，不复改图。现有 Skill Evidence timeline 自动读到关联的 false/E0 记录并显示“未验证”；不为本切片修改 derived-state/技能树/知识图/结算，原成功结算 Evidence 仍保持原义。

## 7. 全部旧治理闭包，不伪造历史

helper 的 accepted52ba **完整 canonical 前缀**保留，只在末尾加独立新 selector/range/history/content 函数；旧 synthetic 参数、原 policies/violations/旧授权/source predicate 不变。新16 selector 在旧13/15/11/09分支之前，control 存在但 marker 不全时仍严格拒绝，不能因已有旧合同常驻而绕回旧 scope。实际 working/fullPR/currentmain 的完整35与合同 hash/祖先必须先重解绑定后才能任何历史读取。

旧9个 wrapper 的旧断言保持（activity/context/canvas/mobile/onboarding/dashboard/8F/rejection/visual）；只新增显式16 actual 分支与必要有界历史内容 adapter。当前35中的只有0054是新SQL例外；schema test只加 inventory 一行，不删原 policy/权限断言。不得跳过测试/缩小 discovery/伪造Git输出/改env/shim让差集假绿。

固定真实历史：Context32 为 `15f6287cd53d9049a2d6e60958cab40f75911405..52ba1378d355ccab26f12e7fdd3eedb8464deafe`；Reject25 为 `78d2036af19e55ea59f40cdc8a3358c3bab3cae4..15f6287cd53d9049a2d6e60958cab40f75911405`；更旧历史只接已有合法 anchors→固定78d，保留既有精确过滤。对 Context 自己的 actual32/保护SQL断言须在 strict16 通过后，以固定52ba端点证明旧范围，再由新35/0054权限实测证明当前；不能把新SQL隐藏在旧豁免里或把原测试变成仅“返回成功”。

历史内容只允许明确旧组：onboarding七条（现有 PROPOSAL_REJECTION_HISTORICAL_CONTENT）固定78d，activity三条（现有 ASSESSMENT_CONTEXT_ACTIVITY_CONTENT）固定15f，rejection仅 prompts.ts 固定15f；此外仅原 Activity page 的只读保护可使用 accepted52ba page 内容，但必须另有新测试逐字逆向去除唯一 panel import/插入后还原52ba、保持完整旧 UI/API tests。不得任意旧doc/source/blob投影。所有原 protected blobs、Demo fixture、旧 prompt/context/hash/0001..0053 仍实际受检。

新增治理测试必须独立反例：十九缺标记、额外source/SQL/deps/config/workflow/secret/docs、旧 scope 混入/duplicate/traversal、hash/read/ancestry/Git错误、空差集、PR多commit/currentmain/remoteahead真范围、content组错配、旧 assertions/prefix/protected blobs、snapshot历史不吞新35范围。

## 8. 实测、独审与临时资源回收

ADMISSION GO 后才写 production/0054；开始前读安装版本 Next 文档。先纯验证/SDK/RPC tuple/回执/API/UI 测试，再隔离合成 PostgreSQL+Auth/真实完成 build HTTP。绝不对54321写夹具、迁移或建立 synthetic user。每套栈有独立项目/workdir/四个原始 ID+Created/54331、54332 回执；DB访问串行授权，reviewer direct permanent release 与终态client census 后才由主 exact-owned disposal；旧未知服务/3018/共享node_modules/备份不清理、不全局 prune。

真实 PG 覆盖 auth前置/NULL/unknown keys/Unicode trim25/UTF8边界/SQL映射一致，三个 owner 有 populated Core（含XP500/Level4、Mastery、assessments、旧 verified Evidence）和 reward/Wishes/outer 基线；完整深比较所有既有表，创建只多本人 Evidence+receipt；重放/失败/读/异tuple无任何差异。包含 authenticated/anon/service_role broaden-grants+forgedflags+directhelper拒绝、foreign同形FK、rollback故障、并发samekey/same和differenttuple、archive/deleteSkill重放、Activity/auth级联/单删Core禁止、1000+材料/技能分页不遗漏不跨租户、显示pending不改技能成长。

真实完成build HTTP必须测试真Auth、owner/foreign/blank、GET/POST、headers、body超限、错误回执/安全错误、200 replay/201 create/409 conflict、旧Activity GET/raw/source保护和既有技能HTTP。浏览器合成用户真实打开详情→展开→选技能/写材料→确认→显示完整pending→Skill timeline→重试/refreshfail/登录过期；四宽度原生Tab/44px/溢出及零错误；保留原13步历史，当前整站最终13步仍另验。不调用真实AI为此入口添分。

主完整 PG 回归、deterministic harness、E2E、typecheck/lint/build 必须终态exit0且记录实际文件/断言/skip区别与原始机器证据。所有失败保留为历史，修复后的production使旧build/full/browser绑定失效，必须重验。fresh Risk2 候选独审必须自执行可复现关键反例及授权真实DB，不只相信主日志；PASS只绑定冻结35字节及精确base/tree/BUILD_ID，不是committed FINAL。

流程仍为实现→真实测试→fresh独立候选GO→selected35 commit/push→own exact-head CI→不同fresh committed FINAL→仅普通保护分支允许的merge→post-main CI→新本机预览验收→精确缓存清理。无需用户再手动创建/合并PR，但不force/admin绕过或删除branch，不公开deploy。不为收尾修改已绑定合同或假称当前website已全部完成。正式DB应用0054另须当前备份/恢复演练/审批记录及迁移门禁；此合同不是正式DB立即升级授权。

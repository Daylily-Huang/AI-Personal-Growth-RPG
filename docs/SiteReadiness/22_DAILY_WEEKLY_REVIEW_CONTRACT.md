# 22 — Daily / Weekly Review 本地补齐控制

状态：待独立 Risk2 ADMISSION；不是实现、验收、提交、合并、发布或整站完成。

## 1. 接受基线与权限

基线 main/HEAD `69978e833bf0af7444f1eda92f573b0b479ba3e0`，tree `44f5aa8607569e1d28dfc22c39ed9b5e3ed9b6b1`。正式0056已完成，本阶段不新增迁移，不重复0056，不向正式库写测试数据，不公开部署。依据01§40–41、02§35–36、03§107、04§10、05§11补原有Daily/Weekly；Monthly按03后置。旧手动WEEKLY/AD_HOC/FINAL入口和RPC保留。

## 2. EXACT42 / ALL23

以下首个text块是唯一完整修改白名单，42路径必须全部出现且无重复/额外路径。23必备标记为本22、02、03、12 production与8新增tests；缺任一标记不得借旧控制文件存在而回退授权。最终文档只追加过程/结论，不覆盖历史失败。

```text
docs/Design ChatGPT/02_PRODUCT_DESIGN.md
docs/Design ChatGPT/03_TECHNICAL_IMPLEMENTATION.md
docs/MASTER_PROJECT_HANDOFF.md
docs/SiteReadiness/22_DAILY_WEEKLY_REVIEW_CONTRACT.md
docs/SiteReadiness/23_DAILY_WEEKLY_REVIEW_VERIFICATION.md
findings.md
progress.md
task_plan.md
src/lib/review-insights/types.ts
src/lib/review-insights/validation.ts
src/lib/review-insights/summary.ts
src/lib/review-insights/repository.ts
src/lib/review-insights/request.ts
src/lib/review-insights/ai.ts
src/lib/review-insights/http.ts
src/lib/review-insights/client.ts
src/components/journey/ReviewInsightsPanel.tsx
src/components/journey/ReviewsClient.tsx
src/app/api/reviews/summary/route.ts
src/app/api/reviews/analyze/route.ts
tests/review-insights-validation.test.ts
tests/review-insights-summary.test.ts
tests/review-insights-repository.test.ts
tests/review-insights-ai.test.ts
tests/review-insights-api.test.ts
tests/review-insights-ui.test.tsx
tests/review-insights-http.test.ts
tests/review-insights-governance.test.ts
tests/helpers/governance-delta.ts
tests/activity-detail-governance.test.ts
tests/assessment-context-governance.test.ts
tests/evidence-submission-governance.test.ts
tests/graph-canvas-governance.test.ts
tests/graph-mobile-governance.test.ts
tests/onboarding-governance.test.ts
tests/phase8f-ui-governance.test.ts
tests/proposal-rejection-governance.test.ts
tests/proposal-edit-governance.test.ts
tests/visual-foundation.test.ts
tests/phase5-dashboard-ui.test.tsx
tests/stage7c-ui.test.tsx
tests/artifact-acceptance-governance.test.ts
```

## 3. 客观摘要，不重算成长

仅request-scoped publishable/cookie客户端先auth.getUser，RLS与显式user_id双隔离。新GET /api/reviews/summary 与POST /api/reviews/analyze；无service-role、Demo/mock降级、RPC/insert/update/delete。输入仅mode(DAILY/WEEKLY)、ISO start/end、IANA timezone；严格plain own data/未知字段/重复query/getter/prototype拒绝。区间[start,end)，Daily最长26小时，Weekly最长8天，end不得晚于服务端now，start<end；timezone是明确显示标签，不偷偷改变请求区间。日期控件按用户本地时区构造当天或周一至今；历史窗口止于下一日/周的本地边界，DST不可按固定24小时平移。

查询实际activities、xp_transactions、mastery_events、skills、knowledge_nodes、artifacts、quests、domains、journal_entries九源；0045实际状态字段在journal_entries，不存在state_snapshots表。状态只展示本期最新logged_at且至少一项状态非NULL的用户自评，明确非当前实时/医学判定；无记录显示未知，不发送journal正文。其余事件时间为created_at，XP按入账时间而非活动开始时间；技能/领域/主线显示当前状态，不谎称历史快照。每表id升序keyset，page200，最多10000行/表；检测10001行则标记该源truncated，不完整时禁止AI请求。owner、UUID、数值、状态、日期及游标顺序/重复均严格验证，数据库失败不当空数组。asOf与每源scanned/complete及多查询非原子快照边界随响应显示；并发写入/后续编辑可能使关联缺失，明确unknown，不补造数据。

XP只对本期xp_transactions.amount有符号求和，同时区分activity/adjustment/correction、技能与领域分布、重复次数/折减。Artifact首次100是Wish credits，绝不计XP。Mastery仅列本期mastery_events的from/to/event_type与source；不得把skills当前缓存当本期升级。新增技能、知识节点与Artifact按各自创建时间；节点inferred/verified和作品active/draft/archived等状态明确区分，不能把创建/手动验收当独立验证。主线只列current progress，期间变化unknown；低价值时间、刷分、真实突破、偏科、休息需求均非确定事实，不用分钟推导XP或能力。无数据有明确空态，不捏造成长。

## 4. AI分析与确认边界

只有用户明确点击“生成AI复盘”才POST并调用provider；GET、打开页、切换日期或模式绝不自动调用。POST重新从服务器读取本人摘要，不接受客户端提交facts/XP/owner/模型参数。GET和POST仅私有响应Cache-Control private,no-store / Vary Cookie；auth先于parse/DB/provider；错误只白名单中文安全文案，无数据库/上游payload、密钥、原文、stack。

新增独立review prompt版本daily-weekly-review-v1、严格结构schema与适配器；旧assessment prompts/config/模型schema/结算全部原样。复用现有效AI环境配置但不传给浏览器；独立OpenAI client timeout60000ms、maxRetries0、max_tokens2048；request body最多2048UTF8 bytes、prompt含摘要最多16384UTF8 bytes、上游文本最多16384UTF8 bytes。数字仅资源/展示预算，不是成长阈值；大摘要以确定性筛选前20条/类、每标题160字、描述不发送的方式降采样，显式sampled/count/遗漏提示，不能把采样当全量分析。账本精确总额/分类/coverage不得截断。超预算/不完整/无期内事件拒绝provider，摘要仍可读；超时/abort/缺配置/无效JSON/非stop/模型不匹配安全失败，绝无mock成功。

输出明确为AI推断：overview、最大成长/突破/产物/知识链、主要问题、偏科与任务效率、XP膨胀/重复刷分风险、Mastery虚高风险、休息与不确定性、明日/下周行动及1–3机制调整。各项有supportingIds且必须属于本次实际送给模型的source refs；资料不足必须说未知，不能造事实/UUID。模型confidence仅推断置信度，不是Core Evidence/Mastery Confidence。严禁建议新增XP/修改Mastery或声称已执行。纯文本渲染，不执行HTML/Markdown链接，不发出模型指定网络/工具请求。provider只读摘要中的虚构测试数据做真实验收，不将用户旧原文外发。

可显式“采用为手动复盘草稿”：仅填反思/调整/期间和带明确USER_CONFIRMED_NOTE标签的客观附注；无ACTIVE Season时禁用并解释，但Daily/Weekly查看和分析仍可用。采用不是保存，用户必须再选择ACTIVE Season并点旧保存按钮；Daily草稿使用原AD_HOC类型并保留DAILY provenance附注，不扩旧DB枚举。用户手动改笔记可自由；附注不能被当成Core真值/认证结果。FINAL修订逻辑不受影响。换期/请求失败/abort不得采用旧分析，旧手动编辑须清除之前摘要附注，防串期。

## 5. 治理：当前先严格，再真实历史投影

helper accepted699全文前缀保持，仅append本阶段。新23/all42、控制canonical SHA、HEAD/remote/accepted ancestry/working+untracked/fullPR/main firstparent均fail-closed，每次调用前后漂移拒绝，无跨调用缓存。合并主分支首parent必须699；原显式execute/readControl/readFixture合成反例仍进入原逻辑，不能被适配绕过。

13旧tests只允许顶部独立import/alias/wrapper与visual/8F最前新范围选择；新tests必须逐份逆向还原699完整全文/全部断言/modelbody/timeout。需要历史readFile时仅对这13个已修改旧test及helper精确路径从真实accepted699 Git blob读（必须先完整验证当前42），不猴补全局fs，不伪造当前test通过。旧Artifact校验在真实5168..699完整46/控制20/两个原fixture上重新运行，历史工作端点明确699、remote5168，累计78与旧53等保持；这是immutable历史回归而非当前授权。新当前治理测试独立覆盖42/all23/missing每个路径/额外混入/Git失败/漂移/current-main/fullPR及历史路径内容边界。旧20单独存在不授权本阶段。旧0001–0056、成长引擎、旧AI评估、Core/RLS/ledger、奖励v1与manual100、AppShell/navigation/graph/44px/md48rem/250ms/0motion/旧7protected blobs全部无生产delta。

## 6. 验收与清理

ADMISSION GO后实施。确定性测试覆盖DST/leap/date/空态/正负XP/多技能/重复/微秒时间/1000+分页/10000cap/跨owner/畸形receipt/采样/AI无自动调用和错误/原型安全/abort/stale/手动草稿及旧FINAL保持。真实completed-build HTTP/Auth/RLS和三owner全Core前后快照证明新读/分析/采用不产生永久写入；真实provider+Chrome验证Daily/Weekly、完整空/错/加载/键盘/移动端44px及旧保存确认。全套、harness、lint/type/build、secret扫描及新独立Risk2 candidate GO→selected42commit→own exact-headCI→不同fresh committedFINAL→ordinaryPR/merge/postCI。最新本机preview/launcher重新绑定后再完成整站需求审计，不能用旧13/4358代替新功能验收。

唯一新合成栈，先精确容器ID/Created/project/workdir/port归属，再独占DB_ACCESS_GRANTED，双方terminal与独审直接永久release后仅主清理；保留正式0056库、全部完整备份、共享deps、root四用户文件及旧冻结53/46。不全局prune、不删未知进程/VHD；只删已不再引用的本任务测试build/cache/worktree，保存每次失败、unknownexit、NO-GO和清理receipt。

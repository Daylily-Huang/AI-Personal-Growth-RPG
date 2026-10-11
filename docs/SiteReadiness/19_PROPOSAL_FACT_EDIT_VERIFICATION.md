# 19 — 事实修正与 AI 重评验证记录

当前：实现进行中。不是候选 GO、committed FINAL、合并、正式0055应用或整站完成记录。

## 已批准的边界

用户选择事实修正后由AI重新评估，不直接改评分。acceptedbase `229c09f122d3f0cb31fd02ff3ade53b27d06566d`，tree `ae8316f16cab5e9ad13005bef135ee552197531a`。18经James fresh Risk2纠正准入 P0/P1/P2=0 GO，仅设计；全文26652bytes、raw/canonical SHA256 `BF9CFA5BC25677A75489C6B0DD7238221ABB44F0A9FB290E83E5C8ADCBCC1019`，获准后不得改正文。

原草案hash134268...3FE2的NO-GO（P1=3/P2=1：输出预算、terminal replay、Activity历史入口、SQL误称cap）保留。最终明确EXACT52/21production/10newtests/12oldtests-helper/9docs/35markers、新model/receipt上限、先existing-keyreplay、独立Activity只读历史route、新revision显式delta guard与旧0042 fallback完整保留。独审源码/内存设计证据不是实现或真实PG证明。

## 首段实现与主验证

新增纯types/validation及对应测试。输入只有requestId和facts（描述、两种分钟、相关技能UUID线索），拒绝用户评分/owner/规则/状态/额外键，检查原生数据描述符、Unicode/UTF8、分钟一致性、0..5有序唯一UUID、edit/history不同ID类型下的有界query。没有API/SQL/AI或正式数据写入。

主Linux Vitest4.1.10实际65/65，1file、0fail/0skip，terminal exit0，duration1.74s，tool a26140；调用程序结束时显式close。只针对本次已写纯校验，不算全套回归/独审候选。主全项目TypeScript noEmit/incremental=false exit0（88acc5），三个新文件ESLint exit0（04cefb）。新测试cache=false，task缓存目录不存在（484994）；未安装依赖、未建立临时数据库栈。

首Windows测试启动因Rolldown native binding缺失而失败（2bb073，尚未跑测试）；复用已有Linux依赖完成，不删除/重装任何node_modules。过程错误保留，不把首次失败算通过或产品缺陷。

## 第二段实现：认证、回执、请求编排与 HTTP 基础

新增 request/repository/service/http，扩展 types/validation；目前共6个新production文件、3个新测试文件及18/19两份记录，working11个untracked，accepted tracked文件仍零变更。这里不是最终EXACT52候选，不启动尚未实现的SQL0055 RPC。四个RPC适配器名字现固定为 rpc_begin_proposal_fact_edit / rpc_read_proposal_fact_edit / rpc_complete_proposal_fact_edit / rpc_fail_proposal_fact_edit，后续SQL必须对应；实际PG函数尚不存在于本切片。

request factory每次使用请求cookie客户端和auth.getUser；无session、配置失败、基础设施错误、畸形owner均安全拒绝，service client只在认证后按需构造。repository begin/read仅使用用户客户端，complete/fail才用lazy service client，所有RPC显式retry(false)。使用实际installed Supabase SDK、注入无网络fetch，核验单次精确RPC tuple/权限客户端分离、状态/owner/UUID/事实/嵌套结果校验、已Confirm/Reject后的completed重放、503/520及断网不隐藏重试。

service仅接受持久dispatch=true才调用一次注入evaluator；已有所有五状态不重派，begin/complete/fail结果不明只同key读一次；不以fail覆盖不明complete、不换key、不接管租约。模型参数是独立冻结facts副本，模型失败只发固定安全code；原Activity、XP、数据库锁序仍必须由后续0055实测承担，当前mock port不是DB并发证据。API命名测试当前只覆盖认证factory/编排/实际NextResponse与流式HTTP基础，**还没有edit route接线或真实HTTP服务验收**。

新回执对缺失/null status、实际boolean、原始owner、期限180s、revision/result/route tuple、规则与模型标签、proposal/confidence、日期时区及微秒边界均严格检查，投影后去owner。新model adapter保留旧schema，只增加pure JSON/65536UTF8预算，拒绝getter/toJSON/cycle/非法数值/Unicode；另补actual schema会丢literal __proto__ metadata的detached JSON保留，不改旧AI文件。HTTP最多16384真实bytes/fatalUTF8、Host/Origin与16一致、POST禁query、Map错误/private-no-store/VaryCookie、202 Retry-After3及终态安全响应；完整响应按JSON编码UTF8有界。

主最终Linux Vitest实际3files **223/223、0fail/0skip**（validation113 + repository45 + API基础65），start15:52:15 CST、duration6.94s，526d47/session84245→ecbec7 terminal exit0并ctx.close。全项目TypeScript noEmit/incremental=false b68aa6 exit0；全部6新production/3新tests ESLint055a3b exit0。cache=false，f79069确认taskcache不存在；未安装依赖/构建/启新服务器/数据库或模型调用，无task DB栈需清理。

失败历史保留：首轮85d1ef TS因ES2017不支持BigInt literal三处失败；改BigInt()构造、不改tsconfig后闭合。首测78b55d/session88902→e7aaf6 terminal1，3files190中189pass/1fail，合法metadata __proto__字段丢失；按上述detached JSON保留修复，4ad4a0/session84844→e90c9c先220/220通过，补SDK503/520/network三例后最终223。这些不算独审GO。只读路径猜测失败（旧assessment/proposal-rejection/mock-assessment/mutation-origin/Postgrest顶层路径、checkout Windows node_modules）、LiteralPath wildcard hash错误均未造成写入；实际路径用rg找到，installed Next指南完整读取。root四保护文件最终hash与前一轮完全相同；18仍冻结BF9CFA...C1019，3019、正式0054和完整备份不动。

当前source/tests raw SHA256（不是最终冻结manifest）：

```text
src/lib/proposal-edit/http.ts BD8DF0C03868BC3C280F0BC15FD0D2419822BBA1A3CD777EA8F4FA21F1D8C25E
src/lib/proposal-edit/repository.ts A07A38551A36BDC19B533AD149B7FA1BD5A0E1DFD6A543855784BC60B386FE0D
src/lib/proposal-edit/request.ts D57131B8B530144E4CF788A13B79E609FA9148FC8FFBEB08B3561C77ED5B5E5A
src/lib/proposal-edit/service.ts 97B5D8B03C4EA24F59C0BE3A8FEC3D77F7D765B5D78644EF77B569A7D7C3C12A
src/lib/proposal-edit/types.ts 13EADC422F94DB5F0486B9AB23F3C82270BFA4886411760E0B01B37C34523940
src/lib/proposal-edit/validation.ts 4E1BF676ADFEBECD3826145F6BA383553E485DB64897065B84B22BD26E65506D
tests/proposal-edit-api.test.ts A044A56F923E0717675AF03A7506DFA116650E2C7BB915A4B8844CA59FA981AD
tests/proposal-edit-repository.test.ts C5932272E17E0E951793D195EA880168481FEA17E394AD68FDA434F4E46D87A1
tests/proposal-edit-validation.test.ts BD9E668342F7FADBE968A4BFDDDAAAF59DB3EFF83A87D61EB66DAE9CB30EDB67
```

## 第三段实现：SQL0055、真实权限与并发（主验证，不是独审 GO）

新0055只创建 proposal_fact_edit_requests / proposal_fact_revisions 两表，并给既有 ai_assessments 增加 owner/id 唯一键。不可变facts、owner复合FK/线性链、180秒状态、每Activity单个in_progress、真实角色/调用身份guard、独立RLS/SELECT与API角色helper禁EXECUTE均已实现。begin/read对应用户权限，complete/fail为service权限，read是SECURITY INVOKER，只读不修复过期；既有key优先重放，不重验当前Skill归档或后来的Confirm/Reject状态。

只替换0021 record_ai_assessment与0042 settle_activity，增加同namespace Activity gate及精确新revision审计guard；测试删除新增标记块后，两份旧函数全文body逐字恢复。原Activity事实与时间、旧结算全部算法/Artifact分支/Quest fallback不改。新revision Confirm要求root与ledger modifier共同携带factRevisionId/factEffectiveMinutes，Quest显式delta必须与冻结TS一致；未关联Quest不能偷偷增加delta。SQL使用double而非decimal round，10007个completion输入及null/0/边界分钟与实际 calculateQuestProgressDelta 逐项相符。

WSL Docker29.1.3正常，Windows默认npipe不可用不代表引擎坏；未升级/重置Docker或启动第二引擎。仅新建 phase8f_test_edit_20261011，workdir /mnt/d/AI_Personal_Growth_RPG/.data/proposal-edit-stack，API54331/DB54332。creation记录四组件完整ID/Created/project/workdir/ports，旧11个运行网站容器不动；0055已在此合成PostgreSQL安装，**不是正式数据库应用**。主4f0aa1将当前SQL的19个实际prosrc/owner/search_path逐项绑定，17new+2old，SQL rawSHA256 `59A4789CE379BE3EC7875316252841CA4B3AF9D69B129A81DD1ADA65BD4C2C06`；重载settle仅同步删去的新增空行，未改算法。

新增authority45项（3static+42live）与concurrency9项。三owner分别已有Skill XP500/Level4/M8、playerXP500/Level4、旧Activity/assessment/ledger、Evidence3、Quest奖励、Wish与OuterLoop provenance；对36个既有user_id表逐表snapshot，Edit与读取只允许AI旧status/新增AI以及新两表发生规定变化。这里没有宣称global表或整站完整fixture覆盖。包含raw NULL/缺字段/越界/外国owner、独立SQL模型校验、嵌套metadata __proto__、broadened grants+伪造GUC下三角色insert/update/delete/truncate/helper拒绝、纯GET不关闭过期、独立新POST关闭旧租约、删除AI审计保护/真Activity和零ledger用户cascade。已有XP ledger禁止删除有账本用户是冻结旧规则，不为本功能放宽。

九项真实并发显式观察pg_locks等待：同key同tuple、同key不同facts、同key跨Activity、不同key同Activity、重复finalize、legacy record、Confirm先赢、finalize先赢、旧单行Reject CAS先赢。所有竞争promise立即绑定成功/失败handler，零unhandled；Confirm先赢仅一笔账本，后finalize冲突；finalize先赢旧Confirm不得结算。新revision普通Confirm（有/无Quest）另实测错误分钟/ledger审计/delta拒绝、正确回执结算50、原raw/effective_minutes120不回写；这里50是受控RPC测试载荷，不冒称实际TS Growth Engine已经接线。

最终主 8ce252/session46313→32f1ea terminal0：**5files277/277、0fail/skip/unhandled**（原223+authority45+concurrency9），2026-10-11T08:26:23.985Z开始，ctx.close、所有PG peer/end均完成。原始JSON `.data/proposal-edit-authority-v9.json` rawSHA256 `3D4DF0956C7CCB4A1682DBD0BF8A6BD7FC7E5DB8296102EDD773DAC5065B81AB`。54新测试此前db8a19/session32350→9b54f4已终态0；TypeScript caa0ef及67ac75终态0、两新tests ESLint ecf828终态0；c6fe11最终无诊断，feature tracked仍零变更、当前14untracked，不是最终52候选。

失败历史：a4c55c首39中2pass/37fail及01fc45重跑同结果，fixture domains复用uuid/text参数产生42P08，另旧settle逆向多一个新增空行；分别修fixture参数及删新增空行，不放宽全文断言。a07b7c其后39/39。b60650新增45中42pass/3fail：Confirm fixture漏传Evidence沿用旧默认1、误将有immutable XP ledger用户当可删；先0951eb43/45，再补与真实service一致Evidence0及独立零ledger cascade fixture后a0f12745/45。3b6574/session4414→a436bd53/54：Reject fixture误用authenticated，真实旧service使用admin单行CAS；只修fixture为service_role并带完整id/owner/Activity/pending谓词，db8a19随后54/54。SQL bind首次237f24因CommonJS import Client不是constructor，在connect前失败，改require后4f0aa1通过；这些不是新增产品缺陷或独审。两环境路径/Windows literal wildcard/错误cwd探测与首次rg过宽展示截断均未造成正式写入；后用实际路径与结构化小结果纠正。

清理：191d56/session73342→0fe557 terminal0，创建receipt逐ID/Created/labels/ports重新核验后stop --no-backup，仅删本轮4containers和1卷 supabase_db_phase8f_test_edit_20261011；taskcontainers0/volumes0，nonTaskInventoryUnchanged=true，taskcache不存在。被删仅合成fixture，不可恢复、不包含用户数据；保留小型测试/创建/清理凭证、源码、共享依赖、3019预览、正式0054与备份。没有独立reviewer/commit/GitHub写/模型网络请求/正式0055操作。

本段只是数据库基础的主验证：仍缺私有facts/skills/history读取适配、store新revision分钟覆盖和旧assess模型前guard、context/AI/routes/UI及全套验收；不能把当前SQL或上述测试当作可单独部署的完整功能。

新增测试raw SHA256：authority `CE3E5E598B6D3B208AF8D15388C1A45532C475CCBB85A91D1387F36C0B2EE75B`；concurrency `F337898EE21AA6832C4D74F113FF2A711EC0520BDFAC0FCE8219143ED0DF0A86`。

## 第四段：私有读取、Confirm 覆盖与 GET 接线（主离线，非候选 GO）

本段继续在 accepted229c09f 开发副本实现：严格 raw revision/request 双 owner、tuple、completed、180s期限、日期与规则验证；只有真实空数组表示没有revision，缺schema/网络/错误回执都失败关闭。Supabase新可选端口提供revision读与旧assess预检，Demo不增加端口。实际SettlementService只覆盖原成长引擎与Quest计算的effectiveMinutes，保留原Activity/raw reason；新revision ID/分钟同时写入settlement root和ledger审计。描述、总时长、技能线索不直接成为成长权威。

新增 GET `/api/assessments/[id]/edit` 的facts/skills/request与ActivityID历史GET：认证先于path/query，request读取五状态不重新派发AI；facts/skills/history均用同request RLS client、owner过滤、严格原始行校验，无admin读取或AI JSON读取。技能50+51与历史25+26按UUID升序、有界游标；name200 codepoints并标截断，原文8192UTF8投影不改真值。固定JSON编码响应预算分别128KiB/80KiB/1536KiB，private/no-store/Vary Cookie；历史不错误套用128KiB。旧assess实际路由在context/AI前进行只读guard，SQL竞争固定冲突安全409；普通旧路径及Demo保留。

主离线现有Linux依赖/config=false/cache=false，最终 session40436→0f9164 terminal0：**5files335/335、0fail/skip/unhandled**，validation113、repository96、API107、旧settlement8、原Growth11。原Growth11实际运行，但没有伪称运行pnpm harness命令。新实际SDK假fetch读测试、真实SettlementService/Growth分钟null/0/1/9/11/35/1440与Quest/审计测试、实际Next GET和旧assess route测试均为离线证据，不是完成buildHTTP/实PG验证。最终报告 `.data/proposal-edit-offline-v4.json` SHA256 `87268A3A26BD8F4C2D914B4442F8276E8851680432ACA048B7F7BBDC6333F355`，42ad0a实际严格解析5文件全部335assertions passed。full TypeScript 83fe19 exit0、scoped ESLint 1a2a05 exit0、feature diff--check0。

旧五文件逆向自检42ad0a：仅删除标记新增块并恢复两个effectiveMinutes表达式，与accepted229c09f逐字canonical全文一致（repository/types/supabase-repository/settlement.service/旧assess route），不放宽或跑旧快照替身。原18 raw BF9CFA...C1019、SQL0055 raw59A478...C06及root四受保护hash保持。最终52/35markers治理、生产来源独审仍未完成，不以本自检替代Risk2。

历史保留：v1最初5files293/293报告已严格解析，但原exec65377句柄过期后不能重新取terminal，不能把取回失败说成原运行失败；v2 session94024→1ec057 terminal0 329/329。随后旧assess新夹具v3 session50405→973a6c terminal1，333pass/2fail，原因是原测试UUID的version/variant不符合旧v1 z.uuid，改为实际合法UUID后原断言不放宽，v4全335通过。首次新增auth-before-parse getter夹具返回类型被推断void导致TS2345，补Promise返回注解后TS0。首次逆向发现新Supabase/read块各多一空行，删除新增空行后五全文相等。PowerShell brace glob解析错误、Windows rg字面wildcard与一次root误读19 ENOENT仅工具错误，后均改实际路径/范围；不报产品缺陷或隐去历史。

清理与边界：272611 Docker只读查询旧task project相关容器/卷均无，cache目录absent；本段没有启动新DB/HTTP/AI/浏览器或生成build，没有可删的新合成栈/缓存。保留小型raw报告与自检runner，不清共享依赖/正式数据/备份/3019预览。新GET实现不代表POST/context/AI/UI已完成；原277仅历史SQL基础证据，代码更新后仍需新完成build全栈/全套/Chrome/独审，不提交、不PR、不合并，不应用正式0055。

## 第五段：v0.4-facts context / AI / POST（主离线，非独审或真实 AI 验收）

新context通过同request RLS client核验base pending、原Activity两个raw owner/IDs/rules/status，单独读取0..5本人active技能线索；按用户线索顺序映射并标记200-codepoint名称截断，缺失/foreign/archived/NULL/重复/错ID失败关闭。旧loadAssessmentContext源码全文不改，继续按原始完整raw选取v1的技能/近期样本；再次核验返回原文/Activity/rules与原始读取一致，再仅投影8192UTF8原文到模型。不会把修正线索当完整历史或永久成长目标。

新messages复用旧输出shape与边界，只发送一次原文块、完整修正facts、原文v1上下文和服务端线索；明确user_claim、original-context范围、Mastery既有状态、primary100%/secondary0、1.00..1.15时间因子、30天稳定ID重复、M>=5或跳>=2需verification、Artifact双延期与现实零积分。发送前重新严格校验注入context，再按完整messages JSON.stringify UTF8≤131072bytes检查，包含system文本及JSON转义，不按字符数。实际最坏原文8192controls+修正8192controls+五200-codepoint controls线索的完整messages实测通过预算。

新OpenAI兼容adapter只用既有server环境配置，不修改provider/secret/旧AI文件；temperature0、maxRetries0、timeout60000ms，无Demo/输入或upstream日志。模型原始content先检查65536UTF8/Unicode再JSON.parse，继续原schema与独立compact纯JSON预算/256byte模型标签。实际SDK的429/500/503各一次请求不重试，真实SDK AbortSignal+60000ms fake-clock超时一次调用安全失败；这些请求全部命中测试自己的synthetic fetch，**没有真实模型网络或费用**。

POST `/api/assessments/[id]/edit`已接实际request factory、来源/UTF8流式输入、service、lazy context/evaluator与持久结果响应。auth-before-headers/path/body，已有五状态key不加载context或调用模型；unknown begin/commit只同key读一次，不盲重发或fail覆盖不明commit；context/model失败只记录安全fail，原pending由SQL authority保护。客户端取消不传递为数据库回滚保证。该POST尚未接用户UI，也未完成build/真实HTTP验收。

最终主离线 session28163→a6172b terminal0：**7files407/407、0fail/skip/unhandled**；validation113、repository96、API125、context29、golden/actual-SDK25、旧settlement8、原Growth11。raw `.data/proposal-edit-offline-v7.json` SHA256 `A38C0355DF94EC5FACDCCBE39D2B01473D1CF644C762ABCDA40320E31BAABA21`，ca4610实际解析并核对全部assertions passed。full TypeScript abbd0c exit0；scoped ESLint d40f7a `--max-warnings 0` exit0；feature diff--check e38777 exit0。当前package确无harness:llm:golden，因此只称实际新golden/adapter离线测试，未编造harness运行或LLM语义验收。实际Growth11在同run中通过，不伪称pnpm harness命令执行。

历史保留：v5 session84096→2774b9 terminal1，406pass/1fail/0unhandled；夹具将lone surrogate写入process.env时OS转为合法replacement字符，故未能模拟所声称非法Unicode，非产品缺陷。替换成真实86中文字符/258UTF8bytes超256模型label，原“zero SDK”断言不弱化；非法Unicode本身仍由实际proposal parser测试覆盖。v6 session8658→73f960 terminal0 407/407；改schema引用统一既有5/200常量后最终v7复跑407全通过。9b3c9f lint首次两个未用fixture变量warning，改为显式字段映射后最终零警告。技能source/status和旧v1独立只读校验未被mock绕过；AI transport fixtures与路由evaluator mock仍明确不是实际模型。

ca4610再验五旧文件逆向全文恢复、18/0055/root四hash保持；tracked仍仅原五，当前working+untracked共25路径（目标最终52，不能冒称完整候选）。本段没有正式0055/DB/浏览器/真实AI/新build/commit/PR/merge，task cache absent、新feature .next absent，无新的可删合成环境或缓存。保留小型测试报告与runner、原正式0054/3019/共享依赖和备份。后续编辑表单/客户端严格回执与有限轮询/历史面板、52治理、fresh全栈/全套/Chrome/Risk2仍必须完成；本记录不签候选GO。

## 第六段：浏览器 client / Editor / History 接线（主定向，非整站完成）

新增client严格校验owner已剔除的公开DTO：base/Activity/request/facts/各UUID、实际boolean、日期/期限、完整revision与模型/规则/provenance、固定字段与分页单调性；公开request复用原严格core但明确owner=null模式，**不伪造owner，也不把浏览器投影当服务器owner证明**。原服务器owner模式继续必须核验真实owner，原113验证断言保留并复跑。成功结果只认可completed与200/replayed或201/非replayed一致；GET绝不认可201。202与终态绑定原requestID；generic502/不明成功/网络错误只能unknown，不伪装已failed或盲重调AI。成功正文先实际bytes/fatalUTF8有界读取，超界取消stream，错误正文不显示；POST16384编码bytes先检查。客户端不导入server/admin/AI模块。

PendingProposals只接独立editor/按钮与本项锁；原Confirm/Reject/Artifact流程保留，其他项仍可确认。Editor原始事实独列、不覆盖；描述与0..1440整数/nullable分钟、最多5线索、技能50分页、原生label/textarea/number/checkbox与44px控件；不新增评分输入。初始化并行两读共用owned controller，任一失败abort另一路；关闭/id键切换/卸载清理owned读/提交等待。facts/key/result仅内存，unknown冻结原facts/key、仅显式同keyGET；新尝试须明确点击，已知输入拒绝不虚构持久request。首次202最多20GET/60s含挂起读的timeout，手动核实仅一次GET不自动重开poll。取消始终明示不保证服务器回滚。

成功receipt与刷新分开：旧item立即retired不可再Confirm/Reject，刷新失败仍可关闭/重开查看回执，不再POST。无shell刷新不能伪称成功。关闭editor原生focus回到该按钮。Activity详情仅加默认关闭的独立History，关闭时无额外GET；打开按ActivityID读取25项页、完整事实/分钟/技能UUID/请求与前版本/状态中文/三种来源标签，不返回AI JSON。Evidence面板与原始输入/原GET/error行为保留。

最终主 session46221→af5135 terminal0：**8files461/461、0fail/skip/unhandled**；validation113、repository96、API163、context29、golden25、UI16、旧settlement8、Growth11。raw `.data/proposal-edit-offline-v10.json` SHA256 `996EBED44F119ED1EE13CBE3738757B334A2A9979F84F7EFDE0CAA054D53091A`，e189f8实际严格解析全部assertions passed。abe2c8 full TypeScript exit0、068136 scoped ESLint max-warnings0 exit0，31aece diff--check0。新增actual React测试包含本项互斥/另一项可Confirm/native焦点返回/未知同key/重击一次/refresh失败回执/60s停止/原GET零新增/分钟交叉错误；不是Chrome几何或完整业务验收。

UI16中两例是**真实native fetch + owned本机loopback HTTP socket**，分别让facts与skills分支在两条连接都已建立后失败，实际client/React cleanup关闭另一个仍挂起的response/socket，两个方向均通过。测试只起自己的127.0.0.1 ephemeral server，无DB/Next build/AI请求；每例finally仅closeAllConnections+close本例server，测试runner终态ctx.close；不是mock AbortSignal就自称socket已关闭，更不称完成buildHTTP通过。

历史保留：首次v8 session26789→652baa terminal1，457pass/1fail/0unhandled：取消兄弟请求夹具将skills第3参数after误当signal（实际第4），修为真实签名后原“兄弟实际abort”断言不弱化，再新增双向native socket验证。v9 session83897→6c6251 terminal0 460/460；加分钟交叉中文提示后v10最终461。3816b0两个ref-cleanup warning，捕获实际Set解决；e0ee35未用within import warning删该import，最终零warning。没有由这些夹具或lint错误推断产品GO；原失败report不覆盖。

e189f8七旧source（新增PendingProposals/Activity page）剥离显式新标记块、恢复两分钟表达式和本项busy扩展后，与accepted229c09f canonical全文逐字相同；root四/18/0055 hash保持。当前working+untracked共31路径，合同21production路径存在且已接线，**不等于完整52路径/35markers或实现验收GO**。尚无commit/PR/独审/正式0055/新build/真实AI；taskcache absent，未新起DB栈，原0054/3019/备份/共享依赖保留。本轮仅task HTTP server在测试finally关闭，未清全局缓存或其他服务。

## 完整范围与历史治理主回归：941 + 461（仍非候选 GO）

本段完成52路径/35markers接入：accepted229c helper完整canonical前缀不改，末尾追加18 selector/working/fullPR/正向current-main firstparent/固定history/content。12旧测试/helper仅增加显式18真实分支及有界适配，旧synthetic入口不借新授权；先实际52/35/合同hash/祖先/Git范围，再Evidence35/Context32/Reject25及原图/guide/detail/main历史完整断言。新tests主动攻击35 missing、额外/重复/路径穿越/旧scope混入、坏hash/read/祖先/Git错误/空范围/remoteahead/多commitPR/currentmain父错配、精确内容组端点；七旧production逆向全文恢复accepted229c，旧54SQL、实际成长四源及全部milestone服务器/API源码保护。

主最终governance v2 session28962→e0f261终态exit0：12真实testResults / 941 assertions全passed，0skip/fail/todo/unhandled。原始`.data/proposal-edit-governance-v2.json` SHA256 `98DB574C8C7EF53B9FF23F378037D99CD01032D389494BAC2ABD72F868897850`。selected旧文件导入visual/8F会在对应文件重复收集其describe；941为本次实际执行断言，不能冒称941独立测试定义或整个项目全套。

主定向v11 session39592→076661终态exit0：8files461/461、0skip/unhandled，raw SHA256 `D7B425E6E80D98BB214B49A06CBA657504BB58891FB15A52330565BCE0110F43`；Growth11包含其中。002980独立主只读parse两raw均success=true/allassertionspassed/0fail/pending/todo；不是第二人独审。5dd209 feature project全TS(noEmit/incremental false)和14本段tests/helper scoped ESLint(maxwarnings0)实际exit0。f773f3/此前binder核验实际unique52、18冻结、helper旧前缀、11旧test文件932个历史matcher及其参数未删除/减少、七docs旧prefix原样、diffcheck0；0bbe11七旧source逆向/root四/SQL0055保持。matcher计数不替代整个测试主体的独立语义审查。

新增完成build `proposal-edit-http.test.ts`：真实Auth cookies/Next/PG、三owner XP500/Level4、受控loopback合成AI、认证先行/headers/UTF8/owner/clue检查、同key重放/在途202/不同key409/旧assess阻断、失败原pending保持、历史完整facts/provenance/原文不变、旧Confirm失效及新Confirm唯一XP/root-ledger修正分钟审计。**该新HTTP文件当前只经TS/lint，尚未启动完成build或执行其业务用例，不计入941/461，不称真实AI验收。**

失败历史完整保留：governance v1 session77373→644fe8终态exit1，930passed/11failed/0skip/unhandled，raw SHA256 `32CAE48DC0D2B9ECBA721338E869EACD6F039415DED891578BC4E43514D0AB0A`。九处重复visual失败为旧loader硬编码checkout/node_modules缺失；用仅actual18+strict52的新分支解析真实已安装tailwindcss/index.css，保留原loader/所有编译断言，不安装或重链接共享deps。一处新保护清单错误使用不存在的growth-engine/engine.ts，改为实际xp/levels/mastery/quest四源并扩展milestone保护；一处Reject实际分支误仍调用旧Evidence scope，纠正为18 strict rejection固定范围，原断言不减。HTTP hold回调两次TS2349（010de5/690132）为夹具闭包控制流narrowing，改独立releaseHeld函数；账本断言静态核对实际modifier_json/factEffectiveMinutes字段。均未改生产以迁就测试。旧HTTP与真实AI/fullbuild证据仍未获得。

本段无DB/浏览器/真实模型请求、无正式0055/新build/commit/PR/独审。主定向UI有自有loopback native-fetch测试，不伪称所有测试完全无HTTP；每例finally只关闭自己server/socket。002980只读Docker旧project过滤仍0容器/0卷；feature .next、feature node_modules及taskvalidationcache均absent，未产生可删的大型构建缓存/新栈。小型报告/runner保留作证据，不删除共享deps/备份/旧预览；原3019、正式0054和root四保护不变。

最终a35ddb在本段状态文档更新后再次实际52/diffcheck/helper与七docs旧prefix/932matcher、七旧source逆向、root四/18/0055/hash复核通过。84bc5c只读/proc核对本段两个runner及feature cwd的Vitest worker，taskTestResidual=[]/exit0；不宣称全机零Next进程，未终止或探测其他服务环境变量。没有需要删的新task栈/大型cache，报告与可恢复source保留。仍需下一段完整build及隔离验收，未签候选GO。

## 必须继续的工作（本段更新）

### 新 runtime / build / 真实 HTTP 定向与环境中断（后续阶段）

新project `phase8f_test_edit_runtime_20261011`、workdir `.data/proposal-edit-runtime-stack`，57346→3a4427终态0创建全新四容器；原ID/Created/labels/API54331+DB54332记录在`.data/proposal-edit-runtime-creation.json`，不是此前已销毁旧栈。NEW feature-local node_modules链接57b39f复用`.data/site-new-user-guide-live/node_modules`，无安装、无共享依赖写。Turbopack build84979→1c062f终态0，BUILD_ID `VK5zHdQkcGxEEMJHjzV61`，实际child0/null/null与全source before/after相等见`.data/proposal-edit-runtime-build-v1.json`；只编入合成公开Supabase tuple，没有真实AI或server secret参与build。

主定向v1 95469→11b5a6终态1：10files205pass/1fail/0unhandled，raw SHA256 `FC2ADC5E2B42DFBF86ED5E22C87498037A7ED0CC041CC06B2CE0B813344F749F`。唯一失败为新HTTP Confirm后的旧表parity误将冻结0042正常新增Evidence排除；原settlement.service证据payload与0042:451..456精确来源核实后，仅新HTTP测试增加唯一E0/learning/self-report/owner/Activity/skill/原verified协议及全部旧Evidence不变断言，不改生产或0055。v2 78040→411ee5实际exit0、10files206/206零skip/unhandled，SHA256 `5E26340DABFE59E8BC335ED5B3FD00B9C61A40084A1883103CF750E0304834AE`。分项authority45/concurrency9/newHTTP16/context13/rejection37/Evidence10/activity29/guide13/skills16/8F18，不能将其等同整项目全套。

旧HTTP receipts字段不同，以原build source集合和同一fresh creation导出有可追溯derivedFromSHA的兼容receipt（context sourceHashes恰好24、rejection原精确集合、guide/activity productionHashes及公开tuple）；未伪造GITHUB_ACTIONS或绕过其所有权/config/source检查。所有credentials仅CLI管道→子进程内存，无root dotenv或真实模型请求。

full-v1 52462→865e22外层exit1，无JSON/childterminal、log0；2026-10-11 19:23:54 WSL kernel实际OOM MainThread9673 anonRSS约12.5GB、随后WSL重启。PID归属未可靠捕获，不能归咎生产或某审查进程，也不能称完整suite失败用例已定位或已通过；本次full结果unknown，空log/现有derivedreceipts保留。暂停重型并发，后续只任务heap限额+maxWorkers1串行，不动全局WSL配置/未知process。四task容器与正式容器ID仍原样，重启后自动running；不把Docker重启误说成无运行影响。3019匿名probe一度ECONNREFUSED，使用accepted原源码/原build/config启动器恢复，保留历史start/handoff，另记新restartreceipt；没有新build、正式迁移或模型调用。

本段尚无完整suite/Chrome/freshRisk2候选GO、未commit/PR/正式0055。新stack/build仍用于后续验收，不能套用前段task0/cacheabsent；须全部客户端退出、审查直接永久释放后精确owned销毁。上述历史已通过/未通过证据边界均保留。

- SQL0055基础已主测，私有读取/store/GET/context/AI adapter/POST/client/editor/history已实现且主定向461通过；继续治理闭包，并在最终源码冻结后重建全栈复验。
- 服务器与模型接线须完成build真实HTTP，独立限量真实AI另验；现有407不替代全套或真实模型证明。
- 表单/互斥/恢复/History已主定向验证；仍需完成build真实HTTP、四宽Chrome与完整结算/失败/取消验收。
- 52路径/35markers治理主回归已通过；最终freeze/hash及fresh Risk2独立语义/反例审查仍待。
- 隔离真实PG并发/populated基线/完成buildHTTP，主full/Growth/E2E/type/lint/build/四宽真实Chrome。
- fresh Risk2候选独立复现/永久DB释放/owned disposal/冻结52；selectedcommit/ownCI/不同fresh committedFINAL/普通merge/postmainCI。
- 正式0055当前批准与新备份/恢复/迁移独审另行；新预览验收和精确临时清理。

已有本机3019、正式0054、root用户修改、共享依赖和备份继续保留；Artifact双延期、现实零积分、对外部署暂缓不变。Verifier、附件与最新整站13步骤仍不得冒称完成。

<!-- BEGIN PROPOSAL_FACT_EDIT_FIXTURE_AMENDMENT -->
用户已授权并经 fresh Risk2 独立 ADMISSION GO：本次范围只从原52扩为严格53；唯一新增路径为 tests/assessment-context-api.test.ts。
冻结18 canonical SHA256 BF9CFA5BC25677A75489C6B0DD7238221ABB44F0A9FB290E83E5C8ADCBCC1019；accepted base 229c09f122d3f0cb31fd02ff3ade53b27d06566d；tree ae8316f16cab5e9ad13005bef135ee552197531a；MARKERS35不变。
新增文件仅允许 fixture 类型增加 hasProposalFactEdit:ReturnType<typeof vi.fn>，以及 fixture 对象增加 hasProposalFactEdit:vi.fn().mockResolvedValue(false)。去除这两处精确增加后必须逐字 canonical 还原 accepted base 全文件；不得修改任何旧断言、用例、错误预期或其余代码。
working、完整PR、current-main及全部历史投影统一要求原52加唯一该路径，不保留52旁路；修订块缺失、重复、篡改，任一路径缺失、任何第54路径、旧文件逆向不一致均 fail-closed。生产缺少检查端口仍 fail-closed，不得用 fallback 迁就夹具。
本块独立 canonical hash 固定绑定，不对可追加运行证据的19全文自引用；原18正文保持冻结。ADMISSION不等于实现验收、候选GO、committed FINAL、merge或整站完成。
<!-- END PROPOSAL_FACT_EDIT_FIXTURE_AMENDMENT -->

### corrective runtime 历史与重验边界

full-v2 session39664→1299f6实际child1/null/null：143files、3997pass/8fail/2skip、0unhandled，raw SHA256 299130858C5DE318037CC8653CC8232352BCF75902BD44FEB12065CE0F3F32D7。8失败来自旧assessment-context-api fixture缺新增只读检查端口，生产正确fail-closed；不因此开放端口缺失fallback。2skip为旧仅CI=true启用的并发测试，后续仍在精确合成栈中设置CI=true，并不伪造GITHUB_ACTIONS或绕过所有权门禁。

浏览器主v1..v3为定位器/布局等待等harness失败，v4完成部分真实流程后暴露真实P1：全局refreshDashboard在503时清空dashboard，真实父页面卸载Pending/editor，已保存回执丢失。既有UI16模拟shell未覆盖该父组件生命周期；原build/206/full-v2/部分浏览器均只历史证据，不能作为修后绑定。修复只在原允许Pending内自有可取消GET，成功才发布snapshot；AppShell与DashboardPage不改，正式DB未写。本次Chrome会话随后已不在，不能冒称仍有可复用现场；owned v2 test server已按原PID/工作目录SIGTERM，仍须终态及后续精确环境清理。

主corrective v12 75532→2119d9为8files462/462；增加关闭/卸载后迟到snapshot不写回两例后v13 4308→756806为464/464，皆0skip/unhandled。首次完整production lint20851→7addde发现5个React错误：Editor直接改memory prop、Pending render读ref；此前仅tests scoped lint不能替代生产lint。修为每item内存external store的不可变snapshot、useSyncExternalStore订阅，store仅parent state持有、不浏览器持久化；原key/facts/result恢复与界限保持，原16断言未弱化。最终v14 36511→8e896a为8files464/464；完整TS1ead23 exit0、六修后source/tests/helper lint30010→cd224d exit0/零warning。原TS2353测试fixture多写PlayerState不支持stress已删除，之前以链式终态0掩盖的类型错误不作通过证据。

governance-v3 63403→94e628终态0：12files942/942、0skip/unhandled，包含修订块缺失/重复/篡改/不可读、exact53与新增旧夹具逆向断言；966历史matcher参数与七docs prefix/accepted helper完整prefix均主只读binder验证。build-v2 55671→d27dee虽child0/null/null，但随后memory写法纠正改变源码，故只历史构建，**不是当前build绑定**；另建v3。v2浏览器server23808→093e56退出1，原因关闭HTTP/Next后末尾source绑定改为不存在的新build-v2 receipt导致receipt阶段抛错；后续实际/proc无该PID。未生成v2 closed receipt，不编造关闭终态0；后续server捕获启动build并明确sourceChanges，避免关闭审计随当前build pointer漂移。没有重用旧browser/server关闭证明。

### corrected build-v3 / Chrome-v5 / PG parity（主执行）

build-v3 19962→7594c6 child0/null/null，BUILD_ID `WQPlTjOYzDkMzQHrmSS_a`，347 sources启动/完成一致，receipt `.data/proposal-edit-runtime-build-v3.json` SHA256 `B338DED0D5C022172BEE6DB1DB4C19FDABC3E24CAF4F4AB958BD8C8FAEAE7545`。正式/root dotenv或真实AIkey未参与，只有实际task公开tuple编入。主v14 464 rawSHA `5E0A58B231FEC44837231865C5C62E95C208904F2E4C5863BDB16F55A046E6B7`，42b587再验七production逆向/18/0055/root四及966旧matcher/七docs原前缀/diffcheck。

fresh browser fixture-v3三owner/38个user_id表/原XP500 Level4、Statistics M8、旧Evidence/奖励Main200/Wish100/outer provenance。Chrome-v5 f41c94实际exit0：51布尔检查、8几何行（Editor/History各320/390/768/1440）、4真实native Tab、3成功revision/1新Confirm、25业务HTTP请求、0pageerror。真实打开/取消focus回位、旧建议本项Confirm/Reject互斥/其他项可用、原文本script不执行、原120分钟保留/新35分钟、历史来源/状态与中文错误；模型invalid502、实际后台201后丢客户端响应→原keyGET核实且不再POST/AI、实际新201后dashboardGET503→回执保留/旧项禁ConfirmReject均通过。受控loopback合成AI四dispatch/temperature0/消息预算有效，绝非真实AI供应商验证。raw `.data/proposal-edit-browser-flow-v5.json` SHA256 `593768075F65C81E19753466544434ED17878796E2AB09546018B9CA43378927`；8截图存output/playwright/proposal-edit-*.png，几何通过不冒称浏览器全站验收。

PG复核 fefdc8终态0/ROLLBACK/end：`.data/proposal-edit-browser-db-proof-v5.json` SHA256 `262D763DE4EDDEBA7D465024754FFFA44A8655A437F2C2650F9970F46E6B0D8A`；实际冻结Growth/similarity/levels模块内存执行重算一次历史同技能同type重复、有效35分钟→XP12，skill/player512/Level4，两新审计表3revision/4request含1failed、3新assessment、仅一新ledger及原settle协议一E0 Evidence。foreign三owner中的另两owner全部38表逐项不变；旧records/原raw/120分钟/其他Core/奖励/Mastery/outer/Wish精确保持。首次verify e1d533对Confirm原last_used_at更新过强忽略导致失败；参照冻结0042的v_now改为显式与ledger.created_at相等及其余列不变，另修player_states按user_id查行；加强后139da0错误使用报告不存在saved.result字段，再按actual saved.assessment修复。两次harness错误不算产品失败或通过证据，不改production/SQL，不弱化原旧行断言。

Chrome456986已关闭；owned server-v3 74962→93fa70 exit0，自有Next/HTTP/合成AI全关、sourceChanges=[]，closed receipt SHA256 `7C94044A7493D0B056BBB35BF3A1A869E9BD6DA50493048E4F22EFB1CF15E438`。旧v2退出1没有伪造closed receipt。正式3019仍独立；随后仅main full-v3访问合成栈，尚未给reviewer DB grant。

实际package harness命令35aa96 exit0：`pnpm --config.verify-deps-before-run=false harness:deterministic --no-cache --maxWorkers 1`，Growth11/11。默认pnpm11首次7ccfbd尝试自动deps检查/install并因NO_TTY在purge前中止，已核验共享node_modules realpath与Vitest文件仍在；第二次00d246直接option不被CLI识别；读取本机pnpm源码后只本次命令关闭install-before-run，不写全局配置/不安装或删除共享依赖。Vite现有configLoader future警告保留，没有为抹警告改冻结配置。full-v3 84257当前运行，尚无完整终态/候选GO；本次cache约115.99MiB只盘点，等待main/reviewer永久release后删除。

### 最终 corrective 主终态、独立执行与 owned 清理（待候选离线裁决）

full-v3 84257→e55600实际终态exit0，child.status0/signalnull/errornull；143个真实testResults、4011个assertions全部passed，零fail/pending/todo/skipped/unhandled。内部describe suite计数不当文件数；Duration1047.94s。raw `.data/proposal-edit-runtime-full-v3.json` SHA256 `D673EA067011FE31AB4CC987CFDB34469FC25F297AE2CC2A27357FAC9ED9C477`。旧context API21全部通过；原8失败及两个旧CI-only用例不再失败/跳过，原断言完整。完整项目ESLint --max-warnings0 44100→25236d终态0/零warning；先前全TS0、Growth11、全量包含E2E11与修后UI19/新HTTP16均为主执行证据。

主c32c12在12:30:11.757Z严格解析raw/terminal/counts，核验当前347source逐项与build-v3相符、taskClientResidual=[]。`.data/proposal-edit-runtime-main-handoff.json` SHA256 `92E14E020C642F22BA645208A1E264F3B27939592C9A337F5F8E50CFC855A8BD`。随后显式DB_ACCESS_GRANTED交Herschel独占原四ID/Created合成栈；main不再DB/HTTP，仅offline lint/文件和进程归属读取。root三计划追加首次标题锚点错误原子失败、未写文件，已正确重试，不是产品finding。末次完整lint进程终态另告审查，不把它误算未关DB客户端。

Herschel独立终态直接回复：12files246/246、零skip/fail/unhandled、外层exit0，含原10file206+旧API21+UI19；其另243项只读SQL断言通过、19个installed prosrc、RLS/权限、0050来源、Unicode25和冻结八奖励150/100/150/200/200/100/150/250通过，ROLLBACK/客户端关闭。347sources再核对不变，12:40:17Z任务PID210386/210433及登记PID皆不存在、candidate cwd残留空；直接DB_ACCESS_COMPLETE_PERMANENT，此后无DB/HTTP。独立回执仅stdout：runtime SHA256 `7CB9B97609F26CE51A769CCBF25D466A2E562447F351A2088D40FD104A21E36B`，SQL SHA256 `ECC6E9E1BADA48329EB8286D4A7D04D79260146B0836CE56B058205439539EBC`，不是主生成JSON或主再次执行。三次独立SQL夹具失败（返回类型、函数名数字匹配、CRLF比较）保留为reviewer harness历史，不算产品finding或通过证据。先前独立offline459/176内存及当前actual store+React17属于其另行证据；两旧OOM会话UNKNOWN仍保留，不补称终态。

永久释放来源为实际wait_agent返回的reviewer原文，无可核实自动submission/messageID；session31404只是运行会话。主release记录明确referenceKind为观察到的工具返回文本，不伪造释放工具ID。`.data/proposal-edit-runtime-review-release.json` SHA256 `1727BF3438A37C7C174814A290DC05741C45AEC450376A0FDCD3E5E64829E0A4`绑定原creation SHA A9489D4A0B6F3D582A392678F0B1D8A86D68913359D6F665B7045980E06E285D及上述两stdout SHA。

主owned disposal 29656→347e2e终态0，12:41:25.306Z按原四完整ID/Created/project/workdir/API54331/DB54332与唯一精确卷核验，supabase stop --no-backup仅该workdir。task4containers/1volume→0/0，nonTask容器id/name/state逐项不变；未kill未知Next/DSH/旧预览，未global prune。删除唯一验证realpath且非symlink的feature `.next/cache` **121623728 bytes（约115.99MiB）**；构建BUILD_ID与其余编译输出/source保留，缓存可重建。临时合成数据库整卷已销毁，不能当正式恢复备份；其可重建。`.data/proposal-edit-runtime-disposal.json` SHA256 `2529CFEF5DAA96D01E3AC83910BA6C6AA6B0D6DAB76A7F7545DF4E58925DD113`。正式0054、完整cluster.tar备份、共享依赖、密钥和root四保护文件未动；小型审计报告保留。

本节是main终态与独立执行报告的准确归属；最终严格53文件hash、19全文与七旧docs前缀待同一Risk2离线重新绑定，不预签candidate GO。冻结18与唯一修订块保持原hash、MARKERS35不变；未来selected53 commit/own exactheadCI/不同fresh committedFINAL及其新栈清理/普通merge/postmainCI依序执行。正式0055尚无当前批准，必须新备份/恢复演练/迁移独审后另行；现有3019维持accepted229c。真实供应商AI、Verifier、附件及最新整站13步未由本切片证明；不称网站完成或部署。
